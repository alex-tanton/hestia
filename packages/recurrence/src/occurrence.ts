import { TZDate } from '@date-fns/tz';
import { addDays } from 'date-fns';
import { daysInMonth, formatCalendarDate, parseCalendarDate } from './calendar-date.js';
import type { CalendarDate, Recurrence } from './types.js';

/**
 * Adds `monthsToAdd` months to `anchor`, clamping the day-of-month to the target month's last day
 * when the anchor's day doesn't exist there. Monthly and yearly anchors past the 28th clamp to the
 * last day of shorter months… Each occurrence is computed from the anchor, never from the
 * previous clamped date.
 *
 * Both monthly and yearly recurrence funnel through here — a year is just 12 months — which is
 * also why a yearly Feb 29 anchor correctly clamps to Feb 28 in a non-leap target year: it's the
 * same day-of-month clamp, not a special case.
 *
 * Critically, `anchorDay` below always comes from the original anchor passed in, never from a
 * previously clamped result, so a 31st-of-the-month anchor gives Feb 28/29 and then the 31st again
 * in March rather than ratcheting down to the 28th forever.
 */
function addClampedMonths(anchor: TZDate, monthsToAdd: number): TZDate {
  const anchorDay = anchor.getDate();
  const totalMonths = anchor.getMonth() + monthsToAdd;
  const targetYear = anchor.getFullYear() + Math.floor(totalMonths / 12);
  const targetMonthIndex = ((totalMonths % 12) + 12) % 12;
  const clampedDay = Math.min(anchorDay, daysInMonth(targetYear, targetMonthIndex));
  return new TZDate(targetYear, targetMonthIndex, clampedDay, 'UTC');
}

function assertValidRecurrence(recurrence: Recurrence): void {
  if (!Number.isInteger(recurrence.interval) || recurrence.interval <= 0) {
    throw new RangeError('recurrence.interval must be a positive integer');
  }
}

function assertValidIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError('occurrence index must be a non-negative integer');
  }
}

/** The calendar date of occurrence `index` (0-based) — `anchorDate` plus `index × interval` units. */
export function occurrenceDate(recurrence: Recurrence, index: number): CalendarDate {
  assertValidRecurrence(recurrence);
  assertValidIndex(index);
  const anchor = parseCalendarDate(recurrence.anchorDate);
  const steps = index * recurrence.interval;
  switch (recurrence.unit) {
    case 'day':
      return formatCalendarDate(addDays(anchor, steps));
    case 'week':
      return formatCalendarDate(addDays(anchor, steps * 7));
    case 'month':
      return formatCalendarDate(addClampedMonths(anchor, steps));
    case 'year':
      return formatCalendarDate(addClampedMonths(anchor, steps * 12));
  }
}

/**
 * The largest occurrence index whose date is on or before `date`, or `null` if even occurrence 0
 * (the anchor) is still in the future relative to `date`. Occurrence dates are strictly increasing
 * in index for every unit, clamping included, so an exponential-then-binary search finds the
 * answer in O(log k) calls to `occurrenceDate` regardless of how large k gets.
 */
export function occurrenceIndexAtOrBefore(
  recurrence: Recurrence,
  date: CalendarDate,
): number | null {
  if (date < recurrence.anchorDate) return null;
  let lo = 0;
  let hi = 1;
  while (occurrenceDate(recurrence, hi) <= date) {
    lo = hi;
    hi *= 2;
  }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (occurrenceDate(recurrence, mid) <= date) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** The smallest occurrence index whose date is on or after `date` (occurrence 0 if `date` precedes the anchor). */
export function occurrenceIndexAtOrAfter(recurrence: Recurrence, date: CalendarDate): number {
  const before = occurrenceIndexAtOrBefore(recurrence, date);
  if (before === null) return 0;
  return occurrenceDate(recurrence, before) === date ? before : before + 1;
}

/**
 * The next `count` occurrence dates starting at the anchor (index 0) — the plain-language "next
 * three due dates" preview the bill and chore creation sheets show. It
 * previews from the anchor rather than from "today" because at preview time the record may not
 * exist yet; a caller previewing against a specific cutoff can combine this with
 * `occurrenceIndexAtOrAfter` to skip ahead.
 */
export function previewOccurrences(recurrence: Recurrence, count: number): CalendarDate[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError('count must be a non-negative integer');
  }
  return Array.from({ length: count }, (_, index) => occurrenceDate(recurrence, index));
}
