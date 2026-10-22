/**
 * Anchored recurrence: it never shifts, because it is computed from the anchor date and interval,
 * never from the completion timestamp. Pure functions only — no I/O, no `Date.now()`, no database
 * access. Every date in and out is a plain `YYYY-MM-DD` `CalendarDate`; resolving what "today"
 * means in a given timezone (household or personal) is entirely the caller's job.
 *
 * A one-time bill (`recurrence_unit` null) is not represented here — see the note on
 * `RecurrenceUnit` in `types.ts` for why that case is simple enough to stay the caller's problem.
 */
export type { CalendarDate, Recurrence, RecurrenceUnit } from './types.js';

export {
  occurrenceDate,
  occurrenceIndexAtOrAfter,
  occurrenceIndexAtOrBefore,
  previewOccurrences,
} from './occurrence.js';

export { currentBillOccurrence } from './bills.js';

export { currentChoreOccurrence, occurrenceToComplete } from './chores.js';

export { currentTurn, rebaseRotationOnDeparture, rebaseRotationOnEdit } from './rotation.js';
