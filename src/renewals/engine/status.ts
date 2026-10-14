import { ISODate, diffDays, todayIn, DEFAULT_TIMEZONE } from './dates';
import { ladderOffsets, PresetKey, Recurrence, effectiveDueDate } from './schedule';

// =====================================================
// Display status of a renewal (brief §4.5).
// Stored state is small (active/paused/archived + snooze); everything
// the user sees is derived here so the list, the calendar and the
// scheduler agree.
// =====================================================

export type RenewalStatus =
  | 'upcoming' | 'in_window' | 'awaiting' | 'snoozed'
  | 'completed' | 'overdue' | 'paused' | 'archived';

export const STATUS_META: Record<RenewalStatus, { label: string; tone: string; dot: string }> = {
  upcoming: { label: 'Upcoming', tone: 'bg-slate-100 text-slate-700 border-slate-200', dot: '#7c8391' },
  in_window: { label: 'In reminder window', tone: 'bg-blue-50 text-blue-700 border-blue-200', dot: '#d8b75c' },
  awaiting: { label: 'Awaiting action', tone: 'bg-amber-50 text-amber-800 border-amber-200', dot: '#f0b53c' },
  snoozed: { label: 'Snoozed', tone: 'bg-cyan-50 text-cyan-700 border-cyan-200', dot: '#22d3ee' },
  completed: { label: 'Completed', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: '#34d399' },
  overdue: { label: 'Overdue', tone: 'bg-red-50 text-red-700 border-red-200', dot: '#f87171' },
  paused: { label: 'Paused', tone: 'bg-slate-100 text-slate-500 border-slate-200', dot: '#5f6675' },
  archived: { label: 'Archived', tone: 'bg-slate-100 text-slate-400 border-slate-200', dot: '#2d3240' },
};

export interface StatusInput {
  state: 'active' | 'paused' | 'archived';
  dueDate: ISODate;
  preset: PresetKey;
  customOffsets?: number[] | null;
  recurrence: Recurrence;
  holidayShift?: boolean;
  snoozedUntil?: string | null;
  lastCompletedAt?: string | null;
  completedOneOff?: boolean;
}

export function deriveStatus(r: StatusInput, timeZone = DEFAULT_TIMEZONE, now = new Date()): RenewalStatus {
  if (r.completedOneOff) return 'completed';
  if (r.state === 'archived') return 'archived';
  if (r.state === 'paused') return 'paused';
  const today = todayIn(timeZone, now);
  const left = diffDays(today, r.dueDate);
  if (left < 0) return 'overdue';
  if (r.snoozedUntil && new Date(r.snoozedUntil) > now) return 'snoozed';
  if (left <= 7) return 'awaiting';
  const offsets = ladderOffsets(r.preset, r.customOffsets, r.recurrence);
  const first = offsets.length ? offsets[0] : 0;
  const eff = effectiveDueDate(r.dueDate, r.holidayShift ?? true);
  if (diffDays(today, eff) <= first) return 'in_window';
  return 'upcoming';
}

export function daysLeftLabel(due: ISODate, timeZone = DEFAULT_TIMEZONE, now = new Date()): string {
  const left = diffDays(todayIn(timeZone, now), due);
  if (left === 0) return 'Due today';
  if (left === 1) return 'Due tomorrow';
  if (left > 0) return `${left} days left`;
  if (left === -1) return '1 day overdue';
  return `${-left} days overdue`;
}

/** Risk ordering for the provider dashboard: overdue first, then approaching. */
export function riskRank(s: RenewalStatus): number {
  return { overdue: 0, awaiting: 1, snoozed: 2, in_window: 3, upcoming: 4, paused: 5, completed: 6, archived: 7 }[s];
}
