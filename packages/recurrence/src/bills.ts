import { occurrenceDate } from './occurrence.js';
import type { CalendarDate, Recurrence } from './types.js';

export interface BillOccurrenceState {
  /** The earliest occurrence with no payment or skip log row. */
  readonly occurrenceDate: CalendarDate;
  readonly occurrenceIndex: number;
  /** True once the current occurrence's date is strictly before `today` and still unresolved. */
  readonly isOverdue: boolean;
}

/**
 * A bill's current occurrence is its earliest occurrence with no `bill_payment_log` row, meaning
 * neither paid nor skipped. That occurrence is overdue once its date is before today. It stays
 * current, and overdue, until it is paid or skipped.
 *
 * `resolvedDates` is every occurrence date the caller already has a payment or skip row for
 * (`bill_payment_log`, the caller's concern, not this package's). The loop below terminates in at
 * most `resolvedDates.size + 1` steps: every iteration that continues consumes one distinct
 * resolved date, and occurrence dates are distinct per index, so it can never continue past the
 * number of dates actually in the set.
 */
export function currentBillOccurrence(
  recurrence: Recurrence,
  resolvedDates: ReadonlySet<CalendarDate>,
  today: CalendarDate,
): BillOccurrenceState {
  let index = 0;
  let date = occurrenceDate(recurrence, index);
  while (resolvedDates.has(date)) {
    index += 1;
    date = occurrenceDate(recurrence, index);
  }
  return {
    occurrenceDate: date,
    occurrenceIndex: index,
    isOverdue: date < today,
  };
}
