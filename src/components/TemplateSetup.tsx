import React, { useMemo, useState } from 'react';
import { getDataClient } from '../lib/neon';
import { useAuth, setupFlagKey } from '../lib/auth';
import { upsertUserProfile, upsertTemplate, DataClient } from '../lib/data';
import { ProfileFields, ProfileForm } from './ProfileScreen';
import { Template } from '../types';
import { INITIAL_TEMPLATES } from '../data';
import { ArrowLeft, ArrowRight, Check, Layers, AlertTriangle } from 'lucide-react';

interface TemplateSetupProps {
  onComplete: (installed: Template[]) => void;
}

const STEPS = ['Your profile', 'Journey templates'] as const;

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
}

export default function TemplateSetup({ onComplete }: TemplateSetupProps) {
  const { user, pendingUsername } = useAuth();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [selected, setSelected] = useState<string[]>(INITIAL_TEMPLATES.map(t => t.id));

  const [form, setForm] = useState<ProfileForm>({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: '',
    company: '',
    position: '',
    avatarUrl: user?.image || '',
  });

  const initials = useMemo(() => initialsOf(form.fullName), [form.fullName]);

  const toggle = (id: string) =>
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const finish = (installed: Template[]) => {
    if (user) {
      try {
        localStorage.setItem(setupFlagKey(user.id), '1');
      } catch { /* private mode */ }
    }
    onComplete(installed);
  };

  const complete = async () => {
    if (!user) return;

    // Already failed once — let the owner into the tool.
    if (attempted && syncError) {
      finish([]);
      return;
    }

    setBusy(true);
    setSyncError(null);
    try {
      const db: DataClient = getDataClient();

      await upsertUserProfile(db, {
        id: user.id,
        fullName: form.fullName.trim() || user.name || 'Owner',
        email: form.email.trim() || user.email || '',
        username: pendingUsername,
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        position: form.position.trim() || null,
        avatarUrl: form.avatarUrl || null,
        industry: 'real-estate',
      });

      const chosen = INITIAL_TEMPLATES.filter(t => selected.includes(t.id));
      const installed: Template[] = [];
      for (const t of chosen) {
        installed.push(await upsertTemplate(db, t, user.id));
      }

      finish(installed);
    } catch (e: any) {
      console.error('Template setup sync failed:', e);
      setSyncError(e?.message || 'Could not reach the workspace yet.');
      setAttempted(true);
    } finally {
      setBusy(false);
    }
  };

  const canAdvance = form.fullName.trim().length > 1;

  return (
    <div className="min-h-screen bg-ink-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Brand + step indicator */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src="/favicon.png" alt="" className="w-11 h-11 object-contain" />
          <div className="leading-none">
            <p className="text-lg font-bold tracking-tight text-slate-900">CloudSTep</p>
            <p className="text-[9px] uppercase tracking-widest text-blue-600 font-bold mt-1">SineThamsanqa Solutions</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${
                i === step ? 'text-blue-600' : i < step ? 'text-emerald-600' : 'text-slate-500'
              }`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${
                  i === step ? 'bg-blue-600 text-ink-950 border-blue-600'
                    : i < step ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-600'
                    : 'border-slate-300 text-slate-500'
                }`}>
                  {i < step ? <Check className="w-3 h-3" /> : i + 1}
                </span>
                {s}
              </div>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-slate-300/60" />}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-slate-150 rounded-2xl shadow-xl border border-slate-200 p-6 md:p-8">
          {step === 0 ? (
            <>
              <h1 className="text-2xl font-bold text-slate-900">Set up your member profile</h1>
              <p className="text-sm text-slate-500 mt-2 mb-6 leading-relaxed">
                This creates your CloudSTep member record and gives you access to the tool.
                You manage everything here — the account console is not part of your workflow.
              </p>
              <ProfileFields
                form={form}
                setForm={setForm}
                initials={initials}
                photoUrl={user?.image || ''}
                lockIdentity
              />
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-900">Set up your journey templates</h1>
              <p className="text-sm text-slate-500 mt-2 mb-5 leading-relaxed">
                Pick the South African real estate &amp; conveyancing journeys you want installed in your
                workspace. You can edit or add more later in the Journey Template Builder.
              </p>

              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {selected.length} of {INITIAL_TEMPLATES.length} selected
                </span>
                <button
                  onClick={() => setSelected(selected.length === INITIAL_TEMPLATES.length ? [] : INITIAL_TEMPLATES.map(t => t.id))}
                  className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  {selected.length === INITIAL_TEMPLATES.length ? 'Clear all' : 'Select all'}
                </button>
              </div>

              <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                {INITIAL_TEMPLATES.map(t => {
                  const on = selected.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggle(t.id)}
                      className={`w-full text-left rounded-xl border p-4 flex items-start gap-3 transition-all cursor-pointer ${
                        on ? 'border-blue-600 bg-blue-50/40' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <span className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                        on ? 'bg-blue-600 border-blue-600 text-ink-950' : 'border-slate-300 bg-slate-150'
                      }`}>
                        {on && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-bold text-sm text-slate-900">{t.name.replace(/^\d+\.\s*/, '')}</span>
                        <span className="block text-xs text-slate-500 mt-0.5 line-clamp-2">{t.description}</span>
                        <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                          <Layers className="w-3 h-3" /> {t.milestones.length} milestones
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {syncError && (
            <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{syncError} You can still enter the tool — your profile and templates will sync on your next save.</span>
            </p>
          )}

          <div className="mt-7 pt-5 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 font-bold text-sm px-5 py-3 rounded-xl border border-slate-300 text-slate-600 hover:border-blue-500 hover:text-blue-600 transition-all cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}

            {step === 0 ? (
              <button
                onClick={() => canAdvance && setStep(1)}
                disabled={!canAdvance}
                className={`flex-1 inline-flex items-center justify-center gap-2 font-bold text-sm px-5 py-3 rounded-xl transition-all ${
                  canAdvance
                    ? 'bg-blue-600 text-ink-950 hover:bg-blue-500 shadow-md shadow-blue-100/40 cursor-pointer'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={complete}
                disabled={busy}
                className={`flex-1 inline-flex items-center justify-center gap-2 font-bold text-sm px-5 py-3 rounded-xl transition-all ${
                  busy ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-blue-600 text-ink-950 hover:bg-blue-500 shadow-md shadow-blue-100/40 cursor-pointer'
                }`}
              >
                {busy ? 'Creating your workspace…'
                  : attempted && syncError ? 'Enter workspace anyway'
                  : selected.length ? `Install ${selected.length} template${selected.length > 1 ? 's' : ''} & enter workspace`
                  : 'Enter workspace'}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-4">
          Real Estate &amp; Conveyancing workspace • South Africa
        </p>
      </div>
    </div>
  );
}
