/**
 * US formatting through `Intl` rather than hand-built strings, so a future locale is a change of
 * constants (Requirements, "Locale").
 */

const LOCALE = 'en-US';

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

/** MM/DD/YYYY, h:mm AM — the "as of" stamp System health shows. */
export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

/** A timezone name as people read it: "America/New_York" as "New York". */
export function formatTimezone(timezone: string): string {
  return (timezone.split('/').at(-1) ?? timezone).replaceAll('_', ' ');
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
