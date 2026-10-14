// =====================================================
// Calendar-date helpers for the Renewal Reminder engine.
//
// Every due date is a plain calendar date ("YYYY-MM-DD") with no time
// zone. Arithmetic happens on UTC midnights so DST and the host's local
// zone can never shift a day. Instants (fire times) are only produced at
// the very end, by `zonedInstant`, in the account's time zone.
// =====================================================

export type ISODate = string; // YYYY-MM-DD

export const DEFAULT_TIMEZONE = 'Africa/Johannesburg';

export function parseDate(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function fmtDate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function isValidDate(d: unknown): boolean {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return fmtDate(parseDate(d)) === d;
}

export function addDays(d: ISODate, n: number): ISODate {
  const t = parseDate(d);
  t.setUTCDate(t.getUTCDate() + n);
  return fmtDate(t);
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/**
 * Add whole months, clamping to the last day of a shorter month.
 * `anchorDay` is the day-of-month the series was born on, so a series
 * anchored on the 31st goes 31 Jan → 28/29 Feb → 31 Mar, never drifting
 * down to the 28th.
 */
export function addMonths(d: ISODate, months: number, anchorDay?: number): ISODate {
  const t = parseDate(d);
  const day = anchorDay ?? t.getUTCDate();
  const total = t.getUTCFullYear() * 12 + t.getUTCMonth() + months;
  const y = Math.floor(total / 12);
  const m = total - y * 12;
  return fmtDate(new Date(Date.UTC(y, m, Math.min(day, daysInMonth(y, m)))));
}

/** Whole days from a to b (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(d: ISODate): number {
  return parseDate(d).getUTCDay();
}

// ---------------------------------------------------------------
// Time-zone handling
// ---------------------------------------------------------------

function zoneParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}

/** Offset of `timeZone` from UTC at `instant`, in minutes. */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const p = zoneParts(instant, timeZone);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** The UTC instant at which it is `date` `hour:minute` on the wall clock in `timeZone`. */
export function zonedInstant(date: ISODate, hour: number, timeZone: string = DEFAULT_TIMEZONE, minute = 0): Date {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  let off = zoneOffsetMinutes(new Date(guess), timeZone);
  let instant = guess - off * 60_000;
  // A second pass settles the rare case where the offset differs across the guess.
  const off2 = zoneOffsetMinutes(new Date(instant), timeZone);
  if (off2 !== off) instant = guess - off2 * 60_000;
  return new Date(instant);
}

/** Calendar date and hour of `instant` on the wall clock in `timeZone`. */
export function localDateHour(instant: Date, timeZone: string = DEFAULT_TIMEZONE): { date: ISODate; hour: number; minute: number } {
  const p = zoneParts(instant, timeZone);
  const date = `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
  return { date, hour: p.h, minute: p.mi };
}

export function todayIn(timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()): ISODate {
  return localDateHour(now, timeZone).date;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function formatLongDate(d: ISODate): string {
  return parseDate(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// ---------------------------------------------------------------
// South African public holidays (Public Holidays Act 36 of 1994).
// A holiday that falls on a Sunday is observed on the Monday.
// ---------------------------------------------------------------

/** Gregorian Easter Sunday (anonymous / Meeus algorithm). */
export function easterSunday(year: number): ISODate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return fmtDate(new Date(Date.UTC(year, month - 1, day)));
}

const FIXED_HOLIDAYS: [string, string][] = [
  ['01-01', "New Year's Day"],
  ['03-21', 'Human Rights Day'],
  ['04-27', 'Freedom Day'],
  ['05-01', "Workers' Day"],
  ['06-16', 'Youth Day'],
  ['08-09', "National Women's Day"],
  ['09-24', 'Heritage Day'],
  ['12-16', 'Day of Reconciliation'],
  ['12-25', 'Christmas Day'],
  ['12-26', 'Day of Goodwill'],
];

const holidayCache = new Map<number, Map<ISODate, string>>();

export function saPublicHolidays(year: number): Map<ISODate, string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const out = new Map<ISODate, string>();
  for (const [md, name] of FIXED_HOLIDAYS) {
    const date = `${year}-${md}`;
    out.set(date, name);
    if (weekday(date) === 0) {
      const monday = addDays(date, 1);
      if (!out.has(monday)) out.set(monday, `${name} (observed)`);
    }
  }
  const easter = easterSunday(year);
  out.set(addDays(easter, -2), 'Good Friday');
  out.set(addDays(easter, 1), 'Family Day');
  holidayCache.set(year, out);
  return out;
}

export function holidayName(d: ISODate): string | null {
  return saPublicHolidays(Number(d.slice(0, 4))).get(d) ?? null;
}

export function isBusinessDay(d: ISODate): boolean {
  const wd = weekday(d);
  return wd !== 0 && wd !== 6 && !holidayName(d);
}

/** The last business day on or before `d`. */
export function previousBusinessDay(d: ISODate): ISODate {
  let cur = d;
  for (let i = 0; i < 10 && !isBusinessDay(cur); i++) cur = addDays(cur, -1);
  return cur;
}
