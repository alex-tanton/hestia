import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Persister } from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';

/*
 * TanStack Query's persister, written to IndexedDB through `idb-keyval`. One payload holds both
 * halves of offline support: the last-synced queries, so a
 * cold start renders lists, the meal plan, chores, errands, and bills rather than nothing, and
 * the paused mutations, which is what makes the write queue survive a browser restart.
 *
 * TanStack's own defaults decide what goes in: successful queries, and mutations that are paused.
 */

export const PERSIST_KEY = 'hearth-query-cache';

/**
 * Stale data beats empty data, and a phone can be away from a connection for longer than TanStack's
 * 24-hour default. A week covers a shopping trip and anything either side of it, after which
 * last-synced prices are too old to stand in for a fetch.
 */
export const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** The slice of an async key-value store the persister uses; a test supplies a fake. */
export interface AsyncStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export const indexedDbStorage: AsyncStorage = {
  getItem: (key) => get<string>(key).then((value) => value ?? null),
  setItem: (key, value) => set(key, value),
  removeItem: (key) => del(key),
};

export function createCachePersister(
  storage: AsyncStorage = indexedDbStorage,
  throttleTime = 1000,
): Persister {
  return createAsyncStoragePersister({ storage, key: PERSIST_KEY, throttleTime });
}

/**
 * A second persister over the same storage and key, with no throttle. `createCachePersister`'s
 * default 1000ms throttle is right for the query cache -- it exists so a realtime-chatty screen
 * does not hammer IndexedDB on every settle -- but it is wrong for a write the moment it queues:
 * "the queue survives a page reload and a browser restart; it is not in memory" (Engineering
 * Practices › The write queue) has no exception for whatever is still inside that window, and a
 * restart landing there would lose the write silently. `asyncThrottle` keys its cooldown to the
 * persister instance it wraps, so a second instance is what lets the write queue's own flush go
 * through uncoupled from the query cache's throttle, onto the same storage.
 */
export function createImmediateFlushPersister(storage: AsyncStorage = indexedDbStorage): Persister {
  return createCachePersister(storage, 0);
}
