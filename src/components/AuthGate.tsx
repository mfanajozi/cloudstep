import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, AlertCircle, AtSign, KeyRound, Loader2, UserRound } from 'lucide-react';
import { useAuth } from '../lib/auth';

export type AuthMode = 'sign-in' | 'sign-up';

const field =
  'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all';
const label = 'block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5';

function Field({
  id,
  label: labelText,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  icon,
  hint,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
  icon: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {labelText} {hint && <span className="normal-case tracking-normal text-slate-400 font-medium">— {hint}</span>}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">{icon}</span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={field}
        />
      </div>
    </div>
  );
}

export default function AuthGate({
  mode,
  onBack,
  onModeChange,
}: {
  mode: AuthMode;
  onBack: () => void;
  onModeChange: (mode: AuthMode) => void;
}) {
  const { signIn, signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === 'sign-up';

  const validate = (): string | null => {
    if (!email.trim()) return 'Enter your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'That email address is not valid.';
    if (password.length < 8) return 'Password must be at least 8 characters.';

    if (isSignUp) {
      if (fullName.trim().length < 2) return 'Enter your full name.';
      if (!/^[a-z0-9._-]{3,30}$/.test(username.trim().toLowerCase()))
        return 'Username must be 3–30 characters: letters, numbers, dot, dash or underscore.';
      if (password !== confirm) return 'Passwords do not match.';
    }
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isSignUp) {
        await signUp({
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          password,
        });
      } else {
        await signIn(email.trim().toLowerCase(), password);
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    setError(null);
    setPassword('');
    setConfirm('');
    onModeChange(next);
  };

  return (
    <div className="min-h-screen bg-ink-950 text-slate-800 font-sans flex flex-col items-center justify-center p-4 selection:bg-blue-600 selection:text-ink-950">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src="/favicon.png" alt="" className="w-11 h-11 object-contain" />
          <div className="leading-none">
            <p className="text-lg font-bold tracking-tight text-slate-900">CloudSTep</p>
            <p className="text-[9px] uppercase tracking-widest text-blue-600 font-bold mt-1">SineThamsanqa Solutions</p>
          </div>
        </div>

        <div className="bg-slate-150 rounded-2xl shadow-xl border border-slate-200 p-6 md:p-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 leading-tight">
                {isSignUp ? 'Create your workspace' : 'Sign in to CloudSTep'}
              </h1>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                {isSignUp
                  ? 'Your firm gets its own isolated workspace for real estate and conveyancing journeys.'
                  : 'Open your business console and pick up where you left off.'}
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {isSignUp && (
              <>
                <Field
                  id="full-name"
                  label="Full names"
                  type="text"
                  value={fullName}
                  onChange={setFullName}
                  placeholder="Thandiwe Nkosi"
                  autoComplete="name"
                  icon={<UserRound className="w-4 h-4" />}
                />
                <Field
                  id="username"
                  label="Username"
                  type="text"
                  value={username}
                  onChange={v => setUsername(v.toLowerCase())}
                  placeholder="thandiwe.nkosi"
                  autoComplete="username"
                  icon={<AtSign className="w-4 h-4" />}
                  hint="lowercase, no spaces"
                />
              </>
            )}

            <Field
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@agency.co.za"
              autoComplete="email"
              icon={<AtSign className="w-4 h-4" />}
            />

            <Field
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={isSignUp ? 'At least 8 characters' : '••••••••'}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              icon={<KeyRound className="w-4 h-4" />}
            />

            {isSignUp && (
              <Field
                id="confirm-password"
                label="Confirm password"
                type="password"
                value={confirm}
                onChange={setConfirm}
                placeholder="Repeat your password"
                autoComplete="new-password"
                icon={<KeyRound className="w-4 h-4" />}
              />
            )}

            {error && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className={`w-full inline-flex items-center justify-center gap-2 font-bold text-sm px-5 py-3 rounded-xl transition-all ${
                busy
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 text-ink-950 hover:bg-blue-500 shadow-md shadow-blue-100/40 cursor-pointer'
              }`}
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> {isSignUp ? 'Creating workspace…' : 'Signing in…'}
                </>
              ) : (
                <>
                  {isSignUp ? 'Create workspace' : 'Sign in'} <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-5">
            {isSignUp ? 'Already have an account?' : 'No workspace yet?'}{' '}
            <button
              type="button"
              onClick={() => switchMode(isSignUp ? 'sign-in' : 'sign-up')}
              className="text-blue-600 font-bold hover:underline cursor-pointer"
            >
              {isSignUp ? 'Sign in' : 'Create one'}
            </button>
          </p>
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-4">
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer">
            <ArrowLeft className="w-3 h-3" /> Back to the landing page
          </button>
        </p>
      </div>
    </div>
  );
}
