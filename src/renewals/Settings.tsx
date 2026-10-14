import React, { useState } from 'react';
import { Save, Plus, Trash2, Pencil } from 'lucide-react';
import * as E from './engine';
import { useRR } from './store';
import * as data from './data';
import type { RRAccount, RRTemplate } from './types';
import { Button, Card, Field, Input, Modal, Select, SectionTitle, Toggle, Pill, Textarea } from './ui';

const TIMEZONES = ['Africa/Johannesburg', 'Africa/Windhoek', 'Africa/Gaborone', 'Africa/Harare', 'Africa/Maputo', 'Africa/Lagos', 'Africa/Nairobi', 'Europe/London', 'UTC'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Settings() {
  const { account, plan, canAdmin, isPlatformAdmin, run, setAccount, reload } = useRR();
  const [a, setA] = useState<RRAccount>(account);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof RRAccount>(k: K, v: RRAccount[K]) => setA(p => ({ ...p, [k]: v }));
  const dirty = JSON.stringify(a) !== JSON.stringify(account);
  const ro = !canAdmin;

  const save = async () => {
    if (a.quietStart >= a.quietEnd) return;
    setBusy(true);
    const saved = await run(() => data.updateAccount(account.id, a), 'Settings saved — affected schedules are rebuilt automatically');
    setBusy(false);
    if (saved) { setAccount(saved); setA(saved); }
  };

  return (
    <div className="space-y-5">
      <SectionTitle eyebrow="Account" title="Notifications & account settings">
        {canAdmin && <Button kind="primary" busy={busy} disabled={!dirty || a.quietStart >= a.quietEnd} onClick={save}><Save className="w-3.5 h-3.5" /> Save changes</Button>}
      </SectionTitle>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="space-y-3">
          <p className="font-bold text-slate-900">General</p>
          <Field label="Account name"><Input disabled={ro} value={a.name} onChange={e => set('name', e.target.value)} /></Field>
          <Field label="Owner email" hint="Default reminder recipient and where account alerts go."><Input disabled={ro} type="email" value={a.ownerEmail} onChange={e => set('ownerEmail', e.target.value)} /></Field>
          <Field label="Reply-to email" hint="Where replies to reminder emails go."><Input disabled={ro} type="email" value={a.replyToEmail ?? ''} onChange={e => set('replyToEmail', e.target.value || null)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Time zone"><Select disabled={ro} value={a.timezone} onChange={e => set('timezone', e.target.value)}>{TIMEZONES.map(t => <option key={t} value={t}>{t === 'Africa/Johannesburg' ? 'SAST (Johannesburg)' : t}</option>)}</Select></Field>
            <Field label="Language" hint="Afrikaans and isiZulu are on the roadmap."><Select disabled value="en"><option value="en">English</option></Select></Field>
          </div>
        </Card>

        <Card className="space-y-3">
          <p className="font-bold text-slate-900">Default reminder behaviour</p>
          <Field label="Default ladder for new renewals">
            <Select disabled={ro} value={a.defaultPreset} onChange={e => set('defaultPreset', e.target.value as RRAccount['defaultPreset'])}>
              {Object.entries(E.PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label} — {p.blurb}</option>)}
            </Select>
          </Field>
          <Field label="Send reminders at" hint="Local time on the nudge day.">
            <Select disabled={ro} value={a.sendHour} onChange={e => set('sendHour', Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </Select>
          </Field>
          <Toggle disabled={ro} checked={a.deliveryMode === 'sequential'} onChange={v => set('deliveryMode', v ? 'sequential' : 'fanout')} label="Sequential delivery" hint="Off = fan-out: every channel gets every reminder. On = first channel, then escalate after 24 h." />
          <Toggle disabled={ro} checked={a.overdueAlerts} onChange={v => set('overdueAlerts', v)} label="Overdue alerts" hint="Keep alerting 1, 7 and 14 days after the due date (and tell watchers)." />
          <Toggle disabled={ro} checked={a.holidayShift} onChange={v => set('holidayShift', v)} label="Shift for weekends and SA public holidays" hint="Count reminders back from the last business day before the due date." />
          <Toggle disabled={ro} checked={a.consolidate} onChange={v => set('consolidate', v)} label="Combine same-day reminders" hint="One message per channel when several renewals nudge on the same day." />
        </Card>

        <Card className="space-y-3">
          <p className="font-bold text-slate-900">Quiet hours</p>
          <p className="text-xs text-slate-500">WhatsApp and SMS are only sent inside this window. Anything that falls outside it rolls to the next permitted time. Email, Slack and Teams are not affected.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From"><Select disabled={ro} value={a.quietStart} onChange={e => set('quietStart', Number(e.target.value))}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</Select></Field>
            <Field label="Until"><Select disabled={ro} value={a.quietEnd} onChange={e => set('quietEnd', Number(e.target.value))}>{Array.from({ length: 24 }, (_, h) => h + 1).map(h => <option key={h} value={h}>{String(h % 24).padStart(2, '0')}:00</option>)}</Select></Field>
          </div>
          {a.quietStart >= a.quietEnd && <p className="text-xs text-red-600">The window must start before it ends.</p>}
          <Toggle disabled={ro} checked={a.quietOverride} onChange={v => set('quietOverride', v)} label="Override quiet hours" hint="Allow WhatsApp / SMS at any time." />
        </Card>

        <Card className="space-y-3">
          <p className="font-bold text-slate-900">Digest & retention</p>
          <Toggle disabled={ro} checked={a.digestEnabled} onChange={v => set('digestEnabled', v)} label="Weekly digest email" hint="What is coming up in 30 days and what is overdue. Each person can opt out under Team." />
          <Field label="Digest day"><Select disabled={ro || !a.digestEnabled} value={a.digestWeekday} onChange={e => set('digestWeekday', Number(e.target.value))}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</Select></Field>
          <Field label="Keep logs and history for" hint="Deliveries, completions and change logs older than this are deleted automatically (POPIA-aligned). Default 5 years.">
            <Select disabled={ro} value={a.retentionYears} onChange={e => set('retentionYears', Number(e.target.value))}>{[1, 2, 3, 5, 7, 10].map(y => <option key={y} value={y}>{y} year{y === 1 ? '' : 's'}</option>)}</Select>
          </Field>
        </Card>

        <Card className="space-y-3">
          <p className="font-bold text-slate-900 flex items-center gap-2">White-label branding {!plan.whiteLabel && <Pill>Provider White-Label</Pill>}</p>
          <p className="text-xs text-slate-500">Reminders, Mark-as-done pages and the client portal carry your brand instead of CloudStep's.</p>
          <Field label="Brand name"><Input disabled={ro || !plan.whiteLabel} value={a.brandName ?? ''} onChange={e => set('brandName', e.target.value || null)} placeholder="Your Firm Compliance" /></Field>
          <Field label="Logo URL" hint="https:// link to a PNG or SVG, about 32 px high."><Input disabled={ro || !plan.whiteLabel} value={a.brandLogoUrl ?? ''} onChange={e => set('brandLogoUrl', e.target.value || null)} /></Field>
          <Field label="Brand colour"><div className="flex gap-2"><input type="color" disabled={ro || !plan.whiteLabel} value={a.brandColor ?? '#2563eb'} onChange={e => set('brandColor', e.target.value)} className="h-9 w-12 rounded border border-slate-200 bg-transparent" /><Input disabled={ro || !plan.whiteLabel} value={a.brandColor ?? ''} onChange={e => set('brandColor', e.target.value || null)} placeholder="#2563eb" /></div></Field>
        </Card>

        <PlanCard />
      </div>

      <AccountTemplates />
    </div>
  );
}

function PlanCard() {
  const { account, plan, isPlatformAdmin, run, setAccount, entities, renewals, channels, members } = useRR();
  const rows: [string, string, string][] = [
    ['Entities', String(entities.filter(e => !e.archived).length), E.formatLimit(plan.entities)],
    ['Renewals', String(renewals.filter(r => r.state !== 'archived').length), E.formatLimit(plan.renewals)],
    ['Channel types beyond email', String(new Set(channels.filter(c => c.type !== 'email').map(c => c.type)).size), String(plan.extraChannels)],
    ['Users', String(members.filter(m => m.status !== 'revoked').length + 1), String(plan.users)],
  ];
  return (
    <Card className="space-y-3">
      <p className="font-bold text-slate-900">Plan: {plan.label}</p>
      <table className="w-full text-xs">
        <tbody>{rows.map(([k, used, cap]) => <tr key={k} className="border-t border-slate-200"><td className="py-1.5 text-slate-500">{k}</td><td className="py-1.5 text-right font-bold text-slate-800">{used} / {cap}</td></tr>)}</tbody>
      </table>
      <p className="text-[11px] text-slate-400">
        {[plan.watchers && 'watcher alerts', plan.auditExport && 'audit exports', plan.providerDashboard && 'multi-client dashboard', plan.bulkActions && 'bulk actions', plan.whiteLabel && 'white-label'].filter(Boolean).join(' · ') || 'Core reminders'}.
        If an account is over a limit after a downgrade, existing renewals keep running but nothing new can be added.
      </p>
      {isPlatformAdmin && (
        <Field label="Change plan (CloudStep administrator)">
          <Select value={account.plan} onChange={async e => {
            const plan = e.target.value;
            if (await run(() => data.setPlan(account.id, plan), `Plan changed to ${E.PLANS[plan as E.PlanKey].label}`)) setAccount({ ...account, plan: plan as E.PlanKey });
          }}>
            {(Object.keys(E.PLANS) as E.PlanKey[]).map(k => <option key={k} value={k}>{E.PLANS[k].label}</option>)}
          </Select>
        </Field>
      )}
    </Card>
  );
}

function AccountTemplates() {
  const { templates, canAdmin } = useRR();
  const [editing, setEditing] = useState<RRTemplate | 'new' | null>(null);
  return (
    <section>
      <SectionTitle eyebrow="Templates" title="Your own renewal templates">
        {canAdmin && <Button onClick={() => setEditing('new')}><Plus className="w-3.5 h-3.5" /> New template</Button>}
      </SectionTitle>
      <p className="text-xs text-slate-500 mb-3">Reuse your firm's standard obligations across clients and branches. Like the SA library, templates never carry a date.</p>
      {templates.length === 0 ? <p className="text-xs text-slate-400">No custom templates yet — the SA library is always available.</p> : (
        <div className="bg-slate-150 border border-slate-200 rounded-2xl divide-y divide-slate-200">
          {templates.map(t => (
            <div key={t.id} className="px-4 py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900">{t.name}</p>
                <p className="text-[11px] text-slate-500">{E.categoryLabel(t.category)} · {E.describeRecurrence({ unit: t.recurrenceUnit, interval: t.recurrenceInterval })} · {t.preset === 'custom' ? 'custom ladder' : E.PRESETS[t.preset].label}</p>
              </div>
              {canAdmin && <Button kind="ghost" onClick={() => setEditing(t)} aria-label="Edit"><Pencil className="w-3.5 h-3.5" /></Button>}
            </div>
          ))}
        </div>
      )}
      {editing && <TemplateForm template={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function TemplateForm({ template, onClose }: { template: RRTemplate | null; onClose: () => void }) {
  const { account, run, reload } = useRR();
  const [t, setT] = useState<Partial<RRTemplate>>(template ?? { name: '', category: 'internal', description: '', recurrenceUnit: 'year', recurrenceInterval: 1, anchorMode: 'fixed', preset: 'standard', expectsAttachment: false });
  const [offsets, setOffsets] = useState((template?.customOffsets ?? []).join(', '));
  const set = <K extends keyof RRTemplate>(k: K, v: RRTemplate[K]) => setT(p => ({ ...p, [k]: v }));
  const save = async () => {
    const customOffsets = t.preset === 'custom' ? E.normaliseOffsets(offsets.split(/[,\s]+/).filter(Boolean).map(Number)) : null;
    if (await run(() => data.saveTemplate({ ...t, accountId: account.id, customOffsets } as RRTemplate & { accountId: string }), 'Template saved')) { await reload(); onClose(); }
  };
  return (
    <Modal title={template ? `Edit ${template.name}` : 'New template'} onClose={onClose} footer={<>
      {template && <Button kind="danger" onClick={async () => { if (confirm('Delete this template? Existing renewals are not affected.') && await run(() => data.deleteRow('rr_templates', template.id), 'Template deleted')) { await reload(); onClose(); } }}><Trash2 className="w-3.5 h-3.5" /> Delete</Button>}
      <Button onClick={onClose}>Cancel</Button>
      <Button kind="primary" disabled={!t.name?.trim()} onClick={save}>Save</Button>
    </>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Name" className="sm:col-span-2"><Input value={t.name ?? ''} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="Category"><Select value={t.category} onChange={e => set('category', e.target.value as E.CategoryKey)}>{E.CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</Select></Field>
        <Field label="Repeats">
          <Select value={`${t.recurrenceUnit}:${t.recurrenceInterval}`} onChange={e => { const [u, i] = e.target.value.split(':'); set('recurrenceUnit', u as E.RecurrenceUnit); set('recurrenceInterval', Number(i)); }}>
            {E.RECURRENCE_PRESETS.map(p => <option key={p.key} value={`${p.rule.unit}:${p.rule.interval}`}>{p.label}</option>)}
            <option value="year:2">Every 2 years</option><option value="year:3">Every 3 years</option><option value="year:5">Every 5 years</option>
          </Select>
        </Field>
        <Field label="Anchor"><Select value={t.anchorMode} onChange={e => set('anchorMode', e.target.value as E.AnchorMode)}><option value="fixed">Anniversary of the date</option><option value="completion">Period after completion</option></Select></Field>
        <Field label="Ladder"><Select value={t.preset} onChange={e => set('preset', e.target.value as E.PresetKey)}>{Object.entries(E.PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}<option value="custom">Custom</option></Select></Field>
        {t.preset === 'custom' && <Field label="Days before" className="sm:col-span-2"><Input value={offsets} onChange={e => setOffsets(e.target.value)} placeholder="45, 21, 7, 2" /></Field>}
        <Field label="Description" className="sm:col-span-2"><Textarea rows={2} value={t.description ?? ''} onChange={e => set('description', e.target.value)} /></Field>
        <div className="sm:col-span-2"><Toggle checked={!!t.expectsAttachment} onChange={v => set('expectsAttachment', v)} label="Expect a document on completion" /></div>
      </div>
    </Modal>
  );
}
