import React, { useState } from 'react';
import { UserPlus, Mail, Link2, Trash2, Pencil, Crown } from 'lucide-react';
import { useRR } from './store';
import * as data from './data';
import type { RRMember } from './types';
import { Button, Card, Field, Input, Modal, Select, SectionTitle, Pill, Toggle, copyText, fmtDate } from './ui';

export const ROLE_INFO: Record<string, { label: string; can: string }> = {
  owner: { label: 'Owner', can: 'Everything, including the team, integrations and settings. Plan changes are made by a CloudStep administrator.' },
  admin: { label: 'Admin', can: 'Create and edit all renewals, manage entities, channels, integrations and the team.' },
  contributor: { label: 'Contributor', can: 'Create and edit renewals for the entities assigned to them.' },
  viewer: { label: 'Viewer', can: 'Read-only access to every renewal, report and log.' },
  watcher: { label: 'Watcher', can: 'Read-only, and receives watcher alerts when a renewal is at risk.' },
};

export default function Team() {
  const { account, members, plan, canAdmin, me, run, reload, toast } = useRR();
  const [editing, setEditing] = useState<RRMember | 'new' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const live = members.filter(m => m.status !== 'revoked');
  const atLimit = live.length + 1 >= plan.users;

  const inviteLink = (m: RRMember) => `${window.location.origin}${window.location.pathname}#/renewals/invite/${m.inviteToken}`;

  return (
    <div className="space-y-5">
      <SectionTitle eyebrow="Users & roles" title="Your team">
        {canAdmin && <Button kind="primary" disabled={atLimit} title={atLimit ? `Your plan allows ${plan.users} users` : undefined} onClick={() => setEditing('new')}><UserPlus className="w-3.5 h-3.5" /> Invite</Button>}
      </SectionTitle>
      <p className="text-xs text-slate-500">{live.length + 1} of {plan.users} users on {plan.label}. Invited people sign in or create a CloudStep account, then open their invite link.</p>

      <div className="bg-slate-150 border border-slate-200 rounded-2xl divide-y divide-slate-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center"><Crown className="w-4 h-4" /></span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">Account owner</p>
            <p className="text-[11px] text-slate-500">{account.ownerEmail}</p>
          </div>
          <Pill>Owner</Pill>
        </div>
        {members.map(m => (
          <div key={m.id} className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${m.status === 'revoked' ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="w-9 h-9 shrink-0 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center">
                {(m.name || m.email).split(/\s+/).map(w => w[0]?.toUpperCase()).slice(0, 2).join('')}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{m.name || m.email}</p>
                <p className="text-[11px] text-slate-500 truncate">{m.email} · {m.status === 'invited' ? `invited ${fmtDate(m.createdAt)}` : m.status === 'active' ? `joined ${fmtDate(m.acceptedAt)}` : 'removed'}
                  {m.role === 'contributor' && ` · ${m.entityIds ? `${m.entityIds.length} entit${m.entityIds.length === 1 ? 'y' : 'ies'}` : 'all entities'}`}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Pill>{ROLE_INFO[m.role].label}</Pill>
              {m.status === 'invited' && <Pill className="text-amber-800 border-amber-200 bg-amber-50">Pending</Pill>}
              {canAdmin && m.status === 'invited' && m.inviteToken && (
                <>
                  <Button kind="ghost" title="Copy invite link" onClick={async () => { if (await copyText(inviteLink(m))) toast({ kind: 'success', title: 'Invite link copied', body: 'Send it to them yourself — it works once.' }); }}><Link2 className="w-3.5 h-3.5" /></Button>
                  {data.functionConfigured() && <Button kind="ghost" title="Email the invite" busy={busy === m.id} onClick={async () => {
                    setBusy(m.id);
                    const res = await run(() => data.api.sendInvite(m.id));
                    setBusy(null);
                    if (res) toast(res.ok ? { kind: 'success', title: `Invite emailed to ${m.email}` } : { kind: 'error', title: 'Invite email failed', body: `${res.error ?? ''} — copy the link instead.` });
                  }}><Mail className="w-3.5 h-3.5" /></Button>}
                </>
              )}
              {canAdmin && m.status !== 'revoked' && <Button kind="ghost" onClick={() => setEditing(m)} aria-label="Edit"><Pencil className="w-3.5 h-3.5" /></Button>}
            </div>
          </div>
        ))}
      </div>

      <Card>
        <p className="text-sm font-bold text-slate-900 mb-2">What each role can do</p>
        <dl className="grid sm:grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          {Object.entries(ROLE_INFO).map(([k, r]) => <React.Fragment key={k}><dt className="font-bold text-slate-700">{r.label}</dt><dd className="text-slate-500">{r.can}</dd></React.Fragment>)}
          <dt className="font-bold text-slate-700">Client (portal)</dt><dd className="text-slate-500">No account needed: sees their own renewals and marks them done through the entity's secret portal link.</dd>
        </dl>
      </Card>

      {me && <MyPrefs member={me} />}
      {editing && <MemberForm member={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}

function MyPrefs({ member }: { member: RRMember }) {
  const { account, run, reload } = useRR();
  const [prefs, setPrefs] = useState({ digest: member.prefs.digest !== false, watcherAlerts: member.prefs.watcherAlerts !== false });
  const save = async (next: typeof prefs) => {
    setPrefs(next);
    if (await run(() => data.updateMyPrefs(account.id, next), 'Preferences saved')) reload();
  };
  return (
    <Card className="space-y-3">
      <p className="text-sm font-bold text-slate-900">My notifications</p>
      <Toggle checked={prefs.digest} onChange={v => save({ ...prefs, digest: v })} label="Weekly digest email" hint="What is coming up and what is overdue." />
      {member.role === 'watcher' && <Toggle checked={prefs.watcherAlerts} onChange={v => save({ ...prefs, watcherAlerts: v })} label="Watcher alerts" hint="Hear about renewals at risk across this account." />}
    </Card>
  );
}

function MemberForm({ member, onClose, onSaved }: { member: RRMember | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const { account, entities, run, toast } = useRR();
  const [email, setEmail] = useState(member?.email ?? '');
  const [name, setName] = useState(member?.name ?? '');
  const [role, setRole] = useState<RRMember['role']>(member?.role ?? 'contributor');
  const [scoped, setScoped] = useState(!!member?.entityIds);
  const [entityIds, setEntityIds] = useState<string[]>(member?.entityIds ?? []);
  const [busy, setBusy] = useState(false);
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  const save = async () => {
    setBusy(true);
    const saved = await run(() => data.saveMember({
      id: member?.id, accountId: account.id, email: email.trim().toLowerCase(), name: name.trim(), role,
      entityIds: role === 'contributor' && scoped ? entityIds : null,
    }), member ? 'Member updated' : 'Invitation created');
    setBusy(false);
    if (!saved) return;
    await onSaved();
    if (!member && data.functionConfigured()) {
      const res = await data.api.sendInvite(saved.id).catch(() => null);
      toast(res?.ok ? { kind: 'success', title: `Invite emailed to ${saved.email}` } : { kind: 'info', title: 'Invite created', body: 'Copy the invite link from the team list and send it to them.' });
    }
    onClose();
  };

  return (
    <Modal title={member ? `Edit ${member.name || member.email}` : 'Invite someone'} onClose={onClose} footer={<>
      {member && <Button kind="danger" onClick={async () => {
        if (!confirm(`Remove ${member.email} from this account?`)) return;
        if (await run(() => data.saveMember({ id: member.id, accountId: account.id, status: 'revoked' }), 'Access removed')) { await onSaved(); onClose(); }
      }}><Trash2 className="w-3.5 h-3.5" /> Remove access</Button>}
      <Button onClick={onClose}>Cancel</Button>
      <Button kind="primary" busy={busy} disabled={!valid} onClick={save}>{member ? 'Save' : 'Create invite'}</Button>
    </>}>
      <div className="space-y-3">
        <Field label="Email"><Input type="email" value={email} disabled={!!member} onChange={e => setEmail(e.target.value)} placeholder="colleague@firm.co.za" autoFocus /></Field>
        <Field label="Name"><Input value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Role" hint={ROLE_INFO[role].can}>
          <Select value={role} onChange={e => setRole(e.target.value as RRMember['role'])}>
            {(['admin', 'contributor', 'viewer', 'watcher'] as const).map(r => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
          </Select>
        </Field>
        {role === 'contributor' && entities.length > 0 && (
          <div className="space-y-2">
            <Toggle checked={scoped} onChange={setScoped} label="Limit to specific entities" hint="Delegated setup: they can only create and edit renewals for these companies." />
            {scoped && (
              <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-200">
                {entities.map(e => (
                  <label key={e.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-800 cursor-pointer">
                    <input type="checkbox" className="accent-[#d8b75c]" checked={entityIds.includes(e.id)} onChange={x => setEntityIds(x.target.checked ? [...entityIds, e.id] : entityIds.filter(i => i !== e.id))} />
                    {e.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
