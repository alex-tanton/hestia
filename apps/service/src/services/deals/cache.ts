/**
 * The cache TTLs from Technical Architecture, "Caching and storage", and the one rule that
 * decides what a request gets:
 *
 * | Query                    | TTL      | Where                                            |
 * | ------------------------ | -------- | ------------------------------------------------ |
 * | Flyers by postal code    | 12 hours | In-process memory                                |
 * | Flyer items              | Until the flyer's valid_to | `deal` rows, by `flyer_id`     |
 * | Search by (postal, query)| 6 hours  | `deal_query_cache` (deal ids), deals in `deal`   |
 * | Merchant directory       | 7 days   | In-process memory, one copy for all postal codes |
 *
 * A fresh entry is served without touching the network. A miss triggers a live fetch. When that
 * fetch fails and any entry exists, however old, the entry is served with its age, which the UI
 * renders as an "as of" label — stale data beats empty data (Handoff non-negotiable 18).
 */

export const SEARCH_TTL_MS = 6 * 60 * 60 * 1_000;
export const FLYERS_TTL_MS = 12 * 60 * 60 * 1_000;
export const MERCHANTS_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export interface CacheEntry<T> {
  value: T;
  fetchedAt: Date;
}

export function isFresh(fetchedAt: Date, now: Date, ttlMs: number): boolean {
  const age = now.getTime() - fetchedAt.getTime();
  // A clock that went backwards leaves a future timestamp; treat it as fresh rather than
  // re-fetching in a loop.
  return age < ttlMs;
}

/**
 * What to serve once a live fetch has failed (Handoff non-negotiable 18, "stale data beats empty
 * data"): any entry, however old, with its age, or — when nothing has ever been cached — an
 * error, which the UI renders as the retry state (Design, "Deals-specific states").
 */
export function serveAfterFailure<T>(
  entry: CacheEntry<T> | undefined,
): CacheEntry<T> | 'unavailable' {
  return entry ?? 'unavailable';
}

/**
 * A keyed in-process cache that keeps an expired entry rather than dropping it, because an
 * expired entry is exactly what the stale fallback needs when the live fetch fails.
 */
export class StaleWhileFailingCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  get(key: string): CacheEntry<T> | undefined {
    return this.entries.get(key);
  }

  set(key: string, value: T, fetchedAt: Date): CacheEntry<T> {
    const entry = { value, fetchedAt };
    this.entries.set(key, entry);
    return entry;
  }

  /** Only the tests and the CLI need this; the process lives as long as the cache. */
  clear(): void {
    this.entries.clear();
  }
}

export interface Freshness {
  asOf: string | null;
  stale: boolean;
  refreshing: boolean;
}

export function freshness(
  entry: CacheEntry<unknown> | undefined,
  options: { stale: boolean; refreshing: boolean },
): Freshness {
  return {
    asOf: entry?.fetchedAt.toISOString() ?? null,
    stale: options.stale,
    refreshing: options.refreshing,
  };
}
