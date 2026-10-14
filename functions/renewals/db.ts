import pg from 'pg';

// =====================================================
// Postgres access for the renewals function.
//
// Connects as the branch owner (DATABASE_URL is injected by Neon), so RLS
// does not apply. Every query that acts for a person must therefore check
// access itself — see `withUser`, which reuses the database's own
// rr_role / rr_can_write logic instead of re-implementing it.
// =====================================================

const { Pool } = pg;

// DATE columns come back as plain "YYYY-MM-DD" strings, never JS Dates,
// so the engine's calendar maths cannot be skewed by a time zone.
pg.types.setTypeParser(1082, (v: string) => v);

export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

// An idle client dropped by the pooler must not crash the isolate.
pool.on('error', (err: Error & { code?: string }) => {
  const benign = ['ECONNRESET', 'EPIPE', 'ETIMEDOUT', '57P01'];
  if (!benign.includes(err.code ?? '') && !/terminated unexpectedly/i.test(err.message)) {
    console.error('[pg pool]', err);
  }
});

export type Queryable = pg.Pool | pg.PoolClient;

export async function q<T = any>(sql: string, params: unknown[] = [], db: Queryable = pool): Promise<T[]> {
  const res = await db.query(sql, params as any[]);
  return res.rows as T[];
}

export async function one<T = any>(sql: string, params: unknown[] = [], db: Queryable = pool): Promise<T | null> {
  const rows = await q<T>(sql, params, db);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>, actor?: string): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    if (actor) await c.query(`SELECT set_config('rr.actor', $1, true)`, [actor]);
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/**
 * Evaluate the database's access helpers as `userId`, exactly as the Data
 * API would for that user's JWT.
 */
export async function roleFor(userId: string, accountId: string): Promise<string | null> {
  return tx(async c => {
    await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId })]);
    const r = await one<{ role: string | null }>(`SELECT public.rr_role($1) AS role`, [accountId], c);
    return r?.role ?? null;
  });
}

export async function canWrite(userId: string, accountId: string, entityId: string | null): Promise<boolean> {
  return tx(async c => {
    await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId })]);
    const r = await one<{ ok: boolean }>(`SELECT public.rr_can_write($1, $2) AS ok`, [accountId, entityId], c);
    return !!r?.ok;
  });
}

// ---------------------------------------------------------------
// Row shapes (snake_case, as stored)
// ---------------------------------------------------------------

export interface AccountRow {
  id: string;
  owner_user_id: string;
  name: string;
  plan: string;
  timezone: string;
  send_hour: number;
  quiet_start: number;
  quiet_end: number;
  quiet_override: boolean;
  default_preset: string;
  default_channel_ids: string[];
  delivery_mode: 'fanout' | 'sequential';
  overdue_alerts: boolean;
  holiday_shift: boolean;
  consolidate: boolean;
  digest_enabled: boolean;
  digest_weekday: number;
  retention_years: number;
  owner_email: string;
  brand_name: string | null;
  brand_logo_url: string | null;
  brand_color: string | null;
  reply_to_email: string | null;
  last_digest_on: string | null;
}

export interface RenewalRow {
  id: string;
  account_id: string;
  entity_id: string | null;
  name: string;
  category: string;
  template_key: string | null;
  due_date: string;
  series_due: string | null;
  anchor_date: string | null;
  recurrence_unit: string;
  recurrence_interval: number;
  anchor_mode: 'fixed' | 'completion';
  preset: string;
  custom_offsets: number[] | null;
  channel_ids: string[] | null;
  delivery_mode: 'fanout' | 'sequential' | null;
  overdue_alerts: boolean | null;
  holiday_shift: boolean | null;
  responsible_name: string | null;
  responsible_email: string | null;
  responsible_phone: string | null;
  watchers: { name?: string; email?: string }[];
  notes: string | null;
  state: 'active' | 'paused' | 'archived';
  expects_attachment: boolean;
  cycle_no: number;
  ack_token: string;
  snooze_count: number;
  snoozed_until: Date | null;
  escalation_stage: number;
  last_completed_at: Date | null;
  completed_one_off: boolean;
  needs_reschedule: boolean;
  reschedule_reason: string | null;
}

export interface EntityRow {
  id: string;
  account_id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  portal_enabled: boolean;
  portal_token: string;
  archived: boolean;
}

export interface ChannelRow {
  id: string;
  account_id: string;
  entity_id: string | null;
  type: 'email' | 'whatsapp' | 'sms' | 'slack' | 'teams' | 'webhook';
  label: string;
  target: string;
  priority: number;
  enabled: boolean;
  consecutive_failures: number;
  flagged: boolean;
}

export interface WebhookRow {
  id: string;
  account_id: string;
  label: string;
  url: string;
  secret: string;
  events: string[];
  is_relay: boolean;
  enabled: boolean;
  consecutive_failures: number;
}

export interface JobRow {
  id: string;
  account_id: string;
  renewal_id: string;
  cycle_no: number;
  kind: 'nudge' | 'overdue' | 'watcher' | 'escalation' | 'immediate' | 'deferred';
  seq: number;
  offset_days: number | null;
  tone: string;
  fire_at: Date;
  channel_filter: string[] | null;
  stage: number | null;
  status: string;
  attempts: number;
  idempotency_key: string;
}
