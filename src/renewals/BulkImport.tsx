import React, { useMemo, useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import * as E from './engine';
import { useRR } from './store';
import * as data from './data';
import type { RRRenewal } from './types';
import { Button, Modal, Select, downloadCsv } from './ui';

// CSV bulk import (brief §4.8): upload → map columns → validate → commit.

type Target =
  | 'name' | 'due_date' | 'category' | 'entity' | 'recurrence' | 'anchor' | 'preset'
  | 'responsible_name' | 'responsible_email' | 'responsible_phone' | 'notes' | 'template';

const TARGETS: { key: Target; label: string; required?: boolean; guess: RegExp }[] = [
  { key: 'name', label: 'Renewal name', required: true, guess: /^(renewal|name|obligation|item|description)/i },
  { key: 'due_date', label: 'Due date', required: true, guess: /(due|date|expiry|expires|deadline)/i },
  { key: 'category', label: 'Category', guess: /^(category|type)/i },
  { key: 'entity', label: 'Entity / company', guess: /(entity|company|client|business)/i },
  { key: 'recurrence', label: 'Recurrence', guess: /(recur|frequency|cycle|repeat)/i },
  { key: 'anchor', label: 'Anchor (fixed / completion)', guess: /anchor/i },
  { key: 'preset', label: 'Reminder preset', guess: /(preset|ladder|schedule)/i },
  { key: 'responsible_name', label: 'Responsible name', guess: /(responsible|owner|contact).*name|^responsible$/i },
  { key: 'responsible_email', label: 'Responsible email', guess: /email/i },
  { key: 'responsible_phone', label: 'Responsible phone', guess: /(phone|mobile|cell)/i },
  { key: 'notes', label: 'Notes', guess: /(note|reference|comment)/i },
  { key: 'template', label: 'Template key', guess: /template/i },
];

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === ';' || ch === '\t') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim())) rows.push(row);
  return rows;
}

/** Accepts YYYY-MM-DD, DD/MM/YYYY (SA convention) and D Month YYYY. */
export function parseDateCell(v: string): string | null {
  const s = v.trim();
  if (E.isValidDate(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (dmy) {
    const iso = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return E.isValidDate(iso) ? iso : null;
  }
  const t = Date.parse(`${s} UTC`);
  if (!Number.isNaN(t) && /[a-z]/i.test(s)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

function matchCategory(v: string): E.CategoryKey | null {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  const hit = E.CATEGORIES.find(c => c.key === s || c.label.toLowerCase() === s || c.label.toLowerCase().startsWith(s) || s.includes(c.key));
  return hit?.key ?? null;
}

function matchRecurrence(v: string): E.Recurrence | null {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  const p = E.RECURRENCE_PRESETS.find(x => x.key === s || x.label.toLowerCase() === s);
  if (p) return p.rule;
  if (/semi|bi-?annual|6 ?month/.test(s)) return { unit: 'month', interval: 6 };
  if (/year|annual/.test(s)) return { unit: 'year', interval: 1 };
  if (/quarter/.test(s)) return { unit: 'month', interval: 3 };
  if (/month/.test(s)) return { unit: 'month', interval: 1 };
  if (/week/.test(s)) return { unit: 'week', interval: 1 };
  if (/once|one.?off|single/.test(s)) return { unit: 'once', interval: 1 };
  const n = s.match(/every\s+(\d+)\s+(day|week|month|year)/);
  if (n) return { unit: n[2] as E.RecurrenceUnit, interval: Number(n[1]) };
  return null;
}

interface Parsed { row: number; ok: boolean; errors: string[]; value?: Partial<RRRenewal> & { entityName?: string } }

export default function BulkImport({ onClose }: { onClose: () => void }) {
  const { account, entities, run, reload, plan } = useRR();
  const [rows, setRows] = useState<string[][] | null>(null);
  const [map, setMap] = useState<Partial<Record<Target, number>>>({});
  const [busy, setBusy] = useState(false);
  const [createEntities, setCreateEntities] = useState(true);

  const header = rows?.[0] ?? [];
  const body = rows?.slice(1) ?? [];

  const onFile = async (f: File) => {
    const parsed = parseCsv(await f.text());
    setRows(parsed);
    const h = parsed[0] ?? [];
    const guess: Partial<Record<Target, number>> = {};
    for (const t of TARGETS) {
      const idx = h.findIndex((c, i) => t.guess.test(c.trim()) && !Object.values(guess).includes(i));
      if (idx >= 0) guess[t.key] = idx;
    }
    setMap(guess);
  };

  const parsed: Parsed[] = useMemo(() => body.map((cells, i) => {
    const get = (t: Target) => (map[t] !== undefined ? (cells[map[t]!] ?? '').trim() : '');
    const errors: string[] = [];
    const template = E.findTemplate(get('template'));
    const name = get('name') || template?.name || '';
    if (!name) errors.push('Missing name');
    const due = parseDateCell(get('due_date'));
    if (!due) errors.push(`Invalid due date “${get('due_date')}”`);
    const category = matchCategory(get('category')) ?? template?.category ?? null;
    if (!category) errors.push(get('category') ? `Unknown category “${get('category')}”` : 'Missing category');
    const rec = matchRecurrence(get('recurrence')) ?? template?.recurrence ?? { unit: 'year', interval: 1 };
    if (get('recurrence') && !matchRecurrence(get('recurrence'))) errors.push(`Unknown recurrence “${get('recurrence')}”`);
    const anchor = /complet/i.test(get('anchor')) ? 'completion' : get('anchor') ? 'fixed' : template?.anchorMode ?? 'fixed';
    const presetRaw = get('preset').toLowerCase();
    const preset = (['gentle', 'standard', 'aggressive', 'short'].includes(presetRaw) ? presetRaw : template?.preset ?? (E.cycleLengthDays(rec) <= 120 ? 'short' : account.defaultPreset)) as E.PresetKey;
    const email = get('responsible_email');
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push(`Invalid email “${email}”`);
    const entityName = get('entity');
    const known = entityName ? entities.find(e => e.name.toLowerCase() === entityName.toLowerCase()) : undefined;
    if (entityName && !known && !createEntities) errors.push(`Unknown entity “${entityName}”`);
    return {
      row: i + 2,
      ok: errors.length === 0,
      errors,
      value: {
        accountId: account.id, name, dueDate: due ?? undefined, category: category ?? undefined, templateKey: template?.key ?? null,
        recurrenceUnit: rec.unit, recurrenceInterval: rec.interval, anchorMode: anchor as E.AnchorMode, preset,
        responsibleName: get('responsible_name') || null, responsibleEmail: email || null, responsiblePhone: get('responsible_phone') || null,
        notes: get('notes') || null, expectsAttachment: template?.expectsAttachment ?? false,
        entityId: known?.id ?? null, entityName: !known && entityName ? entityName : undefined,
      },
    };
  }), [body, map, entities, account, createEntities]);

  const good = parsed.filter(p => p.ok);
  const newEntityNames = [...new Set(good.map(p => p.value!.entityName).filter(Boolean))] as string[];
  const overEntityLimit = entities.filter(e => !e.archived).length + newEntityNames.length > plan.entities;

  const commit = async () => {
    setBusy(true);
    const ok = await run(async () => {
      const created = new Map<string, string>();
      for (const n of newEntityNames) {
        const e = await data.saveEntity({ accountId: account.id, name: n });
        created.set(n.toLowerCase(), e.id);
      }
      const payload = good.map(p => {
        const { entityName, ...v } = p.value!;
        return { ...v, entityId: v.entityId ?? (entityName ? created.get(entityName.toLowerCase()) ?? null : null) } as Partial<RRRenewal> & { accountId: string };
      });
      for (let i = 0; i < payload.length; i += 100) await data.insertRenewals(payload.slice(i, i + 100));
      return payload.length;
    }, `Imported ${good.length} renewal${good.length === 1 ? '' : 's'}`);
    setBusy(false);
    if (ok !== undefined) { await reload(); onClose(); }
  };

  const sample = () => downloadCsv('renewals-import-template.csv', [
    ['Entity', 'Renewal name', 'Category', 'Due date', 'Recurrence', 'Anchor', 'Preset', 'Responsible name', 'Responsible email', 'Notes'],
    ['Acme Trading (Pty) Ltd', 'CIPC Annual Return', 'Statutory & CIPC', '2027-03-15', 'Annual', 'fixed', 'standard', 'Thandi M', 'thandi@acme.co.za', 'Reg 2015/123456/07'],
    ['Acme Trading (Pty) Ltd', 'Domain renewal acme.co.za', 'Digital assets', '15/09/2027', 'Annual', 'fixed', 'gentle', '', '', ''],
  ]);

  return (
    <Modal title="Import renewals from CSV" onClose={onClose} wide footer={rows ? <>
      <span className="text-xs text-slate-500 mr-auto self-center">{good.length} valid · {parsed.length - good.length} with errors (skipped){newEntityNames.length ? ` · ${newEntityNames.length} new entities` : ''}</span>
      <Button onClick={() => setRows(null)}>Choose another file</Button>
      <Button kind="primary" busy={busy} disabled={!good.length || map.due_date === undefined || overEntityLimit} onClick={commit}>Import {good.length}</Button>
    </> : undefined}>
      {!rows ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Upload a spreadsheet exported as CSV. You'll map its columns and see every row validated before anything is saved. Dates may be <b>YYYY-MM-DD</b> or <b>DD/MM/YYYY</b>.</p>
          <label className="block border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center cursor-pointer hover:border-blue-500">
            <Upload className="w-6 h-6 mx-auto text-blue-600" />
            <span className="block mt-2 text-sm font-bold text-slate-800">Choose a CSV file</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          </label>
          <Button kind="ghost" onClick={sample}><Download className="w-3.5 h-3.5" /> Download a sample file</Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">1. Map columns</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {TARGETS.map(t => (
                <label key={t.key} className="text-xs">
                  <span className="text-slate-500">{t.label}{t.required && <span className="text-red-600"> *</span>}</span>
                  <Select value={map[t.key] ?? ''} onChange={e => setMap({ ...map, [t.key]: e.target.value === '' ? undefined : Number(e.target.value) })} className="!py-1.5 text-xs mt-0.5">
                    <option value="">— not in file —</option>
                    {header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </Select>
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 mt-3 cursor-pointer">
              <input type="checkbox" className="accent-[#d8b75c]" checked={createEntities} onChange={e => setCreateEntities(e.target.checked)} />
              Create entities that don't exist yet
            </label>
            {overEntityLimit && <p className="text-xs text-red-600 mt-1">This file would add {newEntityNames.length} entities, which exceeds your plan's limit of {plan.entities}.</p>}
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">2. Review ({body.length} rows)</p>
            <div className="border border-slate-200 rounded-xl max-h-[40vh] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-100"><tr className="text-left text-[10px] uppercase text-slate-400"><th className="p-2">Row</th><th className="p-2">Renewal</th><th className="p-2">Due</th><th className="p-2">Category</th><th className="p-2">Entity</th><th className="p-2">Result</th></tr></thead>
                <tbody>
                  {parsed.map(p => (
                    <tr key={p.row} className="border-t border-slate-200 align-top">
                      <td className="p-2 text-slate-400">{p.row}</td>
                      <td className="p-2 text-slate-800">{p.value?.name}</td>
                      <td className="p-2 text-slate-600 whitespace-nowrap">{p.value?.dueDate ?? '—'}</td>
                      <td className="p-2 text-slate-600">{p.value?.category ? E.categoryLabel(p.value.category) : '—'}</td>
                      <td className="p-2 text-slate-600">{p.value?.entityName ? <>{p.value.entityName} <span className="text-blue-600">(new)</span></> : (entities.find(e => e.id === p.value?.entityId)?.name ?? '—')}</td>
                      <td className="p-2">{p.ok ? <span className="text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> OK</span> : <span className="text-red-600 inline-flex items-start gap-1"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{p.errors.join('; ')}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
