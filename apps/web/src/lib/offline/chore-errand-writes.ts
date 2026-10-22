import { useMutationState, type MutationKey, type QueryClient } from '@tanstack/react-query';
import { occurrenceToComplete, type Recurrence } from '@hearth/recurrence';
import {
  choreDetailSchema,
  errandSchema,
  type Chore,
  type ChoreDetail,
  type Errand,
} from '@hearth/shared';
import type { ApiClient } from '../api/client.ts';
import { queryKeys } from '../api/keys.ts';
import { todayInTimezone } from '../household-date.ts';
import { registerListWriteDefaults, LIST_WRITE_PREFIX, retryQueuedWrite } from './write-queue.ts';

/*
 * Queued chore completion and errand done. Like list writes, these are TanStack Query's paused
 * mutations: a default
 * `mutationFn` per prefix, so a paused write resumes after a reload, and a scope per chore or
 * errand, so writes to one run one at a time in the order they were made.
 *
 * Unlike a list, a chore's id varies per row, and a `useMutation` hook binds its key and scope once.
 * So each write is built through the mutation cache with its own key and scope.
 */

export const CHORE_WRITE_PREFIX = 'chore-write';
export const ERRAND_WRITE_PREFIX = 'errand-write';

export interface ChoreCompleteVariables {
  kind: 'complete';
  householdId: string;
  choreId: string;
  /** Client-generated; a replay with the same id is a no-op. */
  completionId: string;
  /**
   * The occurrence closed, computed on the client in the household timezone. Sent only for a
   * completion made offline: an online one lets the service compute its own answer, so a stale
   * cache cannot turn a live completion into a rejected one.
   */
  occurrenceDate?: string;
  /** When the member acted (ISO 8601), so a replayed completion keeps its action time. */
  doneAt: string;
}

export interface ErrandDoneVariables {
  kind: 'done';
  householdId: string;
  errandId: string;
  /** When the member acted (ISO 8601). */
  doneAt: string;
}

export function choreCompleteKey(choreId: string): MutationKey {
  return [CHORE_WRITE_PREFIX, choreId, 'complete'];
}

export function choreScope(choreId: string): { id: string } {
  return { id: `chore:${choreId}` };
}

export function errandDoneKey(errandId: string): MutationKey {
  return [ERRAND_WRITE_PREFIX, errandId, 'done'];
}

export function errandScope(errandId: string): { id: string } {
  return { id: `errand:${errandId}` };
}

/** Whether a mutation belongs to the write queue at all (any of the three prefixes). */
export function isQueueWriteKey(key: MutationKey | undefined): boolean {
  const head = key?.[0];
  return head === LIST_WRITE_PREFIX || head === CHORE_WRITE_PREFIX || head === ERRAND_WRITE_PREFIX;
}

function isChoreCompleteVariables(value: unknown): value is ChoreCompleteVariables {
  return (
    typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'complete'
  );
}

/** Registers the defaults for every queued write. Called before the persisted cache hydrates. */
export function registerQueueDefaults(queryClient: QueryClient, api: ApiClient): void {
  registerListWriteDefaults(queryClient, api);

  queryClient.setMutationDefaults([CHORE_WRITE_PREFIX], {
    retry: retryQueuedWrite,

    mutationFn: (variables: ChoreCompleteVariables): Promise<ChoreDetail> =>
      api.request({
        method: 'POST',
        path: `/api/chores/${variables.choreId}/complete`,
        body: {
          id: variables.completionId,
          ...(variables.occurrenceDate === undefined
            ? {}
            : { occurrenceDate: variables.occurrenceDate }),
          doneAt: variables.doneAt,
        },
        schema: choreDetailSchema,
      }),

    onSuccess: (detail: ChoreDetail, variables: ChoreCompleteVariables) => {
      queryClient.setQueryData(queryKeys.chore(variables.householdId, variables.choreId), detail);
      void queryClient.invalidateQueries({ queryKey: queryKeys.chores(variables.householdId) });
    },
  });

  queryClient.setMutationDefaults([ERRAND_WRITE_PREFIX], {
    retry: retryQueuedWrite,

    mutationFn: (variables: ErrandDoneVariables): Promise<Errand> =>
      api.request({
        method: 'PATCH',
        path: `/api/errands/${variables.errandId}`,
        body: { status: 'done', doneAt: variables.doneAt },
        schema: errandSchema,
      }),

    onSuccess: (_errand: Errand, variables: ErrandDoneVariables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.errands(variables.householdId) });
    },
  });
}

/**
 * Queues a chore completion. Resolves with the server's detail when it lands, or undefined when it
 * fails or waits: a failure is surfaced once by the queue itself (`use-write-queue.ts`), so the
 * caller does not repeat it.
 */
export function queueChoreCompletion(
  queryClient: QueryClient,
  variables: ChoreCompleteVariables,
): Promise<ChoreDetail | undefined> {
  const mutation = queryClient
    .getMutationCache()
    .build<ChoreDetail, Error, ChoreCompleteVariables, unknown>(queryClient, {
      mutationKey: choreCompleteKey(variables.choreId),
      scope: choreScope(variables.choreId),
    });
  return mutation.execute(variables).catch(() => undefined);
}

export function queueErrandDone(
  queryClient: QueryClient,
  variables: ErrandDoneVariables,
): Promise<Errand | undefined> {
  const mutation = queryClient
    .getMutationCache()
    .build<Errand, Error, ErrandDoneVariables, unknown>(queryClient, {
      mutationKey: errandDoneKey(variables.errandId),
      scope: errandScope(variables.errandId),
    });
  return mutation.execute(variables).catch(() => undefined);
}

/**
 * Takes a completion that has not been sent out of the queue (the toast's Undo while offline). A
 * write already in flight is not touched: undoing a sent completion is online-only. Returns
 * whether anything was removed. The caller flushes the persister, or a reload would replay it.
 */
export function removeQueuedCompletion(queryClient: QueryClient, completionId: string): boolean {
  const cache = queryClient.getMutationCache();
  const queued = cache
    .getAll()
    .find(
      (mutation) =>
        mutation.state.isPaused &&
        isChoreCompleteVariables(mutation.state.variables) &&
        mutation.state.variables.completionId === completionId,
    );
  if (queued === undefined) return false;
  cache.remove(queued);
  // A scope follower that was waiting on the removed write may now run.
  void cache.resumePausedMutations();
  return true;
}

/** The chore ids with a completion waiting to sync, for the pending mark on each row. */
export function usePendingChoreCompletions(): ReadonlySet<string> {
  const variables = useMutationState({
    filters: { mutationKey: [CHORE_WRITE_PREFIX], status: 'pending' },
    select: (mutation) => mutation.state.variables,
  });
  const pending = new Set<string>();
  for (const entry of variables) {
    if (isChoreCompleteVariables(entry)) pending.add(entry.choreId);
  }
  return pending;
}

/** The errand ids marked done offline that have not synced yet. */
export function usePendingErrandDones(): ReadonlySet<string> {
  const variables = useMutationState({
    filters: { mutationKey: [ERRAND_WRITE_PREFIX], status: 'pending' },
    select: (mutation) => mutation.state.variables,
  });
  const pending = new Set<string>();
  for (const entry of variables) {
    if (isErrandDoneVariables(entry)) pending.add(entry.errandId);
  }
  return pending;
}

function isErrandDoneVariables(value: unknown): value is ErrandDoneVariables {
  return (
    typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'done'
  );
}

/**
 * Whether a queueable write can be made right now. Online, everything can. Offline, a queueable
 * write needs the household's cached data, because its timezone comes from there. Without it the
 * control is disabled with "Needs a connection."
 */
export function queueableWriteReason(
  isOnline: boolean,
  hasCachedHousehold: boolean,
  offlineReason: string,
): string | undefined {
  if (isOnline || hasCachedHousehold) return undefined;
  return offlineReason;
}

/**
 * The occurrence a completion made now closes, computed on the client: the household's "today"
 * (not the browser's, which may be in another zone), then the same rule the service applies.
 */
export function offlineChoreOccurrence(
  chore: Chore,
  completedDates: ReadonlySet<string>,
  householdTimezone: string,
  now: Date,
): string {
  const recurrence: Recurrence = {
    unit: chore.recurrenceUnit,
    interval: chore.interval,
    anchorDate: chore.anchorDate,
  };
  return occurrenceToComplete(recurrence, completedDates, todayInTimezone(householdTimezone, now));
}

/**
 * The completed occurrences this device knows about. The full history is in the chore's detail
 * cache when that was opened; the list row carries only the latest completion, which is enough to
 * place the current occurrence in the common case.
 */
export function completedOccurrencesFor(
  queryClient: QueryClient,
  householdId: string,
  chore: Chore,
): Set<string> {
  const detail = queryClient.getQueryData<ChoreDetail>(queryKeys.chore(householdId, chore.id));
  if (detail !== undefined) {
    return new Set(detail.completions.map((completion) => completion.occurrenceDate));
  }
  return new Set(chore.lastCompletion === null ? [] : [chore.lastCompletion.occurrenceDate]);
}

/**
 * The single message a dropped queued write leaves behind. It counts the changes and never names
 * the chore, errand, or anyone in the household (PWA rule: no household content in error text).
 */
export function queueDropMessage(count: number, anyPermanent: boolean): string {
  const noun = count === 1 ? 'change' : 'changes';
  return anyPermanent
    ? `${String(count)} ${noun} couldn't be saved. The chore or errand is no longer available.`
    : `${String(count)} ${noun} couldn't be saved.`;
}
