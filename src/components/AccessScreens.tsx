import React, { useState } from 'react';
import { ShieldOff, KeyRound, LogOut, Lock } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { getNeon, getDataClient } from '../lib/neon';

// Screens shown instead of a workspace when access rules apply.

function Shell({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  return (
    <div className="min-h-screen bg-ink-950 text-slate-800 font-sans flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src="/favicon.png" alt="" className="w-11 h-11 object-contain" />
          <p className="text-lg font-bold tracking-tight text-slate-900">CloudSTep</p>
        </div>
        <div className="bg-slate-150 rounded-2xl shadow-xl border border-slate-200 p-6 md:p-8">
          <span className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">{icon}</span>
          <h1 className="text-xl font-bold text-slate-900 mt-4">{title}</h1>
          <div className="mt-3 text-sm text-slate-500 leading-relaxed space-y-3">{children}</div>
          <button onClick={() => signOut()} className="mt-6 text-xs font-bold text-slate-500 hover:text-slate-900 inline-flex items-center gap-1.5 cursor-pointer">
            <LogOut className="w-3.5 h-3.5" /> Sign out{user?.email ? ` (${user.email})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SuspendedScreen({ reason }: { reason: string | null }) {
  return (
    <Shell icon={<ShieldOff className="w-5 h-5" />} title="Your access is suspended">
      <p>An administrator has suspended this CloudStep account, so its workspaces can't be opened right now.</p>
      {reason && <p className="text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">Reason: {reason}</p>}
      <p>Contact SineThamsanqa Business Solutions at <a className="text-blue-600 font-semibold" href="https://www.cloudst.co.za" target="_blank" rel="noreferrer">www.cloudst.co.za</a> to restore access.</p>
    </Shell>
  );
}

export function NoAccessScreen({ product }: { product?: string }) {
  return (
    <Shell icon={<Lock className="w-5 h-5" />} title={product ? `${product} isn't enabled for you` : 'No system has been assigned yet'}>
      <p>{product ? `Your account doesn't include ${product}.` : 'Your account is set up, but it hasn’t been given access to a CloudStep system yet.'}</p>
      <p>Ask your CloudStep administrator to allocate it to you, then sign in again.</p>
    </Shell>
  );
}

export function ChangePasswordScreen({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = 'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setError('Choose a password of at least 8 characters.');
    if (next !== confirm) return setError('The new passwords do not match.');
    if (next === current) return setError('Choose a password different from the temporary one.');
    setBusy(true); setError(null);
    try {
      const { error: err } = await (getNeon().auth as any).changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
      if (err) throw new Error(err.message || 'That temporary password is not correct.');
      await (getDataClient() as any).from('users').update({ must_change_password: false }).eq('id', userId);
      onDone();
    } catch (x: any) {
      setError(x?.message ?? 'Could not change the password.');
      setBusy(false);
    }
  };

  return (
    <Shell icon={<KeyRound className="w-5 h-5" />} title="Choose your own password">
      <p>You signed in with a temporary password from your administrator. Set a new one to continue.</p>
      <form onSubmit={submit} className="space-y-3 pt-1">
        <input className={field} type="password" autoComplete="current-password" placeholder="Temporary password" value={current} onChange={e => setCurrent(e.target.value)} required />
        <input className={field} type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={next} onChange={e => setNext(e.target.value)} required />
        <input className={field} type="password" autoComplete="new-password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="w-full bg-blue-600 text-ink-950 font-bold py-3 rounded-xl hover:bg-blue-500 disabled:opacity-50 cursor-pointer">
          {busy ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </Shell>
  );
}
