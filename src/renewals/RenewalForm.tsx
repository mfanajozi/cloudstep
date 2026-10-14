import React, { useMemo, useState } from 'react';
import { Bell, Mail, MessageCircle, Smartphone, Hash, Users, Webhook, Plus, Trash2, Sparkles, Info } from 'lucide-react';
import * as E from './engine';
import { useRR } from './store';
import * as data from './data';
import type { RRRenewal, ChannelType, Watcher } from './types';
import { Button, Field, Input, Select, Textarea, Toggle, Modal, Pill } from './ui';

export const CHANNEL_META: Record<ChannelType, { label: string; icon: React.ReactNode; placeholder: string; hint: string }> = {
  email: { label: 'Email', icon: <Mail className="w-3.5 h-3.5" />, placeholder: 'finance@company.co.za', hint: 'An extra email address (the primary recipient always gets email).' },
  whatsapp: { label: 'WhatsApp', icon: <MessageCircle className="w-3.5 h-3.5" />, placeholder: '+27821234567', hint: 'International format. Delivered through your relay webhook (n8n / Make / Zapier).' },
  sms: { label: 'SMS', icon: <Smartphone className="w-3.5 h-3.5" />, placeholder: '+27821234567', hint: 'International format. Delivered through your relay webhook.' },
  slack: { label: 'Slack', icon: <Hash className="w-3.5 h-3.5" />, placeholder: 'https://hooks.slack.com/services/…', hint: 'A Slack incoming-webhook URL for the channel to post into.' },
  teams: { label: 'Microsoft Teams', icon: <Users className="w-3.5 h-3.5" />, placeholder: 'https://….webhook.office.com/…', hint: 'A Teams incoming-webhook or Workflows URL.' },
  webhook: { label: 'Webhook / CRM', icon: <Webhook className="w-3.5 h-3.5" />, placeholder: '', hint: 'Sends each reminder to one of your webhook endpoints.' },
};

type Draft = {
  name: string;
  category: E.CategoryKey;
  templateKey: string | null;
  entityId: string | null;
  dueDate: string;
  recurrenceKey: string;           // preset key or 'custom'
  customUnit: E.RecurrenceUnit;
  customInterval: number;
  anchorMode: E.AnchorMode;
  preset: E.PresetKey;
  customOffsets: string;           // "60, 30, 14"
  channelIds: string[] | null;     // null = account defaults
  responsibleName: string;
  responsibleEmail: string;
  responsiblePhone: string;
  watchers: Watcher[];
  notes: string;
  expectsAttachment: boolean;
  overdueAlerts: boolean | null;
  holidayShift: boolean | null;
  deliveryMode: 'fanout' | 'sequential' | null;
  dateScope: 'cycle' | 'permanent';
};

function recurrenceKeyOf(unit: E.RecurrenceUnit, interval: number): string {
  return E.RECURRENCE_PRESETS.find(p => p.rule.unit === unit && p.rule.interval === interval)?.key ?? 'custom';
}

function draftFrom(r: RRRenewal | null, defaults: { preset: E.PresetKey; entityId: string | null }): Draft {
  if (r) {
    return {
      name: r.name, category: r.category, templateKey: r.templateKey, entityId: r.entityId, dueDate: r.dueDate,
      recurrenceKey: recurrenceKeyOf(r.recurrenceUnit, r.recurrenceInterval), customUnit: r.recurrenceUnit, customInterval: r.recurrenceInterval,
      anchorMode: r.anchorMode, preset: r.preset, customOffsets: (r.customOffsets ?? []).join(', '), channelIds: r.channelIds,
      responsibleName: r.responsibleName ?? '', responsibleEmail: r.responsibleEmail ?? '', responsiblePhone: r.responsiblePhone ?? '',
      watchers: r.watchers ?? [], notes: r.notes ?? '', expectsAttachment: r.expectsAttachment,
      overdueAlerts: r.overdueAlerts, holidayShift: r.holidayShift, deliveryMode: r.deliveryMode, dateScope: 'cycle',
    };
  }
  return {
    name: '', category: 'statutory', templateKey: null, entityId: defaults.entityId, dueDate: '',
    recurrenceKey: 'annual', customUnit: 'year', customInterval: 1, anchorMode: 'fixed', preset: defaults.preset,
    customOffsets: '60, 30, 14, 7, 1', channelIds: null, responsibleName: '', responsibleEmail: '', responsiblePhone: '',
    watchers: [], notes: '', expectsAttachment: false, overdueAlerts: null, holidayShift: null, deliveryMode: null, dateScope: 'permanent',
  };
}

function recurrenceFromDraft(d: Draft): E.Recurrence {
  if (d.recurrenceKey === 'custom') return { unit: d.customUnit, interval: Math.max(1, Math.round(d.customInterval || 1)) };
  return E.RECURRENCE_PRESETS.find(p => p.key === d.recurrenceKey)!.rule;
}

function offsetsFromDraft(d: Draft): number[] | null {
  if (d.preset !== 'custom') return null;
  return d.customOffsets.split(/[,\s]+/).filter(Boolean).map(Number).filter(n => Number.isFinite(n));
}

// ---------------------------------------------------------------
// Timeline preview (onboarding step 5 and every edit)
// ---------------------------------------------------------------

export function TimelinePreview({ dueDate, recurrence, preset, customOffsets, overdueAlerts, watchers, holidayShift, channelsLabel, compact }: {
  dueDate: string; recurrence: E.Recurrence; preset: E.PresetKey; customOffsets: number[] | null;
  overdueAlerts: boolean; watchers: boolean; holidayShift: boolean; channelsLabel: string; compact?: boolean;
}) {
  const { account } = useRR();
  if (!E.isValidDate(dueDate)) {
    return <p className="text-xs text-slate-400">Enter the due date to see exactly when reminders will go out.</p>;
  }
  const plan = E.planCycle({
    dueDate, recurrence, preset, customOffsets, overdueAlerts, watchers,
    settings: { timeZone: account.timezone, sendHour: account.sendHour, holidayShift },
  });
  const eff = E.effectiveDueDate(dueDate, holidayShift);
  const holiday = E.holidayName(dueDate);
  const wd = E.weekday(dueDate);
  const future = plan.filter(p => !p.inPast);
  const skipped = plan.filter(p => p.inPast && p.kind === 'nudge');
  const next = E.nextCycle({ recurrence, anchorMode: 'fixed', anchorDate: dueDate, currentDue: dueDate });

  return (
    <div className="space-y-3">
      {eff !== dueDate && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-2">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {E.formatLongDate(dueDate)} is a {holiday ? `public holiday (${holiday})` : wd === 0 ? 'Sunday' : 'Saturday'}. Reminders count back from {E.formatLongDate(eff)}, the last business day before it.
        </p>
      )}
      <ol className="relative border-l border-slate-250 ml-2 space-y-2.5">
        {plan.filter(p => compact ? !p.inPast : true).map(p => (
          <li key={`${p.kind}-${p.seq}`} className={`ml-4 ${p.inPast ? 'opacity-40 line-through' : ''}`}>
            <span className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full ${p.kind === 'watcher' ? 'bg-cyan-500' : p.kind === 'overdue' ? 'bg-red-500' : 'bg-blue-600'}`} />
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-xs font-bold text-slate-900">{p.fireAt.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: account.timezone })}</span>
              <span className="text-[11px] text-slate-400">{p.fireAt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: account.timezone })}</span>
              <span className="text-[11px] text-slate-500">
                {p.kind === 'watcher' ? 'Watchers alerted if not done' : p.kind === 'overdue' ? `Overdue alert (${-p.offsetDays}d late)` : `${E.TONE_LABEL[p.tone]} · ${p.offsetDays === 0 ? 'on the due date' : `${p.offsetDays} day${p.offsetDays === 1 ? '' : 's'} before`}`}
              </span>
            </div>
            {p.kind === 'nudge' && !p.inPast && <p className="text-[10px] text-slate-400">{channelsLabel}</p>}
          </li>
        ))}
        <li className="ml-4">
          <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-xs font-bold text-slate-900">{E.formatLongDate(dueDate)}</span>
          <span className="text-[11px] text-slate-500 ml-2">Due date</span>
        </li>
      </ol>
      <p className="text-[11px] text-slate-500">
        {future.filter(p => p.kind === 'nudge').length} reminder{future.filter(p => p.kind === 'nudge').length === 1 ? '' : 's'} scheduled (max {E.MAX_NUDGES}).
        {skipped.length > 0 && ` ${skipped.length} earlier nudge${skipped.length === 1 ? ' is' : 's are'} already in the past and won't be backfilled.`}
        {' '}Tapping <b>Mark as done</b> in any reminder cancels the rest{next ? ` and schedules the next cycle (${E.formatLongDate(next.dueDate)})` : ''}.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------
// Form
// ---------------------------------------------------------------

export default function RenewalForm({ renewal, initialEntityId, initialTemplateKey, onClose, onSaved }: {
  renewal?: RRRenewal | null;
  initialEntityId?: string | null;
  initialTemplateKey?: string | null;
  onClose: () => void;
  onSaved?: (r: RRRenewal) => void;
}) {
  const store = useRR();
  const { account, entities, channels, plan, templates, canWrite, run, reloadRenewals, toast } = store;
  const editing = !!renewal;
  const [d, setD] = useState<Draft>(() => {
    const base = draftFrom(renewal ?? null, { preset: account.defaultPreset, entityId: initialEntityId ?? (entities.length === 1 ? entities[0].id : null) });
    const t = E.findTemplate(initialTemplateKey);
    return t && !renewal ? applyTemplate(base, t) : base;
  });
  const [mode, setMode] = useState<'quick' | 'full'>(editing ? 'full' : 'quick');
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(prev => ({ ...prev, [k]: v }));

  const recurrence = recurrenceFromDraft(d);
  const offsets = offsetsFromDraft(d);
  const normalised = d.preset === 'custom' ? E.normaliseOffsets(offsets ?? [], recurrence) : null;
  const cycleTooShort = d.preset !== 'custom' && E.ladderOffsets(d.preset, null, recurrence).length < E.PRESETS[d.preset as Exclude<E.PresetKey, 'custom'>].offsets.length;

  const effectiveChannelIds = d.channelIds ?? account.defaultChannelIds;
  const availableChannels = channels.filter(c => c.enabled && (c.entityId === null || c.entityId === d.entityId));
  const channelsLabel = ['Email', ...availableChannels.filter(c => effectiveChannelIds.includes(c.id)).map(c => CHANNEL_META[c.type].label)]
    .filter((v, i, a) => a.indexOf(v) === i).join(' + ');

  const writableEntities = entities.filter(e => !e.archived && canWrite(e.id));
  const canSave = !!d.name.trim() && E.isValidDate(d.dueDate) && canWrite(d.entityId) && (d.preset !== 'custom' || (normalised?.length ?? 0) > 0);
  const dateChanged = editing && renewal!.dueDate !== d.dueDate;

  function applyTemplate(base: Draft, t: E.RenewalTemplate): Draft {
    return {
      ...base, name: base.name || t.name, category: t.category, templateKey: t.key,
      recurrenceKey: recurrenceKeyOf(t.recurrence.unit, t.recurrence.interval), customUnit: t.recurrence.unit, customInterval: t.recurrence.interval,
      anchorMode: t.anchorMode, preset: t.preset, expectsAttachment: t.expectsAttachment,
      // Guardrail: a template never supplies the date.
      dueDate: base.dueDate,
    };
  }

  const pickTemplate = (key: string) => {
    if (key.startsWith('acct:')) {
      const t = templates.find(x => x.id === key.slice(5));
      if (!t) return;
      setD(prev => ({
        ...prev, name: prev.name || t.name, category: t.category, templateKey: null,
        recurrenceKey: recurrenceKeyOf(t.recurrenceUnit, t.recurrenceInterval), customUnit: t.recurrenceUnit, customInterval: t.recurrenceInterval,
        anchorMode: t.anchorMode, preset: t.preset, customOffsets: (t.customOffsets ?? []).join(', '), expectsAttachment: t.expectsAttachment,
      }));
      return;
    }
    const t = E.findTemplate(key);
    if (t) setD(prev => applyTemplate({ ...prev, name: '' }, t));
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const payload: Partial<RRRenewal> & { accountId: string } = {
      id: renewal?.id,
      accountId: account.id,
      entityId: d.entityId,
      name: d.name.trim(),
      category: d.category,
      templateKey: d.templateKey,
      dueDate: d.dueDate,
      recurrenceUnit: recurrence.unit,
      recurrenceInterval: recurrence.interval,
      anchorMode: d.anchorMode,
      preset: d.preset,
      customOffsets: normalised,
      channelIds: d.channelIds,
      responsibleName: d.responsibleName.trim() || null,
      responsibleEmail: d.responsibleEmail.trim() || null,
      responsiblePhone: d.responsiblePhone.trim() || null,
      watchers: d.watchers.filter(w => (w.email ?? '').trim()),
      notes: d.notes.trim() || null,
      expectsAttachment: d.expectsAttachment,
      overdueAlerts: d.overdueAlerts,
      holidayShift: d.holidayShift,
      deliveryMode: d.deliveryMode,
    };
    // "Permanently for this record" moves the series; "this cycle only"
    // leaves the anniversary series where it was.
    if (!editing || (dateChanged && d.dateScope === 'permanent')) {
      payload.seriesDue = d.dueDate;
      payload.anchorDate = d.dueDate;
    }
    const saved = await run(() => data.saveRenewal(payload), editing ? 'Renewal updated' : 'Renewal created — reminders scheduled');
    setSaving(false);
    if (!saved) return;
    await reloadRenewals();
    // Ask the scheduler to rebuild now rather than on its next 5-minute tick.
    if (data.functionConfigured()) data.api.reschedule(saved.id).catch(() => {});
    onSaved?.(saved);
    onClose();
  };

  const allTemplates = (
    <Select value="" onChange={e => e.target.value && pickTemplate(e.target.value)}>
      <option value="">Start from a template…</option>
      <optgroup label="SA template library">
        {E.TEMPLATE_LIBRARY.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
      </optgroup>
      {templates.length > 0 && (
        <optgroup label="Your templates">
          {templates.map(t => <option key={t.id} value={`acct:${t.id}`}>{t.name}</option>)}
        </optgroup>
      )}
    </Select>
  );

  const template = E.findTemplate(d.templateKey);

  return (
    <Modal
      title={editing ? `Edit ${renewal!.name}` : 'Add a renewal'}
      onClose={onClose}
      wide={mode === 'full'}
      footer={<>
        {!editing && <Button kind="ghost" onClick={() => setMode(mode === 'quick' ? 'full' : 'quick')}>{mode === 'quick' ? 'More options' : 'Quick add'}</Button>}
        <Button onClick={onClose}>Cancel</Button>
        <Button kind="primary" onClick={save} busy={saving} disabled={!canSave}>{editing ? 'Save changes' : 'Create renewal'}</Button>
      </>}
    >
      <div className={mode === 'full' ? 'grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-6' : 'space-y-4'}>
        <div className="space-y-4">
          {!editing && allTemplates}
          {template && (
            <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <Sparkles className="w-3 h-3 inline mr-1 text-blue-600" />{template.description} <b className="text-slate-700">{template.dateHint}</b>
            </p>
          )}

          <Field label="Renewal name">
            <Input value={d.name} onChange={e => set('name', e.target.value)} placeholder="e.g. CIPC Annual Return" autoFocus maxLength={200} />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Due date" hint={template ? 'CloudStep never guesses a legal deadline. Use the date on your documents.' : undefined}>
              <Input type="date" value={d.dueDate} onChange={e => set('dueDate', e.target.value)} required />
            </Field>
            {(entities.length > 0) && (
              <Field label="Entity">
                <Select value={d.entityId ?? ''} onChange={e => set('entityId', e.target.value || null)}>
                  {canWrite(null) && <option value="">— No specific entity —</option>}
                  {writableEntities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </Select>
              </Field>
            )}
          </div>

          {dateChanged && renewal!.recurrenceUnit !== 'once' && (
            <div className="text-xs bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <p className="font-bold text-slate-800">Apply the new date to…</p>
              <label className="flex gap-2 items-start cursor-pointer"><input type="radio" checked={d.dateScope === 'cycle'} onChange={() => set('dateScope', 'cycle')} className="mt-0.5 accent-[#d8b75c]" />
                <span><b>This cycle only.</b> Future cycles keep the original anniversary.</span></label>
              <label className="flex gap-2 items-start cursor-pointer"><input type="radio" checked={d.dateScope === 'permanent'} onChange={() => set('dateScope', 'permanent')} className="mt-0.5 accent-[#d8b75c]" />
                <span><b>Permanently.</b> Every future cycle follows the new date.</span></label>
              <p className="text-slate-500">{d.dueDate < renewal!.dueDate ? 'Moved earlier: the ladder is recalculated and, if you are already inside the window, the next applicable reminder fires straight away.' : 'Moved later: pending reminders are cancelled and rescheduled. Reminders already sent are not recalled.'}</p>
            </div>
          )}

          {mode === 'quick' ? (
            <Field label="Channels" hint="Email is always included.">
              <ChannelPicker selected={effectiveChannelIds} available={availableChannels} onChange={ids => set('channelIds', ids)} isDefault={d.channelIds === null} onReset={() => set('channelIds', null)} />
            </Field>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Category">
                  <Select value={d.category} onChange={e => set('category', e.target.value as E.CategoryKey)}>
                    {E.CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </Select>
                </Field>
                <Field label="Repeats">
                  <Select value={d.recurrenceKey} onChange={e => {
                    const key = e.target.value;
                    set('recurrenceKey', key);
                    const rule = E.RECURRENCE_PRESETS.find(p => p.key === key)?.rule;
                    if (rule && E.cycleLengthDays(rule) <= 120 && d.preset !== 'custom') set('preset', 'short');
                  }}>
                    {E.RECURRENCE_PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                    <option value="custom">Custom interval…</option>
                  </Select>
                </Field>
              </div>
              {d.recurrenceKey === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Every">
                    <Input type="number" min={1} max={120} value={d.customInterval} onChange={e => set('customInterval', Number(e.target.value))} />
                  </Field>
                  <Field label="Unit">
                    <Select value={d.customUnit} onChange={e => set('customUnit', e.target.value as E.RecurrenceUnit)}>
                      <option value="day">Days</option><option value="week">Weeks</option><option value="month">Months</option><option value="year">Years</option>
                    </Select>
                  </Field>
                </div>
              )}
              {recurrence.unit !== 'once' && (
                <Field label="Next due date is calculated from" hint="A CIPC return follows the incorporation anniversary. A B-BBEE certificate follows the issue date of the new certificate.">
                  <Select value={d.anchorMode} onChange={e => set('anchorMode', e.target.value as E.AnchorMode)}>
                    <option value="fixed">The original date — always the anniversary</option>
                    <option value="completion">The date I mark it done — one period after completion</option>
                  </Select>
                </Field>
              )}

              <Field label="Reminder schedule">
                <Select value={d.preset} onChange={e => set('preset', e.target.value as E.PresetKey)}>
                  {Object.entries(E.PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label} — {p.blurb}</option>)}
                  <option value="custom">Custom ladder (max 5)</option>
                </Select>
              </Field>
              {d.preset === 'custom' && (
                <Field label="Days before the due date" hint={`Up to ${E.MAX_NUDGES} values, at least 1 day apart. Using: ${normalised?.join(', ') || '—'}`}>
                  <Input value={d.customOffsets} onChange={e => set('customOffsets', e.target.value)} placeholder="45, 21, 7, 2" />
                </Field>
              )}
              {cycleTooShort && <p className="text-[11px] text-amber-700">This cycle is shorter than the ladder, so nudges that would fall in the previous cycle are dropped. The Short-cycle preset suits monthly and quarterly items.</p>}

              <Field label="Channels" hint="Email is always included. Leave on account defaults to follow future changes to your defaults.">
                <ChannelPicker selected={effectiveChannelIds} available={availableChannels} onChange={ids => set('channelIds', ids)} isDefault={d.channelIds === null} onReset={() => set('channelIds', null)} />
              </Field>

              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Responsible person"><Input value={d.responsibleName} onChange={e => set('responsibleName', e.target.value)} placeholder="Name" /></Field>
                <Field label="Their email" hint="Receives the reminders"><Input type="email" value={d.responsibleEmail} onChange={e => set('responsibleEmail', e.target.value)} placeholder={store.entityName(d.entityId) ? 'Defaults to entity contact' : account.ownerEmail} /></Field>
                <Field label="Their phone"><Input value={d.responsiblePhone} onChange={e => set('responsiblePhone', e.target.value)} placeholder="+27…" /></Field>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Watchers {!plan.watchers && <Pill className="ml-1">Business plan+</Pill>}</span>
                  <Button kind="ghost" disabled={!plan.watchers} onClick={() => set('watchers', [...d.watchers, { name: '', email: '' }])}><Plus className="w-3 h-3" /> Add watcher</Button>
                </div>
                <p className="text-[11px] text-slate-400">Watchers hear only when something goes wrong: 7 days out and not done, due date passed, or a channel failing.</p>
                {d.watchers.map((w, i) => (
                  <div key={i} className="flex gap-2 mt-2">
                    <Input value={w.name ?? ''} placeholder="Name" onChange={e => set('watchers', d.watchers.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                    <Input type="email" value={w.email ?? ''} placeholder="email@firm.co.za" onChange={e => set('watchers', d.watchers.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
                    <Button kind="ghost" onClick={() => set('watchers', d.watchers.filter((_, j) => j !== i))} aria-label="Remove watcher"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
              </div>

              <Field label="Notes" hint="Reference numbers, login hints, provider contact. Never included in WhatsApp or SMS reminders.">
                <Textarea rows={2} value={d.notes} onChange={e => set('notes', e.target.value)} maxLength={2000} />
              </Field>

              <div className="grid sm:grid-cols-2 gap-3">
                <Toggle checked={d.expectsAttachment} onChange={v => set('expectsAttachment', v)} label="Expect a document on completion" hint="Mark-as-done pages ask for the new certificate or return." />
                <Toggle checked={d.overdueAlerts ?? account.overdueAlerts} onChange={v => set('overdueAlerts', v)} label="Overdue alerts" hint="1, 7 and 14 days past due if not done." />
                <Toggle checked={d.holidayShift ?? account.holidayShift} onChange={v => set('holidayShift', v)} label="Shift for weekends & SA public holidays" hint="Count back from the last business day before the due date." />
                <Toggle checked={(d.deliveryMode ?? account.deliveryMode) === 'sequential'} onChange={v => set('deliveryMode', v ? 'sequential' : 'fanout')} label="Sequential delivery" hint="Fire the first channel, escalate to the next after 24 h if not done." />
              </div>
            </>
          )}
        </div>

        <div className={mode === 'full' ? 'lg:border-l lg:border-slate-200 lg:pl-6' : 'border-t border-slate-200 pt-4'}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-1.5"><Bell className="w-3.5 h-3.5 text-blue-600" /> What will happen</p>
          <TimelinePreview
            dueDate={d.dueDate}
            recurrence={recurrence}
            preset={d.preset}
            customOffsets={normalised}
            overdueAlerts={d.overdueAlerts ?? account.overdueAlerts}
            watchers={plan.watchers && d.watchers.some(w => w.email)}
            holidayShift={d.holidayShift ?? account.holidayShift}
            channelsLabel={channelsLabel}
            compact={mode === 'quick'}
          />
          {!canWrite(d.entityId) && <p className="text-xs text-red-600 mt-3">You can only add renewals for the entities assigned to you.</p>}
        </div>
      </div>
    </Modal>
  );
}

export function ChannelPicker({ selected, available, onChange, isDefault, onReset }: {
  selected: string[]; available: { id: string; type: ChannelType; label: string; target: string; flagged: boolean }[];
  onChange: (ids: string[]) => void; isDefault: boolean; onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-blue-600 text-ink-950">{CHANNEL_META.email.icon} Email</span>
      {available.map(c => {
        const on = selected.includes(c.id);
        return (
          <button key={c.id} type="button" onClick={() => onChange(on ? selected.filter(x => x !== c.id) : [...selected, c.id])}
            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${on ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
            title={c.target}>
            {CHANNEL_META[c.type].icon} {c.label || CHANNEL_META[c.type].label}{c.flagged && <span className="text-red-600">⚠</span>}
          </button>
        );
      })}
      {available.length === 0 && <span className="text-[11px] text-slate-400 self-center">Add WhatsApp, SMS, Slack or Teams under Channels.</span>}
      {!isDefault && <button type="button" onClick={onReset} className="text-[11px] text-slate-400 underline cursor-pointer ml-1">use account defaults</button>}
    </div>
  );
}
