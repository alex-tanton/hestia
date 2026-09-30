/**
 * Calendar-date arithmetic in the household's timezone (Requirements › "Locale": weeks start on
 * Sunday; Handoff non-negotiable 8: meal-plan dates are evaluated in the timezone that owns them,
 * never the server's or the browser's). Every date here is a `YYYY-MM-DD` calendar value with no
 * time component: once "today" is read out of the household's own clock, everything after is pure
 * calendar math done at UTC midnight, which never crosses a DST boundary the way arithmetic in a
 * local zone could.
 */

function datePartsFormatter(timezone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** "Today" as a `YYYY-MM-DD` calendar date, read from the household's own clock. */
export function todayInTimezone(timezone: string, now: Date = new Date()): string {
  const parts = datePartsFormatter(timezone).formatToParts(now);
  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? '01';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function toUtcMillis(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

function fromUtcMillis(ms: number): string {
  const asDate = new Date(ms);
  const year = String(asDate.getUTCFullYear()).padStart(4, '0');
  const month = String(asDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(asDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** A calendar date offset by a number of days (negative moves earlier). */
export function addDays(date: string, days: number): string {
  return fromUtcMillis(toUtcMillis(date) + days * 86_400_000);
}

/** The Sunday that starts the week containing this date (Requirements › "Locale"). */
export function weekStart(date: string): string {
  const dayOfWeek = new Date(toUtcMillis(date)).getUTCDay();
  return addDays(date, -dayOfWeek);
}

/** The seven calendar dates of the week starting on this Sunday, in order. */
export function weekDates(sunday: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(sunday, index));
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
