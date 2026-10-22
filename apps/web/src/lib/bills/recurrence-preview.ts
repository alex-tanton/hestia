import { previewOccurrences, type Recurrence } from '@hearth/recurrence';
import type { RecurrenceUnit } from '@hearth/shared';
import { formatCalendarDate, formatList } from '../format.ts';

/**
 * The recurrence a bill's create/edit form is holding, before it is known to be valid. Editing
 * unit, interval, or the first due date shows a plain-language preview of the next three due
 * dates, since anchored recurrence is easy to misunderstand. There is no server round trip for
 * this (the Bills API has no preview endpoint) — it
 * uses the same anchored-recurrence package the service itself computes occurrences with
 * (`@hearth/recurrence`), so the preview can never disagree with what the bill actually does once
 * saved.
 */
export interface RecurrenceDraft {
  unit: RecurrenceUnit | null;
  interval: number;
  /** A `YYYY-MM-DD` calendar date, or '' while the field is still blank. */
  anchorDate: string;
}

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDraft(draft: RecurrenceDraft): boolean {
  return (
    CALENDAR_DATE_PATTERN.test(draft.anchorDate) &&
    Number.isInteger(draft.interval) &&
    draft.interval > 0
  );
}

/**
 * The next due dates as MM/DD/YYYY, formatted. A one-time bill (`unit` null) has a single
 * occurrence on the anchor date, so the preview is that one date. Returns an empty array while the
 * draft is incomplete or malformed, rather than guessing.
 */
export function previewDueDates(draft: RecurrenceDraft, count = 3): string[] {
  if (!isValidDraft(draft)) return [];
  if (draft.unit === null) return [formatCalendarDate(draft.anchorDate)];
  const recurrence: Recurrence = {
    unit: draft.unit,
    interval: draft.interval,
    anchorDate: draft.anchorDate,
  };
  return previewOccurrences(recurrence, count).map(formatCalendarDate);
}

/** The sentence shown beneath the recurrence fields, or `undefined` until it can. */
export function recurrencePreviewSentence(draft: RecurrenceDraft): string | undefined {
  const dates = previewDueDates(draft);
  const [first] = dates;
  if (first === undefined) return undefined;
  if (draft.unit === null) return `Due once, on ${first}.`;
  return `Next due dates: ${formatList(dates)}.`;
}
