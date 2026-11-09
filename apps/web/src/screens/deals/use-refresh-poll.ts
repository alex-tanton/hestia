import { useEffect, useState } from 'react';

/**
 * Dormant postal codes: a flyers or flyer-items request for a dormant
 * postal code queues one background refresh and answers immediately with `refreshing: true`. The
 * PWA refetches while that flag is set.
 *
 * Ingestion runs concurrently with rate pacing and an item-detail cache, completing in seconds.
 * The client polls on a fixed 4.5s beat and caps at 3 minutes (~40 attempts) per D-08 and DEAL-03.
 * Giving up leaves whatever is cached on screen with its "as of" label and offers a retry affordance.
 */
export const POLL_INTERVAL_MS = 4_500;
export const MAX_POLL_MS = 180_000;
export const MAX_ATTEMPTS = Math.floor(MAX_POLL_MS / POLL_INTERVAL_MS);

export function refreshDelayMs(): number {
  return POLL_INTERVAL_MS;
}

export interface RefreshPoll {
  /** True while the poll is still waiting for the refresh to finish. */
  isPolling: boolean;
  /** The poll ran out of attempts; the screen offers a manual retry instead. */
  hasGivenUp: boolean;
}

/**
 * Refetches while `isRefreshing` at fixed 4.5s intervals, and stops as soon as the server stops
 * saying it is refreshing. A poll that is running when the tab goes offline stops too: the refetch
 * would only fail, and the offline state takes over the screen.
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
  // a finished refresh resets the poll count, so the next dormant postal code starts fresh.
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
    }, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [isActive, attempt, refetch]);

  return { isPolling: isActive, hasGivenUp: isRefreshing && attempt >= MAX_ATTEMPTS };
}
