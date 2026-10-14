import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard, Building2, Send, Webhook, Users, BarChart3, Settings as Cog, LogOut, ArrowLeft, BellRing,
  CheckCircle2, Circle, X, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Access, canUse } from '../lib/access';
import { NoAccessScreen } from '../components/AccessScreens';
import { getDataClient } from '../lib/neon';
import { fetchUserProfile } from '../lib/data';
import * as data from './data';
import { RRProvider, useRR } from './store';
import type { MyAccount } from './types';
import { Button, Card, Field, Input, Select } from './ui';
import Overview from './Overview';
import Entities from './Entities';
import Channels from './Channels';
import Integrations from './Integrations';
import Team from './Team';
import Reports from './Reports';
import Settings from './Settings';
import RenewalForm from './RenewalForm';

// =====================================================
// CloudStep Renewal Reminder — standalone workspace at #/renewals.
// Shares sign-in and the users table with CloudSTep; everything else
// (accounts, roles, data) is its own.
// =====================================================

type Tab = 'dashboard' | 'entities' | 'channels' | 'integrations' | 'team' | 'reports' | 'settings';
const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { key: 'entities', label: 'Clients & entities', icon: <Building2 className="w-3.5 h-3.5" /> },
  { key: 'channels', label: 'Channels', icon: <Send className="w-3.5 h-3.5" /> },
  { key: 'integrations', label: 'Integrations', icon: <Webhook className="w-3.5 h-3.5" /> },
  { key: 'team', label: 'Team', icon: <Users className="w-3.5 h-3.5" /> },
  { key: 'reports', label: 'Reports', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: 'settings', label: 'Settings', icon: <Cog className="w-3.5 h-3.5" /> },
];

const ACCOUNT_KEY = 'cloudstep.rr.account';

function parseHash(): { tab: Tab; invite: string | null } {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/');
  if (parts[1] === 'invite' && parts[2]) return { tab: 'dashboard', invite: parts[2] };
  const tab = TABS.find(t => t.key === parts[1])?.key ?? 'dashboard';
  return { tab, invite: null };
}

export default function RenewalsApp({ onExit, access }: { onExit?: () => void; access: Access }) {
  const { user, signOut } = useAuth();
  const [accounts, setAccounts] = useState<MyAccount[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState(user?.email ?? '');
  const [ownerName, setOwnerName] = useState(user?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const loadAccounts = useCallback(async (prefer?: string) => {
    const list = await data.myAccounts();
    setAccounts(list);
    let saved: string | null = null;
    try { saved = localStorage.getItem(ACCOUNT_KEY); } catch { /* private mode */ }
    const pick = list.find(a => a.accountId === prefer) ?? list.find(a => a.accountId === saved) ?? list[0];
    setCurrent(pick?.accountId ?? null);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const db = getDataClient();
        // Every Renewal Reminder user is a CloudStep member (users row), the
        // same rule the rest of the platform uses for access.
        let profile = await fetchUserProfile(db as any, user.id).catch(() => null);
        if (!profile) {
          await (db as any).from('users').upsert({ id: user.id, full_name: user.name || user.email, email: user.email, setup_complete: false });
          profile = await fetchUserProfile(db as any, user.id).catch(() => null);
        }
        setIsPlatformAdmin(access.role === 'admin');
        if (profile?.email) setOwnerEmail(profile.email);
        if (profile?.fullName) setOwnerName(profile.fullName);

        const { invite } = parseHash();
        let joined: string | undefined;
        if (invite) {
          try {
            joined = await data.acceptInvite(invite);
            setInviteMsg('Invitation accepted. Welcome to the team.');
          } catch (e: any) {
            setInviteMsg(e?.message ?? 'That invitation could not be accepted.');
          }
          window.history.replaceState(null, '', '#/renewals');
        }
        await loadAccounts(joined);
      } catch (e: any) {
        setError(e?.message ?? 'Could not open Renewal Reminder.');
      }
    })();
  }, [user, loadAccounts]);

  const switchAccount = useCallback((id: string) => {
    try { localStorage.setItem(ACCOUNT_KEY, id); } catch { /* ignore */ }
    setCurrent(id);
  }, []);

  if (!user) return null;

  const shell = (body: React.ReactNode) => (
    <div className="min-h-screen bg-ink-950 text-slate-800 font-sans flex flex-col selection:bg-blue-100 selection:text-blue-900">
      <header className="bg-slate-150 border-b border-slate-200 relative z-20">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/favicon.png" alt="" className="w-9 h-9 object-contain" />
            <div className="leading-none min-w-0">
              <p className="text-base font-bold tracking-tight text-slate-900 truncate">CloudStep <span className="text-blue-600">Renewal Reminder</span></p>
              <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mt-1">Set it once. Get reminded where you look.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {accounts && accounts.length > 1 && current && (
              <Select value={current} onChange={e => switchAccount(e.target.value)} className="!w-auto !py-1.5 text-xs max-w-[180px]" aria-label="Switch account">
                {accounts.map(a => <option key={a.accountId} value={a.accountId}>{a.name} ({a.role})</option>)}
              </Select>
            )}
            {onExit && <Button kind="ghost" onClick={onExit} title={access.role === 'admin' ? 'Back to the admin console' : 'Back to the Business Console'}><ArrowLeft className="w-3.5 h-3.5" /><span className="hidden sm:inline">{access.role === 'admin' ? 'Admin' : 'Business Console'}</span></Button>}
            <Button kind="ghost" onClick={() => signOut()} title="Sign out"><LogOut className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </header>
      {inviteMsg && (
        <div className="max-w-7xl mx-auto w-full px-4 md:px-8 pt-4">
          <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold rounded-lg px-3 py-2 flex items-center justify-between">
            {inviteMsg}<button onClick={() => setInviteMsg(null)} aria-label="Dismiss" className="cursor-pointer"><X className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6">{body}</main>
      <footer className="border-t border-slate-200 bg-slate-150 px-4 md:px-8 py-4 text-[11px] text-slate-400 text-center">
        &copy; {new Date().getFullYear()} SineThamsanqa Business Solutions · CloudStep Renewal Reminder reminds — it does not file, renew or give legal or tax advice.
      </footer>
    </div>
  );

  if (error) return shell(<Card><p className="text-sm text-red-600">{error}</p></Card>);
  if (!accounts) return shell(<p className="text-sm text-slate-400 font-semibold text-center py-20">Loading Renewal Reminder…</p>);
  if (!current) {
    // Owning an account needs the Renewal Reminder product; invited team
    // members get in through their membership instead.
    if (!canUse(access, 'renewals')) return <NoAccessScreen product="Renewal Reminder" />;
    return shell(<CreateAccount defaultName={ownerName ? `${ownerName.split(' ')[0]}'s business` : ''} defaultEmail={ownerEmail} onCreated={id => loadAccounts(id)} />);
  }

  return shell(
    <RRProvider key={current} accountId={current} accounts={accounts} userId={user.id} isPlatformAdmin={isPlatformAdmin} onSwitch={switchAccount}>
      <Workspace />
    </RRProvider>,
  );
}

function Workspace() {
  const { role, account, plan } = useRR();
  const [tab, setTab] = useState<Tab>(() => parseHash().tab);

  useEffect(() => {
    const onHash = () => setTab(parseHash().tab);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (t: Tab) => { window.location.hash = t === 'dashboard' ? '/renewals' : `/renewals/${t}`; setTab(t); };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-950">{account.name}</h1>
          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{plan.label} plan · you are {role === 'owner' ? 'the owner' : `${role === 'admin' ? 'an' : 'a'} ${role}`}</p>
        </div>
        <nav className="flex overflow-x-auto no-scrollbar bg-slate-150 border border-slate-200 rounded-xl p-1 gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => go(t.key)}
              className={`text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-all ${tab === t.key ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </nav>
      </div>

      {!data.functionConfigured() && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          The reminder service URL is not configured (<code>VITE_RENEWALS_API_URL</code>). Renewals are saved and scheduled, but Mark as done, test sends and downloads are unavailable from the console until it is set.
        </p>
      )}

      {tab === 'dashboard' && <><GettingStarted onGo={go} /><Overview /></>}
      {tab === 'entities' && <Entities />}
      {tab === 'channels' && <Channels />}
      {tab === 'integrations' && <Integrations />}
      {tab === 'team' && <Team />}
      {tab === 'reports' && <Reports />}
      {tab === 'settings' && <Settings />}
    </div>
  );
}

// ---------------------------------------------------------------
// Onboarding (brief §4.8)
// ---------------------------------------------------------------

function CreateAccount({ defaultName, defaultEmail, onCreated }: { defaultName: string; defaultEmail: string; onCreated: (id: string) => void }) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const a = await data.createAccount({ name: name.trim(), ownerEmail: email.trim(), timezone: 'Africa/Johannesburg' });
      try { localStorage.setItem(ACCOUNT_KEY, a.id); } catch { /* ignore */ }
      onCreated(a.id);
    } catch (x: any) {
      setErr(x?.message ?? 'Could not create the account.');
      setBusy(false);
    }
  };
  return (
    <div className="max-w-xl mx-auto py-6">
      <div className="text-center mb-6">
        <span className="mx-auto w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center"><BellRing className="w-6 h-6" /></span>
        <h1 className="text-2xl font-black text-slate-950 mt-4">Never miss an annual deadline again</h1>
        <p className="text-sm text-slate-500 mt-2">Tell CloudStep what needs to happen and when. It reminds you on the channels you already use, for as long as the obligation exists.</p>
      </div>
      <Card>
        <form onSubmit={create} className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Step 1 of 4 · Your account</p>
          <Field label="Business or practice name"><Input value={name} onChange={e => setName(e.target.value)} required minLength={2} autoFocus placeholder="Mokoena Accounting" /></Field>
          <Field label="Email for reminders" hint="Email is always on. You'll add WhatsApp or SMS next."><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></Field>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <Button kind="primary" className="w-full !py-3" busy={busy} type="submit">Create my Renewal Reminder account</Button>
          <p className="text-[11px] text-slate-400 text-center">Invited by someone else? Open the invite link they sent you instead.</p>
        </form>
      </Card>
    </div>
  );
}

const DISMISS_KEY = 'cloudstep.rr.onboarding-dismissed';

function GettingStarted({ onGo }: { onGo: (t: Tab) => void }) {
  const { account, channels, renewals, members, canAdmin } = useRR();
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(`${DISMISS_KEY}.${account.id}`) === '1'; } catch { return false; } });
  const [adding, setAdding] = useState(false);
  const steps = [
    { done: true, label: 'Account created', action: null as null | (() => void) },
    { done: channels.some(c => c.type !== 'email' && c.verifiedAt), label: 'Verify one extra channel with a test send (WhatsApp, SMS, Slack or Teams)', action: () => onGo('channels') },
    { done: renewals.length > 0, label: 'Add your first renewal — pick a template, confirm your date', action: () => setAdding(true) },
    { done: renewals.length > 0, label: 'Check the reminder timeline preview, then save', action: () => setAdding(true) },
    { done: members.length > 0, label: 'Optional: invite your bookkeeper or a colleague', action: () => onGo('team') },
  ];
  if (!canAdmin || dismissed || steps.every(s => s.done)) return null;
  return (
    <Card className="!p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Getting started</p>
          <p className="font-bold text-slate-900 mt-0.5">{steps.filter(s => s.done).length} of {steps.length} done</p>
        </div>
        <button onClick={() => { setDismissed(true); try { localStorage.setItem(`${DISMISS_KEY}.${account.id}`, '1'); } catch { /* ignore */ } }} className="text-slate-400 hover:text-slate-800 cursor-pointer" aria-label="Hide"><X className="w-4 h-4" /></button>
      </div>
      <ol className="mt-3 space-y-1.5">
        {steps.map((s, i) => (
          <li key={i}>
            <button disabled={s.done || !s.action} onClick={() => s.action?.()} className={`text-left text-sm flex items-center gap-2 ${s.done ? 'text-slate-400 line-through' : 'text-slate-800 hover:text-blue-600 cursor-pointer'}`}>
              {s.done ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <Circle className="w-4 h-4 text-slate-350 shrink-0" />}{s.label}
            </button>
          </li>
        ))}
      </ol>
      {adding && <RenewalForm onClose={() => setAdding(false)} />}
    </Card>
  );
}
