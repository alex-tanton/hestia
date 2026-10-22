import { ListChecks, Plus } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import type { Errand } from '@hearth/shared';
import { householdFallback } from '../../components/chores/household-date-fallback.tsx';
import { ErrandRow } from '../../components/errands/ErrandRow.tsx';
import { ErrandSheet } from '../../components/errands/ErrandSheet.tsx';
import {
  ERRANDS_ALL_DONE_COPY,
  ERRANDS_EMPTY_COPY,
  OFFLINE_ACTION_REASON,
  deleteErrandConfirmation,
} from '../../components/chores/chore-copy.ts';
import { EmptyState, ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { useQueryClient } from '@tanstack/react-query';
import { useDeleteErrand, useErrands, useUpdateErrand } from '../../lib/api/chore-hooks.ts';
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

/** A flat list, open first, done collapsed below with who and when. */
export function ErrandsListScreen({ householdId }: ErrandsListScreenProps): ReactElement {
  const isOnline = useOnlineStatus();
  const toast = useToast();
  const household = useHousehold(householdId);
  const timezone = household.data?.timezone;

  const queryClient = useQueryClient();
  const errands = useErrands(householdId);
  const members = useMembers(householdId);
  const updateErrand = useUpdateErrand(householdId);
  const deleteErrand = useDeleteErrand(householdId);
  const pendingDones = usePendingErrandDones();

  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<Errand>();
  const [deleting, setDeleting] = useState<Errand>();

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

  const confirmDelete = (): void => {
    if (deleting === undefined) return;
    deleteErrand.mutate(deleting.id, {
      onSuccess: () => {
        toast({ variant: 'success', message: `Deleted ${deleting.name}.` });
        setDeleting(undefined);
      },
      onError: (error) => {
        setDeleting(undefined);
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
          icon={ListChecks}
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

    const open = data.filter((errand) => errand.status === 'open');
    const done = data.filter((errand) => errand.status === 'done');

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
        menuItems={[
          {
            label: 'Delete',
            isDestructive: true,
            disabledReason: offlineReason,
            onSelect: () => {
              setDeleting(errand);
            },
          },
        ]}
      />
    );

    return (
      <div className="flex flex-col gap-4">
        {open.length === 0 ? (
          <p className="px-4 text-body-sm text-secondary">{ERRANDS_ALL_DONE_COPY}</p>
        ) : (
          <ul className="flex flex-col rounded-md border border-border bg-base">
            {open.map(rowFor)}
          </ul>
        )}
        {done.length > 0 && (
          <details className="rounded-md border border-border bg-base">
            <summary className="min-h-11 cursor-pointer px-4 py-2.5 text-body-sm text-secondary select-none">
              {done.length} completed
            </summary>
            <ul className="flex flex-col border-t border-border">{done.map(rowFor)}</ul>
          </details>
        )}
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
          <Plus aria-hidden size={20} strokeWidth={1.5} />
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

      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined);
        }}
        title="Delete this errand?"
        description={deleting ? deleteErrandConfirmation(deleting) : ''}
        confirmLabel="Delete errand"
        isConfirming={deleteErrand.isPending}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
