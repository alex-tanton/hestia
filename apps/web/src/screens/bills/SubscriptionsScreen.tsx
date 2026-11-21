import { useState, type ReactElement } from 'react';
import type { BillDraft } from '../../components/bills/BillForm.tsx';
import type { BillVisibility, Subscription } from '@hestia/shared';
import { BillForm } from '../../components/bills/BillForm.tsx';
import { SubscriptionRow } from '../../components/bills/SubscriptionRow.tsx';
import { OFFLINE_ACTION_REASON } from '../../components/bills/bills-copy.ts';
import { MdFab } from '../../components/md/MdFab.tsx';
import { EmptyState, ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import {
  useArchiveBill,
  useConfirmBillUsage,
  useCreateHouseholdBill,
  useCreatePersonalBill,
  useSubscriptions,
} from '../../lib/api/bills-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { formatCents } from '../../lib/format.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';

export interface SubscriptionsScreenProps {
  householdId: string;
}

/**
 * Subscriptions view featuring a 28px Display spend Hero Card ("Total per month", formatted monthly
 * spend across active services count) and a borderless list of subscriptions per BILL-01 and D-10.
 */
export function SubscriptionsScreen({ householdId }: SubscriptionsScreenProps): ReactElement {
  const isOnline = useOnlineStatus();
  const toast = useToast();
  const subscriptions = useSubscriptions(householdId);
  const confirmUsage = useConfirmBillUsage(householdId);
  const archiveBill = useArchiveBill(householdId);
  const createHousehold = useCreateHouseholdBill(householdId);
  const createPersonal = useCreatePersonalBill(householdId);

  const [isAdding, setIsAdding] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string>();
  const [stoppingId, setStoppingId] = useState<string>();

  const offlineReason = isOnline ? undefined : OFFLINE_ACTION_REASON;

  const handleStillUsing = (subscription: Subscription): void => {
    setConfirmingId(subscription.id);
    confirmUsage.mutate(subscription.id, {
      onSettled: () => {
        setConfirmingId(undefined);
      },
      onError: (error) => {
        toast({
          variant: 'error',
          message: userMessage(error, {
            fallback: `Couldn't update ${subscription.name}. Try again.`,
          }),
        });
      },
    });
  };

  const handleStopTracking = (subscription: Subscription): void => {
    setStoppingId(subscription.id);
    archiveBill.mutate(subscription.id, {
      onSettled: () => {
        setStoppingId(undefined);
      },
      onSuccess: () => {
        toast({ variant: 'success', message: `Stopped tracking ${subscription.name}.` });
      },
      onError: (error) => {
        toast({
          variant: 'error',
          message: userMessage(error, {
            fallback: `Couldn't stop tracking ${subscription.name}. Try again.`,
          }),
        });
      },
    });
  };

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
          message: userMessage(error, { fallback: "Couldn't add that subscription. Try again." }),
        });
      },
    });
  };

  if (subscriptions.isPending && subscriptions.fetchStatus === 'paused') {
    return (
      <OfflineState message="Subscriptions sync when you reconnect. What you have already opened stays readable." />
    );
  }
  if (subscriptions.isPending) return <SkeletonRows label="Loading subscriptions" />;
  if (subscriptions.isError && subscriptions.data === undefined) {
    return (
      <ErrorState
        message="Couldn't load subscriptions. Try again."
        onRetry={() => {
          void subscriptions.refetch();
        }}
      />
    );
  }

  const data = subscriptions.data;

  return (
    <section className="flex flex-col gap-4">
      {subscriptions.isError && (
        <StaleNotice
          updatedAt={subscriptions.dataUpdatedAt}
          onRetry={() => {
            void subscriptions.refetch();
          }}
        />
      )}

      {/* Hero Card with 28px Display spend per D-10 */}
      <Card
        variant="flat"
        className="p-4 flex flex-col gap-1 rounded-2xl bg-[var(--md-sys-color-surface-container-low)]"
      >
        <span className="text-label-md text-[var(--md-sys-color-on-surface-variant)]">
          Total per month
        </span>
        <span className="text-display-sm font-semibold text-[var(--md-sys-color-on-surface)] tabular-nums">
          {formatCents(data.totalMonthlyCents)}
        </span>
        <span className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
          {`across ${String(data.subscriptions.length)} active services`}
        </span>
      </Card>

      {data.subscriptions.length === 0 ? (
        <EmptyState
          icon="credit_card"
          heading="No subscriptions tracked yet"
          message="Keep track of recurring services and monthly spending in one simple view."
          action={{
            label: 'Add subscription',
            onAction: () => {
              setIsAdding(true);
            },
          }}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--md-sys-color-outline-variant)]">
          {data.subscriptions.map((subscription) => (
            <SubscriptionRow
              key={subscription.id}
              subscription={subscription}
              offlineReason={offlineReason}
              isConfirming={confirmingId === subscription.id}
              isStopping={stoppingId === subscription.id}
              onStillUsing={() => {
                handleStillUsing(subscription);
              }}
              onStopTracking={() => {
                handleStopTracking(subscription);
              }}
            />
          ))}
        </ul>
      )}

      {!offlineReason && data.subscriptions.length > 0 && (
        <div className="fixed right-6 bottom-6 z-20">
          <MdFab
            aria-label="Add subscription"
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
          initialIsSubscription={true}
          onSubmit={handleCreate}
        />
      )}
    </section>
  );
}
