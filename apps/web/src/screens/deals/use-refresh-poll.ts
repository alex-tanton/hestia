import { useEffect, useState } from 'react';

/**
 * Dormant postal codes: a flyers or flyer-items request for a dormant
 * postal code queues one background refresh and answers immediately with `refreshing: true`. The
 * PWA refetches while that flag is set.
 *
 * The refresh is a roster request plus an item-detail request per priced product at a 500ms gap —
 * minutes, not seconds — so the poll backs off rather than asking on a fixed beat, and gives up
 * after {@link MAX_ATTEMPTS}. Giving up leaves whatever is cached on screen with its "as of"
 * label; it never blanks the results, because stale data beats empty data.
 */
export const FIRST_DELAY_MS = 3000;
export const MAX_DELAY_MS = 60_000;
export const MAX_ATTEMPTS = 10;

export function refreshDelayMs(attempt: number): number {
  return Math.min(FIRST_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
}

export interface RefreshPoll {
  /** True while the poll is still waiting for the refresh to finish. */
  isPolling: boolean;
  /** The poll ran out of attempts; the screen offers a manual retry instead. */
  hasGivenUp: boolean;
}

/**
 * Refetches while `isRefreshing`, backing off, and stops as soon as the server stops saying it is
 * refreshing. A poll that is running when the tab goes offline stops too: the refetch would only
 * fail, and the offline state takes over the screen.
 *
 * `refetch` must be stable across renders, or each render would restart the wait.
 */
export function useRefreshPoll(
  isRefreshing: boolean,
  refetch: () => void,
  isOnline = true,
): RefreshPoll {
  const [attempt, setAttempt] = useState(0);
  const [wasRefreshing, setWasRefreshing] = useState(isRefreshing);

  // Adjusted while rendering rather than in an effect (React's "you might not need an effect"):
  // a finished refresh resets the backoff, so the next dormant postal code starts from the first
  // delay instead of inheriting the last one's.
  if (wasRefreshing !== isRefreshing) {
    setWasRefreshing(isRefreshing);
    if (!isRefreshing) setAttempt(0);
  }

  const isActive = isRefreshing && isOnline && attempt < MAX_ATTEMPTS;

  useEffect(() => {
    if (!isActive) return;
    const timer = setTimeout(() => {
      setAttempt((current) => current + 1);
      refetch();
    }, refreshDelayMs(attempt));
    return () => {
      clearTimeout(timer);
    };
  }, [isActive, attempt, refetch]);

  return { isPolling: isActive, hasGivenUp: isRefreshing && attempt >= MAX_ATTEMPTS };
}
