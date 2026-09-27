import type { MutationKey, QueryClient } from '@tanstack/react-query';
import {
  shoppingListDetailSchema,
  type CreateListItemRequest,
  type ListItem,
  type ShoppingListDetail,
  type UpdateListItemRequest,
} from '@hearth/shared';
import type { ApiClient } from '../api/client.ts';
import { queryKeys } from '../api/keys.ts';
import { ApiError } from '../api/problem.ts';
import { withItemPatch, withNewItem } from './list-cache.ts';

/*
 * The offline write queue (Engineering Practices › The write queue). The queue *is* TanStack
 * Query's paused mutations: there is no custom queue, no client_mutation table, and no
 * server-side dedupe. This module supplies the one thing paused mutations need to survive a
 * reload — a default `mutationFn` and its callbacks, registered with `setMutationDefaults` — plus
 * the optimistic update, the rollback, and the single surfacing of a permanent failure.
 *
 * v1.0 queues list item add, check, uncheck, and edit, and nothing else (Requirements › Offline
 * behavior). Check and uncheck are ordinary edits: they send an absolute `status`.
 */

/** Every queued list write starts with this, so one registration covers them all by prefix. */
export const LIST_WRITE_PREFIX = 'list-write';

export type ListWriteKind = 'add-item' | 'update-item';

export function listWriteMutationKey(listId: string, kind: ListWriteKind): MutationKey {
  return [LIST_WRITE_PREFIX, listId, kind];
}

/**
 * Mutations in one scope run one at a time, in the order they were made (Engineering Practices).
 * TanStack persists the scope with the mutation, so the order survives a reload too.
 */
export function listWriteScope(listId: string): { id: string } {
  return { id: `list:${listId}` };
}

export function listIdOfWrite(key: MutationKey | undefined): string | undefined {
  if (key?.[0] !== LIST_WRITE_PREFIX) return undefined;
  const listId: unknown = key[1];
  return typeof listId === 'string' ? listId : undefined;
}

export interface AddListItemVariables {
  kind: 'add-item';
  householdId: string;
  listId: string;
  /** Carries the client-generated id, so a replayed add is a no-op (non-negotiable 9). */
  request: CreateListItemRequest;
  /** The row to show while the write is in flight. */
  optimistic: ListItem;
}

export interface UpdateListItemVariables {
  kind: 'update-item';
  householdId: string;
  listId: string;
  itemId: string;
  /** Absolute values only — never a toggle or an increment (non-negotiable 9). */
  patch: UpdateListItemRequest;
  /** Names what could not be saved if this write fails for good. */
  itemName: string;
}

export type ListWriteVariables = AddListItemVariables | UpdateListItemVariables;

interface ListWriteContext {
  previous: ShoppingListDetail | undefined;
}

/*
 * Notices from the queue. A queued write can fail or sync long after the screen that made it has
 * gone, so the queue announces rather than returning: the shell subscribes and raises the toast.
 */

export interface QueueNotice {
  id: number;
  variant: 'error' | 'success';
  message: string;
}

const noticeListeners = new Set<(notice: QueueNotice) => void>();
let nextNoticeId = 0;

export function announceQueueNotice(variant: QueueNotice['variant'], message: string): void {
  nextNoticeId += 1;
  const notice: QueueNotice = { id: nextNoticeId, variant, message };
  for (const listener of [...noticeListeners]) listener(notice);
}

export function subscribeToQueueNotices(listener: (notice: QueueNotice) => void): () => void {
  noticeListeners.add(listener);
  return () => {
    noticeListeners.delete(listener);
  };
}

/**
 * 410, 403, and 404 all mean the row or its list is gone, or is no longer the caller's. Replaying
 * cannot change that, so the write leaves the queue and is surfaced once.
 */
const PERMANENT_STATUSES: ReadonlySet<number> = new Set([403, 404, 410]);

export function isPermanentFailure(error: unknown): boolean {
  return error instanceof ApiError && PERMANENT_STATUSES.has(error.status);
}

/** A request that never reached the network, or a server fault: both may succeed later. */
function isRetryable(error: unknown): boolean {
  return error instanceof ApiError && (error.isOffline || error.status >= 500);
}

/** Bounded, so a write is never retried forever (Engineering Practices › The write queue). */
export function retryQueuedWrite(failureCount: number, error: unknown): boolean {
  return isRetryable(error) && failureCount < 3;
}

export function queueFailureMessage(error: unknown, what: string): string {
  return isPermanentFailure(error)
    ? `Couldn't save ${what}. It is no longer on this list.`
    : `Couldn't save ${what}. Try again.`;
}

function describe(variables: ListWriteVariables): string {
  return variables.kind === 'add-item' ? variables.optimistic.itemName : variables.itemName;
}

/**
 * Registers the defaults for every queued list write. Called before the persisted cache is
 * hydrated, because TanStack merges a mutation's defaults when it *builds* the mutation, which
 * for a restored write is during hydration — a write whose defaults arrived later would resume
 * with no `mutationFn` at all.
 */
export function registerListWriteDefaults(queryClient: QueryClient, api: ApiClient): void {
  queryClient.setMutationDefaults([LIST_WRITE_PREFIX], {
    retry: retryQueuedWrite,

    mutationFn: (variables: ListWriteVariables): Promise<ShoppingListDetail> =>
      variables.kind === 'add-item'
        ? api.request({
            method: 'POST',
            path: `/api/lists/${variables.listId}/items`,
            body: variables.request,
            schema: shoppingListDetailSchema,
          })
        : api.request({
            method: 'PATCH',
            path: `/api/lists/${variables.listId}/items/${variables.itemId}`,
            body: variables.patch,
            schema: shoppingListDetailSchema,
          }),

    onMutate: async (variables: ListWriteVariables): Promise<ListWriteContext> => {
      const key = queryKeys.list(variables.householdId, variables.listId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ShoppingListDetail>(key);
      if (previous !== undefined) {
        queryClient.setQueryData(
          key,
          variables.kind === 'add-item'
            ? withNewItem(previous, variables.optimistic)
            : withItemPatch(previous, variables.itemId, variables.patch),
        );
      }
      return { previous };
    },

    onError: (
      error: unknown,
      variables: ListWriteVariables,
      context: ListWriteContext | undefined,
    ) => {
      // The rollback is explicit, so the row visibly returns to what the server last confirmed.
      if (context?.previous !== undefined) {
        queryClient.setQueryData(
          queryKeys.list(variables.householdId, variables.listId),
          context.previous,
        );
      }
      announceQueueNotice('error', queueFailureMessage(error, describe(variables)));
    },

    // The service answers every item write with the whole list, so the response is the truth:
    // the subtotals and the unpriced counts come back already computed.
    onSuccess: (detail: ShoppingListDetail, variables: ListWriteVariables) => {
      queryClient.setQueryData(queryKeys.list(variables.householdId, variables.listId), detail);
    },

    onSettled: (
      _detail: ShoppingListDetail | undefined,
      _error: unknown,
      variables: ListWriteVariables,
    ) => {
      // The index shows each list's item counts and last activity, both of which just moved.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lists(variables.householdId, false),
      });
    },
  });
}
