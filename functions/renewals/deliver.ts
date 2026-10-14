import { createHmac, randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { q, WebhookRow, AccountRow } from './db';

// =====================================================
// Channel adapters + outbound webhooks.
//
// Each adapter takes a rendered message and a target and returns a
// DeliveryResult. Adding a channel means adding an adapter here; the
// scheduler never needs to change (brief §6, per-channel adapters).
//
//   email     SMTP, e.g. Mailgun (SMTP_HOST/PORT/USER/PASS, EMAIL_FROM),
//             or Resend (RESEND_API_KEY, EMAIL_FROM) when SMTP is not set
//   slack     Slack incoming-webhook URL
//   teams     Microsoft Teams incoming-webhook / Workflows URL
//   whatsapp  \  relayed through the account's relay webhook(s), so n8n,
//   sms       /  Make or Zapier deliver them (no Meta / SMS onboarding)
//   webhook   a specific rr_webhooks endpoint ("CRM / webhook" channel)
// =====================================================

export interface DeliveryResult {
  ok: boolean;
  /** true when the failure is worth retrying (network, 429, 5xx) */
  transient?: boolean;
  providerRef?: string;
  error?: string;
}

export interface OutboundMessage {
  subject: string;
  text: string;
  short: string;
  html: string;
}

const FETCH_TIMEOUT_MS = 10_000;

/**
 * User-supplied URLs (webhooks, Slack/Teams) must be public HTTPS. Block
 * loopback, link-local (cloud metadata) and private ranges so an endpoint
 * cannot be pointed back into the hosting network.
 */
export function isPublicHttpsUrl(u: string): boolean {
  let url: URL;
  try { url = new URL(u); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return false;
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return false;
  }
  if (host.includes(':') && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80'))) return false;
  return true;
}

async function post(url: string, body: string, headers: Record<string, string>): Promise<{ status: number; text: string }> {
  if (!isPublicHttpsUrl(url)) throw new Error('Destination must be a public https:// URL');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'CloudStep-Renewals/1.0', ...headers },
    body,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'manual',
  });
  return { status: res.status, text: (await res.text().catch(() => '')).slice(0, 500) };
}

function classify(status: number, text: string): DeliveryResult {
  if (status >= 200 && status < 300) return { ok: true };
  return { ok: false, transient: status === 429 || status >= 500, error: `HTTP ${status}${text ? `: ${text}` : ''}` };
}

async function guarded(fn: () => Promise<DeliveryResult>): Promise<DeliveryResult> {
  try {
    return await fn();
  } catch (e: any) {
    const message = e?.name === 'TimeoutError' ? 'Timed out' : (e?.message ?? String(e));
    return { ok: false, transient: !message.startsWith('Destination must'), error: message };
  }
}

// ---------------------------------------------------------------
// Email: SMTP (e.g. Mailgun) when configured, otherwise Resend
// ---------------------------------------------------------------

const smtpConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export function emailConfigured(): boolean {
  return !!process.env.EMAIL_FROM && (smtpConfigured() || !!process.env.RESEND_API_KEY);
}

let transport: nodemailer.Transporter | null = null;

function smtp(): nodemailer.Transporter {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,          // 587 upgrades with STARTTLS
      requireTLS: port !== 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      pool: true,
      maxConnections: 3,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transport;
}

async function sendViaSmtp(from: string, to: string, msg: OutboundMessage, replyTo?: string | null, idempotencyKey?: string): Promise<DeliveryResult> {
  try {
    const info = await smtp().sendMail({
      from,
      to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      ...(replyTo ? { replyTo } : {}),
      ...(idempotencyKey ? { headers: { 'X-CloudStep-Delivery': idempotencyKey.slice(0, 200) } } : {}),
    });
    if (info.rejected?.length) return { ok: false, transient: false, error: `Rejected: ${info.rejected.join(', ')}` };
    return { ok: true, providerRef: info.messageId };
  } catch (e: any) {
    // SMTP 4xx and connection problems are temporary; 5xx are permanent.
    const code = Number(e?.responseCode);
    const transient = !code || (code >= 400 && code < 500);
    return { ok: false, transient, error: `SMTP ${code || e?.code || ''}: ${String(e?.response ?? e?.message ?? e).slice(0, 300)}` };
  }
}

export async function sendEmail(
  to: string,
  msg: OutboundMessage,
  opts: { replyTo?: string | null; fromName?: string | null; idempotencyKey?: string } = {},
): Promise<DeliveryResult> {
  if (!emailConfigured()) {
    return { ok: false, transient: false, error: 'Email provider not configured (SMTP_* or RESEND_API_KEY, plus EMAIL_FROM)' };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, error: `Invalid email address: ${to}` };

  // White-label: keep the verified sending address, swap the display name.
  let from = process.env.EMAIL_FROM!;
  if (opts.fromName) {
    const addr = from.match(/<([^>]+)>/)?.[1] ?? from;
    from = `${opts.fromName.replace(/[<>"]/g, '')} <${addr}>`;
  }

  if (smtpConfigured()) return sendViaSmtp(from, to, msg, opts.replyTo, opts.idempotencyKey);

  return guarded(async () => {
    const headers: Record<string, string> = { Authorization: `Bearer ${process.env.RESEND_API_KEY}` };
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey.slice(0, 256);
    const body = JSON.stringify({
      from,
      to: [to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    });
    const { status, text } = await post('https://api.resend.com/emails', body, headers);
    const result = classify(status, text);
    if (result.ok) {
      try { result.providerRef = JSON.parse(text)?.id; } catch { /* ignore */ }
    }
    return result;
  });
}

// ---------------------------------------------------------------
// Slack / Teams incoming webhooks
// ---------------------------------------------------------------

export async function sendSlack(url: string, msg: OutboundMessage): Promise<DeliveryResult> {
  return guarded(async () => {
    const { status, text } = await post(url, JSON.stringify({ text: `*${msg.subject}*\n${msg.text}` }), {});
    return classify(status, text);
  });
}

export async function sendTeams(url: string, msg: OutboundMessage): Promise<DeliveryResult> {
  return guarded(async () => {
    // Accepted by classic incoming webhooks and by Workflows "post to a
    // channel when a webhook request is received".
    const card = {
      type: 'message',
      text: `${msg.subject}\n\n${msg.text}`,
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            { type: 'TextBlock', text: msg.subject, weight: 'Bolder', wrap: true },
            { type: 'TextBlock', text: msg.text, wrap: true },
          ],
        },
      }],
    };
    const { status, text } = await post(url, JSON.stringify(card), {});
    return classify(status, text);
  });
}

// ---------------------------------------------------------------
// Signed webhooks
// ---------------------------------------------------------------

export interface WebhookEvent {
  id: string;
  type: string;
  created_at: string;
  account_id: string;
  data: Record<string, unknown>;
}

export function makeEvent(accountId: string, type: string, data: Record<string, unknown>): WebhookEvent {
  return { id: randomUUID(), type, created_at: new Date().toISOString(), account_id: accountId, data };
}

/**
 * Signature: hex HMAC-SHA256 of `${timestamp}.${rawBody}` with the
 * endpoint secret, sent as `X-CloudStep-Signature: sha256=<hex>`.
 */
export function signPayload(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export async function postWebhook(hook: Pick<WebhookRow, 'id' | 'url' | 'secret'>, event: WebhookEvent): Promise<DeliveryResult> {
  const body = JSON.stringify(event);
  let last: DeliveryResult = { ok: false };
  // Up to 3 attempts with exponential backoff for transient failures.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise(r => setTimeout(r, 500 * 2 ** attempt));
    const ts = Math.floor(Date.now() / 1000).toString();
    last = await guarded(async () => {
      const { status, text } = await post(hook.url, body, {
        'X-CloudStep-Event': event.type,
        'X-CloudStep-Delivery': event.id,
        'X-CloudStep-Timestamp': ts,
        'X-CloudStep-Signature': `sha256=${signPayload(hook.secret, ts, body)}`,
      });
      return classify(status, text);
    });
    if (last.ok || !last.transient) break;
  }
  await q(
    `UPDATE public.rr_webhooks
        SET last_status = $2, last_error = $3, last_delivery_at = now(),
            consecutive_failures = CASE WHEN $4 THEN 0 ELSE consecutive_failures + 1 END
      WHERE id = $1`,
    [hook.id, last.ok ? 200 : null, last.ok ? null : last.error ?? 'failed', last.ok],
  ).catch(() => {});
  return last;
}

/** Fan an event out to every enabled endpoint subscribed to it. */
export async function emitEvent(account: Pick<AccountRow, 'id'>, type: string, data: Record<string, unknown>, skipHookIds: string[] = []): Promise<void> {
  const hooks = await q<WebhookRow>(
    `SELECT * FROM public.rr_webhooks
      WHERE account_id = $1 AND enabled AND ($2 = ANY (events) OR '*' = ANY (events))`,
    [account.id, type],
  );
  const event = makeEvent(account.id, type, data);
  await Promise.all(hooks.filter(h => !skipHookIds.includes(h.id)).map(h => postWebhook(h, event)));
}

/**
 * WhatsApp / SMS via the account's relay webhook(s). Succeeds if at least
 * one relay accepted the request.
 */
export async function sendViaRelay(
  accountId: string,
  channel: 'whatsapp' | 'sms',
  to: string,
  msg: OutboundMessage,
  meta: Record<string, unknown>,
): Promise<DeliveryResult> {
  const relays = await q<WebhookRow>(
    `SELECT * FROM public.rr_webhooks WHERE account_id = $1 AND enabled AND is_relay`,
    [accountId],
  );
  if (!relays.length) {
    return { ok: false, transient: false, error: `No relay webhook configured for ${channel === 'sms' ? 'SMS' : 'WhatsApp'}` };
  }
  const event = makeEvent(accountId, 'reminder.relay', {
    channel,
    to,
    message: channel === 'sms' ? msg.short : msg.text,
    subject: msg.subject,
    ...meta,
  });
  const results = await Promise.all(relays.map(r => postWebhook(r, event)));
  const ok = results.find(r => r.ok);
  if (ok) return { ok: true, providerRef: event.id };
  return { ok: false, transient: results.some(r => r.transient), error: results.map(r => r.error).join('; ') };
}

