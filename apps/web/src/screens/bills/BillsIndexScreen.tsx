import { Receipt } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import type { Bill, BillVisibility } from '@hearth/shared';
import { BillForm, type BillDraft } from '../../components/bills/BillForm.tsx';
import { BillRow } from '../../components/bills/BillRow.tsx';
import {
  BILLS_LIST_EMPTY_COPY,
  OFFLINE_ACTION_REASON,
  skipBillConfirmation,
} from '../../components/bills/bills-copy.ts';
import { householdFallback } from '../../components/chores/household-date-fallback.tsx';
import { EmptyState, ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { useHousehold } from '../../lib/api/hooks.ts';
import {
  useBills,
  useCreateHouseholdBill,
  useCreatePersonalBill,
  usePayBill,
  useSkipBill,
} from '../../lib/api/bills-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { addDays, todayInTimezone, weekStart } from '../../lib/household-date.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';

export interface BillGroups {
  overdue: Bill[];
  thisWeek: Bill[];
  later: Bill[];
}

/**
 * PRD › "This Week" and Design › Screens › 14: Overdue, This week (through Saturday, household
 * timezone), then Later. A bill's own `isOverdue` flag already accounts for its occurrence being
 * in the past, so grouping needs only that flag and a same-or-before comparison against the end
 * of the current week — no second overdue check is possible here.
 */
export function groupBills(bills: readonly Bill[], weekEnd: string): BillGroups {
  const groups: BillGroups = { overdue: [], thisWeek: [], later: [] };
  for (const bill of bills) {
    if (bill.isOverdue) groups.overdue.push(bill);
    else if (bill.currentOccurrenceDate <= weekEnd) groups.thisWeek.push(bill);
    else groups.later.push(bill);
  }
  return groups;
}

export interface BillsIndexScreenProps {
  householdId: string;
}

export function BillsIndexScreen({ householdId }: BillsIndexScreenProps): ReactElement {
  const isOnline = useOnlineStatus();
  const toast = useToast();
  const household = useHousehold(householdId);
  const bills = useBills(householdId);
  const createHousehold = useCreateHouseholdBill(householdId);
  const createPersonal = useCreatePersonalBill(householdId);
  const payBill = usePayBill(householdId);
  const skipBill = useSkipBill(householdId);

  const [isAdding, setIsAdding] = useState(false);
  const [payingId, setPayingId] = useState<string>();
  const [skipping, setSkipping] = useState<Bill>();

  const offlineReason = isOnline ? undefined : OFFLINE_ACTION_REASON;

  const handleCreate = (draft: BillDraft, visibility: BillVisibility): void => {
    const mutation = visibility === 'personal' ? createPersonal : createHousehold;
    mutation.mutate(draft, {
      onSuccess: (bill) => {
        setIsAdding(false);
        toast({ variant: 'success', message: `Added ${bill.name}.` });
      },
      onError: (error) => {
        toast({
          variant: 'error',
          message: userMessage(error, { fallback: "Couldn't add that bill. Try again." }),
        });
      },
    });
  };

  const handlePay = (bill: Bill): void => {
    setPayingId(bill.id);
    payBill.mutate(
      { billId: bill.id },
      {
        onSettled: () => {
          setPayingId(undefined);
        },
        onSuccess: () => {
          toast({ variant: 'success', message: `Marked ${bill.name} paid.` });
        },
        onError: (error) => {
          toast({
            variant: 'error',
            message: userMessage(error, {
              fallback: `Couldn't mark ${bill.name} paid. Try again.`,
            }),
          });
        },
      },
    );
  };

  const confirmSkip = (): void => {
    if (skipping === undefined) return;
    const { id, name } = skipping;
    skipBill.mutate(id, {
      onSuccess: () => {
        setSkipping(undefined);
        toast({ variant: 'success', message: `Skipped ${name}.` });
      },
      onError: (error) => {
        setSkipping(undefined);
        toast({
          variant: 'error',
          message: userMessage(error, { fallback: `Couldn't skip ${name}. Try again.` }),
        });
      },
    });
  };

  function body(): ReactElement {
    if (bills.isPending && bills.fetchStatus === 'paused') {
      return (
        <OfflineState message="Your bills sync when you reconnect. What you have already opened stays readable." />
      );
    }
    if (bills.isPending) return <SkeletonRows label="Loading your bills" />;
    if (bills.isError && bills.data === undefined) {
      return (
        <ErrorState
          message="Couldn't load your bills. Try again."
          onRetry={() => {
            void bills.refetch();
          }}
        />
      );
    }

    const data = bills.data;
    if (data.length === 0) {
      return (
        <EmptyState
          icon={Receipt}
          message={BILLS_LIST_EMPTY_COPY}
          action={{
            label: 'Add a bill',
            onAction: () => {
              setIsAdding(true);
            },
          }}
        />
      );
    }

    // "This week" runs to the household's Saturday, so the groups wait for the household's zone.
    const timezone = household.data?.timezone;
    if (timezone === undefined) return householdFallback(household, 'Loading your bills');
    const today = todayInTimezone(timezone);
    const weekEnd = addDays(weekStart(today), 6);
    const { overdue, thisWeek, later } = groupBills(data, weekEnd);

    const renderGroup = (title: string, group: Bill[]): ReactElement | null => {
      if (group.length === 0) return null;
      const headingId = `bill-group-${title.toLowerCase().replace(/\s+/g, '-')}`;
      return (
        <section key={title} aria-labelledby={headingId} className="flex flex-col gap-2">
          <h2 id={headingId} className="text-h3 text-primary">
            {title}
          </h2>
          <ul className="flex flex-col rounded-md border border-border">
            {group.map((bill) => (
              <BillRow
                key={bill.id}
                bill={bill}
                isPaying={payingId === bill.id}
                offlineReason={offlineReason}
                onPay={() => {
                  handlePay(bill);
                }}
                onSkip={() => {
                  setSkipping(bill);
                }}
              />
            ))}
          </ul>
        </section>
      );
    };

    return (
      <div className="flex flex-col gap-4">
        {renderGroup('Overdue', overdue)}
        {renderGroup('This week', thisWeek)}
        {renderGroup('Later', later)}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          disabledReason={offlineReason}
          onClick={() => {
            setIsAdding(true);
          }}
        >
          Add a bill
        </Button>
      </div>

      {bills.isError && bills.data !== undefined && (
        <StaleNotice
          updatedAt={bills.dataUpdatedAt}
          onRetry={() => {
            void bills.refetch();
          }}
        />
      )}

      {body()}

      {isAdding && (
        <BillForm
          open
          onOpenChange={setIsAdding}
          isSaving={createHousehold.isPending || createPersonal.isPending}
          onSubmit={handleCreate}
        />
      )}

      <ConfirmDialog
        open={skipping !== undefined}
        onOpenChange={(open) => {
          if (!open) setSkipping(undefined);
        }}
        title="Skip this bill?"
        description={skipping === undefined ? '' : skipBillConfirmation(skipping)}
        confirmLabel="Skip bill"
        isConfirming={skipBill.isPending}
        onConfirm={confirmSkip}
      />
    </section>
  );
}
