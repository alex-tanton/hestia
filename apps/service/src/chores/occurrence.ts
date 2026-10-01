import { sql, type Kysely } from 'kysely';
import {
  currentTurn,
  occurrenceDate,
  occurrenceIndexAtOrAfter,
  occurrenceIndexAtOrBefore,
  occurrenceToComplete,
  type CalendarDate,
  type Recurrence,
} from '@hearth/recurrence';
import type { Database } from '../db.js';
import { fail } from '../problem.js';

/**
 * Household-timezone "today" (Handoff non-negotiable 8; PRD, "Timezone": chore dates are always
 * evaluated in the household's own timezone, never the server's or the browser's). Resolved from
 * Postgres's own clock, the same way `services/meal-plan.ts`'s `currentWeekSunday` resolves the
 * current week's Sunday, so every date in a request comes from one clock.
 */
export async function householdToday(
  db: Kysely<Database>,
  householdId: string,
): Promise<CalendarDate> {
  const { rows } = await sql<{ today: string }>`
    select (pg_catalog.now() at time zone h.timezone)::date::text as today
    from public.household h
    where h.id = ${householdId}
  `.execute(db);
  const today = rows[0]?.today;
  if (today === undefined) throw fail(404, 'Household not found.');
  return today;
}

/** `date` is one of `recurrence`'s own occurrence dates (anchor plus a non-negative multiple of interval). */
export function isValidOccurrence(recurrence: Recurrence, date: CalendarDate): boolean {
  const index = occurrenceIndexAtOrBefore(recurrence, date);
  return index !== null && occurrenceDate(recurrence, index) === date;
}

/**
 * The next `count` occurrence dates starting at `from` (Design, "17. Chores" › "Chore detail":
 * "the next three dates"). The caller always passes the chore's own `dueDate` here, never "today"
 * directly: an overdue chore's `dueDate` is itself in the past, and starting the preview from
 * "today" instead would silently skip straight past the very occurrence that is overdue. Since
 * `dueDate` is already guaranteed to land exactly on one of `recurrence`'s own occurrences,
 * `occurrenceIndexAtOrAfter` resolves to that occurrence's own index rather than the next one.
 */
export function nextOccurrenceDates(
  recurrence: Recurrence,
  from: CalendarDate,
  count: number,
): CalendarDate[] {
  const start = occurrenceIndexAtOrAfter(recurrence, from);
  return Array.from({ length: count }, (_, index) => occurrenceDate(recurrence, start + index));
}

export interface DerivedChoreState {
  dueDate: CalendarDate;
  isOverdue: boolean;
  currentTurn: string | null;
  nextTurn: string | null;
}

/**
 * The fields a chore's list and detail views need beyond its stored columns, all derived from the
 * recurrence and the completions on hand (PRD, "Recurrence is anchored and derived on read";
 * "Rotation"). `occurrenceToComplete` never returns a date in the past when the current occurrence
 * is already completed (the next occurrence of a positive-interval recurrence is always later
 * than "today" in that case), so comparing it to `today` is enough to know overdue-ness without a
 * second call to `currentChoreOccurrence`.
 */
export function deriveChoreState(
  recurrence: Recurrence,
  completedDates: ReadonlySet<CalendarDate>,
  completionCount: number,
  today: CalendarDate,
  rotationOrder: readonly string[] | null,
  rotationOffset: number,
): DerivedChoreState {
  const dueDate = occurrenceToComplete(recurrence, completedDates, today);
  return {
    dueDate,
    isOverdue: dueDate < today,
    currentTurn:
      rotationOrder === null ? null : currentTurn(rotationOrder, rotationOffset, completionCount),
    nextTurn:
      rotationOrder === null
        ? null
        : currentTurn(rotationOrder, rotationOffset, completionCount + 1),
  };
}
