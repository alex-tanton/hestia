import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { persistQueryClientSave } from '@tanstack/react-query-persist-client';
import type { Chore, Member } from '@hearth/shared';
import { useDeleteChoreCompletion } from '../../lib/api/chore-hooks.ts';
import { useHousehold } from '../../lib/api/hooks.ts';
import { useFlushPersister } from '../../lib/api/api-context.tsx';
import { userMessage } from '../../lib/api/problem.ts';
import {
  completedOccurrencesFor,
  offlineChoreOccurrence,
  queueableWriteReason,
  queueChoreCompletion,
  removeQueuedCompletion,
  usePendingChoreCompletions,
} from '../../lib/offline/chore-errand-writes.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { useToast } from '../ui/Toast.tsx';
import { OFFLINE_ACTION_REASON, completionToastMessage, memberName } from './chore-copy.ts';

/**
 * Completing a chore from its row or its detail (Design › "17. Chores": "Completing closes the
 * current occurrence … The completion toast … offers Undo for 5 seconds; undoing deletes the
 * completion"). Both entry points share this, so the toast wording and the Undo window are the
 * same wherever a member completes a chore. `members` must be loaded: a turn's name is looked up
 * in it, and an unloaded roster would name every member "Former member".
 *
 * Completion is a queueable write (Requirements, "Offline behavior"). Online it is sent at once and
 * the toast names who is next. Offline it is queued, the toast appears at once, and Undo removes
 * the queued write. Once sent, Undo is an online-only delete.
 */
export function useChoreCompletion(
  householdId: string,
  members: readonly Member[],
): {
  completeChore: (chore: Chore) => void;
  /** The chores with a completion waiting to sync. */
  pendingChoreIds: ReadonlySet<string>;
  /** Why completing is unavailable right now, or undefined when it is available. */
  completeReason: string | undefined;
} {
  const queryClient = useQueryClient();
  const toast = useToast();
  const isOnline = useOnlineStatus();
  const household = useHousehold(householdId);
  const flushPersister = useFlushPersister();
  const undo = useDeleteChoreCompletion(householdId);
  const pendingChoreIds = usePendingChoreCompletions();

  /*
   * Removing a queued write changes what should survive a reload, so the removal is flushed through
   * the unthrottled persister. Otherwise a restart inside the throttle window would replay it.
   */
  const flush = (): void => {
    if (flushPersister) void persistQueryClientSave({ queryClient, persister: flushPersister });
  };

  const undoCompletion = (choreId: string, completionId: string): void => {
    if (removeQueuedCompletion(queryClient, completionId)) {
      flush();
      return;
    }
    if (!onlineManager.isOnline()) {
      toast({ variant: 'error', message: OFFLINE_ACTION_REASON });
      return;
    }
    undo.mutate(
      { choreId, completionId },
      {
        onError: (error) => {
          toast({
            variant: 'error',
            message: userMessage(error, { fallback: "Couldn't undo that. Try again." }),
          });
        },
      },
    );
  };

  const undoAction = (choreId: string, completionId: string) => ({
    label: 'Undo',
    onAction: () => {
      undoCompletion(choreId, completionId);
    },
  });

  const completeChore = (chore: Chore): void => {
    // The id makes a replayed completion a no-op on the server (Handoff non-negotiable 9).
    const completionId = crypto.randomUUID();
    const doneAt = new Date().toISOString();

    if (!onlineManager.isOnline()) {
      // Offline, the occurrence is worked out here, in the household's timezone (PRD, "Timezone").
      // Without cached household data there is no timezone to work it out with, so it is refused.
      const timezone = household.data?.timezone;
      if (timezone === undefined) {
        toast({ variant: 'error', message: OFFLINE_ACTION_REASON });
        return;
      }
      const occurrenceDate = offlineChoreOccurrence(
        chore,
        completedOccurrencesFor(queryClient, householdId, chore),
        timezone,
        new Date(),
      );
      void queueChoreCompletion(queryClient, {
        kind: 'complete',
        householdId,
        choreId: chore.id,
        completionId,
        occurrenceDate,
        doneAt,
      });
      toast({
        variant: 'success',
        message: completionToastMessage(chore.name, undefined),
        action: undoAction(chore.id, completionId),
      });
      return;
    }

    void queueChoreCompletion(queryClient, {
      kind: 'complete',
      householdId,
      choreId: chore.id,
      completionId,
      doneAt,
    }).then((updated) => {
      // A failed completion is announced by the queue, once, so there is nothing to show here.
      if (updated === undefined) return;
      const nextTurnName =
        updated.currentTurn === null ? undefined : memberName(members, updated.currentTurn);
      toast({
        variant: 'success',
        message: completionToastMessage(updated.name, nextTurnName),
        action: undoAction(chore.id, completionId),
      });
    });
  };

  return {
    completeChore,
    pendingChoreIds,
    completeReason: queueableWriteReason(
      isOnline,
      household.data !== undefined,
      OFFLINE_ACTION_REASON,
    ),
  };
}
