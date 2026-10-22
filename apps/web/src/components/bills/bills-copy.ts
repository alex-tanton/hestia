import type { Bill } from '@hearth/shared';
import { formatCalendarDate } from '../../lib/format.ts';

/**
 * The words Bills and Subscriptions are shown and announced with (state facts,
 * never feelings; name the thing rather than speak generically).
 */

export const OFFLINE_ACTION_REASON = 'Needs a connection.';

/**
 * Empty (first run): Hearth tracks bills but never pays them, and that is made honest and
 * explicit up front, rather than discovered the first time someone looks for a "Pay now" button
 * that does not exist.
 */
export const BILLS_LIST_EMPTY_COPY =
  'Hearth tracks what you owe and when — it never pays a bill or touches your accounts. Add a bill to start.';

/** E.g. "Skip the March 12 Duke Energy bill? It won't be marked paid." */
export function skipBillConfirmation(bill: Pick<Bill, 'name' | 'currentOccurrenceDate'>): string {
  return `Skip the ${formatCalendarDate(bill.currentOccurrenceDate)} ${bill.name} bill? It won't be marked paid.`;
}

/** A destructive confirmation names the consequence. */
export function deleteBillConfirmation(bill: Pick<Bill, 'name'>): string {
  return `Delete ${bill.name}? Its payment history is removed with it.`;
}

export function archiveBillConfirmation(bill: Pick<Bill, 'name'>): string {
  return `Archive ${bill.name}? It stops showing up and sends no more reminders; its history is kept.`;
}

export function deletePaymentConfirmation(bill: Pick<Bill, 'name'>): string {
  return `Delete this payment for ${bill.name}? The occurrence becomes unpaid again.`;
}

export const SUBSCRIPTIONS_EMPTY_COPY = 'No subscriptions tracked yet.';

/** "Still using this?" after 60 days unconfirmed. */
export const STILL_USING_PROMPT = 'Still using this?';
