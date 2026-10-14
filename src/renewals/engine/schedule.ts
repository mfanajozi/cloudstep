import {
  ISODate, addDays, addMonths, compareDates, diffDays, parseDate,
  previousBusinessDay, zonedInstant, localDateHour, DEFAULT_TIMEZONE,
} from './dates';

// =====================================================
// Recurrence + reminder-ladder engine.
//
// This module is the single source of truth for "when is it next due"
// and "when do we nudge". The browser uses it to preview a timeline,
// the scheduler function uses it to write reminder jobs. Nothing else
// is allowed to compute either.
// =====================================================

export type RecurrenceUnit = 'once' | 'day' | 'week' | 'month' | 'year';
export type AnchorMode = 'fixed' | 'completion';

export interface Recurrence {
  unit: RecurrenceUnit;
  interval: number; // every N units (>= 1)
}

export const RECURRENCE_PRESETS: { key: string; label: string; rule: Recurrence }[] = [
  { key: 'annual', label: 'Annual', rule: { unit: 'year', interval: 1 } },
  { key: 'biannual', label: 'Bi-annual (every 6 months)', rule: { unit: 'month', interval: 6 } },
  { key: 'quarterly', label: 'Quarterly', rule: { unit: 'month', interval: 3 } },
  { key: 'monthly', label: 'Monthly', rule: { unit: 'month', interval: 1 } },
  { key: 'weekly', label: 'Weekly', rule: { unit: 'week', interval: 1 } },
  { key: 'once', label: 'One-off', rule: { unit: 'once', interval: 1 } },
];

export function describeRecurrence(r: Recurrence): string {
  const hit = RECURRENCE_PRESETS.find(p => p.rule.unit === r.unit && p.rule.interval === r.interval);
  if (hit) return hit.label;
  const unit = r.unit === 'day' ? 'day' : r.unit === 'week' ? 'week' : r.unit === 'month' ? 'month' : 'year';
  return `Every ${r.interval} ${unit}${r.interval === 1 ? '' : 's'}`;
}

/** Approximate cycle length in days, used to keep a ladder inside one cycle. */
export function cycleLengthDays(r: Recurrence): number {
  switch (r.unit) {
    case 'day': return r.interval;
    case 'week': return r.interval * 7;
    case 'month': return Math.floor(r.interval * 28); // shortest month, conservative
    case 'year': return r.interval * 365;
    default: return Infinity;
  }
}

/** anchor + n periods, keeping the anchor's day-of-month (31st, 29 Feb). */
export function occurrence(anchor: ISODate, r: Recurrence, n: number): ISODate {
  switch (r.unit) {
    case 'day': return addDays(anchor, n * r.interval);
    case 'week': return addDays(anchor, n * r.interval * 7);
    case 'month': return addMonths(anchor, n * r.interval, parseDate(anchor).getUTCDate());
    case 'year': return addMonths(anchor, n * r.interval * 12, parseDate(anchor).getUTCDate());
    default: return anchor;
  }
}

export interface NextCycle {
  dueDate: ISODate;
  anchorDate: ISODate;
}

/**
 * The due date of the cycle after `currentDue`.
 *
 *  - fixed:      "always the anniversary of X". The next date is the first
 *                occurrence of the anchor series strictly after the current
 *                due date. Computed from the anchor, never from the previous
 *                (possibly clamped) due date, so 31-Jan monthly never decays
 *                to the 28th and 29-Feb annual returns to the 29th in leap years.
 *  - completion: "X period after I completed it". The completion date
 *                becomes the new anchor.
 *
 * Returns null for one-off renewals.
 */
export function nextCycle(opts: {
  recurrence: Recurrence;
  anchorMode: AnchorMode;
  anchorDate: ISODate;
  currentDue: ISODate;
  /** The un-overridden series date of the current cycle. A one-off date
   *  edit moves `currentDue` but not this, so the next cycle never lands
   *  inside the cycle that was just completed. */
  seriesDue?: ISODate | null;
  completedOn?: ISODate;
}): NextCycle | null {
  const { recurrence: r, anchorMode, anchorDate, completedOn } = opts;
  const currentDue = opts.seriesDue && compareDates(opts.seriesDue, opts.currentDue) > 0 ? opts.seriesDue : opts.currentDue;
  if (r.unit === 'once') return null;
  if (anchorMode === 'completion' && completedOn) {
    return { dueDate: occurrence(completedOn, r, 1), anchorDate: completedOn };
  }
  // Estimate n, then walk forward to the first occurrence after currentDue.
  let n = Math.max(1, Math.floor(diffDays(anchorDate, currentDue) / Math.max(1, cycleLengthDays(r) + 3)));
  while (n > 1 && compareDates(occurrence(anchorDate, r, n - 1), currentDue) > 0) n--;
  let next = occurrence(anchorDate, r, n);
  let guard = 0;
  while (compareDates(next, currentDue) <= 0 && guard++ < 10_000) next = occurrence(anchorDate, r, ++n);
  return { dueDate: next, anchorDate };
}

/** The first occurrence on or after `onOrAfter` — used when resuming a paused renewal. */
export function firstOccurrenceFrom(anchorDate: ISODate, r: Recurrence, currentDue: ISODate, onOrAfter: ISODate): ISODate {
  let due = currentDue;
  let guard = 0;
  while (compareDates(due, onOrAfter) < 0 && guard++ < 10_000) {
    const nxt = nextCycle({ recurrence: r, anchorMode: 'fixed', anchorDate, currentDue: due });
    if (!nxt) break;
    due = nxt.dueDate;
  }
  return due;
}

// ---------------------------------------------------------------
// Reminder ladder
// ---------------------------------------------------------------

export const MAX_NUDGES = 5;
export const SNOOZE_DAYS = 3;
export const MAX_SNOOZES = 2;
export const OVERDUE_OFFSETS = [1, 7, 14];

export type PresetKey = 'gentle' | 'standard' | 'aggressive' | 'short' | 'custom';

export const PRESETS: Record<Exclude<PresetKey, 'custom'>, { label: string; offsets: number[]; blurb: string }> = {
  gentle: { label: 'Gentle', offsets: [30, 14, 3], blurb: '3 nudges: 30, 14 and 3 days before' },
  standard: { label: 'Standard', offsets: [60, 30, 14, 7, 1], blurb: '5 nudges: 60, 30, 14, 7 and 1 day before' },
  aggressive: { label: 'Aggressive', offsets: [90, 60, 30, 14, 3], blurb: '5 nudges: 90, 60, 30, 14 and 3 days before' },
  short: { label: 'Short-cycle', offsets: [7, 3, 1], blurb: 'For monthly or quarterly items: 7, 3 and 1 day before' },
};

/** Suggest a preset that fits inside the cycle. */
export function suggestPreset(r: Recurrence): PresetKey {
  const len = cycleLengthDays(r);
  if (len <= 120) return 'short';
  return 'standard';
}

/**
 * Enforce the hard rules on a ladder: whole days, >= 0, distinct (so at
 * least 1 day apart), at most 5, and inside one cycle so a monthly item
 * never nudges about a due date two cycles away.
 */
export function normaliseOffsets(raw: number[], r?: Recurrence): number[] {
  const len = r ? cycleLengthDays(r) : Infinity;
  const clean = Array.from(new Set(raw.map(n => Math.round(Number(n))).filter(n => Number.isFinite(n) && n >= 0 && n < len)));
  clean.sort((a, b) => b - a);
  // Keep the nudges nearest the due date: those are the ones that matter.
  return clean.slice(-MAX_NUDGES);
}

export function ladderOffsets(preset: PresetKey, custom: number[] | null | undefined, r?: Recurrence): number[] {
  const base = preset === 'custom' ? (custom ?? []) : PRESETS[preset]?.offsets ?? PRESETS.standard.offsets;
  return normaliseOffsets(base, r);
}

export type Tone = 'heads_up' | 'soon' | 'needed' | 'urgent' | 'final' | 'overdue';

export function toneFor(offset: number): Tone {
  if (offset < 0) return 'overdue';
  if (offset <= 1) return 'final';
  if (offset <= 7) return 'urgent';
  if (offset <= 14) return 'needed';
  if (offset <= 30) return 'soon';
  return 'heads_up';
}

export const TONE_LABEL: Record<Tone, string> = {
  heads_up: 'Heads-up',
  soon: 'Action needed soon',
  needed: 'Action needed',
  urgent: 'Urgent',
  final: 'Final notice',
  overdue: 'Overdue',
};

export interface ScheduleSettings {
  timeZone?: string;
  sendHour?: number;      // local hour nudges fire at (default 08:00)
  holidayShift?: boolean; // shift nudges earlier when the due date is a weekend / SA public holiday
}

/** The date nudges are counted back from: the due date, or the last business day before it. */
export function effectiveDueDate(due: ISODate, holidayShift: boolean): ISODate {
  return holidayShift ? previousBusinessDay(due) : due;
}

export interface PlannedNudge {
  kind: 'nudge' | 'overdue' | 'watcher';
  seq: number;
  offsetDays: number; // days before due (negative = after)
  date: ISODate;
  fireAt: Date;
  tone: Tone;
  inPast: boolean;
}

/**
 * The full nudge plan for one cycle. Past entries are returned flagged
 * `inPast` so a timeline can show them; the scheduler only writes the
 * future ones (no backfill).
 */
export function planCycle(opts: {
  dueDate: ISODate;
  recurrence: Recurrence;
  preset: PresetKey;
  customOffsets?: number[] | null;
  overdueAlerts: boolean;
  watchers: boolean;
  settings?: ScheduleSettings;
  now?: Date;
}): PlannedNudge[] {
  const tz = opts.settings?.timeZone || DEFAULT_TIMEZONE;
  const hour = opts.settings?.sendHour ?? 8;
  const now = opts.now ?? new Date();
  const eff = effectiveDueDate(opts.dueDate, opts.settings?.holidayShift ?? true);
  const out: PlannedNudge[] = [];

  ladderOffsets(opts.preset, opts.customOffsets, opts.recurrence).forEach((off, i) => {
    const date = addDays(eff, -off);
    const fireAt = zonedInstant(date, hour, tz);
    out.push({ kind: 'nudge', seq: i + 1, offsetDays: off, date, fireAt, tone: toneFor(off), inPast: fireAt <= now });
  });

  if (opts.overdueAlerts) {
    OVERDUE_OFFSETS.forEach((d, i) => {
      const date = addDays(opts.dueDate, d);
      const fireAt = zonedInstant(date, hour, tz);
      out.push({ kind: 'overdue', seq: 100 + i, offsetDays: -d, date, fireAt, tone: 'overdue', inPast: fireAt <= now });
    });
  }

  if (opts.watchers) {
    // Watchers hear only when something is going wrong: entering the 7-day
    // window unacknowledged, at the due date, and 7 days overdue.
    [7, 0, -7].forEach((off, i) => {
      const date = off >= 0 ? addDays(eff, -off) : addDays(opts.dueDate, -off);
      const fireAt = zonedInstant(date, hour + 1 > 23 ? hour : hour + 1, tz);
      out.push({ kind: 'watcher', seq: 200 + i, offsetDays: off, date, fireAt, tone: off < 0 ? 'overdue' : toneFor(off), inPast: fireAt <= now });
    });
  }

  return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}

// ---------------------------------------------------------------
// Quiet hours
// ---------------------------------------------------------------

export const HIGH_URGENCY_CHANNELS = ['whatsapp', 'sms'] as const;

/**
 * If `at` falls outside the permitted window [startHour, endHour) on the
 * local clock, return the start of the next permitted window; otherwise
 * return `at` unchanged.
 */
export function nextPermittedInstant(at: Date, startHour: number, endHour: number, timeZone: string = DEFAULT_TIMEZONE): Date {
  const { date, hour } = localDateHour(at, timeZone);
  if (hour >= startHour && hour < endHour) return at;
  const day = hour < startHour ? date : addDays(date, 1);
  return zonedInstant(day, startHour, timeZone);
}
