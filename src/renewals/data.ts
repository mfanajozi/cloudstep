import { getNeon, getDataClient } from '../lib/neon';
import type {
  RRAccount, RREntity, RRRenewal, RRChannel, RRMember, RRWebhook, RRApiKey, RRJob, RRDelivery,
  RRCompletion, RRAttachment, RRChange, RRTemplate, MyAccount,
} from './types';

// =====================================================
// Renewal Reminder data access.
//
// Plain reads and edits go straight to the Neon Data API (RLS decides
// what each role may see or change). Anything that needs the recurrence
// engine — complete, reopen, snooze, test sends, downloads — goes to the
// `renewals` Neon Function with the user's session JWT.
// =====================================================

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const snake = (s: string) => s.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);

export function fromDb<T>(row: Record<string, any>): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) out[camel(k)] = v;
  return out as T;
}

export function toDb(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[snake(k)] = v;
  return out;
}

function db() {
  return getDataClient();
}

async function run<T>(label: string, p: PromiseLike<{ data: any; error: any }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(friendlyError(error.message ?? String(error), label));
  return data as T;
}

function friendlyError(message: string, label: string): string {
  if (/row-level security|permission denied/i.test(message)) return 'You do not have permission to do that.';
  if (/duplicate key.*members_email/i.test(message)) return 'That person is already on the team.';
  if (/rr_webhooks_url_check/.test(message)) return 'Webhook URLs must start with https://';
  return message || `${label} failed`;
}

const list = <T>(table: string, label: string) => async (accountId: string, order = 'created_at', ascending = true): Promise<T[]> =>
  (await run<any[]>(label, db().from(table).select('*').eq('account_id', accountId).order(order, { ascending }))).map(r => fromDb<T>(r));

// ---------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------

export async function myAccounts(): Promise<MyAccount[]> {
  const rows = await run<any[]>('Load accounts', (db() as any).rpc('rr_my_accounts'));
  return (rows ?? []).map(r => fromDb<MyAccount>(r));
}

export async function fetchAccount(id: string): Promise<RRAccount> {
  return fromDb<RRAccount>(await run('Load account', db().from('rr_accounts').select('*').eq('id', id).single()));
}

export async function createAccount(input: { name: string; ownerEmail: string; timezone?: string }): Promise<RRAccount> {
  return fromDb<RRAccount>(await run('Create account',
    db().from('rr_accounts').insert(toDb({ name: input.name, ownerEmail: input.ownerEmail, timezone: input.timezone })).select('*').single()));
}

export async function updateAccount(id: string, patch: Partial<RRAccount>): Promise<RRAccount> {
  const { id: _i, ownerUserId: _o, plan: _p, ...rest } = patch as any;
  return fromDb<RRAccount>(await run('Save settings', db().from('rr_accounts').update(toDb(rest)).eq('id', id).select('*').single()));
}

export async function setPlan(id: string, plan: string): Promise<void> {
  await run('Change plan', db().from('rr_accounts').update({ plan }).eq('id', id));
}

export async function acceptInvite(token: string): Promise<string> {
  return run<string>('Accept invitation', (db() as any).rpc('rr_accept_invite', { token }));
}

export async function updateMyPrefs(accountId: string, prefs: Record<string, boolean>): Promise<void> {
  await run('Save preferences', (db() as any).rpc('rr_update_my_prefs', { acct: accountId, new_prefs: prefs }));
}

// ---------------------------------------------------------------
// Entities, renewals, channels, members, templates
// ---------------------------------------------------------------

export const fetchEntities = list<RREntity>('rr_entities', 'Load entities');
export const fetchRenewals = list<RRRenewal>('rr_renewals', 'Load renewals');
export const fetchChannels = list<RRChannel>('rr_channels', 'Load channels');
export const fetchMembers = list<RRMember>('rr_members', 'Load team');
export const fetchWebhooks = list<RRWebhook>('rr_webhooks', 'Load webhooks');
export const fetchTemplates = list<RRTemplate>('rr_templates', 'Load templates');

export async function fetchApiKeys(accountId: string): Promise<RRApiKey[]> {
  const rows = await run<any[]>('Load API keys',
    db().from('rr_api_keys').select('id,label,prefix,scopes,created_at,last_used_at,revoked_at').eq('account_id', accountId).order('created_at'));
  return rows.map(r => fromDb<RRApiKey>(r));
}

async function upsertRow<T>(table: string, label: string, row: Record<string, any>): Promise<T> {
  const payload = toDb(row);
  const q = row.id
    ? db().from(table).update(payload).eq('id', row.id).select('*').single()
    : db().from(table).insert(payload).select('*').single();
  return fromDb<T>(await run(label, q));
}

export const saveEntity = (e: Partial<RREntity> & { accountId: string }) => upsertRow<RREntity>('rr_entities', 'Save entity', e);
export const saveRenewal = (r: Partial<RRRenewal> & { accountId: string }) => upsertRow<RRRenewal>('rr_renewals', 'Save renewal', r);
export const saveChannel = (c: Partial<RRChannel> & { accountId: string }) => upsertRow<RRChannel>('rr_channels', 'Save channel', c);
export const saveMember = (m: Partial<RRMember> & { accountId: string }) => upsertRow<RRMember>('rr_members', 'Save member', m);
export const saveWebhook = (w: Partial<RRWebhook> & { accountId: string }) => upsertRow<RRWebhook>('rr_webhooks', 'Save webhook', w);
export const saveTemplate = (t: Partial<RRTemplate> & { accountId: string }) => upsertRow<RRTemplate>('rr_templates', 'Save template', t);

export async function insertRenewals(rows: (Partial<RRRenewal> & { accountId: string })[]): Promise<RRRenewal[]> {
  if (!rows.length) return [];
  return (await run<any[]>('Create renewals', db().from('rr_renewals').insert(rows.map(toDb)).select('*'))).map(r => fromDb<RRRenewal>(r));
}

export async function deleteRow(table: 'rr_entities' | 'rr_renewals' | 'rr_channels' | 'rr_members' | 'rr_webhooks' | 'rr_templates' | 'rr_attachments', id: string): Promise<void> {
  await run('Delete', db().from(table).delete().eq('id', id));
}

export async function rotateSecret(table: 'rr_webhooks' | 'rr_entities', id: string): Promise<string> {
  const token = randomHex(32);
  const column = table === 'rr_webhooks' ? 'secret' : 'portal_token';
  await run('Rotate secret', db().from(table).update({ [column]: token }).eq('id', id));
  return token;
}

// ---------------------------------------------------------------
// Logs
// ---------------------------------------------------------------

export async function fetchJobs(accountId: string, renewalId?: string): Promise<RRJob[]> {
  let q = db().from('rr_jobs').select('id,renewal_id,cycle_no,kind,offset_days,tone,fire_at,status,sent_at,last_error').eq('account_id', accountId);
  if (renewalId) q = q.eq('renewal_id', renewalId);
  else q = q.eq('status', 'scheduled');
  return (await run<any[]>('Load schedule', q.order('fire_at').limit(2000))).map(r => fromDb<RRJob>(r));
}

export async function fetchDeliveries(accountId: string, opts: { renewalId?: string; limit?: number; since?: string } = {}): Promise<RRDelivery[]> {
  let q = db().from('rr_deliveries').select('*').eq('account_id', accountId);
  if (opts.renewalId) q = q.eq('renewal_id', opts.renewalId);
  if (opts.since) q = q.gte('created_at', opts.since);
  return (await run<any[]>('Load delivery log', q.order('created_at', { ascending: false }).limit(opts.limit ?? 500))).map(r => fromDb<RRDelivery>(r));
}

export async function fetchCompletions(accountId: string, renewalId?: string): Promise<RRCompletion[]> {
  let q = db().from('rr_completions').select('*').eq('account_id', accountId);
  if (renewalId) q = q.eq('renewal_id', renewalId);
  return (await run<any[]>('Load history', q.order('completed_at', { ascending: false }).limit(5000))).map(r => fromDb<RRCompletion>(r));
}

export async function fetchAttachments(accountId: string, renewalId: string): Promise<RRAttachment[]> {
  return (await run<any[]>('Load attachments',
    db().from('rr_attachments').select('id,renewal_id,completion_id,cycle_no,file_name,content_type,size_bytes,created_at')
      .eq('account_id', accountId).eq('renewal_id', renewalId).order('created_at', { ascending: false }))).map(r => fromDb<RRAttachment>(r));
}

export async function fetchChanges(accountId: string, renewalId?: string, limit = 200): Promise<RRChange[]> {
  let q = db().from('rr_changelog').select('*').eq('account_id', accountId);
  if (renewalId) q = q.eq('renewal_id', renewalId);
  return (await run<any[]>('Load change log', q.order('id', { ascending: false }).limit(limit))).map(r => fromDb<RRChange>(r));
}

// ---------------------------------------------------------------
// API keys (generated in the browser, only the hash is stored)
// ---------------------------------------------------------------

export function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export async function createApiKey(accountId: string, label: string, scopes: string[]): Promise<{ key: string; row: RRApiKey }> {
  const key = `csr_${randomHex(24)}`;
  const row = await run<any>('Create API key', db().from('rr_api_keys')
    .insert({ account_id: accountId, label, prefix: key.slice(0, 12), key_hash: await sha256Hex(key), scopes })
    .select('id,label,prefix,scopes,created_at,last_used_at,revoked_at').single());
  return { key, row: fromDb<RRApiKey>(row) };
}

export async function revokeApiKey(id: string): Promise<void> {
  await run('Revoke key', db().from('rr_api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id));
}

// ---------------------------------------------------------------
// Function API
// ---------------------------------------------------------------

export const FUNCTION_URL = ((import.meta.env.VITE_RENEWALS_API_URL as string | undefined) ?? '').replace(/\/+$/, '');

export function functionConfigured(): boolean {
  return !!FUNCTION_URL;
}

export const ackLink = (token: string) => `${FUNCTION_URL}/a/${token}`;
export const portalLink = (token: string) => `${FUNCTION_URL}/p/${token}`;

async function sessionToken(): Promise<string> {
  const { data } = await getNeon().auth.getSession();
  const token = (data as { session?: { token?: string } } | null)?.session?.token;
  if (!token) throw new Error('Your session has expired. Sign in again.');
  return token;
}

export async function callFunction<T = any>(path: string, init: { method?: string; json?: unknown; form?: FormData } = {}): Promise<T> {
  if (!FUNCTION_URL) throw new Error('The Renewal Reminder service URL is not configured (VITE_RENEWALS_API_URL).');
  const headers: Record<string, string> = { Authorization: `Bearer ${await sessionToken()}` };
  let body: BodyInit | undefined;
  if (init.form) body = init.form;
  else if (init.json !== undefined) { body = JSON.stringify(init.json); headers['Content-Type'] = 'application/json'; }
  const res = await fetch(`${FUNCTION_URL}${path}`, { method: init.method ?? 'POST', headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  complete: (id: string, note?: string, file?: File | null) => {
    const form = new FormData();
    if (note) form.set('note', note);
    if (file) form.set('file', file);
    return callFunction<{ ok: boolean; nextDue: string | null }>(`/api/renewals/${id}/complete`, { form });
  },
  reopen: (id: string) => callFunction(`/api/renewals/${id}/reopen`),
  snooze: (id: string) => callFunction<{ snoozedUntil: string }>(`/api/renewals/${id}/snooze`),
  reschedule: (id: string) => callFunction(`/api/renewals/${id}/reschedule`),
  upload: (id: string, file: File) => {
    const form = new FormData();
    form.set('file', file);
    return callFunction(`/api/renewals/${id}/attachments`, { form });
  },
  testChannel: (id: string) => callFunction<{ ok: boolean; error: string | null }>(`/api/channels/${id}/test`),
  testEmail: (accountId: string, to?: string) => callFunction<{ ok: boolean; error: string | null }>(`/api/accounts/${accountId}/test-email`, { json: { to } }),
  testWebhook: (id: string) => callFunction<{ ok: boolean; error: string | null }>(`/api/webhooks/${id}/test`),
  sendInvite: (id: string) => callFunction<{ ok: boolean; error: string | null; link: string }>(`/api/members/${id}/invite`),
  async download(attachmentId: string, fileName: string) {
    const res = await fetch(`${FUNCTION_URL}/api/attachments/${attachmentId}`, { headers: { Authorization: `Bearer ${await sessionToken()}` } });
    if (!res.ok) throw new Error('Download failed');
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },
};
