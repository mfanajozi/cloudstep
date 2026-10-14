import React, { useMemo, useState } from 'react';
import { Building2, Plus, Link2, RefreshCw, Layers, Upload, ChevronDown, ChevronRight, Pencil, Archive } from 'lucide-react';
import * as E from './engine';
import { useRR } from './store';
import * as data from './data';
import type { RREntity, RRRenewal } from './types';
import { Button, Card, Field, Input, Modal, Select, SectionTitle, Toggle, Empty, Pill, Textarea, copyText } from './ui';
import { RenewalRow } from './Overview';
import RenewalDetail from './RenewalDetail';
import RenewalForm from './RenewalForm';
import BulkImport from './BulkImport';

export default function Entities() {
  const store = useRR();
  const { entities, renewals, statusOf, canAdmin, plan, account, toast } = store;
  const [editing, setEditing] = useState<RREntity | 'new' | null>(null);
  const [bulk, setBulk] = useState(false);
  const [importing, setImporting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [open, setOpen] = useState<RRRenewal | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [group, setGroup] = useState('');

  const rows = useMemo(() => entities
    .filter(e => showArchived || !e.archived)
    .filter(e => !group || e.groupName === group)
    .map(e => {
      const rs = renewals.filter(r => r.entityId === e.id && r.state !== 'archived');
      const statuses = rs.map(statusOf);
      const risk = statuses.length ? Math.min(...statuses.map(E.riskRank)) : 99;
      return {
        e, rs,
        overdue: statuses.filter(s => s === 'overdue').length,
        soon: statuses.filter(s => s === 'awaiting' || s === 'in_window' || s === 'snoozed').length,
        next: rs.filter(r => r.state === 'active').sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0],
        risk,
      };
    })
    .sort((a, b) => a.risk - b.risk || (a.next?.dueDate ?? '9').localeCompare(b.next?.dueDate ?? '9') || a.e.name.localeCompare(b.e.name)),
  [entities, renewals, statusOf, showArchived, group]);

  const groups = [...new Set(entities.map(e => e.groupName).filter(Boolean))] as string[];
  const atLimit = entities.filter(e => !e.archived).length >= plan.entities;

  return (
    <div>
      <SectionTitle eyebrow={plan.providerDashboard ? 'Multi-client dashboard' : 'Entities'} title={plan.providerDashboard ? 'Client entities, riskiest first' : 'Companies you track renewals for'}>
        {canAdmin && plan.bulkActions && <Button onClick={() => setBulk(true)} disabled={!entities.length}><Layers className="w-3.5 h-3.5" /> Apply template to many</Button>}
        {canAdmin && plan.bulkActions && <Button onClick={() => setImporting(true)}><Upload className="w-3.5 h-3.5" /> Import CSV</Button>}
        {canAdmin && <Button kind="primary" onClick={() => setEditing('new')} disabled={atLimit} title={atLimit ? `Your plan allows ${plan.entities} entities` : undefined}><Plus className="w-3.5 h-3.5" /> Add entity</Button>}
      </SectionTitle>

      <div className="flex flex-wrap gap-3 items-center mb-3 text-xs text-slate-500">
        <span>{entities.filter(e => !e.archived).length} of {plan.entities} entities on {plan.label}</span>
        {groups.length > 0 && (
          <Select value={group} onChange={e => setGroup(e.target.value)} className="!w-auto !py-1 text-xs">
            <option value="">All groups</option>
            {groups.map(g => <option key={g} value={g}>{g}</option>)}
          </Select>
        )}
        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} className="accent-[#d8b75c]" /> Show archived</label>
      </div>

      {rows.length === 0 ? (
        <Card><Empty icon={<Building2 className="w-5 h-5" />} title="No entities yet">Add the companies you manage. Each gets its own renewals, contact for reminders and a no-login client portal link.</Empty></Card>
      ) : (
        <div className="space-y-2">
          {rows.map(({ e, rs, overdue, soon, next }) => (
            <div key={e.id} className="bg-slate-150 border border-slate-200 rounded-2xl overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3">
                <button onClick={() => setExpanded(expanded === e.id ? null : e.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer">
                  {expanded === e.id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{e.name} {e.archived && <Pill>Archived</Pill>}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {[e.groupName, e.contactName || e.contactEmail, e.registrationNumber].filter(Boolean).join(' · ') || 'No contact set'}
                    </p>
                  </div>
                </button>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  {overdue > 0 && <Pill className="text-red-700 border-red-200 bg-red-50">{overdue} overdue</Pill>}
                  {soon > 0 && <Pill className="text-amber-800 border-amber-200 bg-amber-50">{soon} approaching</Pill>}
                  <Pill>{rs.length} renewal{rs.length === 1 ? '' : 's'}</Pill>
                  {next && <span className="text-slate-500">Next: <b className="text-slate-800">{next.name}</b> · {E.daysLeftLabel(next.dueDate, account.timezone)}</span>}
                </div>
                <div className="flex gap-1">
                  {e.portalEnabled && data.functionConfigured() && (
                    <Button kind="ghost" title="Copy client portal link" onClick={async () => { if (await copyText(data.portalLink(e.portalToken))) toast({ kind: 'success', title: 'Portal link copied', body: 'Anyone with this link can see and complete this entity’s renewals.' }); }}><Link2 className="w-3.5 h-3.5" /></Button>
                  )}
                  {canAdmin && <Button kind="ghost" onClick={() => setEditing(e)} aria-label="Edit entity"><Pencil className="w-3.5 h-3.5" /></Button>}
                </div>
              </div>
              {expanded === e.id && (
                <div className="border-t border-slate-200">
                  {rs.length ? (
                    <div className="divide-y divide-slate-200">{rs.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(r => <RenewalRow key={r.id} r={r} onOpen={() => setOpen(r)} showEntity={false} />)}</div>
                  ) : <p className="text-xs text-slate-400 px-4 py-3">No renewals for this entity yet.</p>}
                  {store.canWrite(e.id) && <div className="px-4 py-2 border-t border-slate-200"><Button kind="ghost" onClick={() => setAdding(e.id)}><Plus className="w-3.5 h-3.5" /> Add renewal for {e.name}</Button></div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && <EntityForm entity={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {bulk && <BulkApply onClose={() => setBulk(false)} />}
      {importing && <BulkImport onClose={() => setImporting(false)} />}
      {open && <RenewalDetail renewal={open} onClose={() => setOpen(null)} />}
      {adding && <RenewalForm initialEntityId={adding} onClose={() => setAdding(null)} />}
    </div>
  );
}

function EntityForm({ entity, onClose }: { entity: RREntity | null; onClose: () => void }) {
  const { account, run, reload, toast } = useRR();
  const [e, setE] = useState<Partial<RREntity>>(entity ?? { name: '', portalEnabled: true });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof RREntity>(k: K, v: RREntity[K]) => setE(p => ({ ...p, [k]: v }));
  const save = async () => {
    setBusy(true);
    const { portalToken: _t, ...rest } = e as RREntity;
    const ok = await run(() => data.saveEntity({ ...rest, accountId: account.id, name: (e.name ?? '').trim() }), entity ? 'Entity saved' : 'Entity added');
    setBusy(false);
    if (ok) { await reload(); onClose(); }
  };
  return (
    <Modal title={entity ? `Edit ${entity.name}` : 'Add entity'} onClose={onClose} footer={<>
      {entity && <Button kind="danger" onClick={async () => {
        if (!confirm(entity.archived ? `Restore ${entity.name}?` : `Archive ${entity.name}? Its renewals keep their history.`)) return;
        if (await run(() => data.saveEntity({ id: entity.id, accountId: account.id, archived: !entity.archived }), entity.archived ? 'Restored' : 'Archived')) { await reload(); onClose(); }
      }}><Archive className="w-3.5 h-3.5" /> {entity.archived ? 'Restore' : 'Archive'}</Button>}
      <Button onClick={onClose}>Cancel</Button>
      <Button kind="primary" busy={busy} disabled={!e.name?.trim()} onClick={save}>Save</Button>
    </>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Company name" className="sm:col-span-2"><Input value={e.name ?? ''} onChange={x => set('name', x.target.value)} placeholder="Acme Trading (Pty) Ltd" autoFocus /></Field>
        <Field label="Registration number"><Input value={e.registrationNumber ?? ''} onChange={x => set('registrationNumber', x.target.value || null)} placeholder="2015/123456/07" /></Field>
        <Field label="Group / branch" hint="For franchises and multi-branch operators"><Input value={e.groupName ?? ''} onChange={x => set('groupName', x.target.value || null)} placeholder="Gauteng North" /></Field>
        <Field label="Contact name"><Input value={e.contactName ?? ''} onChange={x => set('contactName', x.target.value || null)} /></Field>
        <Field label="Contact email" hint="Receives this entity's reminders unless a renewal names someone else"><Input type="email" value={e.contactEmail ?? ''} onChange={x => set('contactEmail', x.target.value || null)} /></Field>
        <Field label="Contact phone"><Input value={e.contactPhone ?? ''} onChange={x => set('contactPhone', x.target.value || null)} placeholder="+27…" /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea rows={2} value={e.notes ?? ''} onChange={x => set('notes', x.target.value || null)} /></Field>
        <div className="sm:col-span-2 space-y-2">
          <Toggle checked={e.portalEnabled ?? true} onChange={v => set('portalEnabled', v)} label="Client portal link" hint="A secret link that lets the client see their renewals and mark them done without an account." />
          {entity && (
            <Button kind="ghost" onClick={async () => {
              if (!confirm('Generate a new portal link? The old link stops working immediately.')) return;
              const t = await run(() => data.rotateSecret('rr_entities', entity.id), 'New portal link generated');
              if (t) { await reload(); if (await copyText(data.portalLink(t))) toast({ kind: 'info', title: 'New link copied to clipboard' }); }
            }}><RefreshCw className="w-3.5 h-3.5" /> Reset portal link</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Provider bulk action: one template, many entities, each with its own date. */
function BulkApply({ onClose }: { onClose: () => void }) {
  const { entities, account, templates, run, reloadRenewals } = useRR();
  const [key, setKey] = useState(E.TEMPLATE_LIBRARY[0].key);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const live = entities.filter(e => !e.archived);
  const lib = E.findTemplate(key);
  const custom = key.startsWith('acct:') ? templates.find(t => t.id === key.slice(5)) : undefined;
  const ready = [...selected].filter(id => E.isValidDate(dates[id]));

  const submit = async () => {
    setBusy(true);
    const rows = ready.map(entityId => ({
      accountId: account.id,
      entityId,
      name: lib?.name ?? custom!.name,
      category: lib?.category ?? custom!.category,
      templateKey: lib?.key ?? null,
      dueDate: dates[entityId],
      recurrenceUnit: lib?.recurrence.unit ?? custom!.recurrenceUnit,
      recurrenceInterval: lib?.recurrence.interval ?? custom!.recurrenceInterval,
      anchorMode: lib?.anchorMode ?? custom!.anchorMode,
      preset: lib?.preset ?? custom!.preset,
      customOffsets: custom?.customOffsets ?? null,
      expectsAttachment: lib?.expectsAttachment ?? custom!.expectsAttachment,
    }));
    const out = await run(() => data.insertRenewals(rows), `${rows.length} renewal${rows.length === 1 ? '' : 's'} created`);
    setBusy(false);
    if (out) { await reloadRenewals(); onClose(); }
  };

  const fillAll = (d: string) => setDates(Object.fromEntries(live.map(e => [e.id, d])));

  return (
    <Modal title="Apply a template to many entities" onClose={onClose} wide footer={<>
      <span className="text-xs text-slate-500 mr-auto self-center">{ready.length} ready · entities without a date are skipped</span>
      <Button onClick={onClose}>Cancel</Button>
      <Button kind="primary" busy={busy} disabled={!ready.length} onClick={submit}>Create {ready.length} renewal{ready.length === 1 ? '' : 's'}</Button>
    </>}>
      <div className="space-y-4">
        <Field label="Template">
          <Select value={key} onChange={e => setKey(e.target.value)}>
            <optgroup label="SA template library">{E.TEMPLATE_LIBRARY.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}</optgroup>
            {templates.length > 0 && <optgroup label="Your templates">{templates.map(t => <option key={t.id} value={`acct:${t.id}`}>{t.name}</option>)}</optgroup>}
          </Select>
        </Field>
        {lib && <p className="text-[11px] text-slate-500">{lib.dateHint} CloudStep will not guess these dates — each entity needs its own.</p>}
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Same date for all (optional)"><Input type="date" onChange={e => e.target.value && fillAll(e.target.value)} /></Field>
          <Button kind="ghost" onClick={() => setSelected(new Set(live.map(e => e.id)))}>Select all</Button>
          <Button kind="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
        <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 max-h-[45vh] overflow-y-auto">
          {live.map(e => (
            <label key={e.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer">
              <input type="checkbox" className="accent-[#d8b75c]" checked={selected.has(e.id)} onChange={x => {
                const s = new Set(selected); x.target.checked ? s.add(e.id) : s.delete(e.id); setSelected(s);
              }} />
              <span className="flex-1 text-sm text-slate-800 truncate">{e.name}</span>
              <Input type="date" className="!w-40 !py-1 text-xs" value={dates[e.id] ?? ''} onChange={x => { setDates({ ...dates, [e.id]: x.target.value }); setSelected(new Set(selected).add(e.id)); }} />
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}

