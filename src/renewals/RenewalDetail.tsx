import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2, Clock, Pause, Play, Archive, Trash2, Pencil, RotateCcw, Link2, Paperclip, Download, FileText, Upload,
} from 'lucide-react';
import * as E from './engine';
import { useRR, recurrenceOf } from './store';
import * as data from './data';
import type { RRRenewal, RRJob, RRDelivery, RRCompletion, RRAttachment, RRChange } from './types';
import { Button, Modal, StatusBadge, Pill, Textarea, Field, Empty, fmtDateTime, fmtDate, downloadCsv, printDocument, escapeHtml, copyText } from './ui';
import RenewalForm from './RenewalForm';

type Tab = 'schedule' | 'history' | 'deliveries' | 'changes';

export default function RenewalDetail({ renewal, onClose }: { renewal: RRRenewal; onClose: () => void }) {
  const store = useRR();
  const { account, canWrite, canAdmin, plan, run, reloadRenewals, statusOf, entityName, toast } = store;
  const r = store.renewals.find(x => x.id === renewal.id) ?? renewal;
  const writable = canWrite(r.entityId);
  const status = statusOf(r);
  const [tab, setTab] = useState<Tab>('schedule');
  const [jobs, setJobs] = useState<RRJob[]>([]);
  const [deliveries, setDeliveries] = useState<RRDelivery[]>([]);
  const [completions, setCompletions] = useState<RRCompletion[]>([]);
  const [attachments, setAttachments] = useState<RRAttachment[]>([]);
  const [changes, setChanges] = useState<RRChange[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    const [j, dl, c, a, ch] = await Promise.all([
      data.fetchJobs(account.id, r.id),
      data.fetchDeliveries(account.id, { renewalId: r.id }),
      data.fetchCompletions(account.id, r.id),
      data.fetchAttachments(account.id, r.id),
      data.fetchChanges(account.id, r.id),
    ]);
    setJobs(j); setDeliveries(dl); setCompletions(c); setAttachments(a); setChanges(ch);
  }, [account.id, r.id]);

  useEffect(() => { load().catch(e => toast({ kind: 'error', title: 'Could not load history', body: e.message })); }, [load, r.cycleNo, r.updatedAt, toast]);

  const act = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    const ok = await run(fn, success);
    setBusy(null);
    if (ok !== undefined) { await reloadRenewals(); await load(); }
  };

  const lastCompletion = completions.find(c => !c.reopenedAt && c.method !== 'skipped');
  const canReopen = writable && lastCompletion && (r.completedOneOff ? lastCompletion.cycleNo === r.cycleNo : lastCompletion.cycleNo === r.cycleNo - 1);
  const pending = jobs.filter(j => j.status === 'scheduled' && j.cycleNo === r.cycleNo);
  const today = E.todayIn(account.timezone);
  const canSnooze = writable && r.state === 'active' && r.snoozeCount < E.MAX_SNOOZES && r.dueDate >= today;
  const fnReady = data.functionConfigured();

  const proofRows = (): (string | null)[][] => [
    ['Sent at', 'Cycle', 'Channel', 'Destination', 'Audience', 'Status', 'Subject', 'Acknowledged at', 'Error'],
    ...deliveries.map(d => [d.createdAt, String(d.cycleNo ?? ''), d.channelType, d.target, d.audience, d.status, d.subject, d.acknowledgedAt, d.error]),
  ];

  const printProof = () => {
    const comp = (c: RRCompletion) => `<tr><td>${c.cycleNo}</td><td>${escapeHtml(fmtDate(c.dueDate))}</td><td>${escapeHtml(fmtDateTime(c.completedAt))}</td><td>${escapeHtml(c.method)}</td><td class="${c.onTime ? 'ok' : 'bad'}">${c.onTime ? 'On time' : 'Late'}</td><td>${c.reopenedAt ? 'Reopened' : ''}</td></tr>`;
    const del = (d: RRDelivery) => `<tr><td>${escapeHtml(fmtDateTime(d.createdAt))}</td><td>${d.cycleNo ?? ''}</td><td>${escapeHtml(d.channelType)}</td><td>${escapeHtml(d.target)}</td><td>${escapeHtml(d.audience)}</td><td class="${d.status === 'failed' ? 'bad' : 'ok'}">${escapeHtml(d.status)}</td><td>${escapeHtml(d.acknowledgedAt ? fmtDateTime(d.acknowledgedAt) : '')}</td></tr>`;
    printDocument(`Proof of reminder — ${r.name}`, `
      <h1>Proof of reminder</h1>
      <p><b>${escapeHtml(r.name)}</b>${entityName(r.entityId) ? ` · ${escapeHtml(entityName(r.entityId)!)}` : ''} · ${escapeHtml(E.categoryLabel(r.category))}</p>
      <p class="muted">Account: ${escapeHtml(account.name)} · Current due date ${escapeHtml(fmtDate(r.dueDate))} · ${escapeHtml(E.describeRecurrence(recurrenceOf(r)))}</p>
      <h2>Completed cycles</h2>
      <table><tr><th>Cycle</th><th>Due</th><th>Completed</th><th>How</th><th>Timeliness</th><th></th></tr>${completions.map(comp).join('') || '<tr><td colspan="6">None yet</td></tr>'}</table>
      <h2>Reminder deliveries</h2>
      <table><tr><th>Sent</th><th>Cycle</th><th>Channel</th><th>Destination</th><th>Audience</th><th>Status</th><th>Acknowledged</th></tr>${deliveries.map(del).join('') || '<tr><td colspan="7">No reminders sent yet</td></tr>'}</table>`);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'schedule', label: `Schedule (${pending.length})` },
    { key: 'history', label: `History (${completions.length})` },
    { key: 'deliveries', label: `Delivery log (${deliveries.length})` },
    { key: 'changes', label: 'Changes' },
  ];

  return (
    <>
      <Modal title={r.name} onClose={onClose} wide>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-72 shrink-0 space-y-4">
            <div className="space-y-2">
              <StatusBadge status={status} />
              <p className="text-2xl font-black text-slate-950">{E.formatLongDate(r.dueDate)}</p>
              <p className="text-sm text-slate-500">{E.daysLeftLabel(r.dueDate, account.timezone)}</p>
            </div>
            <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
              {entityName(r.entityId) && <><dt className="text-slate-400">Entity</dt><dd className="text-slate-800 font-semibold">{entityName(r.entityId)}</dd></>}
              <dt className="text-slate-400">Category</dt><dd className="text-slate-800">{E.categoryLabel(r.category)}</dd>
              <dt className="text-slate-400">Repeats</dt><dd className="text-slate-800">{E.describeRecurrence(recurrenceOf(r))}</dd>
              {r.recurrenceUnit !== 'once' && <><dt className="text-slate-400">Anchored to</dt><dd className="text-slate-800">{r.anchorMode === 'fixed' ? `anniversary (${fmtDate(r.anchorDate)})` : 'completion date'}</dd></>}
              <dt className="text-slate-400">Schedule</dt><dd className="text-slate-800">{r.preset === 'custom' ? `Custom: ${(r.customOffsets ?? []).join(', ')} days` : E.PRESETS[r.preset].label}</dd>
              <dt className="text-slate-400">Cycle</dt><dd className="text-slate-800">#{r.cycleNo}</dd>
              {(r.responsibleName || r.responsibleEmail) && <><dt className="text-slate-400">Responsible</dt><dd className="text-slate-800">{r.responsibleName || r.responsibleEmail}</dd></>}
              {r.watchers.length > 0 && <><dt className="text-slate-400">Watchers</dt><dd className="text-slate-800">{r.watchers.map(w => w.name || w.email).join(', ')}</dd></>}
              {r.snoozedUntil && new Date(r.snoozedUntil) > new Date() && <><dt className="text-slate-400">Snoozed until</dt><dd className="text-slate-800">{fmtDateTime(r.snoozedUntil)}</dd></>}
              <dt className="text-slate-400">Snoozes left</dt><dd className="text-slate-800">{E.MAX_SNOOZES - r.snoozeCount} this cycle</dd>
            </dl>
            {r.notes && <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap">{r.notes}</p>}

            {writable && (
              <div className="space-y-2">
                {r.state === 'active' && !r.completedOneOff && (
                  <Button kind="primary" className="w-full" onClick={() => setCompleting(true)} disabled={!fnReady}><CheckCircle2 className="w-4 h-4" /> Mark as done</Button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {canSnooze && <Button busy={busy === 'snooze'} disabled={!fnReady} onClick={() => act('snooze', () => data.api.snooze(r.id), 'Snoozed for 3 days')}><Clock className="w-3.5 h-3.5" /> Snooze</Button>}
                  {canReopen && <Button busy={busy === 'reopen'} disabled={!fnReady} onClick={() => act('reopen', () => data.api.reopen(r.id), 'Reopened — reminders restored')}><RotateCcw className="w-3.5 h-3.5" /> Reopen</Button>}
                  <Button onClick={() => setEditing(true)} disabled={r.completedOneOff}><Pencil className="w-3.5 h-3.5" /> Edit</Button>
                  {r.state === 'active' && <Button busy={busy === 'pause'} onClick={() => act('pause', () => data.saveRenewal({ id: r.id, accountId: account.id, state: 'paused' }), 'Paused — no reminders until resumed')}><Pause className="w-3.5 h-3.5" /> Pause</Button>}
                  {r.state === 'paused' && <Button busy={busy === 'resume'} onClick={() => act('resume', () => data.saveRenewal({ id: r.id, accountId: account.id, state: 'active' }), 'Resumed')}><Play className="w-3.5 h-3.5" /> Resume</Button>}
                  {r.state !== 'archived' && <Button busy={busy === 'archive'} onClick={() => act('archive', () => data.saveRenewal({ id: r.id, accountId: account.id, state: 'archived' }), 'Archived — history kept, reminders stopped')}><Archive className="w-3.5 h-3.5" /> Archive</Button>}
                  {r.state === 'archived' && !r.completedOneOff && <Button busy={busy === 'unarchive'} onClick={() => act('unarchive', () => data.saveRenewal({ id: r.id, accountId: account.id, state: 'active' }), 'Restored')}><Play className="w-3.5 h-3.5" /> Restore</Button>}
                  <Button kind="danger" busy={busy === 'delete'} onClick={() => {
                    if (!confirm(`Delete "${r.name}" and its entire history? This cannot be undone. Archive instead to keep the history.`)) return;
                    act('delete', () => data.deleteRow('rr_renewals', r.id), 'Renewal deleted').then(onClose);
                  }}><Trash2 className="w-3.5 h-3.5" /> Delete</Button>
                </div>
                {fnReady && r.state === 'active' && (
                  <Button kind="ghost" className="w-full" onClick={async () => { if (await copyText(data.ackLink(r.ackToken))) toast({ kind: 'success', title: 'Mark-as-done link copied' }); }}>
                    <Link2 className="w-3.5 h-3.5" /> Copy Mark-as-done link
                  </Button>
                )}
                {!fnReady && <p className="text-[11px] text-amber-700">Mark as done, snooze and reopen need the Renewal Reminder service URL (VITE_RENEWALS_API_URL).</p>}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-slate-200 mb-4">
              {tabs.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`text-xs font-bold px-3 py-2 whitespace-nowrap border-b-2 -mb-px cursor-pointer ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{t.label}</button>
              ))}
            </div>

            {tab === 'schedule' && (
              pending.length ? (
                <ol className="space-y-2">
                  {pending.map(j => (
                    <li key={j.id} className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{fmtDateTime(j.fireAt)}</p>
                        <p className="text-[11px] text-slate-500">
                          {j.kind === 'watcher' ? 'Watcher alert (only if not done)' : j.kind === 'overdue' ? 'Overdue alert' : j.kind === 'escalation' ? 'Escalation to next channel' : j.kind === 'deferred' ? 'Deferred (snooze / quiet hours)' : j.kind === 'immediate' ? 'Immediate (date moved into window)' : E.TONE_LABEL[j.tone as E.Tone] ?? j.tone}
                          {j.offsetDays !== null && j.offsetDays >= 0 && ` · ${j.offsetDays} day${j.offsetDays === 1 ? '' : 's'} before`}
                        </p>
                      </div>
                      <Pill>{j.kind}</Pill>
                    </li>
                  ))}
                </ol>
              ) : (
                <Empty icon={<Clock className="w-5 h-5" />} title={r.state !== 'active' ? `No reminders while ${r.state}` : 'Nothing scheduled right now'}>
                  {r.state === 'active' && 'New schedules appear within 5 minutes of a change. If the due date has passed and overdue alerts are off, nothing more will be sent this cycle.'}
                </Empty>
              )
            )}

            {tab === 'history' && (
              <div className="space-y-4">
                {completions.length === 0 && <Empty icon={<CheckCircle2 className="w-5 h-5" />} title="No completed cycles yet" />}
                {completions.map(c => (
                  <div key={c.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-900">Cycle #{c.cycleNo} · due {fmtDate(c.dueDate)}</p>
                      <div className="flex gap-1.5">
                        {c.method === 'skipped' ? <Pill>Skipped while paused</Pill> : <Pill className={c.onTime ? 'text-emerald-700 border-emerald-200' : 'text-red-700 border-red-200'}>{c.onTime ? 'On time' : 'Late'}</Pill>}
                        {c.reopenedAt && <Pill>Reopened {fmtDate(c.reopenedAt)}</Pill>}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{c.method === 'skipped' ? 'Skipped' : `Done ${fmtDateTime(c.completedAt)} via ${c.method}`}{c.nextDueDate ? ` · next due ${fmtDate(c.nextDueDate)}` : ''}</p>
                    {c.note && <p className="text-xs text-slate-700 mt-1">“{c.note}”</p>}
                    {attachments.filter(a => a.completionId === c.id).map(a => <AttachmentRow key={a.id} a={a} />)}
                  </div>
                ))}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" /> Documents</p>
                    {writable && fnReady && (
                      <label className="text-xs font-bold text-blue-600 cursor-pointer inline-flex items-center gap-1">
                        <Upload className="w-3.5 h-3.5" /> Upload
                        <input type="file" className="hidden" onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) act('upload', () => data.api.upload(r.id, f), 'Document uploaded');
                          e.target.value = '';
                        }} />
                      </label>
                    )}
                  </div>
                  {attachments.filter(a => !a.completionId).map(a => <AttachmentRow key={a.id} a={a} onDelete={canAdmin ? () => act('del-att', () => data.deleteRow('rr_attachments', a.id), 'Document removed') : undefined} />)}
                  {attachments.length === 0 && <p className="text-xs text-slate-400">No documents yet.</p>}
                </div>
              </div>
            )}

            {tab === 'deliveries' && (
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Button onClick={() => downloadCsv(`proof-of-reminder-${r.name.replace(/\W+/g, '-')}.csv`, proofRows())} disabled={!plan.proofOfReminder}><Download className="w-3.5 h-3.5" /> CSV</Button>
                  <Button onClick={printProof} disabled={!plan.proofOfReminder}><FileText className="w-3.5 h-3.5" /> Proof of reminder (PDF)</Button>
                  {!plan.proofOfReminder && <span className="text-[11px] text-slate-400 self-center">Exports are on the Business plan and above.</span>}
                </div>
                {deliveries.length === 0 ? <Empty title="No reminders sent yet" /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="text-left text-[10px] uppercase tracking-wide text-slate-400"><th className="py-2 pr-3">When</th><th className="pr-3">Channel</th><th className="pr-3">To</th><th className="pr-3">Status</th><th>Ack</th></tr></thead>
                      <tbody>
                        {deliveries.map(d => (
                          <tr key={d.id} className="border-t border-slate-200 align-top">
                            <td className="py-2 pr-3 whitespace-nowrap text-slate-700">{fmtDateTime(d.createdAt)}<span className="block text-[10px] text-slate-400">cycle {d.cycleNo ?? '—'} · {d.audience}</span></td>
                            <td className="pr-3 text-slate-700">{d.channelType}</td>
                            <td className="pr-3 text-slate-500 break-all">{d.target}</td>
                            <td className="pr-3"><span className={d.status === 'failed' ? 'text-red-600 font-bold' : d.status === 'fallback' ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>{d.status}</span>{d.error && <span className="block text-[10px] text-slate-400 max-w-[220px]">{d.error}</span>}</td>
                            <td className="text-slate-500 whitespace-nowrap">{d.acknowledgedAt ? fmtDate(d.acknowledgedAt) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 'changes' && <ChangeList changes={changes} />}
          </div>
        </div>
      </Modal>

      {editing && <RenewalForm renewal={r} onClose={() => setEditing(false)} onSaved={() => load()} />}
      {completing && <CompleteDialog renewal={r} onClose={() => setCompleting(false)} onDone={async () => { await reloadRenewals(); await load(); }} />}
    </>
  );
}

function AttachmentRow({ a, onDelete }: { a: RRAttachment; onDelete?: () => void }) {
  const { toast } = useRR();
  return (
    <div className="flex items-center justify-between gap-2 mt-2 text-xs">
      <button className="text-blue-600 font-semibold hover:underline truncate cursor-pointer inline-flex items-center gap-1"
        onClick={() => data.api.download(a.id, a.fileName).catch(e => toast({ kind: 'error', title: 'Download failed', body: e.message }))}>
        <Paperclip className="w-3 h-3" /> {a.fileName}
      </button>
      <span className="text-slate-400 whitespace-nowrap">{(a.sizeBytes / 1024).toFixed(0)} KB · {fmtDate(a.createdAt)}</span>
      {onDelete && <button onClick={() => confirm('Remove this document?') && onDelete()} className="text-slate-400 hover:text-red-600 cursor-pointer" aria-label="Remove"><Trash2 className="w-3 h-3" /></button>}
    </div>
  );
}

export function ChangeList({ changes }: { changes: RRChange[] }) {
  const { members, account } = useRR();
  const who = (actor: string) => {
    if (actor === account.ownerUserId) return 'Owner';
    const m = members.find(x => x.userId === actor);
    if (m) return m.name || m.email;
    if (actor.startsWith('api:')) return `API key ${actor.slice(4)}…`;
    if (actor === 'link') return 'Mark-as-done link';
    if (actor.startsWith('portal')) return 'Client portal';
    if (actor === 'scheduler' || actor === 'system') return 'CloudStep';
    return 'Administrator';
  };
  const show = (v: unknown) => v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (!changes.length) return <Empty title="No changes recorded yet" />;
  return (
    <ul className="space-y-2">
      {changes.map(c => (
        <li key={c.id} className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="text-slate-500"><b className="text-slate-800">{who(c.actor)}</b> {c.action === 'insert' ? 'created' : c.action === 'delete' ? 'deleted' : 'changed'} {c.objectType.replace(/s$/, '')} · {fmtDateTime(c.createdAt)}</p>
          {c.action === 'update' && (
            <ul className="mt-1 space-y-0.5">
              {Object.entries(c.changes).map(([k, v]: [string, any]) => (
                <li key={k} className="text-slate-600"><span className="font-mono text-[10px] text-slate-400">{k}</span> {show(v?.from)} → <b className="text-slate-800">{show(v?.to)}</b></li>
              ))}
            </ul>
          )}
          {c.action !== 'update' && c.changes?.name && <p className="text-slate-700 mt-0.5">{show(c.changes.name)}</p>}
        </li>
      ))}
    </ul>
  );
}

function CompleteDialog({ renewal, onClose, onDone }: { renewal: RRRenewal; onClose: () => void; onDone: () => Promise<void> }) {
  const { run, account } = useRR();
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const next = E.nextCycle({
    recurrence: recurrenceOf(renewal), anchorMode: renewal.anchorMode, anchorDate: renewal.anchorDate ?? renewal.dueDate,
    currentDue: renewal.dueDate, seriesDue: renewal.seriesDue, completedOn: E.todayIn(account.timezone),
  });
  const submit = async () => {
    setBusy(true);
    const res = await run(() => data.api.complete(renewal.id, note.trim() || undefined, file), 'Marked as done');
    setBusy(false);
    if (res) { await onDone(); onClose(); }
  };
  return (
    <Modal title={`Mark "${renewal.name}" as done`} onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button kind="primary" busy={busy} onClick={submit}><CheckCircle2 className="w-4 h-4" /> Mark as done</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          All remaining reminders for this cycle are cancelled.{' '}
          {next ? <>The next cycle is scheduled for <b className="text-slate-900">{E.formatLongDate(next.dueDate)}</b>{renewal.anchorMode === 'completion' ? ' (one period after today)' : ''}.</> : 'This is a one-off renewal, so it will be archived.'}
        </p>
        {renewal.expectsAttachment && (
          <Field label="New certificate / document" hint="PDF, image, Word, Excel or text, up to 10 MB.">
            <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-xs text-slate-600" accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx,.xls,.xlsx,.txt" />
          </Field>
        )}
        <Field label="Note (optional)"><Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={1000} placeholder="e.g. filed, reference ABC123" /></Field>
      </div>
    </Modal>
  );
}
