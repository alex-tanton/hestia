/*
 * The household clock for E2E journeys. The journeys run against the real service and Postgres
 * clocks and there is no clock seam to pin, so every expected date is computed at run time in the
 * household's zone and never assumes a weekday. Specs take "now" from `currentInstant` and turn it
 * into calendar dates and hours with the helpers below.
 */

/**
 * The process clock, the single real-clock read under `e2e/`.
 */
export function currentInstant(): Date {
  // eslint-disable-next-line no-restricted-syntax -- E2E reads the real clock the stack also uses; there is no seam to pin
  return new Date();
}

/** The calendar date (YYYY-MM-DD) an instant falls on in a timezone. */
export function dateInZone(zone: string, at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** The hour of day (0 to 23) an instant falls on in a timezone. */
export function hourInZone(zone: string, at: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(at),
  );
}

/** A calendar date (YYYY-MM-DD) moved by a whole number of days; negative moves back. */
export function addDays(date: string, days: number): string {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}
