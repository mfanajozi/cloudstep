import * as E from '../../src/renewals/engine';
import { q, one, AccountRow, RenewalRow, EntityRow } from './db';
import { Ctx, brandFor, completeCycle, snoozeRenewal, UserError } from './scheduler';

// =====================================================
// No-login pages
//
//   /a/:ackToken   "Mark as done" (and snooze) from any reminder. The token
//                  is per-cycle and rotates on completion, so an old link
//                  can never complete a later cycle.
//   /p/:portalToken  Lightweight client portal for one entity.
//
// Actions are POST-only: link-preview bots and mail scanners fetch GET
// URLs, and a GET must never complete a compliance obligation.
// =====================================================

const MAX_UPLOAD = 10 * 1024 * 1024;
const ALLOWED_TYPES = /^(application\/pdf|image\/(png|jpeg|webp|heic)|application\/(msword|vnd\.openxmlformats-officedocument\.[a-z.]+|vnd\.ms-excel)|text\/plain)$/;

function page(brand: { name: string; color: string; logo: string | null }, title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${E.escapeHtml(title)} · ${E.escapeHtml(brand.name)}</title>
<style>
:root{--brand:${/^#[0-9a-f]{3,8}$/i.test(brand.color) ? brand.color : '#2563eb'};--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--bg:#f1f5f9;--card:#fff}
@media (prefers-color-scheme:dark){:root{--ink:#e2e8f0;--muted:#94a3b8;--line:#334155;--bg:#0b1120;--card:#111827}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
main{max-width:620px;margin:0 auto;padding:24px 16px}.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:24px;margin-bottom:16px}
h1{font-size:22px;margin:0 0 6px}h2{font-size:16px;margin:0 0 4px}.muted{color:var(--muted);font-size:13px}.brand{display:flex;align-items:center;gap:10px;margin-bottom:18px;font-weight:800}
.brand img{height:32px}.pill{display:inline-block;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;border:1px solid var(--line);margin-top:6px}
.btn{display:inline-block;width:100%;border:0;border-radius:12px;padding:14px 18px;font-weight:800;font-size:15px;cursor:pointer;background:var(--brand);color:#fff;margin-top:12px}
.btn.secondary{background:transparent;color:var(--ink);border:1px solid var(--line)}label{display:block;font-size:13px;font-weight:700;margin-top:14px}
input[type=file],textarea{width:100%;margin-top:6px;font:inherit;color:inherit;background:transparent;border:1px solid var(--line);border-radius:10px;padding:10px}
dl{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:14px 0 0;font-size:14px}dt{color:var(--muted)}dd{margin:0;font-weight:600}
.row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.ok{color:#059669}.bad{color:#dc2626}
footer{text-align:center;font-size:11px;color:var(--muted);margin-top:8px}
</style></head><body><main>
<div class="brand">${brand.logo ? `<img src="${E.escapeHtml(brand.logo)}" alt="">` : ''}<span>${E.escapeHtml(brand.name)}</span></div>
${body}
<footer>Secure link · no login required · every action is logged</footer>
</main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

const DEFAULT_BRAND = { name: 'CloudStep', color: '#2563eb', logo: null };

export async function storeAttachment(file: File, meta: {
  account_id: string; renewal_id: string; completion_id: string | null; cycle_no: number; uploaded_by: string;
}): Promise<string> {
  if (file.size === 0) throw new UserError('The file is empty.');
  if (file.size > MAX_UPLOAD) throw new UserError('Files must be 10 MB or smaller.');
  const type = file.type || 'application/octet-stream';
  if (!ALLOWED_TYPES.test(type)) throw new UserError('Upload a PDF, image, Word, Excel or text file.');
  const name = (file.name || 'attachment').replace(/[^\w.\- ()]/g, '_').slice(0, 180);
  const buf = Buffer.from(await file.arrayBuffer());
  const row = await one<{ id: string }>(
    `INSERT INTO public.rr_attachments (account_id, renewal_id, completion_id, cycle_no, file_name, content_type, size_bytes, data, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [meta.account_id, meta.renewal_id, meta.completion_id, meta.cycle_no, name, type, buf.length, buf, meta.uploaded_by],
  );
  return row!.id;
}

function fileFrom(form: FormData): File | null {
  const f = form.get('file');
  return f && typeof f !== 'string' && f.size > 0 ? f : null;
}

// ---------------------------------------------------------------
// Mark as done
// ---------------------------------------------------------------

async function loadByAck(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const r = await one<RenewalRow>(`SELECT * FROM public.rr_renewals WHERE ack_token = $1`, [token]);
  if (!r) return null;
  const acct = (await one<AccountRow>(`SELECT * FROM public.rr_accounts WHERE id = $1`, [r.account_id]))!;
  const entity = r.entity_id ? await one<EntityRow>(`SELECT * FROM public.rr_entities WHERE id = $1`, [r.entity_id]) : null;
  return { r, acct, entity };
}

function goneCard(): string {
  return `<div class="card"><h1>Nothing to do here</h1>
    <p>This reminder has already been marked as done, or the renewal was changed and a newer reminder replaced this link.</p>
    <p class="muted">If you think something is wrong, contact the person who set up the reminder.</p></div>`;
}

function renewalSummary(r: RenewalRow, entity: EntityRow | null, acct: AccountRow, ctx: Ctx): string {
  const status = E.deriveStatus({
    state: r.state, dueDate: r.due_date, preset: r.preset as E.PresetKey, customOffsets: r.custom_offsets,
    recurrence: { unit: r.recurrence_unit as E.RecurrenceUnit, interval: r.recurrence_interval },
    holidayShift: r.holiday_shift ?? acct.holiday_shift, snoozedUntil: r.snoozed_until?.toISOString() ?? null,
    completedOneOff: r.completed_one_off,
  }, acct.timezone, ctx.now);
  return `<span class="pill">${E.escapeHtml(E.STATUS_META[status].label)} · ${E.escapeHtml(E.daysLeftLabel(r.due_date, acct.timezone, ctx.now))}</span>
    <dl>
      <dt>Due</dt><dd>${E.escapeHtml(E.formatLongDate(r.due_date))}</dd>
      ${entity ? `<dt>Entity</dt><dd>${E.escapeHtml(entity.name)}</dd>` : ''}
      <dt>Category</dt><dd>${E.escapeHtml(E.categoryLabel(r.category))}</dd>
      <dt>Repeats</dt><dd>${E.escapeHtml(E.describeRecurrence({ unit: r.recurrence_unit as E.RecurrenceUnit, interval: r.recurrence_interval }))}</dd>
    </dl>`;
}

export async function ackGet(token: string, ctx: Ctx, notice?: string): Promise<Response> {
  const found = await loadByAck(token);
  if (!found || found.r.state === 'archived') return page(DEFAULT_BRAND, 'Reminder', goneCard(), 404);
  const { r, acct, entity } = found;
  const brand = brandFor(acct);
  const today = E.todayIn(acct.timezone, ctx.now);
  const canSnooze = r.state === 'active' && r.snooze_count < E.MAX_SNOOZES && r.due_date >= today;
  const body = `
    ${notice ? `<div class="card bad">${E.escapeHtml(notice)}</div>` : ''}
    <div class="card">
      <h1>${E.escapeHtml(r.name)}</h1>
      ${renewalSummary(r, entity, acct, ctx)}
      <form method="post" action="${ctx.publicUrl}/a/${token}" enctype="multipart/form-data">
        <input type="hidden" name="action" value="done">
        ${r.expects_attachment ? `<label>Attach the new certificate / document (optional, max 10 MB)<input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx,.xls,.xlsx,.txt"></label>` : ''}
        <label>Note (optional)<textarea name="note" rows="2" maxlength="1000" placeholder="e.g. reference number"></textarea></label>
        <button class="btn" type="submit">Mark as done</button>
      </form>
      ${canSnooze ? `<form method="post" action="${ctx.publicUrl}/a/${token}">
        <input type="hidden" name="action" value="snooze">
        <button class="btn secondary" type="submit">Snooze 3 days (${E.MAX_SNOOZES - r.snooze_count} left)</button>
      </form>` : ''}
    </div>`;
  return page(brand, r.name, body);
}

export async function ackPost(token: string, form: FormData, ctx: Ctx): Promise<Response> {
  const found = await loadByAck(token);
  if (!found) return page(DEFAULT_BRAND, 'Reminder', goneCard(), 404);
  const { r, acct, entity } = found;
  const brand = brandFor(acct);
  const action = String(form.get('action') ?? '');
  try {
    if (action === 'snooze') {
      const updated = await snoozeRenewal(r.id, 'link', ctx, token);
      const until = E.localDateHour(updated.snoozed_until!, acct.timezone).date;
      return page(brand, 'Snoozed', `<div class="card"><h1 class="ok">Snoozed</h1>
        <p>We'll remind you again on <b>${E.escapeHtml(E.formatLongDate(until))}</b>. ${E.escapeHtml(r.name)} is still due on ${E.escapeHtml(E.formatLongDate(r.due_date))}.</p></div>`);
    }
    if (action !== 'done') return ackGet(token, ctx, 'Unknown action.');

    const file = fileFrom(form);
    if (file && file.size > MAX_UPLOAD) return ackGet(token, ctx, 'Files must be 10 MB or smaller.');
    const note = String(form.get('note') ?? '').slice(0, 1000) || null;
    const done = await completeCycle(r.id, { actor: 'link', method: 'link', note, expectToken: token }, ctx);
    let uploadMsg = '';
    if (file) {
      try {
        await storeAttachment(file, { account_id: r.account_id, renewal_id: r.id, completion_id: done.completionId, cycle_no: r.cycle_no, uploaded_by: 'link' });
        uploadMsg = `<p class="ok">Your document was saved with this renewal.</p>`;
      } catch (e) {
        uploadMsg = `<p class="bad">Marked as done, but the document was not saved: ${E.escapeHtml((e as Error).message)}</p>`;
      }
    }
    return page(brand, 'Done', `<div class="card"><h1 class="ok">Marked as done ✓</h1>
      <p>${E.escapeHtml(r.name)}${entity ? ` for ${E.escapeHtml(entity.name)}` : ''} is complete for this cycle. All remaining reminders for it have been cancelled.</p>
      ${done.nextDue ? `<p>Next due: <b>${E.escapeHtml(E.formatLongDate(done.nextDue))}</b>. We'll start reminding you again ahead of that date.</p>` : `<p>This was a one-off renewal, so it has been archived.</p>`}
      ${uploadMsg}</div>`);
  } catch (e) {
    if (e instanceof UserError) {
      return e.status === 409 && /already/.test(e.message)
        ? page(brand, 'Reminder', goneCard(), 409)
        : ackGet(token, ctx, e.message);
    }
    throw e;
  }
}

// ---------------------------------------------------------------
// Client portal
// ---------------------------------------------------------------

async function loadPortal(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const entity = await one<EntityRow>(`SELECT * FROM public.rr_entities WHERE portal_token = $1 AND portal_enabled AND NOT archived`, [token]);
  if (!entity) return null;
  const acct = (await one<AccountRow>(`SELECT * FROM public.rr_accounts WHERE id = $1`, [entity.account_id]))!;
  return { entity, acct };
}

export async function portalGet(token: string, ctx: Ctx, notice?: { ok: boolean; text: string }): Promise<Response> {
  const found = await loadPortal(token);
  if (!found) return page(DEFAULT_BRAND, 'Portal', `<div class="card"><h1>Link not available</h1><p>This portal link is invalid or has been switched off.</p></div>`, 404);
  const { entity, acct } = found;
  const brand = brandFor(acct);
  const renewals = await q<RenewalRow>(
    `SELECT * FROM public.rr_renewals WHERE entity_id = $1 AND state <> 'archived' ORDER BY due_date`, [entity.id]);
  const history = await q<{ name: string; due_date: string; completed_at: Date; on_time: boolean }>(
    `SELECT r.name, c.due_date, c.completed_at, c.on_time FROM public.rr_completions c
       JOIN public.rr_renewals r ON r.id = c.renewal_id
      WHERE r.entity_id = $1 AND c.reopened_at IS NULL AND c.method <> 'skipped'
      ORDER BY c.completed_at DESC LIMIT 10`, [entity.id]);

  const items = renewals.map(r => `
    <div class="card">
      <div class="row"><div><h2>${E.escapeHtml(r.name)}</h2>${renewalSummary(r, null, acct, ctx)}</div></div>
      ${r.state === 'active' ? `<form method="post" action="${ctx.publicUrl}/p/${token}" enctype="multipart/form-data">
        <input type="hidden" name="renewal_id" value="${E.escapeHtml(r.id)}">
        <input type="hidden" name="cycle" value="${r.cycle_no}">
        ${r.expects_attachment ? `<label>Attach document (optional)<input type="file" name="file"></label>` : ''}
        <button class="btn" type="submit">Mark as done</button>
      </form>` : `<p class="muted">Paused by your service provider.</p>`}
    </div>`).join('');

  const body = `
    ${notice ? `<div class="card ${notice.ok ? 'ok' : 'bad'}">${E.escapeHtml(notice.text)}</div>` : ''}
    <div class="card"><h1>${E.escapeHtml(entity.name)}</h1>
      <p class="muted">Your renewals and compliance deadlines, managed by ${E.escapeHtml(brand.name === 'CloudStep' ? acct.name : brand.name)}.</p></div>
    ${items || '<div class="card"><p>No renewals are being tracked yet.</p></div>'}
    ${history.length ? `<div class="card"><h2>Recently completed</h2><dl>${history.map(h =>
      `<dt>${E.escapeHtml(E.formatLongDate(h.due_date))}</dt><dd>${E.escapeHtml(h.name)} ${h.on_time ? '<span class="ok">· on time</span>' : '<span class="bad">· late</span>'}</dd>`).join('')}</dl></div>` : ''}`;
  return page(brand, entity.name, body);
}

export async function portalPost(token: string, form: FormData, ctx: Ctx): Promise<Response> {
  const found = await loadPortal(token);
  if (!found) return portalGet(token, ctx);
  const { entity } = found;
  const renewalId = String(form.get('renewal_id') ?? '');
  const cycle = Number(form.get('cycle'));
  const r = await one<RenewalRow>(`SELECT * FROM public.rr_renewals WHERE id = $1 AND entity_id = $2`, [renewalId, entity.id]);
  if (!r) return portalGet(token, ctx, { ok: false, text: 'That renewal is not part of this portal.' });
  // Stale form (cycle already completed in another tab / by email link).
  if (cycle !== r.cycle_no) return portalGet(token, ctx, { ok: false, text: `${r.name} was already updated. Here is its current status.` });
  try {
    const file = fileFrom(form);
    const done = await completeCycle(r.id, { actor: `portal:${entity.id}`, method: 'portal', expectToken: r.ack_token }, ctx);
    if (file) {
      await storeAttachment(file, { account_id: r.account_id, renewal_id: r.id, completion_id: done.completionId, cycle_no: r.cycle_no, uploaded_by: `portal:${entity.id}` })
        .catch(e => console.error('[portal upload]', e));
    }
    return portalGet(token, ctx, { ok: true, text: `${r.name} marked as done.${done.nextDue ? ` Next due ${E.formatLongDate(done.nextDue)}.` : ''}` });
  } catch (e) {
    if (e instanceof UserError) return portalGet(token, ctx, { ok: false, text: e.message });
    throw e;
  }
}
