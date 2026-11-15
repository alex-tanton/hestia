import { useState, type ReactElement } from 'react';
import type { Bill, BillVisibility } from '@hestia/shared';
import { BillForm, type BillDraft } from '../../components/bills/BillForm.tsx';
import { BillRow } from '../../components/bills/BillRow.tsx';
import { OFFLINE_ACTION_REASON } from '../../components/bills/bills-copy.ts';
import { MdFab } from '../../components/md/MdFab.tsx';
import { EmptyState, ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import {
  useBills,
  useCreateHouseholdBill,
  useCreatePersonalBill,
  useDeleteBillPayment,
  usePayBill,
} from '../../lib/api/bills-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';

export interface BillGroups {
  overdue: Bill[];
  upcoming: Bill[];
  inactive: Bill[];
}

/**
 * Group bills by urgency into Overdue, Upcoming, and Inactive per BILL-01.
 * Archived bills are sorted into Inactive; overdue active bills into Overdue;
 * remaining active bills into Upcoming.
 */
export function groupBills(bills: readonly Bill[]): BillGroups {
  const groups: BillGroups = { overdue: [], upcoming: [], inactive: [] };
  for (const bill of bills) {
    if (bill.archivedAt !== null) {
      groups.inactive.push(bill);
    } else if (bill.isOverdue) {
      groups.overdue.push(bill);
    } else {
      groups.upcoming.push(bill);
    }
  }
  return groups;
}

export interface BillsIndexScreenProps {
  householdId: string;
}

export function BillsIndexScreen({ householdId }: BillsIndexScreenProps): ReactElement {
  const isOnline = useOnlineStatus();
  const toast = useToast();
  const bills = useBills(householdId);
  const createHousehold = useCreateHouseholdBill(householdId);
  const createPersonal = useCreatePersonalBill(householdId);
  const payBill = usePayBill(householdId);
  const deletePayment = useDeleteBillPayment(householdId);

  const [isAdding, setIsAdding] = useState(false);
  const [payingId, setPayingId] = useState<string>();

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
        onSuccess: (payment) => {
          toast({
            variant: 'success',
            message: `Marked ${bill.name} as paid.`,
            action: {
              label: 'Undo',
              onAction: () => {
                deletePayment.mutate({ billId: bill.id, paymentId: payment.id });
              },
            },
          });
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
          icon="receipt_long"
          heading="No bills tracked yet"
          message="Hestia tracks what you owe and when. It never touches your bank account or pays bills automatically."
          action={{
            label: 'Add bill',
            onAction: () => {
              setIsAdding(true);
            },
          }}
        />
      );
    }

    const { overdue, upcoming, inactive } = groupBills(data);

    const renderGroup = (title: string, group: Bill[]): ReactElement | null => {
      if (group.length === 0) return null;
      const headingId = `bill-group-${title.toLowerCase().replace(/\s+/g, '-')}`;
      return (
        <section key={title} aria-labelledby={headingId} className="flex flex-col gap-2">
          <h2
            id={headingId}
            className="text-title-md font-semibold text-[var(--md-sys-color-on-surface)]"
          >
            {title}
          </h2>
          <ul className="flex flex-col divide-y divide-[var(--md-sys-color-outline-variant)]">
            {group.map((bill) => (
              <BillRow
                key={bill.id}
                bill={bill}
                isPaying={payingId === bill.id}
                offlineReason={offlineReason}
                onPay={() => {
                  handlePay(bill);
                }}
              />
            ))}
          </ul>
        </section>
      );
    };

    return (
      <div className="flex flex-col gap-6">
        {renderGroup('Overdue', overdue)}
        {renderGroup('Upcoming', upcoming)}
        {renderGroup('Inactive', inactive)}
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

      {!offlineReason && (
        <div className="fixed right-6 bottom-6 z-20">
          <MdFab
            aria-label="Add bill"
            onClick={() => {
              setIsAdding(true);
            }}
          >
            <span slot="icon">
              <Icon name="add" size={24} />
            </span>
          </MdFab>
        </div>
      )}

      {isAdding && (
        <BillForm
          open
          onOpenChange={setIsAdding}
          isSaving={createHousehold.isPending || createPersonal.isPending}
          onSubmit={handleCreate}
        />
      )}
    </section>
  );
}
