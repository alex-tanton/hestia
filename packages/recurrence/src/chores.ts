import { occurrenceDate, occurrenceIndexAtOrBefore } from './occurrence.js';
import type { CalendarDate, Recurrence } from './types.js';

export interface ChoreOccurrenceState {
  /** The latest occurrence on or before `today`, or the first occurrence if none has arrived yet. */
  readonly occurrenceDate: CalendarDate;
  readonly occurrenceIndex: number;
  readonly isCompleted: boolean;
  /** True while the current occurrence has arrived, has no completion, and its date is strictly before `today`. */
  readonly isOverdue: boolean;
}

/**
 * A chore's current occurrence is the latest occurrence on or before today, or the first
 * occurrence if none has arrived yet. When the next occurrence's date arrives, an uncompleted
 * earlier occurrence stops being due; missed occurrences do not stack up and are never backfilled.
 *
 * `completedDates` is every occurrence date the caller already has a `chore_completion` row for.
 */
export function currentChoreOccurrence(
  recurrence: Recurrence,
  completedDates: ReadonlySet<CalendarDate>,
  today: CalendarDate,
): ChoreOccurrenceState {
  const atOrBefore = occurrenceIndexAtOrBefore(recurrence, today);
  const occurrenceIndex = atOrBefore ?? 0;
  const date = occurrenceDate(recurrence, occurrenceIndex);
  const arrived = date <= today;
  const isCompleted = completedDates.has(date);
  return {
    occurrenceDate: date,
    occurrenceIndex,
    isCompleted,
    isOverdue: arrived && date < today && !isCompleted,
  };
}

/**
 * Which occurrence a new completion closes. A completion closes the current occurrence if that
 * occurrence is open. If the current occurrence is already completed, or has not arrived yet, the
 * completion is early and closes the earliest later occurrence that has no completion.
 *
 * "Open" means arrived (due) and not yet completed — the overdue-or-due-today case. Otherwise the
 * completion is early, and the search for "earliest later occurrence with no completion" starts:
 * - at `occurrenceIndex + 1` when the current occurrence already has a completion (so it, and
 *   everything the completion history implies came before it, is skipped), or
 * - at `occurrenceIndex` itself (which is always 0 here) when nothing has arrived yet, since the
 *   first occurrence is the earliest one that could possibly need closing.
 *
 * This never reaches back before the current occurrence, which is what keeps missed occurrences
 * from ever being backfilled: a chore occurrence that has already stopped being due cannot be the
 * target of a later completion.
 *
 * Composability note (also demonstrated in chores.test.ts): deleting the most recent completion is
 * just re-calling this (and `currentChoreOccurrence` / the rotation functions) with that one
 * completion removed from `completedDates` and `completionCount` reduced by one — no separate
 * "undo" function is needed because both are already pure functions of the completion set.
 */
export function occurrenceToComplete(
  recurrence: Recurrence,
  completedDates: ReadonlySet<CalendarDate>,
  today: CalendarDate,
): CalendarDate {
  const current = currentChoreOccurrence(recurrence, completedDates, today);
  const arrived = current.occurrenceDate <= today;
  if (arrived && !current.isCompleted) {
    return current.occurrenceDate;
  }
  let index = arrived ? current.occurrenceIndex + 1 : current.occurrenceIndex;
  let date = occurrenceDate(recurrence, index);
  while (completedDates.has(date)) {
    index += 1;
    date = occurrenceDate(recurrence, index);
  }
  return date;
}
