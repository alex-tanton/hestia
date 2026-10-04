import type { Member } from '@hearth/shared';
import { useCompleteChore, useDeleteChoreCompletion } from '../../lib/api/chore-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { useToast } from '../ui/Toast.tsx';
import { completionToastMessage, memberName } from './chore-copy.ts';

export interface CompletableChore {
  id: string;
  name: string;
}

/**
 * Completing a chore from its row or its detail (Design › "17. Chores": "Completing closes the
 * current occurrence … The completion toast … offers Undo for 5 seconds; undoing deletes the
 * completion"). Both entry points share this, so the toast wording and the Undo window are the
 * same wherever a member completes a chore. `members` must be loaded: a turn's name is looked up
 * in it, and an unloaded roster would name every member "Former member".
 */
export function useChoreCompletion(
  householdId: string,
  members: readonly Member[],
): {
  completeChore: (chore: CompletableChore) => void;
  pendingChoreId: string | undefined;
} {
  const toast = useToast();
  const complete = useCompleteChore(householdId);
  const undo = useDeleteChoreCompletion(householdId);

  const undoCompletion = (choreId: string, completionId: string): void => {
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

  const completeChore = (chore: CompletableChore): void => {
    complete.mutate(
      { choreId: chore.id },
      {
        onSuccess: (updated) => {
          const nextTurnName =
            updated.currentTurn === null ? undefined : memberName(members, updated.currentTurn);
          const completionId = updated.lastCompletion?.id;
          toast({
            variant: 'success',
            message: completionToastMessage(updated.name, nextTurnName),
            ...(completionId === undefined
              ? {}
              : {
                  action: {
                    label: 'Undo',
                    onAction: () => {
                      undoCompletion(chore.id, completionId);
                    },
                  },
                }),
          });
        },
        onError: (error) => {
          toast({
            variant: 'error',
            message: userMessage(error, { fallback: "Couldn't complete this chore. Try again." }),
          });
        },
      },
    );
  };

  return {
    completeChore,
    pendingChoreId: complete.isPending ? complete.variables.choreId : undefined,
  };
}
