import { getNeon, getDataClient } from '../lib/neon';
import type { Product } from '../lib/access';
import { callFunction, functionConfigured } from '../renewals/data';

// =====================================================
// Platform administration.
//
// Sign-in accounts are managed through Neon Auth's admin API with the
// administrator's own session (create, ban, set password, revoke
// sessions). Profiles, product access and plans live in Postgres and are
// guarded by public.users_guard / is_admin(). Every action is written to
// public.admin_audit.
// =====================================================

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  authRole: string | null;
  banned: boolean;
  banReason: string | null;
  emailVerified: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  hasProfile: boolean;
  role: 'admin' | 'owner' | null;
  status: 'active' | 'suspended';
  products: Product[];
  mustChangePassword: boolean;
  setupComplete: boolean | null;
  company: string | null;
  phone: string | null;
  rrAccountId: string | null;
  rrAccountName: string | null;
  rrPlan: string | null;
  rrRenewals: number;
  rrOverdue: number;
  bcClients: number;
  bcActivePipelines: number;
  bcMessages: number;
}

export interface PlatformStats {
  users: { total: number; suspended: number; no_profile: number; journeys: number; renewals: number; new_30d: number; active_7d: number };
  journeys: { workspaces: number; clients: number; active_pipelines: number; completed: number; messages_30d: number };
  renewals: {
    accounts: number; by_plan: Record<string, number>; entities: number; renewals: number; overdue: number; due_30d: number;
    scheduled: number; sent_7d: number; failed_7d: number; completed_30d: number; flagged_channels: number; last_tick: string | null;
  };
}

export interface AuditEntry { id: number; actor: string; action: string; targetUser: string | null; details: Record<string, any>; createdAt: string }

const db = () => getDataClient() as any;
const auth = () => (getNeon().auth as any);

async function unwrap<T>(p: Promise<{ data: T; error: any }>, label: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message || error.statusText || `${label} failed`);
  return data;
}

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const toCamel = <T,>(row: Record<string, any>): T => Object.fromEntries(Object.entries(row).map(([k, v]) => [camel(k), typeof v === 'string' && /^\d+$/.test(v) && k.match(/^(rr_renewals|rr_overdue|bc_)/) ? Number(v) : v])) as T;

export async function listUsers(): Promise<AdminUser[]> {
  const rows = await unwrap<any[]>(db().rpc('admin_users'), 'Load users');
  return (rows ?? []).map(r => toCamel<AdminUser>(r));
}

export async function platformStats(): Promise<PlatformStats> {
  return unwrap<PlatformStats>(db().rpc('admin_platform_stats'), 'Load platform stats');
}

export async function auditLog(limit = 100, targetUser?: string): Promise<AuditEntry[]> {
  let q = db().from('admin_audit').select('*').order('id', { ascending: false }).limit(limit);
  if (targetUser) q = q.eq('target_user', targetUser);
  return (await unwrap<any[]>(q, 'Load audit log')).map(r => toCamel<AuditEntry>(r));
}

async function audit(action: string, targetUser: string | null, details: Record<string, unknown> = {}) {
  const { data } = await getNeon().auth.getSession();
  const actor = (data as any)?.user?.id;
  await db().from('admin_audit').insert({ actor, action, target_user: targetUser, details });
}

/** A readable temporary password: 14 chars, mixed case, digits, a symbol. */
export function tempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const core = Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
  return `${core.slice(0, 6)}-${core.slice(6)}!`;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  company?: string;
  phone?: string;
  products: Product[];
  renewalAccount?: { name: string; plan: string } | null;
}

export async function createUser(input: CreateUserInput): Promise<{ id: string }> {
  const email = input.email.trim().toLowerCase();
  const created = await unwrap<any>(auth().admin.createUser({
    email, password: input.password, name: input.name.trim(), role: 'user',
  }), 'Create sign-in');
  const id: string = created?.user?.id ?? created?.id;
  if (!id) throw new Error('The sign-in account was created but no user id came back.');

  const { data: s } = await getNeon().auth.getSession();
  const adminId = (s as any)?.user?.id ?? null;
  await unwrap(db().from('users').upsert({
    id, email, full_name: input.name.trim(), company: input.company?.trim() || null, phone: input.phone?.trim() || null,
    role: 'owner', status: 'active', products: input.products, must_change_password: true, setup_complete: false,
    created_by: adminId,
  }), 'Create profile');

  if (input.renewalAccount && input.products.includes('renewals')) {
    await unwrap(db().from('rr_accounts').insert({
      owner_user_id: id, name: input.renewalAccount.name.trim(), plan: input.renewalAccount.plan, owner_email: email,
    }), 'Create Renewal Reminder account');
  }
  await audit('user.create', id, { email, products: input.products, renewalAccount: input.renewalAccount ?? null });
  return { id };
}

/** Creates the CloudStep profile for a sign-in that has none (e.g. a sign-up that failed half way). */
export async function ensureProfile(u: AdminUser) {
  if (u.hasProfile) return;
  await unwrap(db().from('users').upsert({ id: u.id, email: u.email, full_name: u.name || u.email, role: 'owner', status: 'active', products: [], setup_complete: false }), 'Create profile');
}

export async function updateProfile(u: AdminUser, patch: { fullName?: string; company?: string | null; phone?: string | null }) {
  await ensureProfile(u);
  await unwrap(db().from('users').update({
    ...(patch.fullName !== undefined ? { full_name: patch.fullName } : {}),
    ...(patch.company !== undefined ? { company: patch.company } : {}),
    ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
  }).eq('id', u.id), 'Save profile');
  if (patch.fullName !== undefined && patch.fullName !== u.name) {
    await auth().admin.updateUser?.({ userId: u.id, data: { name: patch.fullName } }).catch(() => {});
  }
  await audit('user.update', u.id, patch);
}

export async function setProducts(u: AdminUser, products: Product[]) {
  await ensureProfile(u);
  await unwrap(db().from('users').update({ products }).eq('id', u.id), 'Save access');
  await audit('user.access', u.id, { from: u.products, to: products });
}

export async function suspendUser(u: AdminUser, reason: string) {
  await ensureProfile(u);
  // Block new sign-ins and kill live sessions in Neon Auth …
  await unwrap(auth().admin.banUser({ userId: u.id, banReason: reason || 'Suspended by administrator' }), 'Suspend sign-in');
  await auth().admin.revokeUserSessions({ userId: u.id }).catch(() => {});
  // … and refuse data to any token that is still in flight.
  await unwrap(db().from('users').update({ status: 'suspended', suspended_reason: reason || null }).eq('id', u.id), 'Suspend access');
  await audit('user.suspend', u.id, { reason });
}

export async function reactivateUser(u: AdminUser) {
  await unwrap(auth().admin.unbanUser({ userId: u.id }), 'Reactivate sign-in');
  if (u.hasProfile) await unwrap(db().from('users').update({ status: 'active', suspended_reason: null }).eq('id', u.id), 'Reactivate access');
  await audit('user.reactivate', u.id);
}

export async function resetPassword(u: AdminUser, newPassword: string) {
  await unwrap(auth().admin.setUserPassword({ userId: u.id, newPassword }), 'Reset password');
  await auth().admin.revokeUserSessions({ userId: u.id }).catch(() => {});
  if (u.hasProfile) await unwrap(db().from('users').update({ must_change_password: true }).eq('id', u.id), 'Flag password change');
  await audit('user.reset_password', u.id);
}

export async function signOutEverywhere(u: AdminUser) {
  await unwrap(auth().admin.revokeUserSessions({ userId: u.id }), 'Sign out sessions');
  await audit('user.revoke_sessions', u.id);
}

export async function createRenewalAccount(u: AdminUser, name: string, plan: string) {
  await unwrap(db().from('rr_accounts').insert({ owner_user_id: u.id, name, plan, owner_email: u.email }), 'Create Renewal Reminder account');
  await audit('renewals.account_create', u.id, { name, plan });
}

export async function setRenewalPlan(accountId: string, plan: string, ownerId: string | null) {
  await unwrap(db().from('rr_accounts').update({ plan }).eq('id', accountId), 'Change plan');
  await audit('renewals.plan', ownerId, { accountId, plan });
}

export async function emailUser(userId: string, kind: 'welcome' | 'reset', password: string | null, products: Product[]) {
  if (!functionConfigured()) throw new Error('The CloudStep service URL is not configured, so email cannot be sent.');
  const loginUrl = `${window.location.origin}${window.location.pathname}#/sign-in`;
  const res = await callFunction<{ ok: boolean; error: string | null }>(`/api/admin/users/${userId}/notify`, {
    json: { kind, password, products, loginUrl },
  });
  if (!res.ok) throw new Error(res.error ?? 'Email failed');
  await audit(kind === 'welcome' ? 'user.email_welcome' : 'user.email_reset', userId);
}
