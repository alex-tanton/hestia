import { CreditCard } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import type { Subscription } from '@hestia/shared';
import { SubscriptionRow } from '../../components/bills/SubscriptionRow.tsx';
import {
  OFFLINE_ACTION_REASON,
  SUBSCRIPTIONS_EMPTY_COPY,
} from '../../components/bills/bills-copy.ts';
import { EmptyState, ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import {
  useArchiveBill,
  useConfirmBillUsage,
  useSubscriptions,
} from '../../lib/api/bills-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { formatCents } from '../../lib/format.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';

export interface SubscriptionsScreenProps {
  householdId: string;
}

/**
 * The total monthly figure, then every subscription sorted by monthly cost
 * descending, each with its annualized figure. Every money figure here comes straight from the
 * API's normalized response (the client never does money arithmetic) — the
 * screen only formats and orders what it's given, and the service has already sorted it.
 */
export function SubscriptionsScreen({ householdId }: SubscriptionsScreenProps): ReactElement {
  const isOnline = useOnlineStatus();
  const toast = useToast();
  const subscriptions = useSubscriptions(householdId);
  const confirmUsage = useConfirmBillUsage(householdId);
  const archiveBill = useArchiveBill(householdId);

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

      <p className="flex items-baseline justify-between rounded-md border border-border px-4 py-3">
        <span className="text-body text-secondary">Total per month</span>
        <span className="text-h2 text-primary tabular-nums">
          {formatCents(data.totalMonthlyCents)}
        </span>
      </p>

      {data.subscriptions.length === 0 ? (
        <EmptyState icon={CreditCard} message={SUBSCRIPTIONS_EMPTY_COPY} />
      ) : (
        <ul className="flex flex-col rounded-md border border-border">
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
    </section>
  );
}
