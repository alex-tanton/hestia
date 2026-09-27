import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRealtime } from '../api/api-context.tsx';
import { queryKeys } from '../api/keys.ts';

/** How long a row another member changed stays marked, per Design › Screens › 8. */
export const REALTIME_HIGHLIGHT_MS = 2000;

export interface ListRealtime {
  /** The rows another member just changed, for the brief highlight. */
  changedItemIds: ReadonlySet<string>;
  /** What the live region announces, or the empty string when there is nothing to say. */
  announcement: string;
}

const ANNOUNCEMENT = 'This list was updated by another member.';

/**
 * Keeps an open list live (Requirements › Real-time sharing). Realtime never becomes a second
 * source of truth: a message only invalidates the queries, so the list the screen renders is
 * always the one TanStack Query holds. The subscription is torn down when the screen unmounts and
 * when the household changes, because both change which list, if any, is open.
 */
export function useListRealtime(
  householdId: string | undefined,
  listId: string | undefined,
): ListRealtime {
  const realtime = useRealtime();
  const queryClient = useQueryClient();
  const [changedItemIds, setChangedItemIds] = useState<ReadonlySet<string>>(new Set());
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (realtime === undefined || householdId === undefined || listId === undefined) return;

    const timers = new Set<ReturnType<typeof setTimeout>>();
    const refetch = (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.list(householdId, listId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.lists(householdId, false) });
    };

    const unsubscribe = realtime.subscribeToList(listId, {
      onItemChange: (itemId) => {
        refetch();
        setAnnouncement(ANNOUNCEMENT);
        if (itemId === undefined) return;
        setChangedItemIds((current) => new Set(current).add(itemId));
        const timer = setTimeout(() => {
          setChangedItemIds((current) => {
            const next = new Set(current);
            next.delete(itemId);
            return next;
          });
          timers.delete(timer);
        }, REALTIME_HIGHLIGHT_MS);
        timers.add(timer);
      },
      // The list row's own update is the signal for a delete, which a filtered subscription
      // cannot deliver (Technical Architecture, "Realtime subscriptions").
      onListChange: refetch,
    });

    return () => {
      unsubscribe();
      for (const timer of timers) clearTimeout(timer);
      setChangedItemIds(new Set());
      setAnnouncement('');
    };
  }, [realtime, queryClient, householdId, listId]);

  return { changedItemIds, announcement };
}
