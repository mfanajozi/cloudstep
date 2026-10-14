import React, { useEffect, useState } from 'react';
import { Download, FileText, CalendarRange, Building2, BarChart3, ScrollText, History } from 'lucide-react';
import * as E from './engine';
import { useRR, recurrenceOf } from './store';
import * as data from './data';
import type { RRCompletion, RRDelivery, RRChange } from './types';
import { Button, Card, Field, Input, Select, SectionTitle, Stat, Empty, downloadCsv, printDocument, escapeHtml, fmtDate, fmtDateTime } from './ui';
import { complianceScore } from './Overview';
import { ChangeList } from './RenewalDetail';

export default function Reports() {
  const { account, renewals, entities, plan, statusOf, entityName, toast } = useRR();
  const [completions, setCompletions] = useState<RRCompletion[]>([]);
  const [deliveries, setDeliveries] = useState<RRDelivery[]>([]);
  const [changes, setChanges] = useState<RRChange[]>([]);
  const today = E.todayIn(account.timezone);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(E.addMonths(today, 12));
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [entityId, setEntityId] = useState(entities[0]?.id ?? '');
  const [logTab, setLogTab] = useState<'deliveries' | 'changes'>('deliveries');

  useEffect(() => {
    Promise.all([
      data.fetchCompletions(account.id),
      data.fetchDeliveries(account.id, { limit: 1000 }),
      data.fetchChanges(account.id, undefined, 300),
    ]).then(([c, d, ch]) => { setCompletions(c); setDeliveries(d); setChanges(ch); })
      .catch(e => toast({ kind: 'error', title: 'Could not load reports', body: e.message }));
  }, [account.id, toast]);

  const score = complianceScore(completions);
  const locked = !plan.auditExport;
  const brand = E.planOf(account.plan).whiteLabel && account.brandName ? account.brandName : 'CloudStep';

  // ---- exports ----
  const exportRenewals = () => downloadCsv(`renewals-${today}.csv`, [
    ['Name', 'Entity', 'Category', 'Due date', 'Status', 'Recurrence', 'Anchor', 'Preset', 'Responsible', 'Responsible email', 'Cycle', 'Last completed', 'State'],
    ...renewals.map(r => [r.name, entityName(r.entityId) ?? '', E.categoryLabel(r.category), r.dueDate, E.STATUS_META[statusOf(r)].label,
      E.describeRecurrence(recurrenceOf(r)), r.anchorMode, r.preset, r.responsibleName ?? '', r.responsibleEmail ?? '', r.cycleNo, r.lastCompletedAt ?? '', r.state]),
  ]);

  const exportDeliveries = () => downloadCsv(`delivery-log-${today}.csv`, [
    ['Sent at', 'Renewal', 'Entity', 'Cycle', 'Channel', 'Destination', 'Audience', 'Status', 'Subject', 'Acknowledged at', 'Error'],
    ...deliveries.map(d => {
      const r = renewals.find(x => x.id === d.renewalId);
      return [d.createdAt, r?.name ?? '', r ? entityName(r.entityId) ?? '' : '', d.cycleNo ?? '', d.channelType, d.target, d.audience, d.status, d.subject ?? '', d.acknowledgedAt ?? '', d.error ?? ''];
    }),
  ]);

  const printCalendar = () => {
    const rows: { date: string; name: string; entity: string; category: string; status: string }[] = [];
    for (const r of renewals.filter(x => x.state === 'active' && !x.completedOneOff)) {
      // Project each renewal forward through the range using the engine.
      let due = r.dueDate;
      let guard = 0;
      while (due <= to && guard++ < 400) {
        if (due >= from) rows.push({ date: due, name: r.name, entity: entityName(r.entityId) ?? '', category: E.categoryLabel(r.category), status: due === r.dueDate ? E.STATUS_META[statusOf(r)].label : 'Projected' });
        const n = E.nextCycle({ recurrence: recurrenceOf(r), anchorMode: 'fixed', anchorDate: r.anchorDate ?? r.dueDate, currentDue: due, seriesDue: due === r.dueDate ? r.seriesDue : null });
        if (!n) break;
        due = n.dueDate;
      }
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    const months = new Map<string, typeof rows>();
    rows.forEach(r => months.set(r.date.slice(0, 7), [...(months.get(r.date.slice(0, 7)) ?? []), r]));
    printDocument(`Compliance calendar ${from} to ${to}`, `
      <h1>Compliance calendar</h1>
      <p class="muted">${escapeHtml(account.name)} · ${escapeHtml(E.formatLongDate(from))} – ${escapeHtml(E.formatLongDate(to))} · ${rows.length} due dates</p>
      <p class="muted">Projected dates assume the anniversary cycle continues; completion-anchored renewals move when they are marked done.</p>
      ${[...months.entries()].map(([m, list]) => `
        <h2>${escapeHtml(new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' }))}</h2>
        <table><tr><th>Due</th><th>Renewal</th><th>Entity</th><th>Category</th><th>Status</th></tr>
        ${list.map(r => `<tr><td>${escapeHtml(fmtDate(r.date))}${E.holidayName(r.date) ? `<br><span class="muted">${escapeHtml(E.holidayName(r.date)!)}</span>` : ''}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.entity)}</td><td>${escapeHtml(r.category)}</td><td>${escapeHtml(r.status)}</td></tr>`).join('')}</table>`).join('') || '<p>No renewals fall in this range.</p>'}`);
  };

  const printEntity = () => {
    const e = entities.find(x => x.id === entityId);
    if (!e) return;
    const rs = renewals.filter(r => r.entityId === e.id);
    const cs = completions.filter(c => rs.some(r => r.id === c.renewalId) && c.method !== 'skipped' && !c.reopenedAt);
    const s = complianceScore(cs);
    printDocument(`Compliance summary — ${e.name}`, `
      <h1>${escapeHtml(e.name)}</h1>
      <p class="muted">Compliance summary · prepared by ${escapeHtml(brand === 'CloudStep' ? account.name : brand)}${e.registrationNumber ? ` · Reg ${escapeHtml(e.registrationNumber)}` : ''}</p>
      <div class="kpis"><div class="kpi"><b>${rs.filter(r => r.state === 'active').length}</b>active renewals</div>
        <div class="kpi"><b>${rs.filter(r => statusOf(r) === 'overdue').length}</b>overdue</div>
        <div class="kpi"><b>${s.pct === null ? '—' : `${s.pct}%`}</b>on time, last 12 months</div></div>
      <h2>Current obligations</h2>
      <table><tr><th>Renewal</th><th>Category</th><th>Next due</th><th>Status</th><th>Last completed</th></tr>
      ${rs.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(r => `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(E.categoryLabel(r.category))}</td><td>${escapeHtml(fmtDate(r.dueDate))}</td><td class="${statusOf(r) === 'overdue' ? 'bad' : ''}">${escapeHtml(E.STATUS_META[statusOf(r)].label)}</td><td>${escapeHtml(fmtDate(r.lastCompletedAt))}</td></tr>`).join('')}</table>
      <h2>Completion history</h2>
      <table><tr><th>Renewal</th><th>Due</th><th>Completed</th><th>Timeliness</th></tr>
      ${cs.map(c => `<tr><td>${escapeHtml(renewals.find(r => r.id === c.renewalId)?.name ?? '')}</td><td>${escapeHtml(fmtDate(c.dueDate))}</td><td>${escapeHtml(fmtDateTime(c.completedAt))}</td><td class="${c.onTime ? 'ok' : 'bad'}">${c.onTime ? 'On time' : 'Late'}</td></tr>`).join('') || '<tr><td colspan="4">No completed cycles yet</td></tr>'}</table>`);
  };

  const printAnnual = () => {
    const ys = `${year}-01-01`, ye = `${year}-12-31`;
    const cs = completions.filter(c => c.dueDate >= ys && c.dueDate <= ye && c.method !== 'skipped' && !c.reopenedAt);
    const stillOverdue = renewals.filter(r => r.state === 'active' && r.dueDate >= ys && r.dueDate <= ye && r.dueDate < today);
    const onTime = cs.filter(c => c.onTime).length;
    const late = cs.length - onTime;
    const byCat = E.CATEGORIES.map(cat => {
      const rel = cs.filter(c => renewals.find(r => r.id === c.renewalId)?.category === cat.key);
      const od = stillOverdue.filter(r => r.category === cat.key).length;
      return { cat: cat.label, done: rel.length, onTime: rel.filter(c => c.onTime).length, missed: rel.filter(c => !c.onTime).length + od };
    }).filter(x => x.done || x.missed);
    printDocument(`Annual compliance report ${year}`, `
      <h1>Annual compliance report ${year}</h1>
      <p class="muted">${escapeHtml(account.name)} · cycles with a due date in ${year}</p>
      <div class="kpis"><div class="kpi"><b>${cs.length}</b>completed</div><div class="kpi"><b class="ok">${onTime}</b>on time</div>
        <div class="kpi"><b class="bad">${late}</b>completed late</div><div class="kpi"><b class="bad">${stillOverdue.length}</b>still outstanding</div></div>
      <h2>By category</h2>
      <table><tr><th>Category</th><th>Completed</th><th>On time</th><th>Missed / late</th></tr>
      ${byCat.map(x => `<tr><td>${escapeHtml(x.cat)}</td><td>${x.done}</td><td class="ok">${x.onTime}</td><td class="${x.missed ? 'bad' : ''}">${x.missed}</td></tr>`).join('') || '<tr><td colspan="4">Nothing due this year</td></tr>'}</table>
      ${stillOverdue.length ? `<h2>Still outstanding</h2><table><tr><th>Renewal</th><th>Entity</th><th>Was due</th></tr>${stillOverdue.map(r => `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(entityName(r.entityId) ?? '')}</td><td class="bad">${escapeHtml(fmtDate(r.dueDate))}</td></tr>`).join('')}</table>` : ''}`);
  };

  const failed = deliveries.filter(d => d.status === 'failed').length;
  const fallback = deliveries.filter(d => d.status === 'fallback').length;

  return (
    <div className="space-y-6">
      <SectionTitle eyebrow="Audit, proof & reporting" title="Evidence that compliance is being monitored" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Compliance score" value={score.pct === null ? '—' : `${score.pct}%`} sub="On time, last 12 months" tone={score.pct === null ? 'text-slate-400' : score.pct >= 85 ? 'text-emerald-600' : 'text-amber-600'} />
        <Stat label="Cycles completed" value={completions.filter(c => c.method !== 'skipped' && !c.reopenedAt).length} />
        <Stat label="Reminders delivered" value={deliveries.filter(d => d.status !== 'failed').length} sub="most recent 1 000" />
        <Stat label="Delivery issues" value={failed} sub={`${fallback} rescued by email fallback`} tone={failed ? 'text-red-600' : 'text-slate-900'} />
      </div>

      {locked && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Audit exports are included from the Business plan. Ask your CloudStep administrator to upgrade this account.</p>}

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="space-y-3">
          <p className="font-bold text-slate-900 flex items-center gap-2"><Download className="w-4 h-4 text-blue-600" /> CSV exports</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={locked} onClick={exportRenewals}>All renewals</Button>
            <Button disabled={locked} onClick={exportDeliveries}>Delivery log / proof of reminder</Button>
          </div>
          <p className="text-[11px] text-slate-400">Per-renewal proof of reminder is on each renewal's Delivery log tab.</p>
        </Card>
        <Card className="space-y-3">
          <p className="font-bold text-slate-900 flex items-center gap-2"><CalendarRange className="w-4 h-4 text-blue-600" /> Compliance calendar (PDF)</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="From"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
            <Field label="To"><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
          </div>
          <Button disabled={locked || !E.isValidDate(from) || !E.isValidDate(to) || from > to} onClick={printCalendar}><FileText className="w-3.5 h-3.5" /> Create calendar</Button>
        </Card>
        <Card className="space-y-3">
          <p className="font-bold text-slate-900 flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-600" /> Per-entity compliance summary</p>
          {entities.length ? (
            <div className="flex gap-2">
              <Select value={entityId} onChange={e => setEntityId(e.target.value)}>{entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
              <Button disabled={locked || !entityId} onClick={printEntity}><FileText className="w-3.5 h-3.5" /> PDF</Button>
            </div>
          ) : <p className="text-xs text-slate-400">Add entities to produce per-client summaries.</p>}
        </Card>
        <Card className="space-y-3">
          <p className="font-bold text-slate-900 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-600" /> Annual report: completed vs missed</p>
          <div className="flex gap-2">
            <Select value={year} onChange={e => setYear(Number(e.target.value))}>{[0, 1, 2, 3, 4].map(i => Number(today.slice(0, 4)) - i).map(y => <option key={y} value={y}>{y}</option>)}</Select>
            <Button disabled={locked} onClick={printAnnual}><FileText className="w-3.5 h-3.5" /> PDF</Button>
          </div>
        </Card>
      </div>

      <section>
        <div className="flex gap-1 border-b border-slate-200 mb-3">
          {([['deliveries', 'Delivery log', <ScrollText key="d" className="w-3.5 h-3.5" />], ['changes', 'Change log', <History key="c" className="w-3.5 h-3.5" />]] as const).map(([k, label, icon]) => (
            <button key={k} onClick={() => setLogTab(k)} className={`text-xs font-bold px-3 py-2 border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${logTab === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>{icon}{label}</button>
          ))}
        </div>
        {logTab === 'deliveries' ? (
          deliveries.length === 0 ? <Card><Empty title="No reminders have been sent yet" /></Card> : (
            <div className="bg-slate-150 border border-slate-200 rounded-2xl overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-[10px] uppercase tracking-wide text-slate-400"><th className="p-3">When</th><th className="p-3">Renewal</th><th className="p-3">Channel</th><th className="p-3">To</th><th className="p-3">Status</th></tr></thead>
                <tbody>
                  {deliveries.slice(0, 300).map(d => (
                    <tr key={d.id} className="border-t border-slate-200 align-top">
                      <td className="p-3 whitespace-nowrap text-slate-700">{fmtDateTime(d.createdAt)}<span className="block text-[10px] text-slate-400">{d.audience}</span></td>
                      <td className="p-3 text-slate-800">{renewals.find(r => r.id === d.renewalId)?.name ?? (d.audience === 'digest' ? 'Weekly digest' : d.audience === 'test' ? 'Test message' : '—')}</td>
                      <td className="p-3 text-slate-600">{d.channelType}</td>
                      <td className="p-3 text-slate-500 break-all">{d.target}</td>
                      <td className="p-3"><span className={d.status === 'failed' ? 'text-red-600 font-bold' : d.status === 'fallback' ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>{d.status}</span>{d.error && <span className="block text-[10px] text-slate-400">{d.error}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : <ChangeList changes={changes} />}
        <p className="text-[11px] text-slate-400 mt-2">Logs are kept for {account.retentionYears} year{account.retentionYears === 1 ? '' : 's'} (POPIA-aligned), then deleted automatically. Change it in Settings.</p>
      </section>
    </div>
  );
}
