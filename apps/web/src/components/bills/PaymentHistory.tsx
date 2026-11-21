import type { ReactElement } from 'react';
import type { BillPayment } from '@hestia/shared';
import { formatCalendarDate, formatCents } from '../../lib/format.ts';
import { MdIconButton } from '../md/MdButton.tsx';
import { Badge } from '../ui/Badge.tsx';
import { Icon } from '../ui/Icon.tsx';

export interface PaymentHistoryProps {
  payments: readonly BillPayment[];
  onEdit: (payment: BillPayment) => void;
  onDelete: (payment: BillPayment) => void;
  offlineReason?: string | undefined;
}

function paymentLine(payment: BillPayment): string {
  if (payment.isSkipped) {
    return `Skipped · occurrence ${formatCalendarDate(payment.occurrenceDate)}`;
  }
  const paid = payment.paidDate === null ? '' : ` on ${formatCalendarDate(payment.paidDate)}`;
  const amount =
    payment.amountPaidCents === null ? '' : ` · ${formatCents(payment.amountPaidCents)}`;
  return `Paid${paid}${amount}`;
}

/**
 * Payment history, newest occurrence first. Per-row overflow menus are completely eliminated
 * (D-12, BILL-02). Tapping a paid payment row opens PaymentEditSheet, and every entry provides
 * a direct trailing delete icon button.
 */
export function PaymentHistory({
  payments,
  onEdit,
  onDelete,
  offlineReason,
}: PaymentHistoryProps): ReactElement {
  if (payments.length === 0) {
    return (
      <p className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
        No payments recorded yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-[var(--md-sys-color-outline-variant)]">
      {payments.map((payment) => (
        <li key={payment.id} className="flex min-h-12 items-center justify-between gap-3 px-4 py-3">
          {payment.isSkipped ? (
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-body text-[var(--md-sys-color-on-surface)]">
              {paymentLine(payment)}
            </span>
          ) : (
            <button
              type="button"
              className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left text-body text-[var(--md-sys-color-on-surface)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
              onClick={() => {
                onEdit(payment);
              }}
              aria-label={`Edit payment for ${formatCalendarDate(payment.occurrenceDate)}`}
            >
              <span>{paymentLine(payment)}</span>
              {payment.isAuto && <Badge variant="neutral">Autopay</Badge>}
            </button>
          )}

          <div className="flex items-center">
            <MdIconButton
              aria-label={`Delete payment for ${formatCalendarDate(payment.occurrenceDate)}`}
              disabled={Boolean(offlineReason)}
              onClick={() => {
                onDelete(payment);
              }}
            >
              <span slot="icon">
                <Icon name="delete" size={20} />
              </span>
            </MdIconButton>
          </div>
        </li>
      ))}
    </ul>
  );
}
