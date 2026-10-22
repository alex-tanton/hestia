import type { PriceUnit } from '@hearth/shared';

/**
 * US formatting through `Intl` rather than hand-built strings, so a future locale is a change of
 * constants.
 */

const LOCALE = 'en-US';

const MONEY = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'USD' });

const DATE = new Intl.DateTimeFormat(LOCALE, {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
});

const DATE_TIME = new Intl.DateTimeFormat(LOCALE, {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** MM/DD/YYYY. */
export function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}

const CALENDAR_DATE = new Intl.DateTimeFormat(LOCALE, {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * A `YYYY-MM-DD` calendar date as MM/DD/YYYY, read in the timezone that owns it rather than the
 * browser's. A deal's validity dates are calendar dates in the store's local offset, so parsing one
 * as an instant and printing it in another zone would move it a day.
 */
export function formatCalendarDate(date: string): string {
  const [year = '1970', month = '01', day = '01'] = date.split('-');
  return CALENDAR_DATE.format(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

/** MM/DD/YYYY, h:mm AM — the "as of" stamp System health shows. */
export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

/** A timezone name as people read it: "America/New_York" as "New York". */
export function formatTimezone(timezone: string): string {
  return (timezone.split('/').at(-1) ?? timezone).replaceAll('_', ' ');
}

/**
 * Integer cents as dollars. Money arrives from the API already computed and is only ever
 * formatted here; nothing in the client does arithmetic on it.
 */
export function formatCents(cents: number): string {
  return MONEY.format(cents / 100);
}

/** A price with its unit, as Design writes it: "$2.49/lb", "$3.99". */
export function formatPrice(cents: number, unit: PriceUnit): string {
  return unit === 'each' ? formatCents(cents) : `${formatCents(cents)}/${unit}`;
}

/** The same price as a sentence, for the accessible name of a row or a card. */
export function speakPrice(cents: number, unit: PriceUnit): string {
  if (unit === 'each') return formatCents(cents);
  return `${formatCents(cents)} per ${unit === 'lb' ? 'pound' : 'ounce'}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${String(count)} ${count === 1 ? singular : plural}`;
}

/** "4 lists, 23 recipes, and 6 chores" — the counts a household deletion names. */
export function formatList(parts: readonly string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')}, and ${String(parts.at(-1))}`;
}
