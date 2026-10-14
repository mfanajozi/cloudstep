import React, { useEffect, useMemo, useState } from 'react';
import { Plus, CalendarDays, List, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Search, ShieldCheck } from 'lucide-react';
import * as E from './engine';
import { useRR } from './store';
import * as data from './data';
import type { RRRenewal, RRCompletion } from './types';
import { Button, Card, Input, Select, StatusBadge, Stat, Empty, Pill, fmtDate, fmtDateTime } from './ui';
import RenewalForm, { CHANNEL_META } from './RenewalForm';
import RenewalDetail from './RenewalDetail';

type View = 'upcoming' | 'calendar' | 'overdue' | 'completed';

export function complianceScore(completions: RRCompletion[]): { pct: number | null; onTime: number; total: number } {
  const since = new Date(Date.now() - 365 * 86_400_000).toISOString();
  const rel = completions.filter(c => c.completedAt >= since && !c.reopenedAt && c.method !== 'skipped');
  if (!rel.length) return { pct: null, onTime: 0, total: 0 };
  const onTime = rel.filter(c => c.onTime).length;
  return { pct: Math.round((onTime / rel.length) * 100), onTime, total: rel.length };
}

export default function Overview() {
  const store = useRR();
  const { account, renewals, entities, channels, statusOf, entityName, canWrite } = store;
  const [view, setView] = useState<View>('upcoming');
  const [entity, setEntity] = useState('');
  const [category, setCategory] = useState('');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState<{ templateKey?: string } | null>(null);
  const [open, setOpen] = useState<RRRenewal | null>(null);
  const [completions, setCompletions] = useState<RRCompletion[]>([]);

  useEffect(() => { data.fetchCompletions(account.id).then(setCompletions).catch(() => {}); }, [account.id, renewals]);

  const tz = account.timezone;
  const today = E.todayIn(tz);
  const in30 = E.addDays(today, 30);
  const live = renewals.filter(r => r.state === 'active' && !r.completedOneOff);
  const overdue = live.filter(r => r.dueDate < today);
  const next30 = live.filter(r => r.dueDate >= today && r.dueDate <= in30);
  const score = complianceScore(completions);
  const flagged = channels.filter(c => c.flagged);

  const filtered = useMemo(() => renewals.filter(r => {
    if (entity && (entity === '__none' ? r.entityId : r.entityId !== entity)) return false;
    if (category && r.category !== category) return false;
    if (channel) {
      const ids = r.channelIds ?? account.defaultChannelIds;
      if (channel === 'email') { /* every renewal uses email */ } else if (!channels.some(c => c.type === channel && ids.includes(c.id))) return false;
    }
    if (status && statusOf(r) !== status) return false;
    if (query && !`${r.name} ${entityName(r.entityId) ?? ''} ${r.notes ?? ''}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [renewals, entity, category, channel, status, query, account.defaultChannelIds, channels, statusOf, entityName]);

  const byMonth = useMemo(() => {
    const groups = new Map<string, RRRenewal[]>();
    const list = (view === 'overdue' ? filtered.filter(r => statusOf(r) === 'overdue') : filtered.filter(r => r.state !== 'archived' || status === 'archived'))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    for (const r of list) {
      const k = r.dueDate.slice(0, 7);
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    return [...groups.entries()];
  }, [filtered, view, statusOf, status]);

  return (
    <div className="space-y-5">
      {/* Health */}
      <Card className="!p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center border ${overdue.length ? 'bg-red-50 border-red-200 text-red-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
              {overdue.length ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </span>
            <div>
              <p className="font-bold text-slate-900">
                {overdue.length > 0 && <>{overdue.length} renewal{overdue.length === 1 ? ' is' : 's are'} overdue. </>}
                You have {next30.length} renewal{next30.length === 1 ? '' : 's'} due in the next 30 days.
              </p>
              <p className="text-xs text-slate-500">
                {flagged.length > 0 ? <span className="text-red-600 font-semibold">{flagged.length} channel{flagged.length === 1 ? '' : 's'} failing — reminders fell back to email. </span> : null}
                Reminders fire at {String(account.sendHour).padStart(2, '0')}:00 {tz === E.DEFAULT_TIMEZONE ? 'SAST' : tz}.
              </p>
            </div>
          </div>
          {canWrite(null) || entities.some(e => canWrite(e.id)) ? (
            <div className="flex gap-2">
              <Button kind="primary" onClick={() => setAdding({})}><Plus className="w-4 h-4" /> Add renewal</Button>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Active renewals" value={live.length} sub={`${renewals.filter(r => r.state === 'paused').length} paused · ${renewals.filter(r => r.state === 'archived').length} archived`} />
        <Stat label="Due in 30 days" value={next30.length} tone="text-blue-600" />
        <Stat label="Overdue" value={overdue.length} tone={overdue.length ? 'text-red-600' : 'text-slate-900'} />
        <Stat label="Compliance score" value={score.pct === null ? '—' : `${score.pct}%`} sub={score.total ? `${score.onTime} of ${score.total} on time, last 12 months` : 'Builds as cycles complete'} tone={score.pct === null ? 'text-slate-400' : score.pct >= 85 ? 'text-emerald-600' : score.pct >= 60 ? 'text-amber-600' : 'text-red-600'} />
      </div>

      {/* Views + filters */}
      <div className="flex flex-col xl:flex-row gap-3 xl:items-center justify-between">
        <div className="flex bg-slate-150 border border-slate-200 rounded-xl p-1 gap-1 overflow-x-auto no-scrollbar">
          {([
            ['upcoming', 'Upcoming', <List key="l" className="w-3.5 h-3.5" />],
            ['calendar', 'Calendar', <CalendarDays key="c" className="w-3.5 h-3.5" />],
            ['overdue', `Overdue (${overdue.length})`, <AlertTriangle key="o" className="w-3.5 h-3.5" />],
            ['completed', 'Completed', <CheckCircle2 key="d" className="w-3.5 h-3.5" />],
          ] as [View, string, React.ReactNode][]).map(([k, label, icon]) => (
            <button key={k} onClick={() => setView(k)} className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${view === k ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}>{icon}{label}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <div className="relative col-span-2 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search" className="!pl-8 !py-1.5 text-xs" />
          </div>
          {entities.length > 0 && (
            <Select value={entity} onChange={e => setEntity(e.target.value)} className="!py-1.5 text-xs sm:w-40">
              <option value="">All entities</option>
              <option value="__none">No entity</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          )}
          <Select value={category} onChange={e => setCategory(e.target.value)} className="!py-1.5 text-xs sm:w-40">
            <option value="">All categories</option>
            {E.CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </Select>
          <Select value={channel} onChange={e => setChannel(e.target.value)} className="!py-1.5 text-xs sm:w-36">
            <option value="">All channels</option>
            {(['email', ...new Set(channels.map(c => c.type))] as (keyof typeof CHANNEL_META)[]).filter((v, i, a) => a.indexOf(v) === i).map(t => <option key={t} value={t}>{CHANNEL_META[t].label}</option>)}
          </Select>
          {view === 'upcoming' && (
            <Select value={status} onChange={e => setStatus(e.target.value)} className="!py-1.5 text-xs sm:w-40">
              <option value="">Any status</option>
              {Object.entries(E.STATUS_META).filter(([k]) => k !== 'completed').map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </Select>
          )}
        </div>
      </div>

      {renewals.length === 0 ? (
        <Card><QuickStart onPick={key => setAdding({ templateKey: key })} /></Card>
      ) : view === 'calendar' ? (
        <CalendarView renewals={filtered.filter(r => r.state !== 'archived')} onOpen={setOpen} />
      ) : view === 'completed' ? (
        <CompletedView completions={completions} onOpen={id => { const r = renewals.find(x => x.id === id); if (r) setOpen(r); }} />
      ) : byMonth.length === 0 ? (
        <Card><Empty icon={<CheckCircle2 className="w-5 h-5" />} title={view === 'overdue' ? 'Nothing overdue' : 'No renewals match these filters'} /></Card>
      ) : (
        <div className="space-y-5">
          {byMonth.map(([month, list]) => (
            <section key={month}>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                {new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </h3>
              <div className="bg-slate-150 border border-slate-200 rounded-2xl divide-y divide-slate-200 overflow-hidden">
                {list.map(r => <RenewalRow key={r.id} r={r} onOpen={() => setOpen(r)} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {adding && <RenewalForm initialTemplateKey={adding.templateKey} initialEntityId={entity && entity !== '__none' ? entity : null} onClose={() => setAdding(null)} />}
      {open && <RenewalDetail renewal={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

export function RenewalRow({ r, onOpen, showEntity = true }: { r: RRRenewal; onOpen: () => void; showEntity?: boolean }) {
  const { statusOf, entityName, account } = useRR();
  return (
    <button onClick={onOpen} className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 cursor-pointer">
      <div className="sm:w-28 shrink-0">
        <p className="text-sm font-bold text-slate-900">{fmtDate(r.dueDate)}</p>
        <p className="text-[11px] text-slate-400">{E.daysLeftLabel(r.dueDate, account.timezone)}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{r.name}</p>
        <p className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: E.categoryColor(r.category) }} />
          {E.categoryLabel(r.category)}{showEntity && entityName(r.entityId) ? ` · ${entityName(r.entityId)}` : ''}{r.responsibleName ? ` · ${r.responsibleName}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {r.recurrenceUnit !== 'once' && <Pill>{E.describeRecurrence({ unit: r.recurrenceUnit, interval: r.recurrenceInterval })}</Pill>}
        <StatusBadge status={statusOf(r)} />
      </div>
    </button>
  );
}

function QuickStart({ onPick }: { onPick: (key: string) => void }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Add your first renewal</p>
      <h3 className="text-lg font-bold text-slate-900 mt-1">Pick an obligation — you confirm the date</h3>
      <p className="text-sm text-slate-500 mt-1">Templates set the category, cycle and reminder ladder. CloudStep never guesses a legal deadline, so every template asks for your actual date.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
        {E.TEMPLATE_LIBRARY.slice(0, 12).map(t => (
          <button key={t.key} onClick={() => onPick(t.key)} className="text-left bg-slate-50 border border-slate-200 rounded-xl p-3 hover:border-blue-500 transition-colors cursor-pointer">
            <p className="text-sm font-bold text-slate-900">{t.name}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{E.categoryLabel(t.category)} · {E.describeRecurrence(t.recurrence)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function CompletedView({ completions, onOpen }: { completions: RRCompletion[]; onOpen: (renewalId: string) => void }) {
  const { renewals, entityName } = useRR();
  const rows = completions.filter(c => c.method !== 'skipped').slice(0, 300);
  if (!rows.length) return <Card><Empty icon={<CheckCircle2 className="w-5 h-5" />} title="No completed cycles yet">When someone taps Mark as done, the cycle lands here with its proof.</Empty></Card>;
  return (
    <div className="bg-slate-150 border border-slate-200 rounded-2xl divide-y divide-slate-200 overflow-hidden">
      {rows.map(c => {
        const r = renewals.find(x => x.id === c.renewalId);
        return (
          <button key={c.id} onClick={() => onOpen(c.renewalId)} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center gap-2 cursor-pointer">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{r?.name ?? 'Deleted renewal'}{r && entityName(r.entityId) ? <span className="text-slate-500 font-normal"> · {entityName(r.entityId)}</span> : null}</p>
              <p className="text-[11px] text-slate-500">Due {fmtDate(c.dueDate)} · done {fmtDateTime(c.completedAt)} via {c.method}{c.note ? ` · “${c.note}”` : ''}</p>
            </div>
            <div className="flex gap-1.5">
              {c.reopenedAt && <Pill>Reopened</Pill>}
              <Pill className={c.onTime ? 'text-emerald-700 border-emerald-200' : 'text-red-700 border-red-200'}>{c.onTime ? 'On time' : 'Late'}</Pill>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CalendarView({ renewals, onOpen }: { renewals: RRRenewal[]; onOpen: (r: RRRenewal) => void }) {
  const { account, statusOf } = useRR();
  const today = E.todayIn(account.timezone);
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const [cursor, setCursor] = useState(today.slice(0, 7)); // YYYY-MM
  const [y, m] = cursor.split('-').map(Number);

  const byDay = useMemo(() => {
    const map = new Map<string, RRRenewal[]>();
    for (const r of renewals) map.set(r.dueDate, [...(map.get(r.dueDate) ?? []), r]);
    return map;
  }, [renewals]);

  const shift = (n: number) => {
    const d = mode === 'month' ? E.addMonths(`${cursor}-01`, n) : E.addMonths(`${cursor}-01`, n * 12);
    setCursor(d.slice(0, 7));
  };

  const monthGrid = (year: number, month: number, small = false) => {
    const first = `${year}-${String(month).padStart(2, '0')}-01`;
    const lead = (E.weekday(first) + 6) % 7; // Monday-first
    const days = E.daysInMonth(year, month - 1);
    const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => E.addDays(first, i))];
    while (cells.length % 7) cells.push(null);
    return (
      <div className={small ? '' : 'bg-slate-150 border border-slate-200 rounded-2xl overflow-hidden'}>
        <div className="grid grid-cols-7 text-[10px] font-bold uppercase text-slate-400 text-center">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="py-1.5">{small ? d[0] : d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const items = d ? byDay.get(d) ?? [] : [];
            const holiday = d ? E.holidayName(d) : null;
            if (small) {
              return (
                <div key={i} className={`aspect-square flex items-center justify-center text-[10px] ${d === today ? 'font-black text-blue-600' : 'text-slate-500'}`} title={items.map(r => r.name).join(', ') || holiday || ''}>
                  {d && (items.length
                    ? <span className="w-5 h-5 rounded-full flex items-center justify-center text-ink-950 font-bold" style={{ background: E.STATUS_META[statusOf(items[0])].dot }}>{Number(d.slice(8))}</span>
                    : Number(d.slice(8)))}
                </div>
              );
            }
            return (
              <div key={i} className={`min-h-[84px] border-t border-l border-slate-200 p-1.5 ${!d ? 'bg-slate-100/40' : ''} ${i % 7 === 0 ? 'border-l-0' : ''}`}>
                {d && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold ${d === today ? 'bg-blue-600 text-ink-950 rounded-full w-5 h-5 flex items-center justify-center' : 'text-slate-500'}`}>{Number(d.slice(8))}</span>
                      {holiday && <span className="text-[9px] text-amber-700 truncate ml-1" title={holiday}>{holiday}</span>}
                    </div>
                    <div className="space-y-0.5 mt-1">
                      {items.slice(0, 3).map(r => (
                        <button key={r.id} onClick={() => onOpen(r)} className="w-full text-left text-[10px] font-semibold truncate rounded px-1 py-0.5 border cursor-pointer"
                          style={{ borderColor: E.STATUS_META[statusOf(r)].dot, color: E.STATUS_META[statusOf(r)].dot }} title={r.name}>{r.name}</button>
                      ))}
                      {items.length > 3 && <p className="text-[10px] text-slate-400">+{items.length - 3} more</p>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button kind="ghost" onClick={() => shift(-1)} aria-label="Previous"><ChevronLeft className="w-4 h-4" /></Button>
          <p className="font-bold text-slate-900 min-w-40 text-center">{mode === 'month' ? new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : y}</p>
          <Button kind="ghost" onClick={() => shift(1)} aria-label="Next"><ChevronRight className="w-4 h-4" /></Button>
          <Button kind="ghost" onClick={() => setCursor(today.slice(0, 7))}>Today</Button>
        </div>
        <div className="flex bg-slate-150 border border-slate-200 rounded-lg p-0.5">
          {(['month', 'year'] as const).map(k => <button key={k} onClick={() => setMode(k)} className={`text-xs font-bold px-3 py-1 rounded-md capitalize cursor-pointer ${mode === k ? 'bg-blue-50 text-blue-600' : 'text-slate-500'}`}>{k}</button>)}
        </div>
      </div>
      {mode === 'month' ? <div className="overflow-x-auto"><div className="min-w-[640px]">{monthGrid(y, m)}</div></div> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 12 }, (_, i) => (
            <Card key={i} className="!p-3">
              <button onClick={() => { setCursor(`${y}-${String(i + 1).padStart(2, '0')}`); setMode('month'); }} className="text-xs font-bold text-slate-800 mb-1 hover:text-blue-600 cursor-pointer">
                {new Date(Date.UTC(y, i, 1)).toLocaleDateString('en-ZA', { month: 'long', timeZone: 'UTC' })}
              </button>
              {monthGrid(y, i + 1, true)}
            </Card>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
        {(['upcoming', 'in_window', 'awaiting', 'snoozed', 'overdue', 'paused'] as E.RenewalStatus[]).map(s => (
          <span key={s} className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: E.STATUS_META[s].dot }} />{E.STATUS_META[s].label}</span>
        ))}
      </div>
    </div>
  );
}
