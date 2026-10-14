import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import * as data from './data';
import { planOf, PlanLimits, deriveStatus, RenewalStatus, Recurrence } from './engine';
import type { RRAccount, RREntity, RRRenewal, RRChannel, RRMember, RRTemplate, RRRole, MyAccount } from './types';

// Shared state for one open Renewal Reminder account.

interface Toast { id: number; kind: 'success' | 'error' | 'info'; title: string; body?: string }

export interface RRStore {
  account: RRAccount;
  role: RRRole;
  plan: PlanLimits;
  isPlatformAdmin: boolean;
  userId: string;
  /** the signed-in user's membership row (null for the owner) */
  me: RRMember | null;
  accounts: MyAccount[];
  entities: RREntity[];
  renewals: RRRenewal[];
  channels: RRChannel[];
  members: RRMember[];
  templates: RRTemplate[];
  loading: boolean;
  /** owner / admin */
  canAdmin: boolean;
  /** may create or edit renewals for this entity */
  canWrite: (entityId: string | null) => boolean;
  statusOf: (r: RRRenewal) => RenewalStatus;
  entityName: (id: string | null) => string | null;
  reload: () => Promise<void>;
  reloadRenewals: () => Promise<void>;
  setAccount: (a: RRAccount) => void;
  switchAccount: (id: string) => void;
  toast: (t: Omit<Toast, 'id'>) => void;
  /** Runs an action with error toasts. Resolves to the result (or `true`
   *  for actions that return nothing), or `undefined` if it failed. */
  run: <T>(fn: () => Promise<T>, success?: string) => Promise<(T extends void ? true : T) | undefined>;
}

const Ctx = createContext<RRStore | null>(null);

export function useRR(): RRStore {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRR outside RRProvider');
  return v;
}

export const recurrenceOf = (r: Pick<RRRenewal, 'recurrenceUnit' | 'recurrenceInterval'>): Recurrence => ({ unit: r.recurrenceUnit, interval: r.recurrenceInterval });

export function RRProvider({
  accountId, accounts, userId, isPlatformAdmin, onSwitch, children,
}: {
  accountId: string; accounts: MyAccount[]; userId: string; isPlatformAdmin: boolean;
  onSwitch: (id: string) => void; children: React.ReactNode;
}) {
  const [account, setAccount] = useState<RRAccount | null>(null);
  const [entities, setEntities] = useState<RREntity[]>([]);
  const [renewals, setRenewals] = useState<RRRenewal[]>([]);
  const [channels, setChannels] = useState<RRChannel[]>([]);
  const [members, setMembers] = useState<RRMember[]>([]);
  const [templates, setTemplates] = useState<RRTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { ...t, id }]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), t.kind === 'error' ? 8000 : 4500);
  }, []);

  const reloadRenewals = useCallback(async () => {
    setRenewals(await data.fetchRenewals(accountId, 'due_date'));
  }, [accountId]);

  const reload = useCallback(async () => {
    try {
      const [a, e, r, c, m, t] = await Promise.all([
        data.fetchAccount(accountId),
        data.fetchEntities(accountId, 'name'),
        data.fetchRenewals(accountId, 'due_date'),
        data.fetchChannels(accountId, 'priority'),
        data.fetchMembers(accountId),
        data.fetchTemplates(accountId, 'name'),
      ]);
      setAccount(a); setEntities(e); setRenewals(r); setChannels(c); setMembers(m); setTemplates(t);
    } catch (err: any) {
      toast({ kind: 'error', title: 'Could not load your renewals', body: err?.message });
    } finally {
      setLoading(false);
    }
  }, [accountId, toast]);

  useEffect(() => { setLoading(true); reload(); }, [reload]);

  const role: RRRole = accounts.find(a => a.accountId === accountId)?.role ?? 'viewer';
  const me = members.find(m => m.userId === userId);

  const value = useMemo<RRStore | null>(() => {
    if (!account) return null;
    const canAdmin = role === 'owner' || role === 'admin';
    const tz = account.timezone;
    return {
      account, role, plan: planOf(account.plan), isPlatformAdmin, userId, me: me ?? null, accounts,
      entities, renewals, channels, members, templates, loading,
      canAdmin,
      canWrite: (entityId) => canAdmin || (role === 'contributor' && (!me?.entityIds || (!!entityId && me.entityIds.includes(entityId)))),
      statusOf: (r) => deriveStatus({
        state: r.state, dueDate: r.dueDate, preset: r.preset, customOffsets: r.customOffsets,
        recurrence: recurrenceOf(r), holidayShift: r.holidayShift ?? account.holidayShift,
        snoozedUntil: r.snoozedUntil, completedOneOff: r.completedOneOff,
      }, tz),
      entityName: (id) => (id ? entities.find(e => e.id === id)?.name ?? null : null),
      reload, reloadRenewals, setAccount, switchAccount: onSwitch, toast,
      run: async (fn, success) => {
        try {
          const out = await fn();
          if (success) toast({ kind: 'success', title: success });
          return (out === undefined ? true : out) as any;
        } catch (e: any) {
          toast({ kind: 'error', title: 'Something went wrong', body: e?.message });
          return undefined;
        }
      },
    };
  }, [account, role, isPlatformAdmin, userId, accounts, entities, renewals, channels, members, templates, loading, me, reload, reloadRenewals, onSwitch, toast]);

  return (
    <>
      {value ? <Ctx.Provider value={value}>{children}</Ctx.Provider> : (
        <div className="min-h-[50vh] flex items-center justify-center text-sm text-slate-400 font-semibold">{loading ? 'Loading renewals…' : 'This account could not be opened.'}</div>
      )}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 sm:max-w-sm">
        {toasts.map(t => (
          <div key={t.id} role="status" className={`rounded-xl shadow-2xl border p-3 flex items-start gap-2 ${
            t.kind === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : t.kind === 'error' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-ink-900 border-ink-700 text-white'}`}>
            {t.kind === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600" /> : <AlertCircle className={`w-4 h-4 mt-0.5 ${t.kind === 'error' ? 'text-red-600' : 'text-blue-600'}`} />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold">{t.title}</p>
              {t.body && <p className="text-[11px] mt-0.5 opacity-90 break-words">{t.body}</p>}
            </div>
            <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} className="text-slate-400 hover:text-slate-700" aria-label="Dismiss"><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
    </>
  );
}
