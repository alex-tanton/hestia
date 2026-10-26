import { Pencil, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import type { BillPayment } from '@hestia/shared';
import { formatCalendarDate, formatCents } from '../../lib/format.ts';
import { Badge } from '../ui/Badge.tsx';
import { OverflowMenu, type OverflowMenuItem } from '../ui/OverflowMenu.tsx';

export interface PaymentHistoryProps {
  payments: readonly BillPayment[];
  onEdit: (payment: BillPayment) => void;
  onDelete: (payment: BillPayment) => void;
  offlineReason?: string | undefined;
}

function paymentLine(payment: BillPayment): string {
  if (payment.isSkipped)
    return `Skipped · occurrence ${formatCalendarDate(payment.occurrenceDate)}`;
  const paid = payment.paidDate === null ? '' : ` on ${formatCalendarDate(payment.paidDate)}`;
  const amount =
    payment.amountPaidCents === null ? '' : ` · ${formatCents(payment.amountPaidCents)}`;
  return `Paid${paid}${amount}`;
}

/**
 * Payment history, newest occurrence first (the order `GET /bills/:id`
 * already returns it in). An automatic payment carries the "Autopay" label everywhere it appears,
 * and every entry — automatic or manual — can be edited or removed, except a skipped occurrence,
 * which has no amount to correct.
 */
export function PaymentHistory({
  payments,
  onEdit,
  onDelete,
  offlineReason,
}: PaymentHistoryProps): ReactElement {
  if (payments.length === 0) {
    return <p className="text-body-sm text-secondary">No payments recorded yet.</p>;
  }

  const menuFor = (payment: BillPayment): OverflowMenuItem[] => [
    ...(payment.isSkipped
      ? []
      : [
          {
            label: 'Edit',
            icon: <Pencil aria-hidden size={20} strokeWidth={1.5} />,
            disabledReason: offlineReason,
            onSelect: () => {
              onEdit(payment);
            },
          },
        ]),
    {
      label: 'Delete',
      icon: <Trash2 aria-hidden size={20} strokeWidth={1.5} />,
      isDestructive: true,
      disabledReason: offlineReason,
      onSelect: () => {
        onDelete(payment);
      },
    },
  ];

  return (
    <ul className="flex flex-col rounded-md border border-border">
      {payments.map((payment) => (
        <li
          key={payment.id}
          className="flex items-center gap-1 border-b border-border px-4 py-3 last:border-b-0"
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-body text-primary">
            {paymentLine(payment)}
            {payment.isAuto && <Badge variant="neutral">Autopay</Badge>}
          </span>
          <OverflowMenu
            label={`More actions for the ${formatCalendarDate(payment.occurrenceDate)} payment`}
            items={menuFor(payment)}
          />
        </li>
      ))}
    </ul>
  );
}
