import { useId, useState, type ReactElement } from 'react';
import type { Errand } from '@hestia/shared';
import { householdFallback } from '../../components/chores/household-date-fallback.tsx';
import { ErrandRow } from '../../components/errands/ErrandRow.tsx';
import { ErrandSheet } from '../../components/errands/ErrandSheet.tsx';
import {
  ERRANDS_ALL_DONE_COPY,
  ERRANDS_EMPTY_COPY,
  OFFLINE_ACTION_REASON,
  parseErrandStore,
} from '../../components/chores/chore-copy.ts';
import { EmptyState, ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { MdFab } from '../../components/md/MdFab.tsx';
import { MdFilterChip } from '../../components/md/MdFilterChip.tsx';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateErrand,
  useDeleteErrand,
  useErrands,
  useUpdateErrand,
} from '../../lib/api/chore-hooks.ts';
import { useHousehold, useMembers } from '../../lib/api/hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import {
  queueErrandDone,
  queueableWriteReason,
  usePendingErrandDones,
} from '../../lib/offline/chore-errand-writes.ts';
import { todayInTimezone } from '../../lib/household-date.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';

export interface ErrandsListScreenProps {
  householdId: string;
}

/**
 * A flat list of errands with store filter chips, direct trailing deletion with persistent Undo,
 * floating MdFab for creation, and a collapsible Completed section matching the grocery list pattern.
 */
export function ErrandsListScreen({ householdId }: ErrandsListScreenProps): ReactElement {
  const isOnline = useOnlineStatus();
  const toast = useToast();
  const household = useHousehold(householdId);
  const timezone = household.data?.timezone;

  const queryClient = useQueryClient();
  const errands = useErrands(householdId);
  const members = useMembers(householdId);
  const createErrand = useCreateErrand(householdId);
  const updateErrand = useUpdateErrand(householdId);
  const deleteErrand = useDeleteErrand(householdId);
  const pendingDones = usePendingErrandDones();

  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<Errand>();
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const completedPanelId = useId();

  const offlineReason = isOnline ? undefined : OFFLINE_ACTION_REASON;
  // Marking done is queueable and needs the household's cached timezone offline; reopening is not
  // queueable, so it is online-only.
  const doneReason = queueableWriteReason(
    isOnline,
    household.data !== undefined,
    OFFLINE_ACTION_REASON,
  );
  const memberList = members.data ?? [];

  const toggleDone = (errand: Errand, isDone: boolean): void => {
    if (isDone) {
      // Sent with the moment it was done, so an offline completion keeps its time.
      void queueErrandDone(queryClient, {
        kind: 'done',
        householdId,
        errandId: errand.id,
        doneAt: new Date().toISOString(),
      });
      return;
    }
    updateErrand.mutate(
      { errandId: errand.id, body: { status: 'open' } },
      {
        onError: (error) => {
          toast({
            variant: 'error',
            message: userMessage(error, { fallback: "Couldn't update that errand. Try again." }),
          });
        },
      },
    );
  };

  const handleDelete = (errand: Errand): void => {
    deleteErrand.mutate(errand.id, {
      onSuccess: () => {
        toast({
          variant: 'success',
          message: `Removed ${errand.name}`,
          action: {
            label: 'Undo',
            onAction: () => {
              createErrand.mutate({
                id: errand.id,
                name: errand.name,
                dueDate: errand.dueDate,
                assignedTo: errand.assignedTo,
              });
            },
          },
        });
      },
      onError: (error) => {
        toast({
          variant: 'error',
          message: userMessage(error, { fallback: "Couldn't delete that errand. Try again." }),
        });
      },
    });
  };

  function body(): ReactElement {
    // Due dates and the overdue count are household dates, so nothing renders before the zone.
    if (timezone === undefined) return householdFallback(household, 'Loading errands');
    const today = todayInTimezone(timezone);
    if (errands.isPending && errands.fetchStatus === 'paused') {
      return (
        <OfflineState message="Errands sync when you reconnect. What you have already opened stays readable." />
      );
    }
    if (errands.isPending) return <SkeletonRows label="Loading errands" />;
    if (errands.isError && errands.data === undefined) {
      return (
        <ErrorState
          message="Couldn't load errands. Try again."
          onRetry={() => {
            void errands.refetch();
          }}
        />
      );
    }
    // Rows name their assignee and completer from the roster, so it must be in first.
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
      return <SkeletonRows label="Loading errands" />;
    }

    const data = errands.data;
    if (data.length === 0) {
      return (
        <EmptyState
          icon="checklist"
          message={ERRANDS_EMPTY_COPY}
          action={{
            label: 'Add an errand',
            onAction: () => {
              setIsAdding(true);
            },
          }}
        />
      );
    }

    const uniqueStores = Array.from(
      new Set(
        data
          .map((item) => parseErrandStore(item.name).store)
          .filter((s): s is string => s !== undefined && s.length > 0),
      ),
    ).sort();

    const open = data.filter((errand) => errand.status === 'open');
    const done = data.filter((errand) => errand.status === 'done');

    const filteredOpen = open.filter((errand) => {
      if (selectedStore === null) return true;
      return parseErrandStore(errand.name).store === selectedStore;
    });

    const filteredDone = done.filter((errand) => {
      if (selectedStore === null) return true;
      return parseErrandStore(errand.name).store === selectedStore;
    });

    const filterChips =
      uniqueStores.length > 0 ? (
        <div
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
          role="toolbar"
          aria-label="Filter errands by store"
        >
          <MdFilterChip
            selected={selectedStore === null}
            onClick={() => {
              setSelectedStore(null);
            }}
          >
            All
          </MdFilterChip>
          {uniqueStores.map((store) => (
            <MdFilterChip
              key={store}
              selected={selectedStore === store}
              onClick={() => {
                setSelectedStore((prev) => (prev === store ? null : store));
              }}
            >
              {store}
            </MdFilterChip>
          ))}
        </div>
      ) : null;

    const rowFor = (errand: Errand): ReactElement => (
      <ErrandRow
        key={errand.id}
        errand={errand}
        members={memberList}
        today={today}
        timezone={timezone}
        isPending={
          pendingDones.has(errand.id) ||
          (updateErrand.isPending && updateErrand.variables.errandId === errand.id)
        }
        isQueuedDone={pendingDones.has(errand.id)}
        disabledReason={errand.status === 'done' ? offlineReason : doneReason}
        onToggleDone={(isDone) => {
          toggleDone(errand, isDone);
        }}
        onSelect={() => {
          setEditing(errand);
        }}
        onDelete={() => {
          handleDelete(errand);
        }}
      />
    );

    return (
      <div className="flex flex-col gap-4">
        {filterChips}
        {filteredOpen.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <h3 className="text-title-md font-semibold text-[var(--md-sys-color-on-surface)]">
              Everything is done
            </h3>
            <p className="text-body-sm text-[var(--md-sys-color-on-surface-variant)] mt-1">
              {ERRANDS_ALL_DONE_COPY}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)]">
            {filteredOpen.map(rowFor)}
          </ul>
        )}
        {filteredDone.length > 0 && (
          <div className="rounded-2xl bg-[var(--md-sys-color-surface-container-low)]">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <button
                type="button"
                aria-expanded={isCompletedOpen}
                aria-controls={completedPanelId}
                className="flex min-h-11 flex-1 items-center gap-2 text-title-sm font-semibold text-[var(--md-sys-color-on-surface-variant)]"
                onClick={() => {
                  setIsCompletedOpen((open) => !open);
                }}
              >
                <Icon name={isCompletedOpen ? 'expand_more' : 'chevron_right'} size={20} />
                <span>{`Completed (${String(filteredDone.length)})`}</span>
                <span className="sr-only">completed</span>
              </button>
            </div>
            <ul
              id={completedPanelId}
              hidden={!isCompletedOpen}
              className="flex flex-col border-t border-[var(--md-sys-color-outline-variant)]"
            >
              {filteredDone.map(rowFor)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4 pb-20">
      <div className="flex justify-end">
        <Button
          disabledReason={offlineReason}
          onClick={() => {
            setIsAdding(true);
          }}
        >
          <Icon name="add" size={20} />
          Add an errand
        </Button>
      </div>

      {errands.isError && errands.data !== undefined && (
        <StaleNotice
          updatedAt={errands.dataUpdatedAt}
          onRetry={() => {
            void errands.refetch();
          }}
        />
      )}

      {body()}

      {isAdding && (
        <ErrandSheet
          householdId={householdId}
          members={memberList}
          disabledReason={offlineReason}
          onOpenChange={setIsAdding}
          onSaved={(saved) => {
            toast({ variant: 'success', message: `Added ${saved.name}.` });
          }}
        />
      )}

      {editing !== undefined && (
        <ErrandSheet
          householdId={householdId}
          members={memberList}
          errand={editing}
          disabledReason={offlineReason}
          onOpenChange={(open) => {
            if (!open) setEditing(undefined);
          }}
          onSaved={(saved) => {
            setEditing(undefined);
            toast({ variant: 'success', message: `Saved ${saved.name}.` });
          }}
        />
      )}

      <div className="fixed bottom-6 right-6 z-20">
        <MdFab
          aria-label="Add errand"
          onClick={() => {
            if (isOnline) {
              setIsAdding(true);
            }
          }}
        >
          <span slot="icon">
            <Icon name="add" size={24} />
          </span>
        </MdFab>
      </div>
    </section>
  );
}
