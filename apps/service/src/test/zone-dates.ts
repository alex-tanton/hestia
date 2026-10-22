/*
 * Calendar-date helpers for service tests. Every calendar date belongs to a household's zone:
 * counting days on the UTC calendar, or on the machine's, mis-dates a bill, chore or errand for the
 * hours around the household's midnight. Tests that need "today" or "n days from today" take it
 * from here, in the zone of the household they created.
 */

const DAY_MS = 86_400_000;

/**
 * The process clock. Integration tests run on the real clock, because the Postgres `now()` they
 * are compared against cannot be pinned; unit tests get the shared pin from `test/clock-setup.mjs`.
 */
export function currentInstant(): Date {
  // eslint-disable-next-line no-restricted-syntax -- the one clock read: real in integration tests, pinned in unit tests
  return new Date();
}

/** The calendar date (YYYY-MM-DD) an instant falls on in a timezone. */
export function dateInZone(zone: string, instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** A calendar date moved by a whole number of days (negative moves back). */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from one calendar date to another. */
export function daysBetween(later: string, earlier: string): number {
  return Math.round(
    (Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / DAY_MS,
  );
}

/**
 * The household's calendar date `offsetDays` from today, where today is read in `zone`.
 * `now` defaults to the process clock.
 */
export function householdDate(
  zone: string,
  offsetDays: number,
  now: Date = currentInstant(),
): string {
  return addDays(dateInZone(zone, now), offsetDays);
}
