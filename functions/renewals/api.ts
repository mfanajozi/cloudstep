import { createHash } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import * as E from '../../src/renewals/engine';
import { q, one, tx, roleFor, canWrite, AccountRow, RenewalRow, EntityRow, ChannelRow, WebhookRow } from './db';
import {
  Ctx, UserError, completeCycle, reopenCycle, snoozeRenewal, reconcileRenewal, brandFor,
} from './scheduler';
import { sendEmail, sendSlack, sendTeams, sendViaRelay, postWebhook, makeEvent, OutboundMessage } from './deliver';
import { storeAttachment } from './pages';

// =====================================================
// JSON APIs
//
//   /api/*  The CloudStep web app. Bearer = the user's Neon Auth session
//           JWT (the same token the Data API receives). Authorisation is
//           decided by the database's rr_role / rr_can_write.
//   /v1/*   Inbound integrations (n8n, Make, Zapier). Bearer = an account
//           API key created in Integrations; only its SHA-256 is stored.
// =====================================================

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

export function errorResponse(e: unknown): Response {
  if (e instanceof UserError) return json({ error: e.message }, e.status);
  const pgErr = e as { code?: string; message?: string };
  if (pgErr?.code === 'P0001' || pgErr?.code === '23514' || pgErr?.code === '23505') {
    return json({ error: pgErr.message }, 422);
  }
  console.error('[api]', e);
  return json({ error: 'Internal error' }, 500);
}

// ---------------------------------------------------------------
// Auth: app users
// ---------------------------------------------------------------

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

async function userFromRequest(req: Request): Promise<string> {
  const header = req.headers.get('authorization') ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) throw new UserError('Sign in required', 401);
  const jwksUrl = process.env.AUTH_JWKS_URL || process.env.NEON_AUTH_JWKS_URL;
  const base = process.env.AUTH_ISSUER || (process.env.NEON_AUTH_BASE_URL ? new URL(process.env.NEON_AUTH_BASE_URL).origin : '');
  if (!jwksUrl || !base) throw new UserError('Authentication is not configured on this branch', 503);
  jwks ??= createRemoteJWKSet(new URL(jwksUrl));
  try {
    const { payload } = await jwtVerify(header.slice(7).trim(), jwks, { issuer: base });
    if (!payload.sub) throw new Error('no sub');
    return payload.sub;
  } catch {
    throw new UserError('Your session has expired. Sign in again.', 401);
  }
}

async function requireRole(userId: string, accountId: string, allowed: string[]): Promise<string> {
  const role = await roleFor(userId, accountId);
  if (!role || !allowed.includes(role)) throw new UserError('You do not have access to do that.', 403);
  return role;
}

async function renewalForWrite(userId: string, renewalId: string): Promise<RenewalRow> {
  const r = await one<RenewalRow>(`SELECT * FROM public.rr_renewals WHERE id = $1`, [renewalId]);
  if (!r || !(await canWrite(userId, r.account_id, r.entity_id))) throw new UserError('Renewal not found', 404);
  return r;
}

async function body(req: Request): Promise<Record<string, any>> {
  try { return (await req.json()) as Record<string, any>; } catch { return {}; }
}

function testMessage(brand: string): OutboundMessage {
  const text = `${brand} test message. If you can read this, reminders sent to this channel will reach you.`;
  return {
    subject: `${brand}: test message`,
    text,
    short: text.slice(0, 160),
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px"><h2>Test message</h2><p>${E.escapeHtml(text)}</p></div>`,
  };
}

export async function handleAppApi(req: Request, path: string[], ctx: Ctx): Promise<Response> {
  try {
    const userId = await userFromRequest(req);
    const [, resource, id, action] = path; // ['api', resource, id, action]

    // POST /api/renewals/:id/{complete|reopen|snooze|reschedule|attachments}
    if (resource === 'renewals' && id && req.method === 'POST') {
      const r = await renewalForWrite(userId, id);
      switch (action) {
        case 'complete': {
          const b = req.headers.get('content-type')?.includes('multipart') ? Object.fromEntries((await req.formData()).entries()) : await body(req);
          const done = await completeCycle(r.id, { actor: userId, method: 'app', note: typeof b.note === 'string' ? b.note.slice(0, 1000) : null }, ctx);
          const file = b.file && typeof b.file !== 'string' ? (b.file as File) : null;
          let attachmentId: string | null = null;
          if (file && file.size) {
            attachmentId = await storeAttachment(file, { account_id: r.account_id, renewal_id: r.id, completion_id: done.completionId, cycle_no: r.cycle_no, uploaded_by: userId });
          }
          return json({ ok: true, completionId: done.completionId, nextDue: done.nextDue, attachmentId });
        }
        case 'reopen':
          return json({ ok: true, renewal: { id: (await reopenCycle(r.id, userId, ctx)).id } });
        case 'snooze': {
          const u = await snoozeRenewal(r.id, userId, ctx);
          return json({ ok: true, snoozedUntil: u.snoozed_until, snoozeCount: u.snooze_count });
        }
        case 'reschedule':
          await tx(c => reconcileRenewal(c, r.id, ctx), userId);
          return json({ ok: true });
        case 'attachments': {
          const form = await req.formData();
          const file = form.get('file');
          if (!file || typeof file === 'string') throw new UserError('Choose a file to upload.');
          const lastCompletion = await one<{ id: string }>(
            `SELECT id FROM public.rr_completions WHERE renewal_id = $1 AND reopened_at IS NULL ORDER BY completed_at DESC LIMIT 1`, [r.id]);
          const attId = await storeAttachment(file, {
            account_id: r.account_id, renewal_id: r.id,
            completion_id: form.get('attach_to') === 'completion' ? lastCompletion?.id ?? null : null,
            cycle_no: r.cycle_no, uploaded_by: userId,
          });
          return json({ ok: true, id: attId });
        }
      }
    }

    // GET /api/attachments/:id  → file download
    if (resource === 'attachments' && id && req.method === 'GET') {
      const a = await one<{ account_id: string; file_name: string; content_type: string; data: Buffer }>(
        `SELECT account_id, file_name, content_type, data FROM public.rr_attachments WHERE id = $1`, [id]);
      if (!a || !(await roleFor(userId, a.account_id))) throw new UserError('File not found', 404);
      return new Response(new Uint8Array(a.data), {
        headers: {
          'Content-Type': a.content_type,
          'Content-Disposition': `attachment; filename="${a.file_name.replace(/"/g, '')}"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // POST /api/channels/:id/test
    if (resource === 'channels' && id && action === 'test' && req.method === 'POST') {
      const ch = await one<ChannelRow>(`SELECT * FROM public.rr_channels WHERE id = $1`, [id]);
      if (!ch) throw new UserError('Channel not found', 404);
      await requireRole(userId, ch.account_id, ['owner', 'admin']);
      const acct = (await one<AccountRow>(`SELECT * FROM public.rr_accounts WHERE id = $1`, [ch.account_id]))!;
      const msg = testMessage(brandFor(acct).name);
      let res;
      switch (ch.type) {
        case 'email': res = await sendEmail(ch.target, msg, { fromName: brandFor(acct).name }); break;
        case 'slack': res = await sendSlack(ch.target, msg); break;
        case 'teams': res = await sendTeams(ch.target, msg); break;
        case 'whatsapp':
        case 'sms': res = await sendViaRelay(acct.id, ch.type, ch.target, msg, { test: true }); break;
        case 'webhook': {
          const hook = await one<WebhookRow>(`SELECT * FROM public.rr_webhooks WHERE id = $1 AND account_id = $2`, [ch.target, acct.id]);
          res = hook ? await postWebhook(hook, makeEvent(acct.id, 'test.ping', { channel_id: ch.id })) : { ok: false, error: 'Webhook endpoint not found' };
          break;
        }
      }
      await q(`INSERT INTO public.rr_deliveries (account_id, channel_id, channel_type, target, audience, status, subject, provider_ref, error)
               VALUES ($1,$2,$3,$4,'test',$5,$6,$7,$8)`,
        [acct.id, ch.id, ch.type, ch.target, res.ok ? 'sent' : 'failed', msg.subject, res.providerRef ?? null, res.error ?? null]);
      if (res.ok) {
        await q(`UPDATE public.rr_channels SET verified_at = now(), flagged = false, flagged_reason = NULL, consecutive_failures = 0 WHERE id = $1`, [ch.id]);
      }
      return json({ ok: res.ok, error: res.error ?? null });
    }

    // POST /api/accounts/:id/test-email  → primary email address
    if (resource === 'accounts' && id && action === 'test-email' && req.method === 'POST') {
      await requireRole(userId, id, ['owner', 'admin']);
      const acct = (await one<AccountRow>(`SELECT * FROM public.rr_accounts WHERE id = $1`, [id]))!;
      const to = String((await body(req)).to || acct.owner_email);
      const res = await sendEmail(to, testMessage(brandFor(acct).name), { fromName: brandFor(acct).name });
      await q(`INSERT INTO public.rr_deliveries (account_id, channel_type, target, audience, status, subject, provider_ref, error)
               VALUES ($1,'email',$2,'test',$3,'Test message',$4,$5)`,
        [acct.id, to, res.ok ? 'sent' : 'failed', res.providerRef ?? null, res.error ?? null]);
      return json({ ok: res.ok, error: res.error ?? null });
    }

    // POST /api/webhooks/:id/test
    if (resource === 'webhooks' && id && action === 'test' && req.method === 'POST') {
      const hook = await one<WebhookRow>(`SELECT * FROM public.rr_webhooks WHERE id = $1`, [id]);
      if (!hook) throw new UserError('Webhook not found', 404);
      await requireRole(userId, hook.account_id, ['owner', 'admin']);
      const res = await postWebhook(hook, makeEvent(hook.account_id, 'test.ping', { message: 'Hello from CloudStep Renewal Reminder', webhook_id: hook.id }));
      return json({ ok: res.ok, error: res.error ?? null });
    }

    // POST /api/members/:id/invite  → email the invite link
    if (resource === 'members' && id && action === 'invite' && req.method === 'POST') {
      const m = await one<{ account_id: string; email: string; name: string; role: string; invite_token: string; status: string }>(
        `SELECT * FROM public.rr_members WHERE id = $1`, [id]);
      if (!m) throw new UserError('Member not found', 404);
      await requireRole(userId, m.account_id, ['owner', 'admin']);
      if (m.status !== 'invited') throw new UserError('This person has already joined.', 409);
      const acct = (await one<AccountRow>(`SELECT * FROM public.rr_accounts WHERE id = $1`, [m.account_id]))!;
      const brand = brandFor(acct).name;
      const link = `${ctx.appUrl}/#/renewals/invite/${m.invite_token}`;
      const msg: OutboundMessage = {
        subject: `You're invited to ${acct.name} on ${brand} Renewal Reminder`,
        text: `${m.name || 'Hi'}, you've been invited to ${acct.name} as ${m.role}.\nAccept: ${link}`,
        short: `Invite to ${acct.name}: ${link}`,
        html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px;max-width:560px">
          <h2>You're invited to ${E.escapeHtml(acct.name)}</h2>
          <p>You've been added as <b>${E.escapeHtml(m.role)}</b> on ${E.escapeHtml(brand)} Renewal Reminder.</p>
          <p><a href="${E.escapeHtml(link)}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">Accept invitation</a></p>
          <p style="color:#64748b;font-size:12px">Sign in or create a CloudStep account with this email address, then the link adds you to the team.</p></div>`,
      };
      const res = await sendEmail(m.email, msg, { fromName: brand, replyTo: acct.reply_to_email });
      return json({ ok: res.ok, error: res.error ?? null, link });
    }

    // POST /api/admin/users/:id/notify  { kind: 'welcome' | 'reset', password?, loginUrl }
    // Platform admin only: email a user their sign-in details.
    if (resource === 'admin' && id === 'users' && action && path[4] === 'notify' && req.method === 'POST') {
      const admin = await one<{ ok: boolean }>(
        `SELECT true AS ok FROM public.users WHERE id = $1 AND role = 'admin' AND status = 'active'`, [userId]);
      if (!admin) throw new UserError('Administrators only', 403);
      const target = await one<{ email: string; name: string }>(
        `SELECT email, name FROM neon_auth."user" WHERE id::text = $1`, [action]);
      if (!target) throw new UserError('User not found', 404);
      const b = await body(req);
      const kind = b.kind === 'reset' ? 'reset' : 'welcome';
      const loginUrl = typeof b.loginUrl === 'string' && /^https?:\/\//.test(b.loginUrl) ? b.loginUrl : `${ctx.appUrl}/#/sign-in`;
      const password = typeof b.password === 'string' && b.password.length >= 8 ? b.password : null;
      const products: string[] = Array.isArray(b.products) ? b.products : [];
      const productNames = products.map(p => (p === 'journeys' ? 'Business Console' : p === 'renewals' ? 'Renewal Reminder' : p));
      const first = (target.name || '').split(' ')[0] || 'there';
      const subject = kind === 'welcome' ? 'Your CloudStep account is ready' : 'Your CloudStep password was reset';
      const lines = [
        `Hi ${first},`,
        kind === 'welcome'
          ? `An account has been created for you on CloudStep${productNames.length ? ` with access to ${productNames.join(' and ')}` : ''}.`
          : 'Your CloudStep password has been reset by an administrator.',
        `Sign in: ${loginUrl}`,
        `Email: ${target.email}`,
        ...(password ? [`Temporary password: ${password}`, 'You will be asked to choose a new password when you sign in.'] : []),
      ];
      const msg: OutboundMessage = {
        subject,
        text: lines.join('\n'),
        short: subject,
        html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px;max-width:560px;color:#0f172a">
          <h2 style="margin:0 0 12px">${E.escapeHtml(subject)}</h2>
          <p>Hi ${E.escapeHtml(first)},</p>
          <p>${E.escapeHtml(lines[1])}</p>
          <table style="font-size:14px;margin:12px 0"><tr><td style="color:#64748b;padding-right:12px">Email</td><td><b>${E.escapeHtml(target.email)}</b></td></tr>
          ${password ? `<tr><td style="color:#64748b;padding-right:12px">Temporary password</td><td><code style="font-size:15px">${E.escapeHtml(password)}</code></td></tr>` : ''}</table>
          <p style="margin:20px 0"><a href="${E.escapeHtml(loginUrl)}" style="background:#d8b75c;color:#07080a;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">Sign in to CloudStep</a></p>
          ${password ? '<p style="color:#64748b;font-size:12px">For your security you will choose a new password the first time you sign in.</p>' : ''}
        </div>`,
      };
      const res = await sendEmail(target.email, msg, { fromName: 'CloudStep' });
      return json({ ok: res.ok, error: res.error ?? null });
    }

    throw new UserError('Not found', 404);
  } catch (e) {
    return errorResponse(e);
  }
}

// ---------------------------------------------------------------
// Inbound integrations: /v1
// ---------------------------------------------------------------

interface ApiKeyRow { id: string; account_id: string; prefix: string; scopes: string[] }

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

async function apiKeyFromRequest(req: Request): Promise<ApiKeyRow> {
  const header = req.headers.get('authorization') ?? '';
  const key = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : (req.headers.get('x-api-key') ?? '').trim();
  if (!key.startsWith('csr_')) throw new UserError('Missing or malformed API key', 401);
  const row = await one<ApiKeyRow>(
    `UPDATE public.rr_api_keys SET last_used_at = now()
      WHERE key_hash = $1 AND revoked_at IS NULL RETURNING id, account_id, prefix, scopes`, [hashApiKey(key)]);
  if (!row) throw new UserError('Invalid or revoked API key', 401);
  return row;
}

const CATEGORY_KEYS = E.CATEGORIES.map(c => c.key) as string[];
const PRESET_KEYS = ['gentle', 'standard', 'aggressive', 'short', 'custom'];

function publicRenewal(r: RenewalRow, acct: AccountRow, ctx: Ctx) {
  return {
    id: r.id,
    entity_id: r.entity_id,
    name: r.name,
    category: r.category,
    due_date: r.due_date,
    recurrence: { unit: r.recurrence_unit, interval: r.recurrence_interval, anchor: r.anchor_mode },
    preset: r.preset,
    state: r.state,
    status: E.deriveStatus({
      state: r.state, dueDate: r.due_date, preset: r.preset as E.PresetKey, customOffsets: r.custom_offsets,
      recurrence: { unit: r.recurrence_unit as E.RecurrenceUnit, interval: r.recurrence_interval },
      holidayShift: r.holiday_shift ?? acct.holiday_shift, snoozedUntil: r.snoozed_until?.toISOString() ?? null,
      completedOneOff: r.completed_one_off,
    }, acct.timezone, ctx.now),
    responsible: { name: r.responsible_name, email: r.responsible_email, phone: r.responsible_phone },
    cycle_no: r.cycle_no,
    last_completed_at: r.last_completed_at,
    ack_url: `${ctx.publicUrl}/a/${r.ack_token}`,
  };
}

function validateRenewalInput(b: Record<string, any>, partial: boolean) {
  const out: Record<string, unknown> = {};
  const has = (k: string) => b[k] !== undefined;
  const template = has('template_key') ? E.findTemplate(String(b.template_key)) : undefined;
  if (has('template_key') && !template) throw new UserError(`Unknown template_key. Use one of: ${E.TEMPLATE_LIBRARY.map(t => t.key).join(', ')}`);

  if (!partial || has('name')) {
    const name = String(b.name ?? template?.name ?? '').trim();
    if (!name) throw new UserError('name is required');
    out.name = name.slice(0, 200);
  }
  if (!partial || has('category') || template) {
    const cat = String(b.category ?? template?.category ?? '');
    if (!CATEGORY_KEYS.includes(cat)) throw new UserError(`category must be one of: ${CATEGORY_KEYS.join(', ')}`);
    out.category = cat;
  }
  if (!partial || has('due_date')) {
    // Templates never supply a date: the caller must.
    if (!E.isValidDate(b.due_date)) throw new UserError('due_date is required as YYYY-MM-DD');
    out.due_date = b.due_date;
  }
  if (template) {
    out.template_key = template.key;
    out.recurrence_unit = template.recurrence.unit;
    out.recurrence_interval = template.recurrence.interval;
    out.anchor_mode = template.anchorMode;
    out.preset = template.preset;
    out.expects_attachment = template.expectsAttachment;
  }
  if (has('recurrence')) {
    const preset = E.RECURRENCE_PRESETS.find(p => p.key === b.recurrence);
    const rule = preset?.rule ?? (typeof b.recurrence === 'object' ? b.recurrence : null);
    if (!rule || !['once', 'day', 'week', 'month', 'year'].includes(rule.unit) || !(rule.interval >= 1 && rule.interval <= 120)) {
      throw new UserError(`recurrence must be one of ${E.RECURRENCE_PRESETS.map(p => p.key).join(', ')} or {unit, interval}`);
    }
    out.recurrence_unit = rule.unit;
    out.recurrence_interval = Math.round(rule.interval);
  }
  if (has('anchor_mode')) {
    if (!['fixed', 'completion'].includes(b.anchor_mode)) throw new UserError('anchor_mode must be fixed or completion');
    out.anchor_mode = b.anchor_mode;
  }
  if (has('preset')) {
    if (!PRESET_KEYS.includes(b.preset)) throw new UserError(`preset must be one of: ${PRESET_KEYS.join(', ')}`);
    out.preset = b.preset;
  }
  if (has('custom_offsets')) {
    if (!Array.isArray(b.custom_offsets)) throw new UserError('custom_offsets must be an array of whole days');
    out.custom_offsets = E.normaliseOffsets(b.custom_offsets);
  }
  for (const k of ['responsible_name', 'responsible_email', 'responsible_phone', 'notes']) {
    if (has(k)) out[k] = b[k] === null ? null : String(b[k]).slice(0, 2000);
  }
  if (has('state')) {
    if (!['active', 'paused', 'archived'].includes(b.state)) throw new UserError('state must be active, paused or archived');
    out.state = b.state;
  }
  if (has('entity_id')) out.entity_id = b.entity_id;
  return out;
}

export async function handleInboundApi(req: Request, path: string[], ctx: Ctx): Promise<Response> {
  try {
    const key = await apiKeyFromRequest(req);
    const acct = (await one<AccountRow>(`SELECT * FROM public.rr_accounts WHERE id = $1`, [key.account_id]))!;
    const actor = `api:${key.prefix}`;
    const needWrite = () => { if (!key.scopes.includes('write')) throw new UserError('This API key is read-only', 403); };
    const url = new URL(req.url);
    const [, resource, id, action] = path; // ['v1', resource, id, action]

    const ensureEntity = async (entityId: unknown) => {
      if (entityId === undefined || entityId === null) return;
      const ok = await one(`SELECT 1 FROM public.rr_entities WHERE id = $1 AND account_id = $2`, [entityId, acct.id]);
      if (!ok) throw new UserError('entity_id does not belong to this account', 422);
    };

    if (resource === 'ping') return json({ ok: true, account: { id: acct.id, name: acct.name } });

    if (resource === 'templates' && req.method === 'GET') {
      return json({ data: E.TEMPLATE_LIBRARY.map(t => ({ key: t.key, name: t.name, category: t.category, recurrence: t.recurrence, anchor_mode: t.anchorMode, preset: t.preset, description: t.description })) });
    }

    if (resource === 'entities') {
      if (req.method === 'GET') {
        const rows = await q<EntityRow>(`SELECT id, name, contact_name, contact_email, contact_phone, archived FROM public.rr_entities WHERE account_id = $1 ORDER BY name`, [acct.id]);
        return json({ data: rows });
      }
      if (req.method === 'POST') {
        needWrite();
        const b = await body(req);
        const name = String(b.name ?? '').trim();
        if (!name) throw new UserError('name is required');
        const row = await tx(c => one<EntityRow>(
          `INSERT INTO public.rr_entities (account_id, name, registration_number, contact_name, contact_email, contact_phone)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, contact_name, contact_email, contact_phone`,
          [acct.id, name.slice(0, 200), b.registration_number ?? null, b.contact_name ?? null, b.contact_email ?? null, b.contact_phone ?? null], c), actor);
        return json({ data: row }, 201);
      }
    }

    if (resource === 'renewals') {
      if (!id && req.method === 'GET') {
        const params: unknown[] = [acct.id];
        let where = `account_id = $1`;
        const entity = url.searchParams.get('entity_id');
        if (entity) { params.push(entity); where += ` AND entity_id = $${params.length}`; }
        const before = url.searchParams.get('due_before');
        if (before && E.isValidDate(before)) { params.push(before); where += ` AND due_date <= $${params.length}`; }
        const rows = await q<RenewalRow>(`SELECT * FROM public.rr_renewals WHERE ${where} ORDER BY due_date LIMIT 1000`, params);
        const status = url.searchParams.get('status');
        const data = rows.map(r => publicRenewal(r, acct, ctx)).filter(r => !status || r.status === status);
        return json({ data });
      }
      if (!id && req.method === 'POST') {
        needWrite();
        const b = await body(req);
        const fields = validateRenewalInput(b, false);
        await ensureEntity(fields.entity_id);
        const cols = Object.keys(fields);
        const row = await tx(c => one<RenewalRow>(
          `INSERT INTO public.rr_renewals (account_id, ${cols.join(', ')}) VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING *`,
          [acct.id, ...cols.map(k => fields[k])], c), actor);
        return json({ data: publicRenewal(row!, acct, ctx) }, 201);
      }
      if (id) {
        const r = await one<RenewalRow>(`SELECT * FROM public.rr_renewals WHERE id = $1 AND account_id = $2`, [id, acct.id]);
        if (!r) throw new UserError('Renewal not found', 404);
        if (!action && req.method === 'GET') return json({ data: publicRenewal(r, acct, ctx) });
        if (!action && req.method === 'PATCH') {
          needWrite();
          const b = await body(req);
          const fields = validateRenewalInput(b, true);
          await ensureEntity(fields.entity_id);
          if (!Object.keys(fields).length) return json({ data: publicRenewal(r, acct, ctx) });
          // A "permanent" date change moves the series too.
          if (fields.due_date && b.permanent === true) {
            fields.series_due = fields.due_date;
            fields.anchor_date = fields.due_date;
          }
          const keys = Object.keys(fields);
          const row = await tx(c => one<RenewalRow>(
            `UPDATE public.rr_renewals SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1 RETURNING *`,
            [r.id, ...keys.map(k => fields[k])], c), actor);
          return json({ data: publicRenewal(row!, acct, ctx) });
        }
        if (!action && req.method === 'DELETE') {
          needWrite();
          await tx(c => q(`DELETE FROM public.rr_renewals WHERE id = $1`, [r.id], c), actor);
          return json({ ok: true });
        }
        if (action === 'complete' && req.method === 'POST') {
          needWrite();
          const b = await body(req);
          const done = await completeCycle(r.id, { actor, method: 'api', note: typeof b.note === 'string' ? b.note : null }, ctx);
          return json({ ok: true, completion_id: done.completionId, next_due_date: done.nextDue });
        }
        if (action === 'snooze' && req.method === 'POST') {
          needWrite();
          const u = await snoozeRenewal(r.id, actor, ctx);
          return json({ ok: true, snoozed_until: u.snoozed_until });
        }
        if (action === 'deliveries' && req.method === 'GET') {
          const rows = await q(`SELECT id, cycle_no, channel_type, target, audience, status, subject, error, acknowledged_at, created_at
                                  FROM public.rr_deliveries WHERE renewal_id = $1 ORDER BY created_at DESC LIMIT 500`, [r.id]);
          return json({ data: rows });
        }
      }
    }

    throw new UserError('Not found', 404);
  } catch (e) {
    return errorResponse(e);
  }
}

