import { Pencil } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { CompletionHistory } from '../../components/chores/CompletionHistory.tsx';
import { householdFallback } from '../../components/chores/household-date-fallback.tsx';
import {
  OFFLINE_ACTION_REASON,
  describeRecurrence,
  memberName,
} from '../../components/chores/chore-copy.ts';
import { useChoreCompletion } from '../../components/chores/use-chore-completion.ts';
import { useScreenChrome } from '../../components/shell/screen-chrome.tsx';
import { ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { OverflowMenu } from '../../components/ui/OverflowMenu.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { useChoreDetail, useDeleteChoreCompletion } from '../../lib/api/chore-hooks.ts';
import { useHousehold, useMembers } from '../../lib/api/hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { formatCalendarDate } from '../../lib/format.ts';
import { todayInTimezone } from '../../lib/household-date.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';

export interface ChoreDetailScreenProps {
  householdId: string;
  choreId: string;
}

/**
 * Design › "17. Chores" › Chore detail: recurrence summary, the next three dates, rotation order,
 * and completion history. Completing shows the toast ("Take out trash done. Sam is next.") with
 * Undo for 5 seconds; Undo deletes the fresh completion, which reverts the rotation and next-due
 * display once the query refetches.
 */
export function ChoreDetailScreen({ householdId, choreId }: ChoreDetailScreenProps): ReactElement {
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const toast = useToast();
  const household = useHousehold(householdId);
  const timezone = household.data?.timezone;

  const chore = useChoreDetail(householdId, choreId);
  const members = useMembers(householdId);
  const memberList = members.data ?? [];
  const { completeChore, pendingChoreIds, completeReason } = useChoreCompletion(
    householdId,
    memberList,
  );
  const deleteCompletion = useDeleteChoreCompletion(householdId);

  const offlineReason = isOnline ? undefined : OFFLINE_ACTION_REASON;

  useScreenChrome({ title: chore.data?.name ?? 'Chore', backTo: '/chores', backLabel: 'Chores' });

  if (chore.isPending && chore.fetchStatus === 'paused') {
    return (
      <OfflineState message="This chore syncs when you reconnect. What you have already opened stays readable." />
    );
  }
  if (chore.isPending) return <SkeletonRows label="Loading this chore" />;
  if (chore.isError && chore.data === undefined) {
    return (
      <ErrorState
        message="Couldn't load this chore. Try again."
        onRetry={() => {
          void chore.refetch();
        }}
        alternative={{ label: 'Back to chores', onAction: () => void navigate('/chores') }}
      />
    );
  }
  if (members.data === undefined) {
    if (members.isError) {
      return (
        <ErrorState
          message="Couldn't load the household members. Try again."
          onRetry={() => {
            void members.refetch();
          }}
        />
      );
    }
    return <SkeletonRows label="Loading this chore" />;
  }

  // Due dates and the last-completed day are household dates, so nothing renders before the zone.
  if (timezone === undefined) return householdFallback(household, 'Loading this chore');
  const today = todayInTimezone(timezone);
  const data = chore.data;

  const handleDeleteCompletion = (completionId: string): void => {
    deleteCompletion.mutate(
      { choreId, completionId },
      {
        onError: (error) => {
          toast({
            variant: 'error',
            message: userMessage(error, {
              fallback: "Couldn't delete that completion. Try again.",
            }),
          });
        },
      },
    );
  };

  return (
    <section className="flex flex-col gap-4">
      {chore.isError && (
        <StaleNotice
          updatedAt={chore.dataUpdatedAt}
          onRetry={() => {
            void chore.refetch();
          }}
        />
      )}

      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1 text-primary">{data.name}</h1>
          <p className="text-body-sm text-secondary">
            {describeRecurrence(data.recurrenceUnit, data.interval)}
          </p>
        </div>
        <OverflowMenu
          label={`More actions for ${data.name}`}
          items={[
            {
              label: 'Edit',
              icon: <Pencil aria-hidden size={20} strokeWidth={1.5} />,
              disabledReason: offlineReason,
              onSelect: () => {
                void navigate(`/chores/${choreId}/edit`);
              },
            },
          ]}
        />
      </header>

      <Button
        isLoading={pendingChoreIds.has(choreId)}
        disabledReason={completeReason}
        onClick={() => {
          completeChore(data);
        }}
      >
        Mark done
      </Button>

      <section aria-labelledby="next-dates-heading" className="flex flex-col gap-1">
        <h2 id="next-dates-heading" className="text-h2 text-primary">
          Next three dates
        </h2>
        <ul className="text-body text-primary">
          {data.previewDates.map((date) => (
            <li key={date}>{formatCalendarDate(date)}</li>
          ))}
        </ul>
      </section>

      {data.rotationOrder !== null && (
        <section aria-labelledby="rotation-heading" className="flex flex-col gap-1">
          <h2 id="rotation-heading" className="text-h2 text-primary">
            Rotation order
          </h2>
          <ol className="flex flex-col gap-1">
            {data.rotationOrder.map((userId, index) => {
              const label = memberName(memberList, userId);
              const isCurrent = userId === data.currentTurn;
              const isNext = userId === data.nextTurn;
              return (
                <li key={`${userId}-${String(index)}`} className="text-body text-primary">
                  {`${String(index + 1)}. ${label}`}
                  {isCurrent && (
                    <span className="text-body-sm text-secondary"> · current turn</span>
                  )}
                  {!isCurrent && isNext && (
                    <span className="text-body-sm text-secondary"> · next</span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <CompletionHistory
        completions={data.completions}
        members={memberList}
        today={today}
        timezone={timezone}
        isDeleting={deleteCompletion.isPending}
        disabledReason={offlineReason}
        onDeleteCompletion={handleDeleteCompletion}
      />
    </section>
  );
}
