import { onlineManager, useMutationState, useQueryClient } from '@tanstack/react-query';
import { persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { useEffect, useRef } from 'react';
import { useToast } from '../../components/ui/Toast.tsx';
import { useApi, useFlushPersister } from '../api/api-context.tsx';
import { pluralize } from '../format.ts';
import {
  CHORE_WRITE_PREFIX,
  ERRAND_WRITE_PREFIX,
  isQueueWriteKey,
  queueDropMessage,
  registerQueueDefaults,
} from './chore-errand-writes.ts';
import {
  LIST_WRITE_PREFIX,
  announceQueueNotice,
  isPermanentFailure,
  subscribeToQueueNotices,
  type ListWriteVariables,
} from './write-queue.ts';

/**
 * Wires the queue into the running app: its defaults, its notices, the drop of a write that has
 * failed for good, and the reconnect summary: on reconnect the queue replays and the banner is
 * replaced by a 4-second success toast stating how many changes synced. Mounted once, inside the
 * shell's toast provider.
 */
export function useWriteQueue(): void {
  const queryClient = useQueryClient();
  const api = useApi();
  const flushPersister = useFlushPersister();
  const toast = useToast();
  const isRegistered = useRef<boolean | null>(null);

  /*
   * `main.tsx` registers these before hydrating the persisted cache, which is what lets a
   * restored write resume. This registration binds them to the API client this tree is using:
   * the browser's, or the stubbed one under test. It runs during render rather than in an effect
   * because a write made on the first paint must already have its `mutationFn`.
   */
  if (isRegistered.current == null) {
    isRegistered.current = true;
    registerQueueDefaults(queryClient, api);
  }

  useEffect(
    () =>
      subscribeToQueueNotices((notice) => {
        toast({ variant: notice.variant, message: notice.message });
      }),
    [toast],
  );

  const watched = useRef(new Set<number>());

  useEffect(() => {
    const cache = queryClient.getMutationCache();

    const inspect = (): void => {
      const writes = cache
        .getAll()
        .filter((mutation) => isQueueWriteKey(mutation.options.mutationKey));

      if (!onlineManager.isOnline()) {
        let newlyPaused = false;
        for (const mutation of writes) {
          if (mutation.state.isPaused && !watched.current.has(mutation.mutationId)) {
            watched.current.add(mutation.mutationId);
            newlyPaused = true;
          }
        }
        /*
         * The query cache's persister throttles its saves (`persist.ts`, 1000ms) so a busy screen
         * does not hammer IndexedDB on every settle -- but a write is not durable until it is
         * written, and the queue survives a browser restart (it is not in memory) with no exception
         * for whatever is still inside that window. A restart landing there would otherwise lose the
         * write silently, which the queue must never do. `flushPersister` is a second, unthrottled
         * persister over the same storage and key, so this save goes through uncoupled from the
         * query cache's own throttled one.
         */
        if (newlyPaused && flushPersister) {
          void persistQueryClientSave({ queryClient, persister: flushPersister });
        }
        return;
      }

      // A write that failed leaves the queue, so nothing can replay it; the error toast it
      // already raised is the single surfacing it gets.
      // A chore or errand write has no optimistic cache to roll back and no error toast of its own,
      // so its drop is announced here, once for the whole pass, with a message that names no one.
      let dropped = 0;
      let anyPermanent = false;
      for (const mutation of writes) {
        if (mutation.state.status !== 'error') continue;
        const key = mutation.options.mutationKey?.[0];
        if (key === CHORE_WRITE_PREFIX || key === ERRAND_WRITE_PREFIX) {
          dropped += 1;
          anyPermanent ||= isPermanentFailure(mutation.state.error);
        }
        cache.remove(mutation);
      }
      if (dropped > 0) announceQueueNotice('error', queueDropMessage(dropped, anyPermanent));

      if (watched.current.size === 0) return;
      const replaying = writes.filter((mutation) => watched.current.has(mutation.mutationId));
      if (replaying.some((mutation) => mutation.state.status === 'pending')) return;

      const synced = replaying.filter((mutation) => mutation.state.status === 'success').length;
      watched.current = new Set();
      if (synced > 0) announceQueueNotice('success', `${pluralize(synced, 'change')} synced.`);
    };

    /*
     * Once up front as well as on every change: after a reload the persisted writes are restored
     * during hydration, which happens before this effect runs, so waiting for a notification
     * would miss the queue that the reload brought back and the reconnect would say nothing.
     */
    inspect();
    return cache.subscribe(inspect);
  }, [queryClient, flushPersister]);
}

function isListWriteVariables(value: unknown): value is ListWriteVariables {
  if (typeof value !== 'object' || value === null) return false;
  const kind: unknown = (value as { kind?: unknown }).kind;
  return kind === 'add-item' || kind === 'update-item';
}

/** The item ids this list has an unsent or in-flight write for, for the pending affordance. */
export function usePendingListWrites(listId: string | undefined): ReadonlySet<string> {
  const variables = useMutationState({
    filters: {
      mutationKey: listId === undefined ? [LIST_WRITE_PREFIX] : [LIST_WRITE_PREFIX, listId],
      status: 'pending',
    },
    select: (mutation) => mutation.state.variables,
  });

  const pending = new Set<string>();
  for (const entry of variables) {
    if (!isListWriteVariables(entry)) continue;
    pending.add(entry.kind === 'add-item' ? entry.optimistic.id : entry.itemId);
  }
  return pending;
}
