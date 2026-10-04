import type { Bill } from '@hearth/shared';
import { formatCalendarDate } from '../../lib/format.ts';

/**
 * The words Bills and Subscriptions are shown and announced with (Branding › Voice: state facts,
 * never feelings; name the thing rather than speak generically).
 */

export const OFFLINE_ACTION_REASON = 'Needs a connection.';

/**
 * Design › Screens › 14, empty (first run): Hearth tracks bills but never pays them
 * (Handoff non-negotiable 11 — "Hearth never moves money") made honest and explicit up front,
 * rather than discovered the first time someone looks for a "Pay now" button that does not exist.
 */
export const BILLS_EMPTY_COPY =
  'Hearth tracks what you owe and when — it never pays a bill or touches your accounts. Add a bill to start.';

export const BILLS_LIST_EMPTY_COPY = BILLS_EMPTY_COPY;

/** Design › Screens › 14: "Skip the March 12 Duke Energy bill? It won't be marked paid." */
export function skipBillConfirmation(bill: Pick<Bill, 'name' | 'currentOccurrenceDate'>): string {
  return `Skip the ${formatCalendarDate(bill.currentOccurrenceDate)} ${bill.name} bill? It won't be marked paid.`;
}

/** Branding › Copy patterns › Destructive confirm: names the consequence. */
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

/** Design › Screens › 16: "Still using this?" after 60 days unconfirmed. */
export const STILL_USING_PROMPT = 'Still using this?';
