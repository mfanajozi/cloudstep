import type pg from 'pg';
import * as E from '../../src/renewals/engine';
import {
  q, one, tx, Queryable, pool as dbPool,
  AccountRow, RenewalRow, EntityRow, ChannelRow, WebhookRow, JobRow,
} from './db';
import {
  sendEmail, sendSlack, sendTeams, sendViaRelay, postWebhook, emitEvent, makeEvent,
  OutboundMessage, DeliveryResult,
} from './deliver';

// =====================================================
// The scheduler: Stage 2 (scheduling) → Stage 3 (dispatch) →
// Stage 4 (acknowledgement) → Stage 5 (rollover) of the brief.
// =====================================================

export interface Ctx {
  publicUrl: string; // this function's public origin, for Mark-as-done links
  appUrl: string;    // the CloudStep web app, for links into the console
  now: Date;
}

const MAX_JOBS_PER_ACCOUNT_PER_RUN = 100;
const MAX_ATTEMPTS = 5;

export const recurrenceOf = (r: Pick<RenewalRow, 'recurrence_unit' | 'recurrence_interval'>): E.Recurrence => ({
  unit: r.recurrence_unit as E.RecurrenceUnit,
  interval: r.recurrence_interval,
});

export function brandFor(acct: AccountRow): { name: string; color: string; logo: string | null } {
  if (E.planOf(acct.plan).whiteLabel && acct.brand_name) {
    return { name: acct.brand_name, color: acct.brand_color || '#2563eb', logo: acct.brand_logo_url };
  }
  return { name: 'CloudStep', color: '#2563eb', logo: null };
}

export function ackUrl(ctx: Ctx, r: Pick<RenewalRow, 'ack_token'>): string {
  return `${ctx.publicUrl}/a/${r.ack_token}`;
}

function primaryEmail(r: RenewalRow, entity: EntityRow | undefined, acct: AccountRow): string {
  return (r.responsible_email || entity?.contact_email || acct.owner_email || '').trim();
}

export function renewalPayload(r: RenewalRow, entity: EntityRow | undefined, ctx: Ctx, tz: string) {
  return {
    renewal: {
      id: r.id,
      name: r.name,
      category: r.category,
      entity: entity ? { id: entity.id, name: entity.name } : null,
      due_date: r.due_date,
      days_left: E.diffDays(E.todayIn(tz, ctx.now), r.due_date),
      cycle_no: r.cycle_no,
      recurrence: E.describeRecurrence(recurrenceOf(r)),
      responsible: r.responsible_name || r.responsible_email ? { name: r.responsible_name, email: r.responsible_email, phone: r.responsible_phone } : null,
      state: r.state,
    },
    ack_url: ackUrl(ctx, r),
  };
}

async function loadAccount(id: string, db: Queryable): Promise<AccountRow> {
  const a = await one<AccountRow>(`SELECT * FROM public.rr_accounts WHERE id = $1`, [id], db);
  if (!a) throw new Error(`Account ${id} not found`);
  return a;
}

async function watcherMemberCount(accountId: string, db: Queryable): Promise<number> {
  const r = await one<{ n: string }>(
    `SELECT count(*) AS n FROM public.rr_members WHERE account_id = $1 AND role = 'watcher' AND status = 'active'`,
    [accountId], db,
  );
  return Number(r?.n ?? 0);
}

// ---------------------------------------------------------------
// Stage 2 — scheduling
// ---------------------------------------------------------------

async function insertJob(db: Queryable, j: {
  account_id: string; renewal_id: string; cycle_no: number; kind: JobRow['kind']; seq: number;
  offset_days: number | null; tone: string; fire_at: Date; key: string; stage?: number | null; channel_filter?: string[] | null;
}) {
  await q(
    `INSERT INTO public.rr_jobs (account_id, renewal_id, cycle_no, kind, seq, offset_days, tone, fire_at, idempotency_key, stage, channel_filter)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (idempotency_key) DO UPDATE
        SET status = 'scheduled', fire_at = EXCLUDED.fire_at, attempts = 0, last_error = NULL, locked_at = NULL
      WHERE public.rr_jobs.status = 'cancelled'`,
    [j.account_id, j.renewal_id, j.cycle_no, j.kind, j.seq, j.offset_days, j.tone, j.fire_at, j.key, j.stage ?? null, j.channel_filter ?? null],
    db,
  );
}

/**
 * Rebuild the pending jobs of one renewal from the engine. Jobs already
 * sent are never touched (a date edit never recalls a sent nudge), and the
 * idempotency key stops a re-planned nudge from being sent twice.
 */
export async function reconcileRenewal(c: pg.PoolClient, renewalId: string, ctx: Ctx): Promise<void> {
  let r = await one<RenewalRow>(`SELECT * FROM public.rr_renewals WHERE id = $1 FOR UPDATE`, [renewalId], c);
  if (!r) return;
  const acct = await loadAccount(r.account_id, c);
  const tz = acct.timezone;
  const today = E.todayIn(tz, ctx.now);
  const reason = r.reschedule_reason;

  await q(`UPDATE public.rr_jobs SET status = 'cancelled' WHERE renewal_id = $1 AND status = 'scheduled'`, [r.id], c);

  // Resuming a paused renewal whose date has passed skips that cycle
  // (brief §4.4: pause = skip the current cycle without deleting).
  if (r.state === 'active' && reason === 'resumed' && r.due_date < today && r.recurrence_unit !== 'once') {
    const rec = recurrenceOf(r);
    const nextDue = E.firstOccurrenceFrom(r.anchor_date ?? r.due_date, rec, r.series_due ?? r.due_date, today);
    await q(
      `INSERT INTO public.rr_completions (account_id, renewal_id, cycle_no, due_date, completed_by, method, on_time, note, next_due_date, prev_anchor_date, prev_series_due)
       VALUES ($1,$2,$3,$4,'system','skipped',false,'Cycle skipped while paused',$5,$6,$7)`,
      [r.account_id, r.id, r.cycle_no, r.due_date, nextDue, r.anchor_date, r.series_due], c,
    );
    r = (await one<RenewalRow>(
      `UPDATE public.rr_renewals
          SET due_date = $2::date, series_due = $2::date, cycle_no = cycle_no + 1, ack_token = public.rr_token(),
              snooze_count = 0, snoozed_until = NULL, escalation_stage = 0
        WHERE id = $1 RETURNING *`,
      [r.id, nextDue], c,
    ))!;
  }

  if (r.state === 'active' && !r.completed_one_off) {
    const plan = E.planCycle({
      dueDate: r.due_date,
      recurrence: recurrenceOf(r),
      preset: r.preset as E.PresetKey,
      customOffsets: r.custom_offsets,
      overdueAlerts: r.overdue_alerts ?? acct.overdue_alerts,
      watchers: E.planOf(acct.plan).watchers && ((r.watchers?.length ?? 0) > 0 || (await watcherMemberCount(acct.id, c)) > 0),
      settings: { timeZone: tz, sendHour: acct.send_hour, holidayShift: r.holiday_shift ?? acct.holiday_shift },
      now: ctx.now,
    });

    const snoozedUntil = r.snoozed_until && r.snoozed_until > ctx.now ? r.snoozed_until : null;

    for (const p of plan) {
      if (p.inPast) continue; // no backfill
      if (snoozedUntil && p.kind === 'nudge' && p.fireAt < snoozedUntil) continue;
      await insertJob(c, {
        account_id: r.account_id, renewal_id: r.id, cycle_no: r.cycle_no, kind: p.kind, seq: p.seq,
        offset_days: p.offsetDays, tone: p.tone, fire_at: p.fireAt,
        key: `${r.id}:${r.cycle_no}:${p.kind}:${p.offsetDays}:${p.date}`,
      });
    }

    if (snoozedUntil) {
      const snoozeDate = E.localDateHour(snoozedUntil, tz).date;
      if (snoozeDate <= r.due_date) {
        const off = E.diffDays(snoozeDate, r.due_date);
        await insertJob(c, {
          account_id: r.account_id, renewal_id: r.id, cycle_no: r.cycle_no, kind: 'deferred', seq: 50 + r.snooze_count,
          offset_days: off, tone: E.toneFor(off), fire_at: snoozedUntil,
          key: `${r.id}:${r.cycle_no}:snooze:${r.snooze_count}`,
        });
      }
    }

    // Date moved earlier into the window: fire the applicable nudge now
    // unless one at least that urgent already went out this cycle.
    if (reason === 'date_earlier' && r.due_date >= today && !snoozedUntil) {
      const past = plan.filter(p => p.kind === 'nudge' && p.inPast);
      const latest = past[past.length - 1];
      if (latest) {
        const sent = await one<{ n: string }>(
          `SELECT count(*) AS n FROM public.rr_jobs
            WHERE renewal_id = $1 AND cycle_no = $2 AND status = 'sent' AND kind <> 'watcher'
              AND (offset_days IS NULL OR offset_days <= $3)`,
          [r.id, r.cycle_no, latest.offsetDays], c,
        );
        if (Number(sent?.n ?? 0) === 0) {
          await insertJob(c, {
            account_id: r.account_id, renewal_id: r.id, cycle_no: r.cycle_no, kind: 'immediate', seq: 0,
            offset_days: latest.offsetDays, tone: latest.tone, fire_at: ctx.now,
            key: `${r.id}:${r.cycle_no}:immediate:${r.due_date}`,
          });
        }
      }
    }
  }

  await q(`UPDATE public.rr_renewals SET needs_reschedule = false, reschedule_reason = NULL WHERE id = $1`, [r.id], c);
}

export async function reconcilePending(ctx: Ctx, limit = 500): Promise<number> {
  const ids = await q<{ id: string }>(
    `SELECT id FROM public.rr_renewals WHERE needs_reschedule ORDER BY updated_at LIMIT $1`, [limit],
  );
  let n = 0;
  for (const { id } of ids) {
    try {
      await tx(async c => {
        const locked = await one(`SELECT id FROM public.rr_renewals WHERE id = $1 AND needs_reschedule FOR UPDATE SKIP LOCKED`, [id], c);
        if (locked) { await reconcileRenewal(c, id, ctx); n++; }
      }, 'scheduler');
    } catch (e) {
      console.error('[reconcile]', id, e);
    }
  }
  return n;
}

// ---------------------------------------------------------------
// Stage 4/5 — acknowledgement and rollover
// ---------------------------------------------------------------

export class UserError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export async function completeCycle(
  renewalId: string,
  opts: { actor: string; method: 'app' | 'link' | 'portal' | 'api'; note?: string | null; expectToken?: string },
  ctx: Ctx,
): Promise<{ completionId: string; renewal: RenewalRow; nextDue: string | null }> {
  const out = await tx(async c => {
    const r = await one<RenewalRow>(`SELECT * FROM public.rr_renewals WHERE id = $1 FOR UPDATE`, [renewalId], c);
    if (!r) throw new UserError('Renewal not found', 404);
    if (opts.expectToken && r.ack_token !== opts.expectToken) throw new UserError('This reminder has already been actioned.', 409);
    if (r.state === 'archived' || r.completed_one_off) throw new UserError('This renewal is archived.', 409);
    const acct = await loadAccount(r.account_id, c);
    const today = E.todayIn(acct.timezone, ctx.now);

    const next = E.nextCycle({
      recurrence: recurrenceOf(r),
      anchorMode: r.anchor_mode,
      anchorDate: r.anchor_date ?? r.due_date,
      currentDue: r.due_date,
      seriesDue: r.series_due,
      completedOn: today,
    });

    const completion = await one<{ id: string }>(
      `INSERT INTO public.rr_completions (account_id, renewal_id, cycle_no, due_date, completed_by, method, on_time, note, next_due_date, prev_anchor_date, prev_series_due)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [r.account_id, r.id, r.cycle_no, r.due_date, opts.actor, opts.method, today <= r.due_date, opts.note ?? null,
       next?.dueDate ?? null, r.anchor_date, r.series_due], c,
    );
    await q(`UPDATE public.rr_jobs SET status = 'cancelled' WHERE renewal_id = $1 AND status = 'scheduled'`, [r.id], c);
    await q(`UPDATE public.rr_deliveries SET acknowledged_at = now() WHERE renewal_id = $1 AND cycle_no = $2 AND acknowledged_at IS NULL`, [r.id, r.cycle_no], c);

    let updated: RenewalRow;
    if (!next) {
      updated = (await one<RenewalRow>(
        `UPDATE public.rr_renewals
            SET state = 'archived', completed_one_off = true, last_completed_at = now(), ack_token = public.rr_token(),
                snoozed_until = NULL
          WHERE id = $1 RETURNING *`, [r.id], c))!;
    } else {
      updated = (await one<RenewalRow>(
        `UPDATE public.rr_renewals
            SET due_date = $2::date, series_due = $2::date, anchor_date = $3::date, cycle_no = cycle_no + 1,
                ack_token = public.rr_token(), snooze_count = 0, snoozed_until = NULL, escalation_stage = 0,
                last_completed_at = now(), needs_reschedule = true, reschedule_reason = 'rollover'
          WHERE id = $1 RETURNING *`, [r.id, next.dueDate, next.anchorDate], c))!;
    }
    await reconcileRenewal(c, r.id, ctx);
    return { completionId: completion!.id, renewal: updated, nextDue: next?.dueDate ?? null, acct, prevDue: r.due_date, onTime: today <= r.due_date };
  }, opts.actor);

  const entity = out.renewal.entity_id
    ? (await one<EntityRow>(`SELECT * FROM public.rr_entities WHERE id = $1`, [out.renewal.entity_id])) ?? undefined
    : undefined;
  await emitEvent(out.acct, 'renewal.completed', {
    ...renewalPayload(out.renewal, entity, ctx, out.acct.timezone),
    completed: { completion_id: out.completionId, due_date: out.prevDue, on_time: out.onTime, method: opts.method, note: opts.note ?? null },
    next_due_date: out.nextDue,
  }).catch(e => console.error('[event]', e));

  return { completionId: out.completionId, renewal: out.renewal, nextDue: out.nextDue };
}

/** Undo the most recent completion: the cycle and its remaining nudges come back. */
export async function reopenCycle(renewalId: string, actor: string, ctx: Ctx): Promise<RenewalRow> {
  const out = await tx(async c => {
    const r = await one<RenewalRow>(`SELECT * FROM public.rr_renewals WHERE id = $1 FOR UPDATE`, [renewalId], c);
    if (!r) throw new UserError('Renewal not found', 404);
    const last = await one<any>(
      `SELECT * FROM public.rr_completions
        WHERE renewal_id = $1 AND reopened_at IS NULL AND method <> 'skipped'
        ORDER BY cycle_no DESC, completed_at DESC LIMIT 1`, [r.id], c);
    if (!last) throw new UserError('There is no completed cycle to reopen.', 409);
    const expectedCycle = r.completed_one_off ? r.cycle_no : r.cycle_no - 1;
    if (last.cycle_no !== expectedCycle) throw new UserError('Only the most recent completion can be reopened.', 409);

    await q(`UPDATE public.rr_completions SET reopened_at = now(), reopened_by = $2 WHERE id = $1`, [last.id, actor], c);
    await q(`UPDATE public.rr_deliveries SET acknowledged_at = NULL WHERE renewal_id = $1 AND cycle_no = $2`, [r.id, last.cycle_no], c);
    await q(`UPDATE public.rr_jobs SET status = 'cancelled' WHERE renewal_id = $1 AND status = 'scheduled'`, [r.id], c);
    await q(
      `UPDATE public.rr_renewals
          SET due_date = $2::date, series_due = coalesce($3::date, $2::date), anchor_date = coalesce($4::date, anchor_date), cycle_no = $5,
              state = 'active', completed_one_off = false, ack_token = public.rr_token(),
              snooze_count = 0, snoozed_until = NULL, escalation_stage = 0
        WHERE id = $1`,
      [r.id, last.due_date, last.prev_series_due, last.prev_anchor_date, last.cycle_no], c);
    // Restore, don't re-announce: no immediate nudge on reopen.
    await q(`UPDATE public.rr_renewals SET needs_reschedule = true, reschedule_reason = 'reopened' WHERE id = $1`, [r.id], c);
    await reconcileRenewal(c, r.id, ctx);
    const updated = (await one<RenewalRow>(`SELECT * FROM public.rr_renewals WHERE id = $1`, [r.id], c))!;
    return { updated, acct: await loadAccount(r.account_id, c) };
  }, actor);
  await emitEvent(out.acct, 'renewal.reopened', renewalPayload(out.updated, undefined, ctx, out.acct.timezone)).catch(() => {});
  return out.updated;
}

/** Delay the next nudge by 3 days; at most twice per cycle. */
export async function snoozeRenewal(renewalId: string, actor: string, ctx: Ctx, expectToken?: string): Promise<RenewalRow> {
  const out = await tx(async c => {
    const r = await one<RenewalRow>(`SELECT * FROM public.rr_renewals WHERE id = $1 FOR UPDATE`, [renewalId], c);
    if (!r) throw new UserError('Renewal not found', 404);
    if (expectToken && r.ack_token !== expectToken) throw new UserError('This reminder has already been actioned.', 409);
    if (r.state !== 'active') throw new UserError('Only active renewals can be snoozed.', 409);
    if (r.snooze_count >= E.MAX_SNOOZES) throw new UserError(`Snooze is limited to ${E.MAX_SNOOZES} times per cycle.`, 409);
    const acct = await loadAccount(r.account_id, c);
    const today = E.todayIn(acct.timezone, ctx.now);
    if (r.due_date < today) throw new UserError('This renewal is already overdue and cannot be snoozed.', 409);

    const next = await one<{ fire_at: Date }>(
      `SELECT fire_at FROM public.rr_jobs
        WHERE renewal_id = $1 AND cycle_no = $2 AND status = 'scheduled' AND kind IN ('nudge','immediate','deferred','escalation')
        ORDER BY fire_at LIMIT 1`, [r.id, r.cycle_no], c);
    const base = next?.fire_at && next.fire_at > ctx.now ? next.fire_at : ctx.now;
    let until = new Date(base.getTime() + E.SNOOZE_DAYS * 86_400_000);
    const dueMorning = E.zonedInstant(r.due_date, acct.send_hour, acct.timezone);
    if (until > dueMorning) until = dueMorning;
    if (until <= ctx.now) throw new UserError('This renewal is due too soon to snooze.', 409);

    await q(
      `UPDATE public.rr_renewals
          SET snoozed_until = $2, snooze_count = snooze_count + 1, needs_reschedule = true, reschedule_reason = 'snooze'
        WHERE id = $1`, [r.id, until], c);
    await reconcileRenewal(c, r.id, ctx);
    return { updated: (await one<RenewalRow>(`SELECT * FROM public.rr_renewals WHERE id = $1`, [r.id], c))!, acct };
  }, actor);
  await emitEvent(out.acct, 'renewal.snoozed', {
    ...renewalPayload(out.updated, undefined, ctx, out.acct.timezone),
    snoozed_until: out.updated.snoozed_until, snooze_count: out.updated.snooze_count,
  }).catch(() => {});
  return out.updated;
}

// ---------------------------------------------------------------
// Stage 3 — dispatch
// ---------------------------------------------------------------

interface Target {
  type: ChannelRow['type'];
  target: string;
  channelId: string | null;
  label: string;
}

interface PlannedSend {
  key: string;               // type|target|audience
  t: Target;
  audience: 'recipient' | 'watcher';
  items: { job: JobRow; renewal: RenewalRow; msg: E.RenderedMessage }[];
}

function dedupeTargets(list: Target[]): Target[] {
  const seen = new Set<string>();
  return list.filter(t => {
    const k = `${t.type}|${t.target.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function combine(items: PlannedSend['items'], brand: string): OutboundMessage {
  if (items.length === 1) return items[0].msg;
  return {
    subject: `${brand}: ${items.length} renewals need your attention`,
    text: items.map(i => i.msg.text).join('\n\n— — —\n\n'),
    short: `${brand}: ${items.length} renewals need attention. ${items.map(i => i.renewal.name).join(', ')}`.slice(0, 160),
    html: `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <div style="max-width:560px;margin:0 auto;padding:24px 24px 0"><h1 style="font-size:18px;color:#0f172a">${items.length} renewals need your attention</h1></div>
      ${items.map(i => i.msg.html.replace(/^[\s\S]*?<body[^>]*>/, '').replace(/<\/body>[\s\S]*$/, '')).join('')}
    </body></html>`,
  };
}

async function deliver(t: Target, msg: OutboundMessage, acct: AccountRow, hooks: Map<string, WebhookRow>, meta: Record<string, unknown>, idem: string): Promise<DeliveryResult> {
  const brand = brandFor(acct);
  switch (t.type) {
    case 'email':
      return sendEmail(t.target, msg, { replyTo: acct.reply_to_email, fromName: brand.name, idempotencyKey: idem });
    case 'slack':
      return sendSlack(t.target, msg);
    case 'teams':
      return sendTeams(t.target, msg);
    case 'whatsapp':
    case 'sms':
      return sendViaRelay(acct.id, t.type, t.target, msg, meta);
    case 'webhook': {
      const hook = hooks.get(t.target);
      if (!hook || !hook.enabled) return { ok: false, transient: false, error: 'Webhook endpoint missing or disabled' };
      return postWebhook(hook, makeEvent(acct.id, 'reminder.sent', { ...meta, message: msg.text, subject: msg.subject }));
    }
  }
}

async function recordDelivery(row: {
  account_id: string; job_id: string | null; renewal_id: string | null; cycle_no: number | null; channel_id: string | null;
  channel_type: string; target: string; audience: string; status: 'sent' | 'failed' | 'fallback' | 'skipped';
  subject?: string | null; provider_ref?: string | null; error?: string | null;
}) {
  await q(
    `INSERT INTO public.rr_deliveries (account_id, job_id, renewal_id, cycle_no, channel_id, channel_type, target, audience, status, subject, provider_ref, error)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (job_id, channel_type, target) WHERE job_id IS NOT NULL DO UPDATE
        SET status = EXCLUDED.status, error = EXCLUDED.error, provider_ref = EXCLUDED.provider_ref, created_at = now()
      WHERE public.rr_deliveries.status = 'failed'`,
    [row.account_id, row.job_id, row.renewal_id, row.cycle_no, row.channel_id, row.channel_type, row.target,
     row.audience, row.status, row.subject ?? null, row.provider_ref ?? null, row.error?.slice(0, 1000) ?? null],
  );
}

async function notifyChannelFailure(acct: AccountRow, ch: ChannelRow, error: string, watchers: string[], ctx: Ctx) {
  const brand = brandFor(acct);
  const msg: OutboundMessage = {
    subject: `${brand.name}: your ${ch.type} channel "${ch.label || ch.target}" is failing`,
    text: `Reminders to ${ch.type} (${ch.label || ch.target}) failed twice in a row. We delivered them by email instead.\nLast error: ${error}\nCheck the channel: ${ctx.appUrl}/#/renewals/channels`,
    short: `${brand.name}: ${ch.type} channel failing, check settings.`,
    html: `<p>Reminders to <b>${ch.type}</b> (${E.escapeHtml(ch.label || ch.target)}) failed twice in a row. We delivered them by email instead.</p>
           <p style="color:#64748b">Last error: ${E.escapeHtml(error)}</p>
           <p><a href="${ctx.appUrl}/#/renewals/channels">Check the channel</a></p>`,
  };
  for (const to of new Set([acct.owner_email, ...watchers].filter(Boolean))) {
    const res = await sendEmail(to, msg, { fromName: brand.name });
    await recordDelivery({
      account_id: acct.id, job_id: null, renewal_id: null, cycle_no: null, channel_id: ch.id, channel_type: 'email',
      target: to, audience: 'owner', status: res.ok ? 'sent' : 'failed', subject: msg.subject, provider_ref: res.providerRef, error: res.error,
    });
  }
  await emitEvent(acct, 'channel.failed', { channel: { id: ch.id, type: ch.type, label: ch.label }, error }).catch(() => {});
}

async function processAccount(accountId: string, jobs: JobRow[], ctx: Ctx): Promise<void> {
  const acct = await loadAccount(accountId, dbPool);
  const tz = acct.timezone;
  const today = E.todayIn(tz, ctx.now);
  const plan = E.planOf(acct.plan);
  const brand = brandFor(acct);

  const renewalIds = [...new Set(jobs.map(j => j.renewal_id))];
  const renewals = new Map((await q<RenewalRow>(`SELECT * FROM public.rr_renewals WHERE id = ANY ($1)`, [renewalIds])).map(r => [r.id, r]));
  const entities = new Map((await q<EntityRow>(`SELECT * FROM public.rr_entities WHERE account_id = $1`, [acct.id])).map(e => [e.id, e]));
  const channels = await q<ChannelRow>(`SELECT * FROM public.rr_channels WHERE account_id = $1 AND enabled`, [acct.id]);
  const hooks = new Map((await q<WebhookRow>(`SELECT * FROM public.rr_webhooks WHERE account_id = $1`, [acct.id])).map(h => [h.id, h]));
  const watcherMembers = (await q<{ email: string }>(
    `SELECT email FROM public.rr_members
      WHERE account_id = $1 AND role = 'watcher' AND status = 'active' AND coalesce((prefs ->> 'watcherAlerts')::boolean, true)`,
    [acct.id])).map(m => m.email);

  const permitted = acct.quiet_override ? ctx.now : E.nextPermittedInstant(ctx.now, acct.quiet_start, acct.quiet_end, tz);
  const inQuietHours = permitted > ctx.now;

  const finish = async (job: JobRow, status: 'sent' | 'cancelled' | 'failed' | 'retry', error?: string) => {
    if (status === 'retry') {
      if (job.attempts >= MAX_ATTEMPTS) status = 'failed';
      else {
        const delayMin = 2 ** job.attempts; // 2, 4, 8, 16 minutes
        await q(`UPDATE public.rr_jobs SET status = 'scheduled', locked_at = NULL, fire_at = now() + make_interval(mins => $2), last_error = $3 WHERE id = $1`,
          [job.id, delayMin, error ?? null]);
        return;
      }
    }
    await q(`UPDATE public.rr_jobs SET status = $2, locked_at = NULL, sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END, last_error = $3 WHERE id = $1`,
      [job.id, status, error ?? null]);
  };

  // ---- Phase 1: decide who gets what -----------------------------------
  const sends = new Map<string, PlannedSend>();
  const jobTargets = new Map<string, { job: JobRow; renewal: RenewalRow; primary: string; expected: number }>();
  const addSend = (t: Target, audience: PlannedSend['audience'], job: JobRow, renewal: RenewalRow, msg: E.RenderedMessage) => {
    // Consolidation merges same-day nudges per destination into one message.
    const key = acct.consolidate && audience === 'recipient'
      ? `${t.type}|${t.target.toLowerCase()}|${audience}`
      : `${t.type}|${t.target.toLowerCase()}|${audience}|${job.id}`;
    const s = sends.get(key) ?? { key, t, audience, items: [] };
    s.items.push({ job, renewal, msg });
    sends.set(key, s);
  };

  for (const job of jobs) {
    const r = renewals.get(job.renewal_id);
    if (!r || r.state !== 'active' || r.completed_one_off || job.cycle_no !== r.cycle_no) { await finish(job, 'cancelled', 'stale'); continue; }
    const isNudge = ['nudge', 'immediate', 'deferred', 'escalation'].includes(job.kind);
    if (isNudge && r.due_date < today) { await finish(job, 'cancelled', 'past due date'); continue; }
    if (isNudge && job.kind !== 'deferred' && r.snoozed_until && r.snoozed_until > ctx.now) { await finish(job, 'cancelled', 'snoozed'); continue; }
    if (job.kind === 'watcher' && !plan.watchers) { await finish(job, 'cancelled', 'plan has no watcher alerts'); continue; }

    const entity = r.entity_id ? entities.get(r.entity_id) : undefined;
    const primary = primaryEmail(r, entity, acct);
    let expected = 0;

    const watcherEmails = [...new Set([...(r.watchers ?? []).map(w => (w.email ?? '').trim()).filter(Boolean), ...watcherMembers])];

    if (job.kind === 'watcher') {
      const msg = E.renderReminder({
        brandName: brand.name, renewalName: r.name, entityName: entity?.name, category: r.category, dueDate: r.due_date,
        today, tone: job.tone as E.Tone, audience: 'watcher', responsibleName: r.responsible_name || r.responsible_email,
      });
      for (const w of watcherEmails) { addSend({ type: 'email', target: w, channelId: null, label: 'Watcher' }, 'watcher', job, r, msg); expected++; }
      if (!expected) { await finish(job, 'cancelled', 'no watchers'); continue; }
      jobTargets.set(job.id, { job, renewal: r, primary, expected });
      continue;
    }

    const msg = E.renderReminder({
      brandName: brand.name, renewalName: r.name, entityName: entity?.name, category: r.category, dueDate: r.due_date,
      today, tone: job.tone as E.Tone, audience: 'recipient', ackUrl: ackUrl(ctx, r),
      snoozeAvailable: r.snooze_count < E.MAX_SNOOZES && job.kind !== 'overdue',
    });

    const ids = r.channel_ids ?? acct.default_channel_ids ?? [];
    const chosen = channels
      .filter(c => ids.includes(c.id) && (c.entity_id === null || c.entity_id === r.entity_id))
      .sort((a, b) => a.priority - b.priority)
      .map<Target>(c => ({ type: c.type, target: c.target, channelId: c.id, label: c.label }));
    const emailTarget: Target[] = primary ? [{ type: 'email', target: primary, channelId: null, label: 'Primary email' }] : [];

    let targets: Target[];
    const mode = r.delivery_mode ?? acct.delivery_mode;
    if (mode === 'sequential' && job.kind !== 'overdue') {
      // Priority order, email last. One stage per 24 h until acknowledged.
      const ordered = dedupeTargets([...chosen, ...emailTarget]);
      const stage = job.stage ?? 0;
      targets = ordered[stage] ? [ordered[stage]] : [];
      if (stage + 1 < ordered.length) {
        const at = new Date(ctx.now.getTime() + 24 * 3_600_000);
        if (E.localDateHour(at, tz).date <= r.due_date) {
          await insertJob(dbPool, {
            account_id: r.account_id, renewal_id: r.id, cycle_no: r.cycle_no, kind: 'escalation', seq: job.seq,
            offset_days: job.offset_days, tone: job.tone, fire_at: at, stage: stage + 1,
            key: `${job.idempotency_key}:esc:${stage + 1}`,
          });
        }
      }
    } else {
      targets = dedupeTargets([...emailTarget, ...chosen]);
    }

    if (job.channel_filter?.length) targets = targets.filter(t => job.channel_filter!.includes(t.type));

    // Quiet hours: WhatsApp / SMS roll to the next permitted window.
    if (inQuietHours) {
      const loud = targets.filter(t => (E.HIGH_URGENCY_CHANNELS as readonly string[]).includes(t.type));
      if (loud.length) {
        targets = targets.filter(t => !loud.includes(t));
        await insertJob(dbPool, {
          account_id: r.account_id, renewal_id: r.id, cycle_no: r.cycle_no, kind: 'deferred', seq: job.seq,
          offset_days: job.offset_days, tone: job.tone, fire_at: permitted, stage: job.stage,
          channel_filter: [...new Set(loud.map(t => t.type))],
          key: `${job.idempotency_key}:quiet`,
        });
      }
    }

    for (const t of targets) { addSend(t, 'recipient', job, r, msg); expected++; }

    // Overdue alerts also go to watchers (brief §4.3).
    if (job.kind === 'overdue' && plan.watchers) {
      const wmsg = E.renderReminder({
        brandName: brand.name, renewalName: r.name, entityName: entity?.name, category: r.category, dueDate: r.due_date,
        today, tone: 'overdue', audience: 'watcher', responsibleName: r.responsible_name || r.responsible_email,
      });
      for (const w of watcherEmails) { addSend({ type: 'email', target: w, channelId: null, label: 'Watcher' }, 'watcher', job, r, wmsg); expected++; }
    }

    if (!expected) {
      await finish(job, inQuietHours ? 'sent' : 'failed', inQuietHours ? 'deferred to permitted hours' : 'no deliverable destination');
      continue;
    }
    jobTargets.set(job.id, { job, renewal: r, primary, expected });
  }

  // ---- Phase 2: deliver ------------------------------------------------
  const jobIds = [...jobTargets.keys()];
  const already = new Set(
    jobIds.length
      ? (await q<{ job_id: string; channel_type: string; target: string }>(
          `SELECT job_id, channel_type, target FROM public.rr_deliveries WHERE job_id = ANY ($1) AND status IN ('sent','fallback','skipped')`,
          [jobIds])).map(d => `${d.job_id}|${d.channel_type}|${d.target.toLowerCase()}`)
      : [],
  );
  const transientFail = new Map<string, string>();
  const emailedPrimary = new Set<string>(); // job ids whose primary email went out
  const fallbackQueue: { job: JobRow; renewal: RenewalRow; primary: string; msg: OutboundMessage; channel: ChannelRow; error: string }[] = [];
  const hookIdsUsed = new Map<string, Set<string>>(); // job -> webhook channel ids delivered directly

  for (const s of sends.values()) {
    const pending = s.items.filter(i => !already.has(`${i.job.id}|${s.t.type}|${s.t.target.toLowerCase()}`));
    if (!pending.length) {
      s.items.forEach(i => { if (s.t.type === 'email' && s.t.target.toLowerCase() === jobTargets.get(i.job.id)?.primary.toLowerCase()) emailedPrimary.add(i.job.id); });
      continue;
    }
    const msg = combine(pending, brand.name);
    const first = pending[0];
    const meta = pending.length === 1
      ? { ...renewalPayload(first.renewal, first.renewal.entity_id ? entities.get(first.renewal.entity_id) : undefined, ctx, tz), tone: first.job.tone, kind: first.job.kind }
      : { renewals: pending.map(i => renewalPayload(i.renewal, i.renewal.entity_id ? entities.get(i.renewal.entity_id) : undefined, ctx, tz)), consolidated: true };
    const idem = `${pending.map(i => i.job.id).sort().join(',')}:${s.t.type}:${s.t.target}`;
    const res = await deliver(s.t, msg, acct, hooks, meta, idem);

    for (const i of pending) {
      await recordDelivery({
        account_id: acct.id, job_id: i.job.id, renewal_id: i.renewal.id, cycle_no: i.renewal.cycle_no, channel_id: s.t.channelId,
        channel_type: s.t.type, target: s.t.target, audience: s.audience, status: res.ok ? 'sent' : 'failed',
        subject: msg.subject, provider_ref: res.providerRef, error: res.error,
      });
      const jt = jobTargets.get(i.job.id)!;
      if (res.ok && s.t.type === 'email' && s.t.target.toLowerCase() === jt.primary.toLowerCase()) emailedPrimary.add(i.job.id);
      if (res.ok && s.t.type === 'webhook') {
        const set = hookIdsUsed.get(i.job.id) ?? new Set<string>();
        set.add(s.t.target);
        hookIdsUsed.set(i.job.id, set);
      }
      if (!res.ok) {
        const ch = s.t.channelId ? channels.find(c => c.id === s.t.channelId) : undefined;
        if (ch && s.t.type !== 'email') {
          fallbackQueue.push({ job: i.job, renewal: i.renewal, primary: jt.primary, msg: i.msg, channel: ch, error: res.error ?? 'failed' });
        } else if (res.transient) {
          transientFail.set(i.job.id, res.error ?? 'failed');
        }
      }
    }

    if (s.t.channelId) {
      if (res.ok) {
        await q(`UPDATE public.rr_channels SET consecutive_failures = 0, flagged = false, flagged_reason = NULL, last_delivery_at = now() WHERE id = $1`, [s.t.channelId]);
      } else if (s.t.type !== 'email') {
        const ch = await one<ChannelRow>(
          `UPDATE public.rr_channels SET consecutive_failures = consecutive_failures + 1, flagged = true, flagged_reason = $2
            WHERE id = $1 RETURNING *`, [s.t.channelId, res.error?.slice(0, 500) ?? 'failed']);
        if (ch && ch.consecutive_failures === 2) {
          const watchers = [...new Set(pending.flatMap(i => (i.renewal.watchers ?? []).map(w => w.email ?? '').filter(Boolean)))];
          await notifyChannelFailure(acct, ch, res.error ?? 'failed', plan.watchers ? [...watchers, ...watcherMembers] : [], ctx);
        }
      }
    }
  }

  // Fallback: a failed non-email channel is re-sent by email (once per job).
  for (const f of fallbackQueue) {
    if (emailedPrimary.has(f.job.id) || !f.primary) continue;
    const res = await sendEmail(f.primary, f.msg, { replyTo: acct.reply_to_email, fromName: brand.name, idempotencyKey: `${f.job.id}:fallback` });
    await recordDelivery({
      account_id: acct.id, job_id: f.job.id, renewal_id: f.renewal.id, cycle_no: f.renewal.cycle_no, channel_id: f.channel.id,
      channel_type: 'email', target: f.primary, audience: 'recipient', status: res.ok ? 'fallback' : 'failed',
      subject: f.msg.subject, provider_ref: res.providerRef, error: res.ok ? `fallback for ${f.channel.type}: ${f.error}` : res.error,
    });
    if (res.ok) emailedPrimary.add(f.job.id);
    else if (res.transient) transientFail.set(f.job.id, res.error ?? 'failed');
  }

  // ---- Phase 3: close jobs and emit events -------------------------------
  for (const { job, renewal } of jobTargets.values()) {
    const err = transientFail.get(job.id);
    if (err) { await finish(job, 'retry', err); continue; }
    await finish(job, 'sent');
    const entity = renewal.entity_id ? entities.get(renewal.entity_id) : undefined;
    const payload = { ...renewalPayload(renewal, entity, ctx, tz), tone: job.tone, kind: job.kind, offset_days: job.offset_days };
    const skip = [...(hookIdsUsed.get(job.id) ?? [])];
    if (job.kind === 'watcher') {
      await emitEvent(acct, 'watcher.alerted', payload, skip).catch(() => {});
    } else {
      await emitEvent(acct, 'reminder.sent', payload, skip).catch(() => {});
      if (job.kind === 'overdue' && job.seq === 100) await emitEvent(acct, 'renewal.overdue', payload).catch(() => {});
    }
  }
}

export async function dispatchDue(ctx: Ctx, limit = 300): Promise<number> {
  const jobs = await q<JobRow>(
    `UPDATE public.rr_jobs
        SET status = 'sending', locked_at = now(), attempts = attempts + 1
      WHERE id IN (
        SELECT id FROM public.rr_jobs
         WHERE (status = 'scheduled' AND fire_at <= now())
            OR (status = 'sending' AND locked_at < now() - interval '10 minutes')
         ORDER BY fire_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED)
      RETURNING *`,
    [limit],
  );
  const byAccount = new Map<string, JobRow[]>();
  for (const j of jobs) {
    const list = byAccount.get(j.account_id) ?? [];
    list.push(j);
    byAccount.set(j.account_id, list);
  }
  for (const [accountId, list] of byAccount) {
    // Per-account rate limit protects sender reputation; the rest wait 5 minutes.
    const now = list.slice(0, MAX_JOBS_PER_ACCOUNT_PER_RUN);
    const later = list.slice(MAX_JOBS_PER_ACCOUNT_PER_RUN);
    if (later.length) {
      await q(`UPDATE public.rr_jobs SET status = 'scheduled', locked_at = NULL, attempts = attempts - 1, fire_at = now() + interval '5 minutes' WHERE id = ANY ($1)`,
        [later.map(j => j.id)]);
    }
    try {
      await processAccount(accountId, now, ctx);
    } catch (e) {
      console.error('[dispatch]', accountId, e);
      await q(`UPDATE public.rr_jobs SET status = 'scheduled', locked_at = NULL, fire_at = now() + interval '5 minutes', last_error = $2 WHERE id = ANY ($1) AND status = 'sending'`,
        [now.map(j => j.id), String((e as Error)?.message ?? e).slice(0, 500)]);
    }
  }
  return jobs.length;
}

// ---------------------------------------------------------------
// Weekly digest (brief §4.9)
// ---------------------------------------------------------------

export async function runDigests(ctx: Ctx): Promise<number> {
  const accounts = await q<AccountRow>(`SELECT * FROM public.rr_accounts WHERE digest_enabled`);
  let sent = 0;
  for (const acct of accounts) {
    try {
      const local = E.localDateHour(ctx.now, acct.timezone);
      if (E.weekday(local.date) !== acct.digest_weekday || local.hour < acct.send_hour) continue;
      if (acct.last_digest_on && acct.last_digest_on >= local.date) continue;

      // Claim the slot first so two concurrent ticks never double-send.
      const claimed = await one(
        `UPDATE public.rr_accounts SET last_digest_on = $2 WHERE id = $1 AND (last_digest_on IS NULL OR last_digest_on < $2) RETURNING id`,
        [acct.id, local.date]);
      if (!claimed) continue;

      const horizon = E.addDays(local.date, 30);
      const rows = await q<RenewalRow & { entity_name: string | null }>(
        `SELECT r.*, e.name AS entity_name FROM public.rr_renewals r
           LEFT JOIN public.rr_entities e ON e.id = r.entity_id
          WHERE r.account_id = $1 AND r.state = 'active' AND NOT r.completed_one_off AND r.due_date <= $2
          ORDER BY r.due_date`, [acct.id, horizon]);
      if (!rows.length) continue;

      const overdue = rows.filter(r => r.due_date < local.date);
      const upcoming = rows.filter(r => r.due_date >= local.date);
      const brand = brandFor(acct);
      const line = (r: typeof rows[number]) =>
        `${E.formatLongDate(r.due_date)} — ${r.name}${r.entity_name ? ` (${r.entity_name})` : ''} · ${E.daysLeftLabel(r.due_date, acct.timezone, ctx.now)}`;
      const text = [
        `${brand.name} weekly digest`,
        overdue.length ? `\nOverdue (${overdue.length}):\n${overdue.map(line).join('\n')}` : '',
        upcoming.length ? `\nDue in the next 30 days (${upcoming.length}):\n${upcoming.map(line).join('\n')}` : '',
        `\nOpen your dashboard: ${ctx.appUrl}/#/renewals`,
      ].join('\n');
      const li = (r: typeof rows[number]) => `<li style="margin:4px 0">${E.escapeHtml(line(r))}</li>`;
      const msg: OutboundMessage = {
        subject: `${brand.name}: ${overdue.length ? `${overdue.length} overdue, ` : ''}${upcoming.length} due in the next 30 days`,
        text,
        short: `${brand.name}: ${overdue.length} overdue, ${upcoming.length} due soon.`,
        html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
          <h1 style="font-size:18px">Your week ahead</h1>
          ${overdue.length ? `<h2 style="font-size:14px;color:#dc2626">Overdue (${overdue.length})</h2><ul>${overdue.map(li).join('')}</ul>` : ''}
          ${upcoming.length ? `<h2 style="font-size:14px">Due in the next 30 days (${upcoming.length})</h2><ul>${upcoming.map(li).join('')}</ul>` : ''}
          <p><a href="${ctx.appUrl}/#/renewals">Open your dashboard</a></p></div>`,
      };
      const members = await q<{ email: string }>(
        `SELECT email FROM public.rr_members
          WHERE account_id = $1 AND status = 'active' AND role <> 'watcher' AND coalesce((prefs ->> 'digest')::boolean, true)`, [acct.id]);
      for (const to of new Set([acct.owner_email, ...members.map(m => m.email)].filter(Boolean))) {
        const res = await sendEmail(to, msg, { replyTo: acct.reply_to_email, fromName: brand.name, idempotencyKey: `digest:${acct.id}:${local.date}:${to}` });
        await recordDelivery({
          account_id: acct.id, job_id: null, renewal_id: null, cycle_no: null, channel_id: null, channel_type: 'email', target: to,
          audience: 'digest', status: res.ok ? 'sent' : 'failed', subject: msg.subject, provider_ref: res.providerRef, error: res.error,
        });
        if (res.ok) sent++;
      }
    } catch (e) {
      console.error('[digest]', acct.id, e);
    }
  }
  return sent;
}

// ---------------------------------------------------------------
// Change log → webhook events (covers edits made in the web app)
// ---------------------------------------------------------------

export async function emitChangeEvents(ctx: Ctx): Promise<number> {
  const cur = await one<{ value: string }>(`SELECT value FROM public.rr_system WHERE key = 'event_cursor'`);
  if (!cur) {
    // First run: start from now, never replay history to customers.
    await q(`INSERT INTO public.rr_system (key, value) SELECT 'event_cursor', coalesce(max(id), 0)::text FROM public.rr_changelog ON CONFLICT (key) DO NOTHING`);
    return 0;
  }
  const rows = await q<{ id: string; account_id: string; object_type: string; object_id: string; action: string; actor: string; changes: any }>(
    `SELECT * FROM public.rr_changelog WHERE id > $1 ORDER BY id LIMIT 500`, [cur.value]);
  if (!rows.length) return 0;

  const names: Record<string, string> = { renewals: 'renewal', entities: 'entity' };
  const verbs: Record<string, string> = { insert: 'created', update: 'updated', delete: 'deleted' };
  for (const row of rows) {
    const obj = names[row.object_type];
    if (!obj) continue;
    // Scheduler bookkeeping (rollover, snooze) has its own richer events.
    if (row.actor === 'scheduler' || row.actor.startsWith('link') || row.actor.startsWith('portal')) continue;
    const data: Record<string, unknown> = { id: row.object_id, actor: row.actor, changes: row.changes };
    if (obj === 'renewal' && row.action !== 'delete') {
      const r = await one<RenewalRow>(`SELECT * FROM public.rr_renewals WHERE id = $1`, [row.object_id]);
      if (r) {
        const acct = await loadAccount(r.account_id, dbPool);
        Object.assign(data, renewalPayload(r, undefined, ctx, acct.timezone));
      }
    }
    try {
      await emitEvent({ id: row.account_id }, `${obj}.${verbs[row.action] ?? row.action}`, data);
    } catch (e) {
      console.error('[events]', e);
    }
  }
  await q(`UPDATE public.rr_system SET value = $1, updated_at = now() WHERE key = 'event_cursor'`, [rows[rows.length - 1].id]);
  return rows.length;
}

// ---------------------------------------------------------------
// Data retention (POPIA): default 5 years, per account
// ---------------------------------------------------------------

export async function runRetention(): Promise<void> {
  await q(`DELETE FROM public.rr_deliveries d USING public.rr_accounts a
            WHERE d.account_id = a.id AND d.created_at < now() - make_interval(years => a.retention_years)`);
  await q(`DELETE FROM public.rr_changelog c USING public.rr_accounts a
            WHERE c.account_id = a.id AND c.created_at < now() - make_interval(years => a.retention_years)`);
  await q(`DELETE FROM public.rr_completions c USING public.rr_accounts a
            WHERE c.account_id = a.id AND c.completed_at < now() - make_interval(years => a.retention_years)`);
  await q(`DELETE FROM public.rr_jobs WHERE status IN ('sent','cancelled','failed') AND created_at < now() - interval '400 days'`);
}

export async function tick(ctx: Ctx): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try { out[name] = await fn(); } catch (e) { console.error(`[tick:${name}]`, e); out[name] = `error: ${(e as Error).message}`; }
  };
  await step('rescheduled', () => reconcilePending(ctx));
  await step('dispatched', () => dispatchDue(ctx));
  await step('events', () => emitChangeEvents(ctx));
  await step('digests', () => runDigests(ctx));
  if (ctx.now.getUTCHours() === 0 && ctx.now.getUTCMinutes() < 5) await step('retention', () => runRetention().then(() => 'ok'));
  return out;
}
