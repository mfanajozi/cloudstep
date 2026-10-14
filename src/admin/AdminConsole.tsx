import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, Users, Building2, ScrollText, UserPlus, Search, ShieldOff, ShieldCheck, KeyRound, LogOut, Copy,
  RefreshCw, AlertTriangle, CheckCircle2, BellRing, Briefcase, Activity, Mail, ArrowRight, X, Crown,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { PRODUCTS, Product } from '../lib/access';
import { PLANS, PlanKey } from '../renewals/engine/plans';
import { functionConfigured, FUNCTION_URL } from '../renewals/data';
import { Button, Card, Field, Input, Modal, Select, Toggle, Pill, Empty, Stat, copyText, fmtDateTime, fmtDate } from '../renewals/ui';
import * as A from './adminData';

// =====================================================
// CloudStep platform administration (role = admin).
// =====================================================

type Tab = 'overview' | 'users' | 'tenants' | 'audit';
const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { key: 'users', label: 'Users & access', icon: <Users className="w-3.5 h-3.5" /> },
  { key: 'tenants', label: 'Tenants', icon: <Building2 className="w-3.5 h-3.5" /> },
  { key: 'audit', label: 'Audit log', icon: <ScrollText className="w-3.5 h-3.5" /> },
];

type Toast = { id: number; kind: 'success' | 'error'; title: string; body?: string };

function tabFromHash(): Tab {
  const t = window.location.hash.replace(/^#\/?/, '').split('/')[1];
  return (TABS.find(x => x.key === t)?.key) ?? 'overview';
}

export default function AdminConsole({ onOpenConsole, onOpenRenewals }: { onOpenConsole: () => void; onOpenRenewals: () => void }) {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [users, setUsers] = useState<A.AdminUser[] | null>(null);
  const [stats, setStats] = useState<A.PlatformStats | null>(null);
  const [auditRows, setAudit] = useState<A.AuditEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<string | null>(null);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { ...t, id }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), t.kind === 'error' ? 8000 : 4500);
  }, []);

  const reload = useCallback(async () => {
    try {
      const [u, s, a] = await Promise.all([A.listUsers(), A.platformStats(), A.auditLog(150)]);
      setUsers(u); setStats(s); setAudit(a); setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message ?? 'Could not load the admin console.');
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    const on = () => setTab(tabFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const go = (t: Tab) => { window.location.hash = t === 'overview' ? '/admin' : `/admin/${t}`; setTab(t); };
  const nameOf = (id: string | null) => {
    if (!id) return '—';
    const u = users?.find(x => x.id === id);
    return u ? (u.name || u.email) : id === user?.id ? 'You' : 'Unknown user';
  };
  const managed = users?.find(u => u.id === managing) ?? null;

  return (
    <div className="min-h-screen bg-ink-950 text-slate-800 font-sans flex flex-col">
      <header className="bg-slate-150 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/favicon.png" alt="" className="w-9 h-9 object-contain" />
            <div className="leading-none min-w-0">
              <p className="text-base font-bold tracking-tight text-slate-900 truncate">CloudStep <span className="text-blue-600">Admin</span></p>
              <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mt-1">Platform administration</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button kind="ghost" onClick={onOpenConsole}><Briefcase className="w-3.5 h-3.5" /><span className="hidden sm:inline">Business Console</span></Button>
            <Button kind="ghost" onClick={onOpenRenewals}><BellRing className="w-3.5 h-3.5" /><span className="hidden sm:inline">Renewal Reminder</span></Button>
            <Button kind="ghost" onClick={() => signOut()} title="Sign out"><LogOut className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-slate-950">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</h1>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Every tenant, user and system in one place</p>
          </div>
          <nav className="flex overflow-x-auto no-scrollbar bg-slate-150 border border-slate-200 rounded-xl p-1 gap-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => go(t.key)} className={`text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${tab === t.key ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}>{t.icon}{t.label}</button>
            ))}
          </nav>
        </div>

        {loadError && <Card><p className="text-sm text-red-600">{loadError}</p><Button className="mt-3" onClick={reload}><RefreshCw className="w-3.5 h-3.5" /> Retry</Button></Card>}
        {!users || !stats ? (!loadError && <p className="text-sm text-slate-400 font-semibold text-center py-20">Loading platform data…</p>) : (
          <>
            {tab === 'overview' && <Overview stats={stats} users={users} audit={auditRows} nameOf={nameOf} onCreate={() => setCreating(true)} onManage={setManaging} go={go} />}
            {tab === 'users' && <UsersTab users={users} meId={user?.id ?? ''} onCreate={() => setCreating(true)} onManage={setManaging} />}
            {tab === 'tenants' && <Tenants users={users} onManage={setManaging} toast={toast} reload={reload} />}
            {tab === 'audit' && <AuditTab rows={auditRows} nameOf={nameOf} />}
          </>
        )}
      </main>

      {creating && <CreateUser onClose={() => setCreating(false)} toast={toast} onCreated={async id => { await reload(); setManaging(id); }} />}
      {managed && <ManageUser u={managed} isSelf={managed.id === user?.id} onClose={() => setManaging(null)} toast={toast} reload={reload} audit={auditRows.filter(a => a.targetUser === managed.id)} nameOf={nameOf} />}

      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 sm:max-w-sm">
        {toasts.map(t => (
          <div key={t.id} role="status" className={`rounded-xl shadow-2xl border p-3 flex items-start gap-2 ${t.kind === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
            {t.kind === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 mt-0.5 text-red-600" />}
            <div className="flex-1 min-w-0"><p className="text-xs font-bold">{t.title}</p>{t.body && <p className="text-[11px] mt-0.5 opacity-90 break-words">{t.body}</p>}</div>
            <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} aria-label="Dismiss"><X className="w-3.5 h-3.5 text-slate-400" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Overview
// ---------------------------------------------------------------

function useServiceHealth() {
  const [health, setHealth] = useState<'unknown' | 'ok' | 'down'>('unknown');
  useEffect(() => {
    if (!functionConfigured()) return;
    fetch(`${FUNCTION_URL}/health`).then(r => setHealth(r.ok ? 'ok' : 'down')).catch(() => setHealth('down'));
  }, []);
  return health;
}

function Overview({ stats, users, audit, nameOf, onCreate, onManage, go }: {
  stats: A.PlatformStats; users: A.AdminUser[]; audit: A.AuditEntry[]; nameOf: (id: string | null) => string;
  onCreate: () => void; onManage: (id: string) => void; go: (t: Tab) => void;
}) {
  const health = useServiceHealth();
  const tickAge = stats.renewals.last_tick ? Math.round((Date.now() - new Date(stats.renewals.last_tick).getTime()) / 60000) : null;
  const neverSignedIn = users.filter(u => !u.lastActiveAt && u.role !== 'admin');
  const pendingPassword = users.filter(u => u.mustChangePassword);
  const issues: { tone: 'red' | 'amber'; text: string; action?: () => void }[] = [];
  if (health === 'down') issues.push({ tone: 'red', text: 'The reminder service is not responding.' });
  if (tickAge !== null && tickAge > 15) issues.push({ tone: 'red', text: `The reminder scheduler last ran ${tickAge} minutes ago (expected every 5).` });
  if (tickAge === null) issues.push({ tone: 'amber', text: 'The reminder scheduler has not reported a run yet.' });
  if (stats.renewals.failed_7d > 0) issues.push({ tone: 'amber', text: `${stats.renewals.failed_7d} reminder deliveries failed in the last 7 days.` });
  if (stats.renewals.flagged_channels > 0) issues.push({ tone: 'amber', text: `${stats.renewals.flagged_channels} delivery channel(s) flagged as failing.` });
  if (stats.users.no_profile > 0) issues.push({ tone: 'amber', text: `${stats.users.no_profile} sign-in(s) have no CloudStep profile or access yet.`, action: () => go('users') });
  if (stats.users.suspended > 0) issues.push({ tone: 'amber', text: `${stats.users.suspended} user(s) suspended.`, action: () => go('users') });
  const plans = Object.entries(stats.renewals.by_plan);
  const maxPlan = Math.max(1, ...plans.map(([, n]) => n));

  return (
    <div className="space-y-5">
      <Card className="!p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center border ${issues.some(i => i.tone === 'red') ? 'bg-red-50 border-red-200 text-red-600' : issues.length ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
              {issues.length ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </span>
            <div>
              <p className="font-bold text-slate-900">{issues.length ? `${issues.length} thing${issues.length === 1 ? '' : 's'} need your attention` : 'All systems healthy'}</p>
              <p className="text-xs text-slate-500">
                Reminder service: <b className={health === 'ok' ? 'text-emerald-600' : health === 'down' ? 'text-red-600' : 'text-slate-500'}>{health === 'ok' ? 'online' : health === 'down' ? 'offline' : 'not configured'}</b>
                {tickAge !== null && <> · scheduler ran {tickAge <= 0 ? 'just now' : `${tickAge} min ago`}</>}
              </p>
            </div>
          </div>
          <Button kind="primary" onClick={onCreate}><UserPlus className="w-4 h-4" /> Create user</Button>
        </div>
        {issues.length > 0 && (
          <ul className="mt-3 space-y-1">
            {issues.map((i, n) => (
              <li key={n} className={`text-xs flex items-center gap-2 ${i.tone === 'red' ? 'text-red-600' : 'text-amber-700'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${i.tone === 'red' ? 'bg-red-500' : 'bg-amber-500'}`} />{i.text}
                {i.action && <button onClick={i.action} className="underline cursor-pointer">Review</button>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section>
        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-2 flex items-center gap-1.5"><Users className="w-3 h-3" /> Users</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Total users" value={stats.users.total} sub={`${stats.users.new_30d} new in 30 days`} />
          <Stat label="Active this week" value={stats.users.active_7d} tone="text-blue-600" sub="signed in within 7 days" />
          <Stat label="With Business Console" value={stats.users.journeys} />
          <Stat label="With Renewal Reminder" value={stats.users.renewals} />
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-slate-900 flex items-center gap-2"><Briefcase className="w-4 h-4 text-blue-600" /> Business Console</p>
            <Pill>{stats.journeys.workspaces} workspaces</Pill>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Active clients" value={stats.journeys.clients} />
            <MiniStat label="Active pipelines" value={stats.journeys.active_pipelines} />
            <MiniStat label="Completed journeys" value={stats.journeys.completed} />
            <MiniStat label="Updates sent (30d)" value={stats.journeys.messages_30d} />
          </div>
        </Card>
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-slate-900 flex items-center gap-2"><BellRing className="w-4 h-4 text-blue-600" /> Renewal Reminder</p>
            <Pill>{stats.renewals.accounts} accounts · {stats.renewals.entities} entities</Pill>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Active renewals" value={stats.renewals.renewals} />
            <MiniStat label="Due in 30 days" value={stats.renewals.due_30d} />
            <MiniStat label="Overdue" value={stats.renewals.overdue} danger={stats.renewals.overdue > 0} />
            <MiniStat label="Reminders sent (7d)" value={stats.renewals.sent_7d} />
            <MiniStat label="Failed (7d)" value={stats.renewals.failed_7d} danger={stats.renewals.failed_7d > 0} />
            <MiniStat label="Done (30d)" value={stats.renewals.completed_30d} />
          </div>
          {plans.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {plans.map(([plan, n]) => (
                <div key={plan} className="flex items-center gap-2 text-[11px]">
                  <span className="w-28 text-slate-500">{PLANS[plan as PlanKey]?.label ?? plan}</span>
                  <span className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden"><span className="block h-full bg-blue-600 rounded-full" style={{ width: `${(n / maxPlan) * 100}%` }} /></span>
                  <span className="w-6 text-right font-bold text-slate-800">{n}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="font-bold text-slate-900">Newest users</p>
            <button onClick={() => go('users')} className="text-xs font-bold text-blue-600 inline-flex items-center gap-1 cursor-pointer">All users <ArrowRight className="w-3 h-3" /></button>
          </div>
          <ul className="divide-y divide-slate-200">
            {users.slice(0, 6).map(u => (
              <li key={u.id}>
                <button onClick={() => onManage(u.id)} className="w-full text-left py-2 flex items-center gap-3 hover:bg-slate-50 rounded-lg px-1 cursor-pointer">
                  <Avatar u={u} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{u.name || u.email}</p>
                    <p className="text-[11px] text-slate-500 truncate">{u.email} · joined {fmtDate(u.createdAt)}</p>
                  </div>
                  <StatusPill u={u} />
                </button>
              </li>
            ))}
          </ul>
          {(neverSignedIn.length > 0 || pendingPassword.length > 0) && (
            <p className="text-[11px] text-slate-400 mt-2">{neverSignedIn.length} never signed in · {pendingPassword.length} still on a temporary password</p>
          )}
        </Card>
        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="font-bold text-slate-900 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-600" /> Recent admin activity</p>
            <button onClick={() => go('audit')} className="text-xs font-bold text-blue-600 inline-flex items-center gap-1 cursor-pointer">Audit log <ArrowRight className="w-3 h-3" /></button>
          </div>
          {audit.length === 0 ? <p className="text-xs text-slate-400 py-4">No admin actions recorded yet.</p> : (
            <ul className="space-y-2">
              {audit.slice(0, 7).map(a => (
                <li key={a.id} className="text-xs text-slate-600"><b className="text-slate-800">{describeAction(a.action)}</b> · {nameOf(a.targetUser)} <span className="text-slate-400">· {fmtDateTime(a.createdAt)}</span></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function MiniStat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
      <p className={`text-lg font-black ${danger ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
      <p className="text-[10px] text-slate-500 leading-tight">{label}</p>
    </div>
  );
}

function Avatar({ u }: { u: A.AdminUser }) {
  const initials = (u.name || u.email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
  return <span className="w-8 h-8 shrink-0 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-bold flex items-center justify-center">{u.role === 'admin' ? <Crown className="w-3.5 h-3.5 text-blue-600" /> : initials}</span>;
}

function StatusPill({ u }: { u: A.AdminUser }) {
  if (u.banned || u.status === 'suspended') return <Pill className="text-red-700 border-red-200 bg-red-50">Suspended</Pill>;
  if (!u.hasProfile) return <Pill className="text-amber-800 border-amber-200 bg-amber-50">No access</Pill>;
  if (u.mustChangePassword) return <Pill className="text-amber-800 border-amber-200 bg-amber-50">Temp password</Pill>;
  if (u.role === 'admin') return <Pill className="text-blue-700 border-blue-200 bg-blue-50">Admin</Pill>;
  return <Pill className="text-emerald-700 border-emerald-200 bg-emerald-50">Active</Pill>;
}

const ACTIONS: Record<string, string> = {
  'user.create': 'Created user', 'user.update': 'Updated profile', 'user.access': 'Changed system access',
  'user.suspend': 'Suspended', 'user.reactivate': 'Reactivated', 'user.reset_password': 'Reset password',
  'user.revoke_sessions': 'Signed out everywhere', 'user.email_welcome': 'Emailed sign-in details',
  'user.email_reset': 'Emailed new password', 'renewals.account_create': 'Created Renewal Reminder account',
  'renewals.plan': 'Changed Renewal Reminder plan',
};
const describeAction = (a: string) => ACTIONS[a] ?? a;

// ---------------------------------------------------------------
// Users
// ---------------------------------------------------------------

function UsersTab({ users, meId, onCreate, onManage }: { users: A.AdminUser[]; meId: string; onCreate: () => void; onManage: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [product, setProduct] = useState('');
  const [status, setStatus] = useState('');
  const list = useMemo(() => users.filter(u => {
    if (q && !`${u.name} ${u.email} ${u.company ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (product === 'none' ? u.products.length > 0 : product && !u.products.includes(product as Product)) return false;
    const suspended = u.banned || u.status === 'suspended';
    if (status === 'suspended' && !suspended) return false;
    if (status === 'active' && suspended) return false;
    if (status === 'temp' && !u.mustChangePassword) return false;
    if (status === 'never' && u.lastActiveAt) return false;
    return true;
  }), [users, q, product, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <div className="grid grid-cols-2 sm:flex gap-2">
          <div className="relative col-span-2 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email or company" className="!pl-8 !py-1.5 text-xs" />
          </div>
          <Select value={product} onChange={e => setProduct(e.target.value)} className="!py-1.5 text-xs sm:w-48">
            <option value="">All systems</option>
            {PRODUCTS.map(p => <option key={p.key} value={p.key}>{p.short}</option>)}
            <option value="none">No system assigned</option>
          </Select>
          <Select value={status} onChange={e => setStatus(e.target.value)} className="!py-1.5 text-xs sm:w-44">
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="temp">On temporary password</option>
            <option value="never">Never signed in</option>
          </Select>
        </div>
        <Button kind="primary" onClick={onCreate}><UserPlus className="w-4 h-4" /> Create user</Button>
      </div>

      <div className="bg-slate-150 border border-slate-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-xs min-w-[760px]">
          <thead><tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
            <th className="p-3">User</th><th className="p-3">Systems</th><th className="p-3">Footprint</th><th className="p-3">Last active</th><th className="p-3">Status</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {list.map(u => (
              <tr key={u.id} className="border-t border-slate-200 hover:bg-slate-50/60">
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar u={u} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{u.name || '—'}{u.id === meId && <span className="text-slate-400 font-normal"> (you)</span>}</p>
                      <p className="text-[11px] text-slate-500 truncate">{u.email}{u.company ? ` · ${u.company}` : ''}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {u.role === 'admin' ? <Pill>All systems</Pill> : u.products.length ? u.products.map(p => <Pill key={p}>{PRODUCTS.find(x => x.key === p)?.short ?? p}</Pill>) : <span className="text-slate-400">None</span>}
                  </div>
                </td>
                <td className="p-3 text-slate-500 leading-relaxed">
                  {u.products.includes('journeys') && <span className="block">BC: {u.bcClients} clients · {u.bcActivePipelines} active</span>}
                  {u.rrAccountId ? <span className="block">RR: {u.rrRenewals} renewals{u.rrOverdue ? <b className="text-red-600"> · {u.rrOverdue} overdue</b> : ''} · {PLANS[u.rrPlan as PlanKey]?.label ?? u.rrPlan}</span>
                    : u.products.includes('renewals') ? <span className="block text-slate-400">RR: not set up yet</span> : null}
                </td>
                <td className="p-3 text-slate-500 whitespace-nowrap">{u.lastActiveAt ? fmtDateTime(u.lastActiveAt) : 'Never'}</td>
                <td className="p-3"><StatusPill u={u} /></td>
                <td className="p-3 text-right"><Button onClick={() => onManage(u.id)}>Manage</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <Empty title="No users match these filters" />}
      </div>
    </div>
  );
}

function CreateUser({ onClose, toast, onCreated }: { onClose: () => void; toast: (t: Omit<Toast, 'id'>) => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [products, setProducts] = useState<Product[]>(['renewals']);
  const [password, setPassword] = useState(A.tempPassword);
  const [setupRR, setSetupRR] = useState(true);
  const [plan, setPlan] = useState<PlanKey>('business');
  const [sendEmail, setSendEmail] = useState(functionConfigured());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; emailed: boolean } | null>(null);
  const valid = name.trim().length >= 2 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && password.length >= 8 && products.length > 0;

  const toggle = (p: Product) => setProducts(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const submit = async () => {
    setBusy(true);
    try {
      const { id } = await A.createUser({
        name, email, password, company, phone, products,
        renewalAccount: setupRR && products.includes('renewals') ? { name: company.trim() || name.trim(), plan } : null,
      });
      let emailed = false;
      if (sendEmail) {
        try { await A.emailUser(id, 'welcome', password, products); emailed = true; }
        catch (e: any) { toast({ kind: 'error', title: 'User created, but the welcome email failed', body: e?.message }); }
      }
      setDone({ id, emailed });
      toast({ kind: 'success', title: `${name.trim()} can now sign in` });
    } catch (e: any) {
      toast({ kind: 'error', title: 'Could not create the user', body: e?.message });
    }
    setBusy(false);
  };

  if (done) {
    return (
      <Modal title="User created" onClose={() => { onClose(); onCreated(done.id); }} footer={<Button kind="primary" onClick={() => { onClose(); onCreated(done.id); }}>Done</Button>}>
        <div className="space-y-3 text-sm text-slate-600">
          <p><b className="text-slate-900">{name}</b> has access to {products.map(p => PRODUCTS.find(x => x.key === p)!.short).join(' and ')}.</p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1 text-xs">
            <p>Sign in at: <b className="text-slate-900 break-all">{`${window.location.origin}${window.location.pathname}`}</b></p>
            <p>Email: <b className="text-slate-900">{email.trim().toLowerCase()}</b></p>
            <p className="flex items-center gap-2">Temporary password: <code className="text-slate-900 font-bold">{password}</code>
              <button onClick={async () => { if (await copyText(password)) toast({ kind: 'success', title: 'Password copied' }); }} className="text-blue-600 cursor-pointer" aria-label="Copy password"><Copy className="w-3.5 h-3.5" /></button></p>
          </div>
          <p className="text-xs">{done.emailed ? 'These details were emailed to them.' : 'Share these details with them securely.'} They'll choose their own password on first sign-in.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Create a user" onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button kind="primary" busy={busy} disabled={!valid} onClick={submit}><UserPlus className="w-3.5 h-3.5" /> Create user</Button></>}>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Full name"><Input value={name} onChange={e => setName(e.target.value)} autoFocus /></Field>
          <Field label="Email (their sign-in)"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <Field label="Company"><Input value={company} onChange={e => setCompany(e.target.value)} /></Field>
          <Field label="Phone"><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+27…" /></Field>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Systems they can use</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {PRODUCTS.map(p => (
              <button key={p.key} type="button" onClick={() => toggle(p.key)} className={`text-left rounded-xl border p-3 cursor-pointer transition-all ${products.includes(p.key) ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <p className="text-sm font-bold text-slate-900 flex items-center gap-2">{p.key === 'renewals' ? <BellRing className="w-4 h-4 text-blue-600" /> : <Briefcase className="w-4 h-4 text-blue-600" />}{p.short}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{p.key === 'renewals' ? 'Renewal & compliance reminders' : 'Property client journeys & communications'}</p>
              </button>
            ))}
          </div>
        </div>

        {products.includes('renewals') && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
            <Toggle checked={setupRR} onChange={setSetupRR} label="Create their Renewal Reminder account now" hint={`Named after the company (or their name). Off = they create it themselves on first sign-in, on the Business plan.`} />
            {setupRR && (
              <Field label="Plan">
                <Select value={plan} onChange={e => setPlan(e.target.value as PlanKey)}>
                  {(Object.keys(PLANS) as PlanKey[]).map(k => <option key={k} value={k}>{PLANS[k].label}</option>)}
                </Select>
              </Field>
            )}
          </div>
        )}

        <Field label="Temporary password" hint="They must change it the first time they sign in.">
          <div className="flex gap-2">
            <Input value={password} onChange={e => setPassword(e.target.value)} className="font-mono" />
            <Button kind="ghost" onClick={() => setPassword(A.tempPassword())} title="Generate another"><RefreshCw className="w-3.5 h-3.5" /></Button>
          </div>
        </Field>
        <Toggle checked={sendEmail} onChange={setSendEmail} disabled={!functionConfigured()} label="Email the sign-in details to them" hint={functionConfigured() ? 'Sent through your Mailgun account.' : 'Email needs the CloudStep service URL (VITE_RENEWALS_API_URL).'} />
      </div>
    </Modal>
  );
}

function ManageUser({ u, isSelf, onClose, toast, reload, audit, nameOf }: {
  u: A.AdminUser; isSelf: boolean; onClose: () => void; toast: (t: Omit<Toast, 'id'>) => void; reload: () => Promise<void>;
  audit: A.AuditEntry[]; nameOf: (id: string | null) => string;
}) {
  const [name, setName] = useState(u.name);
  const [company, setCompany] = useState(u.company ?? '');
  const [phone, setPhone] = useState(u.phone ?? '');
  const [products, setProducts] = useState<Product[]>(u.products);
  const [reason, setReason] = useState('');
  const [plan, setPlan] = useState<PlanKey>((u.rrPlan as PlanKey) ?? 'business');
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const suspended = u.banned || u.status === 'suspended';

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast({ kind: 'success', title: ok }); await reload(); }
    catch (e: any) { toast({ kind: 'error', title: 'That did not work', body: e?.message }); }
    setBusy(null);
  };

  const productsChanged = JSON.stringify([...products].sort()) !== JSON.stringify([...u.products].sort());
  const profileChanged = name !== u.name || company !== (u.company ?? '') || phone !== (u.phone ?? '');

  return (
    <Modal title={u.name || u.email} onClose={onClose} wide>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Avatar u={u} />
            <div className="min-w-0">
              <p className="text-sm text-slate-500 truncate">{u.email}</p>
              <p className="text-[11px] text-slate-400">Joined {fmtDate(u.createdAt)} · last active {u.lastActiveAt ? fmtDateTime(u.lastActiveAt) : 'never'}</p>
            </div>
            <div className="ml-auto"><StatusPill u={u} /></div>
          </div>
          {suspended && u.banReason && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Suspended: {u.banReason}</p>}

          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Profile</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Full name"><Input value={name} onChange={e => setName(e.target.value)} /></Field>
              <Field label="Phone"><Input value={phone} onChange={e => setPhone(e.target.value)} /></Field>
              <Field label="Company" className="sm:col-span-2"><Input value={company} onChange={e => setCompany(e.target.value)} /></Field>
            </div>
            <Button disabled={!profileChanged} busy={busy === 'profile'} onClick={() => run('profile', () => A.updateProfile(u, { fullName: name.trim(), company: company.trim() || null, phone: phone.trim() || null }), 'Profile saved')}>Save profile</Button>
          </section>

          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">System access</p>
            {u.role === 'admin' ? <p className="text-xs text-slate-500">Administrators can open every system.</p> : (
              <>
                {PRODUCTS.map(p => (
                  <Toggle key={p.key} checked={products.includes(p.key)} onChange={v => setProducts(v ? [...products, p.key] : products.filter(x => x !== p.key))}
                    label={p.label} hint={p.key === 'renewals' ? 'Removing it hides their Renewal Reminder account (team members they invited keep their own access).' : 'Removing it hides their client journeys; nothing is deleted.'} />
                ))}
                <Button kind="primary" disabled={!productsChanged} busy={busy === 'access'} onClick={() => run('access', () => A.setProducts(u, products), 'Access updated')}>Save access</Button>
              </>
            )}
          </section>

          {(u.products.includes('renewals') || u.role === 'admin') && (
            <section className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Renewal Reminder account</p>
              {u.rrAccountId ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-800"><b>{u.rrAccountName}</b> · {u.rrRenewals} renewals{u.rrOverdue ? <span className="text-red-600"> · {u.rrOverdue} overdue</span> : ''}</p>
                  <div className="flex gap-2">
                    <Select value={plan} onChange={e => setPlan(e.target.value as PlanKey)}>{(Object.keys(PLANS) as PlanKey[]).map(k => <option key={k} value={k}>{PLANS[k].label}</option>)}</Select>
                    <Button disabled={plan === u.rrPlan} busy={busy === 'plan'} onClick={() => run('plan', () => A.setRenewalPlan(u.rrAccountId!, plan, u.id), `Plan changed to ${PLANS[plan].label}`)}>Change plan</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 items-end">
                  <Field label="Plan" className="flex-1"><Select value={plan} onChange={e => setPlan(e.target.value as PlanKey)}>{(Object.keys(PLANS) as PlanKey[]).map(k => <option key={k} value={k}>{PLANS[k].label}</option>)}</Select></Field>
                  <Button busy={busy === 'rr'} onClick={() => run('rr', () => A.createRenewalAccount(u, (u.company || u.name || u.email).trim(), plan), 'Renewal Reminder account created')}>Create account for them</Button>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="space-y-5 lg:border-l lg:border-slate-200 lg:pl-6">
          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Security</p>
            {isSelf ? <p className="text-xs text-slate-500">You can't suspend or reset your own account here. Use “My profile” in the Business Console.</p> : (
              <>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <p className="text-sm font-bold text-slate-900 flex items-center gap-2"><KeyRound className="w-4 h-4 text-blue-600" /> Reset password</p>
                  <p className="text-[11px] text-slate-500">Sets a temporary password, signs them out everywhere, and makes them choose a new one at next sign-in.</p>
                  {newPassword ? (
                    <div className="space-y-2">
                      <p className="text-xs flex items-center gap-2">New temporary password: <code className="font-bold text-slate-900">{newPassword}</code>
                        <button onClick={async () => { if (await copyText(newPassword)) toast({ kind: 'success', title: 'Password copied' }); }} className="text-blue-600 cursor-pointer" aria-label="Copy"><Copy className="w-3.5 h-3.5" /></button></p>
                      {functionConfigured() && <Button busy={busy === 'mail'} onClick={() => run('mail', () => A.emailUser(u.id, 'reset', newPassword, u.products), `Emailed to ${u.email}`)}><Mail className="w-3.5 h-3.5" /> Email it to them</Button>}
                    </div>
                  ) : (
                    <Button busy={busy === 'reset'} onClick={() => {
                      const pw = A.tempPassword();
                      run('reset', async () => { await A.resetPassword(u, pw); setNewPassword(pw); }, 'Password reset');
                    }}>Reset password</Button>
                  )}
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <p className="text-sm font-bold text-slate-900 flex items-center gap-2"><LogOut className="w-4 h-4 text-blue-600" /> Sign out everywhere</p>
                  <p className="text-[11px] text-slate-500">Ends every active session. They can sign straight back in.</p>
                  <Button busy={busy === 'sessions'} onClick={() => run('sessions', () => A.signOutEverywhere(u), 'All sessions ended')}>Sign out all sessions</Button>
                </div>
                <div className={`border rounded-xl p-3 space-y-2 ${suspended ? 'bg-emerald-50/40 border-emerald-200' : 'bg-red-50/40 border-red-200'}`}>
                  <p className="text-sm font-bold text-slate-900 flex items-center gap-2">{suspended ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <ShieldOff className="w-4 h-4 text-red-600" />}{suspended ? 'Reactivate access' : 'Suspend access'}</p>
                  {suspended ? (
                    <>
                      <p className="text-[11px] text-slate-500">They can sign in again and see their data exactly as it was.</p>
                      <Button busy={busy === 'unban'} onClick={() => run('unban', () => A.reactivateUser(u), 'Access restored')}>Reactivate</Button>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] text-slate-500">Blocks sign-in and cuts off their data immediately. Nothing is deleted.</p>
                      <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (shown to them), e.g. account overdue" />
                      <Button kind="danger" busy={busy === 'ban'} onClick={() => { if (confirm(`Suspend ${u.email}?`)) run('ban', () => A.suspendUser(u, reason.trim()), 'User suspended'); }}>Suspend</Button>
                    </>
                  )}
                </div>
              </>
            )}
          </section>

          <section>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">History</p>
            {audit.length === 0 ? <p className="text-xs text-slate-400">No admin actions on this user yet.</p> : (
              <ul className="space-y-1.5">
                {audit.slice(0, 12).map(a => <li key={a.id} className="text-xs text-slate-600"><b className="text-slate-800">{describeAction(a.action)}</b> by {nameOf(a.actor)} <span className="text-slate-400">· {fmtDateTime(a.createdAt)}</span></li>)}
              </ul>
            )}
          </section>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------

function Tenants({ users, onManage, toast, reload }: { users: A.AdminUser[]; onManage: (id: string) => void; toast: (t: Omit<Toast, 'id'>) => void; reload: () => Promise<void> }) {
  const rr = users.filter(u => u.rrAccountId);
  const bc = users.filter(u => u.role !== 'admin' && u.products.includes('journeys'));
  return (
    <div className="space-y-6">
      <section>
        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-2 flex items-center gap-1.5"><BellRing className="w-3 h-3" /> Renewal Reminder accounts ({rr.length})</p>
        <div className="bg-slate-150 border border-slate-200 rounded-2xl overflow-x-auto">
          <table className="w-full text-xs min-w-[640px]">
            <thead><tr className="text-left text-[10px] uppercase tracking-wide text-slate-400"><th className="p-3">Account</th><th className="p-3">Owner</th><th className="p-3">Renewals</th><th className="p-3">Plan</th><th className="p-3"></th></tr></thead>
            <tbody>
              {rr.map(u => (
                <tr key={u.id} className="border-t border-slate-200">
                  <td className="p-3 font-semibold text-slate-900">{u.rrAccountName}</td>
                  <td className="p-3 text-slate-500">{u.name || u.email}<span className="block text-[10px]">{u.email}</span></td>
                  <td className="p-3 text-slate-600">{u.rrRenewals}{u.rrOverdue ? <b className="text-red-600"> · {u.rrOverdue} overdue</b> : ''}</td>
                  <td className="p-3">
                    <Select value={u.rrPlan ?? 'business'} className="!py-1 text-xs !w-40" onChange={async e => {
                      try { await A.setRenewalPlan(u.rrAccountId!, e.target.value, u.id); toast({ kind: 'success', title: `Plan changed to ${PLANS[e.target.value as PlanKey].label}` }); await reload(); }
                      catch (x: any) { toast({ kind: 'error', title: 'Could not change plan', body: x?.message }); }
                    }}>{(Object.keys(PLANS) as PlanKey[]).map(k => <option key={k} value={k}>{PLANS[k].label}</option>)}</Select>
                  </td>
                  <td className="p-3 text-right"><Button onClick={() => onManage(u.id)}>Owner</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rr.length === 0 && <Empty title="No Renewal Reminder accounts yet" />}
        </div>
      </section>

      <section>
        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-2 flex items-center gap-1.5"><Briefcase className="w-3 h-3" /> Business Console workspaces ({bc.length})</p>
        <div className="bg-slate-150 border border-slate-200 rounded-2xl overflow-x-auto">
          <table className="w-full text-xs min-w-[640px]">
            <thead><tr className="text-left text-[10px] uppercase tracking-wide text-slate-400"><th className="p-3">Owner</th><th className="p-3">Company</th><th className="p-3">Clients</th><th className="p-3">Active pipelines</th><th className="p-3">Updates sent</th><th className="p-3">Setup</th><th className="p-3"></th></tr></thead>
            <tbody>
              {bc.map(u => (
                <tr key={u.id} className="border-t border-slate-200">
                  <td className="p-3 font-semibold text-slate-900">{u.name || u.email}<span className="block text-[10px] font-normal text-slate-500">{u.email}</span></td>
                  <td className="p-3 text-slate-600">{u.company || '—'}</td>
                  <td className="p-3 text-slate-600">{u.bcClients}</td>
                  <td className="p-3 text-slate-600">{u.bcActivePipelines}</td>
                  <td className="p-3 text-slate-600">{u.bcMessages}</td>
                  <td className="p-3">{u.setupComplete ? <Pill className="text-emerald-700 border-emerald-200">Done</Pill> : <Pill>Not yet</Pill>}</td>
                  <td className="p-3 text-right"><Button onClick={() => onManage(u.id)}>Owner</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {bc.length === 0 && <Empty title="No Business Console workspaces yet" />}
        </div>
      </section>
    </div>
  );
}

function AuditTab({ rows, nameOf }: { rows: A.AuditEntry[]; nameOf: (id: string | null) => string }) {
  if (!rows.length) return <Card><Empty icon={<ScrollText className="w-5 h-5" />} title="No admin actions recorded yet">Every user creation, access change, suspension and password reset is logged here.</Empty></Card>;
  return (
    <div className="bg-slate-150 border border-slate-200 rounded-2xl overflow-x-auto">
      <table className="w-full text-xs min-w-[640px]">
        <thead><tr className="text-left text-[10px] uppercase tracking-wide text-slate-400"><th className="p-3">When</th><th className="p-3">Action</th><th className="p-3">User</th><th className="p-3">By</th><th className="p-3">Details</th></tr></thead>
        <tbody>
          {rows.map(a => (
            <tr key={a.id} className="border-t border-slate-200 align-top">
              <td className="p-3 whitespace-nowrap text-slate-600">{fmtDateTime(a.createdAt)}</td>
              <td className="p-3 font-semibold text-slate-900">{describeAction(a.action)}</td>
              <td className="p-3 text-slate-600">{nameOf(a.targetUser)}</td>
              <td className="p-3 text-slate-600">{nameOf(a.actor)}</td>
              <td className="p-3 text-slate-500 font-mono text-[10px] break-all">{Object.keys(a.details ?? {}).length ? JSON.stringify(a.details) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
