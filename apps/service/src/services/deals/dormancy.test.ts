import { describe, expect, it } from 'vitest';
import {
  ACTIVE_WINDOW_DAYS,
  isDormantAtRequest,
  isPostalCodeActive,
  sameUtcDay,
  selectActivePostalCodes,
  shouldQueueOnDemandRefresh,
  type RefreshBookkeeping,
} from './dormancy.js';

/**
 * Dormant postal codes, as a decision table. Dormancy governs only the flyer and flyer-item
 * refresh; keyword search is unaffected.
 */

const NOW = new Date('2026-09-25T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1_000;
const daysAgo = (days: number): Date => new Date(NOW.getTime() - days * DAY);

describe('activity window', () => {
  it('is the documented 14 days', () => {
    expect(ACTIVE_WINDOW_DAYS).toBe(14);
  });

  it.each([
    ['today', 0, true],
    ['13 days ago', 13, true],
    ['just inside 14 days', 13.99, true],
    ['just outside 14 days', 14.01, false],
    ['20 days ago, the Empty House fixture', 20, false],
  ])('a household last active %s is active: %s', (_label, days, expected) => {
    expect(isPostalCodeActive([daysAgo(days)], NOW)).toBe(expected);
  });

  it('is dormant when no household at the postal code has any activity', () => {
    expect(isPostalCodeActive([], NOW)).toBe(false);
  });

  it('is active when any one household is, however stale the others', () => {
    expect(isPostalCodeActive([daysAgo(60), daysAgo(200), daysAgo(1)], NOW)).toBe(true);
  });
});

describe('selectActivePostalCodes', () => {
  it('returns one entry per postal code, never one per household', () => {
    const households = [
      { postalCode: '27514', lastActiveAt: daysAgo(0) },
      { postalCode: '27514', lastActiveAt: daysAgo(1) },
      { postalCode: '27514', lastActiveAt: daysAgo(3) },
      { postalCode: '27601', lastActiveAt: daysAgo(2) },
    ];
    expect(selectActivePostalCodes(households, NOW)).toStrictEqual(['27514', '27601']);
  });

  it('drops a postal code whose every household is dormant', () => {
    const households = [
      { postalCode: '27514', lastActiveAt: daysAgo(1) },
      { postalCode: '27705', lastActiveAt: daysAgo(20) },
    ];
    expect(selectActivePostalCodes(households, NOW)).toStrictEqual(['27514']);
  });

  it('keeps a postal code where one of several households is still active', () => {
    const households = [
      { postalCode: '27705', lastActiveAt: daysAgo(20) },
      { postalCode: '27705', lastActiveAt: daysAgo(2) },
    ];
    expect(selectActivePostalCodes(households, NOW)).toStrictEqual(['27705']);
  });

  it('is empty when nothing is active, so a run with no work does nothing', () => {
    expect(
      selectActivePostalCodes([{ postalCode: '27705', lastActiveAt: daysAgo(30) }], NOW),
    ).toStrictEqual([]);
  });
});

describe('dormancy as a request sees it', () => {
  const bookkeeping = (
    lastRefreshedAt: Date | null,
    lastOnDemandAt: Date | null = null,
  ): RefreshBookkeeping => ({ lastRefreshedAt, lastOnDemandAt });

  it.each([
    ['no postal_code_refresh row at all (the 27705 fixture)', undefined, true],
    ['a row that has never been refreshed', bookkeeping(null), true],
    ['refreshed six hours ago by this morning’s run', bookkeeping(daysAgo(0.25)), false],
    ['refreshed 23 hours ago', bookkeeping(daysAgo(23 / 24)), false],
    ['refreshed 25 hours ago, so the last run skipped it', bookkeeping(daysAgo(25 / 24)), true],
    ['refreshed a fortnight ago', bookkeeping(daysAgo(14)), true],
  ])('%s is dormant: %s', (_label, entry, expected) => {
    expect(isDormantAtRequest(entry, NOW)).toBe(expected);
  });
});

describe('the one on-demand refresh per UTC day', () => {
  const at = (iso: string): Date => new Date(iso);

  it('queues for a dormant postal code that has not been claimed today', () => {
    expect(shouldQueueOnDemandRefresh({ lastRefreshedAt: null, lastOnDemandAt: null }, NOW)).toBe(
      true,
    );
    expect(shouldQueueOnDemandRefresh(undefined, NOW)).toBe(true);
  });

  it('does not queue twice in one UTC day', () => {
    const claimedAt = at('2026-09-25T00:00:01.000Z');
    expect(
      shouldQueueOnDemandRefresh({ lastRefreshedAt: null, lastOnDemandAt: claimedAt }, NOW),
    ).toBe(false);
  });

  it('queues again once the UTC day rolls over', () => {
    const yesterday = at('2026-09-24T23:59:59.000Z');
    expect(
      shouldQueueOnDemandRefresh({ lastRefreshedAt: null, lastOnDemandAt: yesterday }, NOW),
    ).toBe(true);
  });

  it('never queues for a postal code the daily run already covers', () => {
    expect(
      shouldQueueOnDemandRefresh({ lastRefreshedAt: daysAgo(0.25), lastOnDemandAt: null }, NOW),
    ).toBe(false);
  });

  it('judges the day in UTC, not in any local timezone', () => {
    // 20:00 in New York on the 24th is 00:00 UTC on the 25th, which is the same UTC day as NOW.
    expect(sameUtcDay(at('2026-09-25T00:00:00.000Z'), NOW)).toBe(true);
    expect(sameUtcDay(at('2026-09-24T23:00:00.000Z'), NOW)).toBe(false);
  });
});
