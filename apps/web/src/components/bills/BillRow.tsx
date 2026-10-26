import { SkipForward } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import type { Bill } from '@hestia/shared';
import { formatCalendarDate, formatCents } from '../../lib/format.ts';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';
import { OverflowMenu } from '../ui/OverflowMenu.tsx';

export interface BillRowProps {
  bill: Bill;
  onPay: () => void;
  onSkip: () => void;
  isPaying: boolean;
  offlineReason?: string | undefined;
}

/**
 * `BillRow`: name, amount, due date, autopay indicator, and visibility. Overdue carries both the
 * danger color and the word "Overdue" (never color alone); the same is true of the "Personal"
 * and "Autopay" badges, which both pair an icon or label with their meaning rather than relying
 * on a color swatch.
 */
export function BillRow({
  bill,
  onPay,
  onSkip,
  isPaying,
  offlineReason,
}: BillRowProps): ReactElement {
  return (
    <li className="flex items-center gap-1 border-b border-border last:border-b-0">
      <Link
        to={`/bills/${bill.id}`}
        className="flex min-h-11 flex-1 flex-col gap-1 px-4 py-3 hover:bg-raised"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-body text-primary">{bill.name}</span>
          {bill.visibility === 'personal' && <Badge variant="personal" />}
          {bill.autopay && <Badge variant="neutral">Autopay</Badge>}
          {bill.isOverdue && <Badge variant="danger">Overdue</Badge>}
        </span>
        <span className="text-body-sm text-secondary">
          {`${formatCents(bill.amountCents)} · Due ${formatCalendarDate(bill.currentOccurrenceDate)}`}
        </span>
      </Link>
      <Button
        variant="secondary"
        disabledReason={offlineReason}
        isLoading={isPaying}
        onClick={onPay}
        aria-label={`Mark paid, ${bill.name}`}
      >
        Mark paid
      </Button>
      <OverflowMenu
        label={`More actions for ${bill.name}`}
        items={[
          {
            label: 'Skip',
            icon: <SkipForward aria-hidden size={20} strokeWidth={1.5} />,
            disabledReason: offlineReason,
            onSelect: onSkip,
          },
        ]}
      />
    </li>
  );
}
