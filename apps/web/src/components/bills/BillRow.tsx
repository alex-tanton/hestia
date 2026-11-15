import type { ReactElement } from 'react';
import { Link } from 'react-router';
import type { Bill } from '@hestia/shared';
import { formatCalendarDate, formatCents } from '../../lib/format.ts';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';

export interface BillRowProps {
  bill: Bill;
  onPay: () => void;
  isPaying: boolean;
  offlineReason?: string | undefined;
}

/**
 * `BillRow`: name, amount, due date, autopay indicator, and visibility. Overdue carries both the
 * danger color and the error icon badge; zero 1-item overflow menus exist, replaced by a direct
 * one-tap "Mark paid" secondary button.
 */
export function BillRow({ bill, onPay, isPaying, offlineReason }: BillRowProps): ReactElement {
  return (
    <li className="flex min-h-12 items-center justify-between gap-3 border-b border-[var(--md-sys-color-outline-variant)] last:border-b-0">
      <Link
        to={`/bills/${bill.id}`}
        className="flex min-w-0 flex-1 flex-col gap-1 py-3 pl-4 hover:bg-[var(--md-sys-color-surface-container-low)] focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-body font-semibold text-[var(--md-sys-color-on-surface)]">
            {bill.name}
          </span>
          {bill.visibility === 'personal' && <Badge variant="personal" />}
          {bill.autopay && <Badge variant="neutral">Autopay</Badge>}
          {bill.isOverdue && <Badge variant="danger">Overdue</Badge>}
        </span>
        <span className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
          <span className="font-semibold tabular-nums text-[var(--md-sys-color-on-surface)]">
            {formatCents(bill.amountCents)}
          </span>
          <span>{` · Due ${formatCalendarDate(bill.currentOccurrenceDate)}`}</span>
        </span>
      </Link>
      <div className="flex items-center pr-4">
        <Button
          variant="secondary"
          disabledReason={offlineReason}
          isLoading={isPaying}
          onClick={onPay}
          aria-label={`Mark paid, ${bill.name}`}
        >
          Mark paid
        </Button>
      </div>
    </li>
  );
}
