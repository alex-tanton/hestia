import { describe, expect, it } from 'vitest';
import type { Flyer } from '../deals/deal-source.js';
import { planFlyerRefreshNotifications, planRefresh } from './refresh-plan.js';

/**
 * Technical Architecture, "Daily refresh", and Handoff non-negotiable 19: one fetch per active
 * postal code, flyer items only for favorited merchants, and each flyer only once.
 */

const TODAY = '2026-09-25';
/** This run's start: 08:00 UTC, the daily refresh's hour. */
const RUN_AT = new Date('2026-09-25T08:00:00.000Z');
/**
 * When yesterday's run stamped this postal code. Cron starts consecutive runs exactly 24 hours
 * apart and the stamp is written after the run starts, so a covered postal code's stamp is always
 * a little under a day old.
 */
const YESTERDAYS_RUN = new Date('2026-09-24T08:00:30.000Z');

function flyer(overrides: Partial<Flyer> = {}): Flyer {
  return {
    flyerId: '8128502',
    merchantId: '2100',
    merchantName: 'Food Lion',
    validFrom: '2026-09-23',
    validTo: '2026-09-29',
    thumbnailUrl: null,
    logoUrl: null,
    ...overrides,
  };
}

const foodLion = flyer();
const harrisTeeter = flyer({
  flyerId: '8132883',
  merchantId: '2431',
  merchantName: 'Harris Teeter',
});
const aldi = flyer({ flyerId: '8131738', merchantId: '2353', merchantName: 'ALDI' });

describe('planRefresh', () => {
  it('fetches items only for favorited merchants', () => {
    const plan = planRefresh({
      flyers: [foodLion, harrisTeeter, aldi],
      favoriteMerchantIds: new Set(['2100', '2431']),
      knownFlyerIds: new Set(),
      today: TODAY,
    });
    expect(plan.fetch.map((one) => one.merchantName)).toStrictEqual(['Food Lion', 'Harris Teeter']);
    expect(plan.notFavorited.map((one) => one.merchantName)).toStrictEqual(['ALDI']);
  });

  it('fetches nothing when the postal code has no favorites at all', () => {
    const plan = planRefresh({
      flyers: [foodLion, harrisTeeter],
      favoriteMerchantIds: new Set(),
      knownFlyerIds: new Set(),
      today: TODAY,
    });
    expect(plan.fetch).toStrictEqual([]);
    expect(plan.notFavorited).toHaveLength(2);
  });

  it('never re-fetches a favorited flyer whose deals are stored and still valid', () => {
    const plan = planRefresh({
      flyers: [foodLion],
      favoriteMerchantIds: new Set(['2100']),
      knownFlyerIds: new Set(['8128502']),
      today: TODAY,
    });
    expect(plan.fetch).toStrictEqual([]);
    expect(plan.alreadyStored.map((one) => one.flyerId)).toStrictEqual(['8128502']);
    expect(plan.newFlyers).toStrictEqual([]);
  });

  it('re-fetches a stored flyer once it has expired, because its rows are being pruned', () => {
    const expired = flyer({ validTo: '2026-09-24' });
    const plan = planRefresh({
      flyers: [expired],
      favoriteMerchantIds: new Set(['2100']),
      knownFlyerIds: new Set(['8128502']),
      today: TODAY,
    });
    expect(plan.fetch).toHaveLength(1);
    expect(plan.alreadyStored).toStrictEqual([]);
  });

  it('treats a flyer valid through today as still valid', () => {
    const plan = planRefresh({
      flyers: [flyer({ validTo: TODAY })],
      favoriteMerchantIds: new Set(['2100']),
      knownFlyerIds: new Set(['8128502']),
      today: TODAY,
    });
    expect(plan.alreadyStored).toHaveLength(1);
  });

  it('marks a favorited flyer new when no deal row carried its id before the run', () => {
    const plan = planRefresh({
      flyers: [foodLion, harrisTeeter],
      favoriteMerchantIds: new Set(['2100', '2431']),
      knownFlyerIds: new Set(['8128502']),
      today: TODAY,
    });
    expect(plan.newFlyers.map((one) => one.flyerId)).toStrictEqual(['8132883']);
  });

  it('never calls an unfavorited flyer new, since nothing would be told about it', () => {
    const plan = planRefresh({
      flyers: [aldi],
      favoriteMerchantIds: new Set(['2100']),
      knownFlyerIds: new Set(),
      today: TODAY,
    });
    expect(plan.newFlyers).toStrictEqual([]);
  });
});

describe('planFlyerRefreshNotifications', () => {
  const households = [
    { householdId: 'oak', favoriteMerchantIds: ['2100', '2431', '2264'] },
    { householdId: 'rivera', favoriteMerchantIds: ['2361', '2175'] },
  ];

  it('notifies a household whose favorite merchant has a new flyer', () => {
    expect(
      planFlyerRefreshNotifications({
        lastRefreshedAt: YESTERDAYS_RUN,
        startedAt: RUN_AT,
        newFlyers: [harrisTeeter],
        households,
      }),
    ).toStrictEqual(['oak']);
  });

  it('notifies nobody when the new flyer belongs to a merchant nobody favorites', () => {
    expect(
      planFlyerRefreshNotifications({
        lastRefreshedAt: YESTERDAYS_RUN,
        startedAt: RUN_AT,
        newFlyers: [aldi],
        households,
      }),
    ).toStrictEqual([]);
  });

  it('suppresses everything when the postal code had no previous refresh', () => {
    // Every flyer reads as new on a first run, so a household would be told its whole week is news.
    expect(
      planFlyerRefreshNotifications({
        lastRefreshedAt: null,
        startedAt: RUN_AT,
        newFlyers: [foodLion, harrisTeeter],
        households,
      }),
    ).toStrictEqual([]);
  });

  it('suppresses everything on the first refresh after dormancy', () => {
    // The stamp is old because no run since has covered the postal code, which is what dormancy
    // looks like from `postal_code_refresh` — the one stamp a returning household has not moved.
    expect(
      planFlyerRefreshNotifications({
        lastRefreshedAt: new Date('2026-08-01T08:00:00.000Z'),
        startedAt: RUN_AT,
        newFlyers: [foodLion, harrisTeeter],
        households,
      }),
    ).toStrictEqual([]);
  });

  it('still notifies with a stamp one millisecond inside the day', () => {
    expect(
      planFlyerRefreshNotifications({
        lastRefreshedAt: new Date(RUN_AT.getTime() - 24 * 60 * 60 * 1000 + 1),
        startedAt: RUN_AT,
        newFlyers: [harrisTeeter],
        households,
      }),
    ).toStrictEqual(['oak']);
  });

  it('notifies nothing when the run found no new flyer', () => {
    expect(
      planFlyerRefreshNotifications({
        lastRefreshedAt: YESTERDAYS_RUN,
        startedAt: RUN_AT,
        newFlyers: [],
        households,
      }),
    ).toStrictEqual([]);
  });

  it('notifies each household once even when several of its favorites are new', () => {
    expect(
      planFlyerRefreshNotifications({
        lastRefreshedAt: YESTERDAYS_RUN,
        startedAt: RUN_AT,
        newFlyers: [foodLion, harrisTeeter],
        households,
      }),
    ).toStrictEqual(['oak']);
  });
});
