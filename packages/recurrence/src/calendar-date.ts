import { TZDate } from '@date-fns/tz';
import { format, getDaysInMonth } from 'date-fns';
import type { CalendarDate } from './types.js';

/**
 * All arithmetic in this package happens on `TZDate` instances pinned to UTC rather than the raw
 * `Date` constructor (Engineering Practices, "Key libraries": "Never use the raw `Date`
 * constructor for date math"). A calendar date has no timezone of its own — pinning every instance
 * to the same fixed offset is what makes `anchor + k units` reproducible regardless of the host
 * machine's local timezone or DST, which matters because jobs and tests must get the same answer
 * everywhere.
 */
const UTC = 'UTC';

/** Parses a `YYYY-MM-DD` string into the UTC calendar instant date-fns operates on. */
export function parseCalendarDate(date: CalendarDate): TZDate {
  const [year, month, day] = date.split('-').map(Number);
  return new TZDate(year ?? 1970, (month ?? 1) - 1, day ?? 1, UTC);
}

/** Formats a UTC-pinned date back to `YYYY-MM-DD`. */
export function formatCalendarDate(date: TZDate): CalendarDate {
  return format(date, 'yyyy-MM-dd');
}

/** The number of days in the given (UTC) year and zero-indexed month, leap years included. */
export function daysInMonth(year: number, monthIndex: number): number {
  return getDaysInMonth(new TZDate(year, monthIndex, 1, UTC));
}
