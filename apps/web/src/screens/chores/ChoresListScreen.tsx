import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { ChoreListRow } from '../../components/chores/ChoreListRow.tsx';
import { householdFallback } from '../../components/chores/household-date-fallback.tsx';
import {
  CHORES_EMPTY_COPY,
  CHORE_GROUP_LABELS,
  CHORE_GROUP_ORDER,
  OFFLINE_ACTION_REASON,
  groupChores,
} from '../../components/chores/chore-copy.ts';
import { useChoreCompletion } from '../../components/chores/use-chore-completion.ts';
import { MdFab } from '../../components/md/MdFab.tsx';
import { EmptyState, ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useChores } from '../../lib/api/chore-hooks.ts';
import { useHousehold, useMembers } from '../../lib/api/hooks.ts';
import { todayInTimezone } from '../../lib/household-date.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';

export interface ChoresListScreenProps {
  householdId: string;
}

/** Grouped by Overdue, Today, This week, Later; the primary action adds a chore. */
export function ChoresListScreen({ householdId }: ChoresListScreenProps): ReactElement {
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const household = useHousehold(householdId);
  const timezone = household.data?.timezone;

  const chores = useChores(householdId);
  const members = useMembers(householdId);
  const memberList = members.data ?? [];
  const { completeChore, pendingChoreIds, completeReason } = useChoreCompletion(
    householdId,
    memberList,
  );
  const offlineReason = isOnline ? undefined : OFFLINE_ACTION_REASON;

  const addButton = (
    <Button
      disabledReason={offlineReason}
      onClick={() => {
        void navigate('/chores/new');
      }}
    >
      <Icon name="add" size={20} />
      Add a chore
    </Button>
  );

  function body(): ReactElement {
    // Groups and due labels are dated in the household's timezone, so nothing renders before it.
    if (timezone === undefined) return householdFallback(household, 'Loading chores');
    const today = todayInTimezone(timezone);
    if (chores.isPending && chores.fetchStatus === 'paused') {
      return (
        <OfflineState message="Chores sync when you reconnect. What you have already opened stays readable." />
      );
    }
    if (chores.isPending) return <SkeletonRows label="Loading chores" />;
    if (chores.isError && chores.data === undefined) {
      return (
        <ErrorState
          message="Couldn't load chores. Try again."
          onRetry={() => {
            void chores.refetch();
          }}
        />
      );
    }

    // A row names its assignee and turn from the roster, so the roster must be in before any row
    // is drawn; otherwise every member would read "Former member" for a moment.
    if (members.data === undefined) {
      if (members.isPending && members.fetchStatus === 'paused') {
        return (
          <OfflineState message="Chores sync when you reconnect. What you have already opened stays readable." />
        );
      }
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
      return <SkeletonRows label="Loading chores" />;
    }

    const data = chores.data;
    if (data.length === 0) {
      return (
        <EmptyState
          icon="checklist"
          heading="No chores yet"
          message={CHORES_EMPTY_COPY}
          action={{
            label: 'Add a chore',
            onAction: () => {
              void navigate('/chores/new');
            },
          }}
        />
      );
    }

    const groups = groupChores(data, today);

    return (
      <div className="flex flex-col gap-6">
        {CHORE_GROUP_ORDER.filter((key) => groups[key].length > 0).map((key) => (
          <section key={key} aria-labelledby={`chore-group-${key}`} className="flex flex-col gap-2">
            <h2
              id={`chore-group-${key}`}
              className="text-title-md font-semibold text-[var(--md-sys-color-on-surface)]"
            >
              {CHORE_GROUP_LABELS[key]}
            </h2>
            <ul className="flex flex-col divide-y divide-[var(--md-sys-color-outline-variant)]">
              {groups[key].map((chore) => (
                <ChoreListRow
                  key={chore.id}
                  chore={chore}
                  members={memberList}
                  today={today}
                  timezone={timezone}
                  onComplete={completeChore}
                  isPending={pendingChoreIds.has(chore.id)}
                  disabledReason={completeReason}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex justify-end">{addButton}</div>
      {chores.isError && chores.data !== undefined && (
        <StaleNotice
          updatedAt={chores.dataUpdatedAt}
          onRetry={() => {
            void chores.refetch();
          }}
        />
      )}
      {body()}

      {!offlineReason && (
        <div className="fixed right-6 bottom-6 z-20">
          <MdFab
            aria-label="Add chore"
            onClick={() => {
              void navigate('/chores/new');
            }}
          >
            <span slot="icon">
              <Icon name="add" size={24} />
            </span>
          </MdFab>
        </div>
      )}
    </section>
  );
}
