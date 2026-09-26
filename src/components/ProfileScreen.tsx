import React, { useEffect, useState } from 'react';
import { getDataClient } from '../lib/neon';
import { useAuth } from '../lib/auth';
import { fetchUserProfile, upsertUserProfile, DataClient } from '../lib/data';
import { UserProfile } from '../types';
import { Avatar } from './Avatar';
import { ArrowLeft, Check, LogOut, Mail, Phone, Building2, BadgeCheck, Save, ShieldCheck } from 'lucide-react';

// ---------------------------------------------------------------
// Shared, controlled profile form used by both the first-login
// template setup screen and the in-app profile screen.
// Everything here is written to CloudSTep's own `users` table.
// ---------------------------------------------------------------

export interface ProfileForm {
  fullName: string;
  email: string;
  phone: string;
  company: string;
  position: string;
  avatarUrl: string;
}

const field =
  'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all';
const label = 'block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5';

export function ProfileFields({
  form,
  setForm,
  initials,
  photoUrl = '',
  lockIdentity = false,
}: {
  form: ProfileForm;
  setForm: (f: ProfileForm) => void;
  initials: string;
  photoUrl?: string;
  lockIdentity?: boolean;
}) {
  const set = (k: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
          <Avatar src={form.avatarUrl} alt={form.fullName} initials={initials} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">
            {form.fullName || 'Your name'}
          </p>
          <p className="text-xs text-slate-500 truncate">{form.email || 'your@email.co.za'}</p>
          <button
            type="button"
            disabled={!photoUrl && !form.avatarUrl}
            onClick={() => setForm({ ...form, avatarUrl: form.avatarUrl ? '' : photoUrl })}
            className="mt-1 text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {form.avatarUrl ? 'Use initials instead' : 'Use profile photo'}
          </button>
        </div>
      </div>

      <div>
        <label className={label} htmlFor="pf-name">Full name</label>
        <input
          id="pf-name"
          className={field}
          value={form.fullName}
          onChange={set('fullName')}
          placeholder="e.g. Mzitho Masitla"
          autoComplete="name"
        />
      </div>

      <div>
        <label className={label} htmlFor="pf-email">
          Email {lockIdentity && <span className="normal-case tracking-normal text-slate-400 font-medium">(sign-in address)</span>}
        </label>
        <div className="relative">
          <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="pf-email"
            className={`${field} pl-9 ${lockIdentity ? 'text-slate-500 cursor-not-allowed' : ''}`}
            value={form.email}
            onChange={set('email')}
            placeholder="name@agency.co.za"
            type="email"
            readOnly={lockIdentity}
            autoComplete="email"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="pf-phone">Mobile</label>
          <div className="relative">
            <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="pf-phone"
              className={`${field} pl-9`}
              value={form.phone}
              onChange={set('phone')}
              placeholder="082 000 0000"
              type="tel"
              autoComplete="tel"
            />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="pf-position">Position</label>
          <input
            id="pf-position"
            className={field}
            value={form.position}
            onChange={set('position')}
            placeholder="e.g. Conveyancing Secretary"
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="pf-company">Agency / practice</label>
        <div className="relative">
          <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="pf-company"
            className={`${field} pl-9`}
            value={form.company}
            onChange={set('company')}
            placeholder="e.g. Masitla Property Group"
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Full in-app profile screen (replaces the Clerk account panel)
// ---------------------------------------------------------------

export default function ProfileScreen({
  onBack,
  onSaved,
}: {
  onBack: () => void;
  onSaved?: (p: UserProfile) => void;
}) {
  const { user, signOut } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    fullName: '', email: '', phone: '', company: '', position: '', avatarUrl: '',
  });

  const initials = (form.fullName || user?.name || '')
    .split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');

  useEffect(() => {
    const currentUser = user;
    if (!currentUser) return;
    let mounted = true;
    async function load() {
      try {
        const db: DataClient = getDataClient();
        const p = await fetchUserProfile(db, currentUser.id);
        if (!mounted) return;
        setProfile(p);
        setForm({
          fullName: p?.fullName || currentUser.name || '',
          email: p?.email || currentUser.email || '',
          phone: p?.phone || '',
          company: p?.company || '',
          position: p?.position || '',
          avatarUrl: p ? (p.avatarUrl || '') : (currentUser.image || ''),
        });
      } catch (e: any) {
        if (!mounted) return;
        // No cloud row yet — fall back to the signed-in account details.
        setForm(f => ({
          ...f,
          fullName: f.fullName || currentUser.name || '',
          email: f.email || currentUser.email || '',
          avatarUrl: f.avatarUrl || currentUser.image || '',
        }));
        setError('Cloud profile unavailable — showing your sign-in details. Changes will sync once the connection is restored.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [user]);

  const handleSave = async () => {
    if (!user || !form.fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const db: DataClient = getDataClient();
      const savedProfile = await upsertUserProfile(db, {
        id: user.id,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        username: profile?.username,
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        position: form.position.trim() || null,
        avatarUrl: form.avatarUrl || null,
        industry: 'real-estate',
      });
      setProfile(savedProfile);
      onSaved?.(savedProfile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-150 border border-slate-200 rounded-2xl p-10 text-center text-slate-500 text-sm">
        Loading your profile…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-150 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-500 transition-all cursor-pointer"
            aria-label="Back to workspace"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-900 leading-tight">My profile</h2>
            <p className="text-xs text-slate-500">Manage how you appear inside CloudSTep.</p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-full">
          <ShieldCheck className="w-3 h-3" /> Managed in CloudSTep
        </span>
      </div>

      <div className="bg-slate-150 border border-slate-200 rounded-2xl p-6">
        <ProfileFields form={form} setForm={setForm} initials={initials} photoUrl={user?.image || ''} lockIdentity />

        {error && (
          <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{error}</p>
        )}
        {saved && (
          <p className="mt-4 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" /> Profile saved.
          </p>
        )}

        <div className="mt-6 pt-5 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`inline-flex items-center justify-center gap-2 font-bold text-sm px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
              saving ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-ink-950 hover:bg-blue-500'
            }`}
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            onClick={() => signOut()}
            className="inline-flex items-center justify-center gap-2 font-bold text-sm px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:border-red-500 hover:text-red-600 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>

      <div className="bg-slate-150 border border-slate-200 rounded-2xl p-6">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <BadgeCheck className="w-4 h-4 text-blue-600" /> Account access
        </h3>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          Your sign-in credentials are handled at login only. Everything about your member record —
          name, contact details, practice and photo — is managed right here, so you never leave the tool.
        </p>
        <dl className="mt-4 grid sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
            <dt className="text-slate-400 font-semibold">Member ID</dt>
            <dd className="text-slate-700 font-mono truncate">{user?.id}</dd>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
            <dt className="text-slate-400 font-semibold">Workspace</dt>
            <dd className="text-slate-700">Real Estate &amp; Conveyancing</dd>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
            <dt className="text-slate-400 font-semibold">Username</dt>
            <dd className="text-slate-700 truncate">{profile?.username || '—'}</dd>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
            <dt className="text-slate-400 font-semibold">Sign-in email</dt>
            <dd className="text-slate-700 truncate">{user?.email || '—'}</dd>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
            <dt className="text-slate-400 font-semibold">Record status</dt>
            <dd className="text-emerald-700 font-semibold">{profile ? 'Provisioned' : 'Pending sync'}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
