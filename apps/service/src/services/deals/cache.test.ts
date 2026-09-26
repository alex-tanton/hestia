import { describe, expect, it } from 'vitest';
import {
  FLYERS_TTL_MS,
  MERCHANTS_TTL_MS,
  SEARCH_TTL_MS,
  StaleWhileFailingCache,
  freshness,
  isFresh,
  serveAfterFailure,
} from './cache.js';

/** Technical Architecture, "Caching and storage": the TTL table and the stale-fallback rule. */

const NOW = new Date('2026-09-25T12:00:00.000Z');
const ago = (ms: number): Date => new Date(NOW.getTime() - ms);
const HOUR = 60 * 60 * 1_000;

describe('the TTL table', () => {
  it('matches the documented TTLs', () => {
    expect(SEARCH_TTL_MS).toBe(6 * HOUR);
    expect(FLYERS_TTL_MS).toBe(12 * HOUR);
    expect(MERCHANTS_TTL_MS).toBe(7 * 24 * HOUR);
  });

  it.each([
    ['a search one second inside its six hours', SEARCH_TTL_MS - 1_000, SEARCH_TTL_MS, true],
    ['a search one second past its six hours', SEARCH_TTL_MS + 1_000, SEARCH_TTL_MS, false],
    ['a search exactly at six hours', SEARCH_TTL_MS, SEARCH_TTL_MS, false],
    ['flyers at eleven hours', 11 * HOUR, FLYERS_TTL_MS, true],
    ['flyers at thirteen hours', 13 * HOUR, FLYERS_TTL_MS, false],
    ['the directory at six days', 6 * 24 * HOUR, MERCHANTS_TTL_MS, true],
    ['the directory at eight days', 8 * 24 * HOUR, MERCHANTS_TTL_MS, false],
  ])('%s', (_name, age, ttl, expected) => {
    expect(isFresh(ago(age), NOW, ttl)).toBe(expected);
  });

  it('treats a future timestamp as fresh rather than re-fetching in a loop', () => {
    expect(isFresh(new Date(NOW.getTime() + HOUR), NOW, SEARCH_TTL_MS)).toBe(true);
  });
});

describe('stale beats empty (non-negotiable 18)', () => {
  it('serves any entry after a failed fetch, however old', () => {
    const entry = { value: ['deal'], fetchedAt: ago(40 * 24 * HOUR) };
    expect(serveAfterFailure(entry)).toBe(entry);
  });

  it('reports unavailable only when nothing has ever been cached', () => {
    expect(serveAfterFailure(undefined)).toBe('unavailable');
  });
});

describe('freshness', () => {
  it('carries the as-of timestamp the UI labels the results with', () => {
    expect(
      freshness({ value: 1, fetchedAt: ago(2 * HOUR) }, { stale: true, refreshing: false }),
    ).toStrictEqual({ asOf: '2026-09-25T10:00:00.000Z', stale: true, refreshing: false });
  });

  it('has no as-of when nothing is cached, which is the refreshing state', () => {
    expect(freshness(undefined, { stale: false, refreshing: true })).toStrictEqual({
      asOf: null,
      stale: false,
      refreshing: true,
    });
  });
});

describe('StaleWhileFailingCache', () => {
  it('keeps an expired entry rather than dropping it', () => {
    const cache = new StaleWhileFailingCache<string>();
    cache.set('27514', 'flyers', ago(40 * HOUR));
    const entry = cache.get('27514');
    expect(entry?.value).toBe('flyers');
    expect(isFresh(entry?.fetchedAt ?? NOW, NOW, FLYERS_TTL_MS)).toBe(false);
  });

  it('replaces an entry on a successful refetch and clears on demand', () => {
    const cache = new StaleWhileFailingCache<string>();
    cache.set('27514', 'old', ago(40 * HOUR));
    cache.set('27514', 'new', NOW);
    expect(cache.get('27514')?.value).toBe('new');
    cache.clear();
    expect(cache.get('27514')).toBeUndefined();
  });

  it('keys by postal code, so one postal code never serves another', () => {
    const cache = new StaleWhileFailingCache<string>();
    cache.set('27514', 'chapel hill', NOW);
    expect(cache.get('27601')).toBeUndefined();
  });
});
