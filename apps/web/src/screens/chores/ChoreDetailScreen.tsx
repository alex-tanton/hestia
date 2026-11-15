import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { CompletionHistory } from '../../components/chores/CompletionHistory.tsx';
import { householdFallback } from '../../components/chores/household-date-fallback.tsx';
import {
  OFFLINE_ACTION_REASON,
  deleteChoreConfirmation,
  describeRecurrence,
  memberName,
} from '../../components/chores/chore-copy.ts';
import { useChoreCompletion } from '../../components/chores/use-chore-completion.ts';
import { useScreenChrome } from '../../components/shell/screen-chrome.tsx';
import { ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { OverflowMenu } from '../../components/ui/OverflowMenu.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import {
  useChoreDetail,
  useDeleteChore,
  useDeleteChoreCompletion,
} from '../../lib/api/chore-hooks.ts';
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
 * Chore detail: single <h1> in Top App Bar, tonal summary card, direct Edit action,
 * overflow menu for destructive deletion, and completion history with direct delete
 * and persistent Undo feedback (CHOR-01).
 */
export function ChoreDetailScreen({ householdId, choreId }: ChoreDetailScreenProps): ReactElement {
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const toast = useToast();
  const household = useHousehold(householdId);
  const timezone = household.data?.timezone;

  const chore = useChoreDetail(householdId, choreId);
  const deleteChore = useDeleteChore(householdId);
  const members = useMembers(householdId);
  const memberList = members.data ?? [];
  const { completeChore, pendingChoreIds, completeReason } = useChoreCompletion(
    householdId,
    memberList,
  );
  const deleteCompletion = useDeleteChoreCompletion(householdId);

  const [isDeletingChore, setIsDeletingChore] = useState(false);

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
        onSuccess: () => {
          toast({
            variant: 'success',
            message: 'Removed completion',
            action: {
              label: 'Undo',
              onAction: () => {
                completeChore(data);
              },
            },
          });
        },
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

  const confirmDeleteChore = (): void => {
    deleteChore.mutate(choreId, {
      onSuccess: () => {
        setIsDeletingChore(false);
        toast({ variant: 'success', message: `Deleted ${data.name}.` });
        void navigate('/chores');
      },
      onError: (error) => {
        setIsDeletingChore(false);
        toast({
          variant: 'error',
          message: userMessage(error, { fallback: `Couldn't delete ${data.name}. Try again.` }),
        });
      },
    });
  };

  const currentAssigneeName =
    data.rotationOrder !== null
      ? memberName(memberList, data.currentTurn)
      : data.assignedTo !== null
        ? memberName(memberList, data.assignedTo)
        : 'Unassigned';

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

      {/* Tonal Summary Card per CHOR-01 */}
      <Card
        variant="flat"
        className="p-4 flex flex-col gap-3 rounded-2xl bg-[var(--md-sys-color-surface-container-low)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-title-lg font-semibold text-[var(--md-sys-color-on-surface)]">
                {data.name}
              </h2>
              {data.isOverdue && <Badge variant="danger">Overdue</Badge>}
            </div>
            <p className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
              {describeRecurrence(data.recurrenceUnit, data.interval)}
            </p>
            <p className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
              {data.rotationOrder !== null ? `${currentAssigneeName}'s turn` : currentAssigneeName}
              {' · '}
              {`Due ${formatCalendarDate(data.dueDate)}`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              disabledReason={offlineReason}
              onClick={() => {
                void navigate(`/chores/${choreId}/edit`);
              }}
              aria-label="Edit chore"
            >
              <Icon name="edit" size={20} />
              Edit chore
            </Button>
            <OverflowMenu
              label={`More actions for ${data.name}`}
              items={[
                {
                  label: 'Delete',
                  icon: <Icon name="delete" size={20} />,
                  isDestructive: true,
                  disabledReason: offlineReason,
                  onSelect: () => {
                    setIsDeletingChore(true);
                  },
                },
              ]}
            />
          </div>
        </div>
      </Card>

      <Button
        isLoading={pendingChoreIds.has(choreId)}
        disabledReason={completeReason}
        onClick={() => {
          completeChore(data);
        }}
      >
        Mark done
      </Button>

      <section aria-labelledby="next-dates-heading" className="flex flex-col gap-2">
        <h2
          id="next-dates-heading"
          className="text-title-md font-semibold text-[var(--md-sys-color-on-surface)]"
        >
          Next three dates
        </h2>
        <ul className="text-body-sm text-[var(--md-sys-color-on-surface-variant)] flex flex-col gap-1 pl-4 list-disc">
          {data.previewDates.map((date) => (
            <li key={date}>{formatCalendarDate(date)}</li>
          ))}
        </ul>
      </section>

      {data.rotationOrder !== null && (
        <section aria-labelledby="rotation-heading" className="flex flex-col gap-2">
          <h2
            id="rotation-heading"
            className="text-title-md font-semibold text-[var(--md-sys-color-on-surface)]"
          >
            Rotation order
          </h2>
          <ol className="flex flex-col gap-1 text-body-sm text-[var(--md-sys-color-on-surface)]">
            {data.rotationOrder.map((userId, index) => {
              const label = memberName(memberList, userId);
              const isCurrent = userId === data.currentTurn;
              const isNext = userId === data.nextTurn;
              return (
                <li key={`${userId}-${String(index)}`}>
                  <span className="font-medium">{`${String(index + 1)}. ${label}`}</span>
                  {isCurrent && (
                    <span className="text-[var(--md-sys-color-on-surface-variant)]">
                      {' '}
                      · current turn
                    </span>
                  )}
                  {!isCurrent && isNext && (
                    <span className="text-[var(--md-sys-color-on-surface-variant)]"> · next</span>
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

      <ConfirmDialog
        open={isDeletingChore}
        onOpenChange={setIsDeletingChore}
        title="Delete chore?"
        description={deleteChoreConfirmation(data)}
        confirmLabel="Delete chore"
        isConfirming={deleteChore.isPending}
        onConfirm={confirmDeleteChore}
      />
    </section>
  );
}
