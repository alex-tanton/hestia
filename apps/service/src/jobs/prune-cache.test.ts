import { describe, expect, it } from 'vitest';
import { SEARCH_TTL_MS } from '../services/deals/cache.js';
import { pruneCutoffs } from './prune-cache.js';

/** Technical Architecture, "Scheduled jobs"; Requirements, "Retention". */

const NOW = new Date('2026-09-25T04:00:00.000Z');

describe('pruneCutoffs', () => {
  const cutoffs = pruneCutoffs(NOW);

  it('prunes deals once valid_to has passed, as a calendar date', () => {
    expect(cutoffs.expiredDealsBefore).toBe('2026-09-25');
  });

  it('prunes the search cache at the six-hour TTL, not at some other figure', () => {
    expect(cutoffs.queryCacheBefore.toISOString()).toBe('2026-09-24T22:00:00.000Z');
    expect(NOW.getTime() - cutoffs.queryCacheBefore.getTime()).toBe(SEARCH_TTL_MS);
  });

  it('prunes sent notifications and errors at 90 days', () => {
    expect(cutoffs.sentNotificationsBefore.toISOString()).toBe('2026-06-27T04:00:00.000Z');
    expect(cutoffs.errorsLastSeenBefore.toISOString()).toBe('2026-06-27T04:00:00.000Z');
  });

  it.each([
    ['yesterday', '2026-09-24', true],
    ['today, so still valid', '2026-09-25', false],
    ['this week', '2026-09-29', false],
  ])('a deal valid to %s is pruned: %s', (_label, validTo, pruned) => {
    expect(validTo < cutoffs.expiredDealsBefore).toBe(pruned);
  });

  it.each([
    ['five hours old', 5, false],
    ['seven hours old, the stale fixture', 7, true],
  ])('a query-cache row %s is pruned: %s', (_label, hours, pruned) => {
    const cachedAt = new Date(NOW.getTime() - hours * 60 * 60 * 1_000);
    expect(cachedAt < cutoffs.queryCacheBefore).toBe(pruned);
  });

  it.each([
    ['89 days', 89, false],
    ['91 days', 91, true],
  ])('a sent notification %s old is pruned: %s', (_label, days, pruned) => {
    const sentAt = new Date(NOW.getTime() - days * 24 * 60 * 60 * 1_000);
    expect(sentAt < cutoffs.sentNotificationsBefore).toBe(pruned);
  });
});
