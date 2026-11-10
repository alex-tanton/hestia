import { describe, expect, it, vi } from 'vitest';
import { FlippDealSource, ItemDetailLruCache } from './flipp-deal-source.js';
import {
  FIXTURE_ITEM_DETAIL,
  FIXTURE_NOW,
  FIXTURE_POSTAL_CODE,
  fixtureTransport,
} from './fixture-transport.js';
import {
  FlippRequestQueue,
  buildUserAgent,
  type HttpGet,
  type QueueLogger,
} from './request-queue.js';

/**
 * The wrapper against the recorded 27514 responses. Every known quirk of the Flipp endpoints has a
 * case here. No test makes a live call.
 */

function sourceWith(get: HttpGet = fixtureTransport(), logger?: QueueLogger) {
  const calls: string[] = [];
  const recording: HttpGet = (url, headers) => {
    calls.push(url);
    return get(url, headers);
  };
  const source = new FlippDealSource({
    queue: new FlippRequestQueue({
      get: recording,
      userAgent: buildUserAgent('https://hestia.aberrance.app'),
      minGapMs: 0,
      attempts: 1,
      ...(logger === undefined ? {} : { logger }),
    }),
    now: () => FIXTURE_NOW,
    ...(logger === undefined ? {} : { logger }),
  });
  return { source, calls };
}

describe('listFlyers', () => {
  it('returns only flyers active at the given instant', async () => {
    const { source } = sourceWith();
    const flyers = await source.listFlyers(FIXTURE_POSTAL_CODE);

    expect(flyers.length).toBeGreaterThan(40);
    for (const flyer of flyers) {
      expect(flyer.validFrom <= '2026-09-19').toBe(true);
      expect(flyer.validTo >= '2026-09-19').toBe(true);
    }
    // ALDI publishes next week's flyer early; it starts 2026-09-23 and must not appear.
    expect(flyers.map((flyer) => flyer.flyerId)).not.toContain('8131568');
    expect(flyers.map((flyer) => flyer.flyerId)).toContain('8131738');
  });

  it('gives calendar dates in the store offset, not UTC', async () => {
    const { source } = sourceWith();
    const flyers = await source.listFlyers(FIXTURE_POSTAL_CODE);
    const harrisTeeter = flyers.find((flyer) => flyer.flyerId === '8132883');

    // Raw: "2026-09-16T00:00:00-04:00" to "2026-09-22T23:59:59-04:00".
    expect(harrisTeeter).toMatchObject({
      merchantId: '2431',
      merchantName: 'Harris Teeter',
      validFrom: '2026-09-16',
      validTo: '2026-09-22',
    });
  });

  it('rewrites http image URLs to https, which the CSP requires', async () => {
    const { source } = sourceWith();
    const flyers = await source.listFlyers(FIXTURE_POSTAL_CODE);

    for (const flyer of flyers) {
      expect(flyer.thumbnailUrl ?? 'https://').toMatch(/^https:\/\//);
      expect(flyer.logoUrl ?? 'https://').toMatch(/^https:\/\//);
    }
  });

  it('caches the flyers response in memory rather than refetching', async () => {
    const { source, calls } = sourceWith();
    await source.listFlyers(FIXTURE_POSTAL_CODE);
    await source.listFlyers(FIXTURE_POSTAL_CODE);

    expect(calls.filter((url) => url.includes('/flipp/flyers?'))).toHaveLength(1);
  });
});

describe('searchItems', () => {
  it('normalizes priced items and dates them from their flyer', async () => {
    const { source } = sourceWith();
    const deals = await source.searchItems(FIXTURE_POSTAL_CODE, 'harris teeter');
    const eggs = deals.find((deal) => deal.externalId === '1040206850');

    expect(eggs).toMatchObject({
      name: "Egg-Land's Best Extra Large Eggs",
      merchantId: '2431',
      merchantName: 'Harris Teeter',
      unitPrice: 250,
      priceUnit: 'each',
      displayPrice: '2/$5.00',
      conditionalPrice: true,
      conditionalReason: 'loyalty_card',
      flyerId: '8132883',
      // Search timestamps are UTC; these dates come from the flyer's local offset.
      validFrom: '2026-09-16',
      validTo: '2026-09-22',
      sourceUrl: null,
    });
  });

  it('takes the category from _L2, falling back to _L1', async () => {
    const { source } = sourceWith();
    const deals = await source.searchItems(FIXTURE_POSTAL_CODE, 'harris teeter');

    expect(deals.find((deal) => deal.externalId === '1038943469')?.category).toBe('Food Items');
    expect(deals.every((deal) => deal.category === null || deal.category.length > 0)).toBe(true);
  });

  it('drops items whose flyer is not in the postal code response', async () => {
    const { source } = sourceWith();
    const deals = await source.searchItems(FIXTURE_POSTAL_CODE, 'milk');

    // The search reaches beyond the flyers the postal code lists; nothing may be dated by guess.
    const flyers = new Set((await source.listFlyers(FIXTURE_POSTAL_CODE)).map((f) => f.flyerId));
    for (const deal of deals) expect(flyers.has(deal.flyerId)).toBe(true);
    expect(deals.length).toBeLessThan(150);
  });

  it('fetches the flyers for a postal code before searching it', async () => {
    const { source, calls } = sourceWith();
    await source.searchItems(FIXTURE_POSTAL_CODE, 'chicken');

    expect(calls[0]).toContain('/flipp/flyers?postal_code=27514');
    expect(calls[1]).toContain('/flipp/items/search?postal_code=27514&q=chicken');
  });

  it('trims merchant names', async () => {
    const { source } = sourceWith();
    const deals = await source.searchItems(FIXTURE_POSTAL_CODE, 'chicken');

    for (const deal of deals) expect(deal.merchantName).toBe(deal.merchantName.trim());
  });

  it('counts what it skipped, per merchant, with reasons', async () => {
    const { source } = sourceWith();
    await source.searchItems(FIXTURE_POSTAL_CODE, 'publix');
    const publix = source.skipCounts().find((count) => count.merchantId === '2361');

    expect(publix).toMatchObject({ merchantName: 'Publix' });
    expect(publix?.skipped).toBeGreaterThan(0);
    // Publix prints BOGO with no price at all on most of its flyer.
    expect(publix?.reasons.bogo_no_base).toBeGreaterThan(0);
    expect(publix?.fetched).toBeGreaterThan(publix?.skipped ?? 0);
  });

  it('warns when a merchant skips more than 40% of its items', async () => {
    const warn = vi.fn<QueueLogger['warn']>();
    const { source } = sourceWith(fixtureTransport(), { warn });
    await source.searchItems(FIXTURE_POSTAL_CODE, 'publix');

    expect(warn).toHaveBeenCalled();
    expect(
      warn.mock.calls.some(
        ([data]) => (data as { merchantName: string }).merchantName === 'Publix',
      ),
    ).toBe(true);
  });

  it('forgets its counts when the next refresh resets them', async () => {
    const { source } = sourceWith();
    await source.searchItems(FIXTURE_POSTAL_CODE, 'publix');
    expect(source.skipCounts().length).toBeGreaterThan(0);

    source.resetSkipCounts();
    expect(source.skipCounts()).toEqual([]);
  });
});

describe('listFlyerItems', () => {
  it('prices each product from its item detail, not from the listing', async () => {
    const { source, calls } = sourceWith();
    // The roster gives "6.0" with no qualifier; the detail says "2/" with a VIC card story.
    const deals = await source.listFlyerItems('8132883');

    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      externalId: '1040206756',
      unitPrice: 300,
      displayPrice: '2/$6.00',
      conditionalReason: 'loyalty_card',
      // Flyer items have no category.
      category: null,
      flyerId: '8132883',
    });
    expect(calls.some((url) => url.endsWith('/flipp/items/1040206756'))).toBe(true);
  });

  it('takes the source URL from item detail', async () => {
    const { source } = sourceWith();
    const deals = await source.listFlyerItems('8139694');

    expect(deals[0]?.sourceUrl).toBe(
      'https://www.cvs.com/shop/deals/23075?icid=weeklyad-shopnow-92026-adblk-23075',
    );
  });

  it('skips an empty listing price without asking for its detail', async () => {
    const { source, calls } = sourceWith();
    await source.listFlyerItems('8132883');

    const counts = source.skipCounts().find((count) => count.merchantId === '2431');
    expect(counts?.reasons.no_price).toBe(1);
    // One roster request and one detail request: the empty-priced item cost nothing.
    expect(calls.filter((url) => url.includes('/flipp/items/'))).toHaveLength(1);
  });

  it('ignores banners rather than counting them as skipped', async () => {
    const { source } = sourceWith();
    await source.listFlyerItems('8132883');

    // The roster holds a product, an empty-priced product, and a display_type 5 banner.
    const counts = source.skipCounts().find((count) => count.merchantId === '2431');
    expect(counts).toMatchObject({ fetched: 2, skipped: 1 });
  });

  it('counts an item whose detail cannot be fetched as skipped, and keeps the rest', async () => {
    const failing: HttpGet = (url, headers) =>
      url.includes('/flipp/items/1040206756')
        ? Promise.resolve({ status: 500, json: () => Promise.reject(new Error('no body')) })
        : fixtureTransport()(url, headers);
    const { source } = sourceWith(failing);

    await expect(source.listFlyerItems('8132883')).resolves.toEqual([]);
    expect(source.skipCounts()[0]?.reasons.detail_unavailable).toBe(1);
  });

  it('writes nothing for a flyer the circuit breaker cuts short', async () => {
    // Five consecutive failures open the breaker; the flyer must then be abandoned whole, so the
    // next run fetches it complete rather than storing half of it.
    let seen = 0;
    const failing: HttpGet = (url, headers) => {
      if (url.includes('/flipp/items/')) {
        seen += 1;
        return Promise.resolve({ status: 503, json: () => Promise.reject(new Error('no body')) });
      }
      return fixtureTransport()(url, headers);
    };
    const source = new FlippDealSource({
      queue: new FlippRequestQueue({
        get: failing,
        userAgent: buildUserAgent('https://hestia.aberrance.app'),
        minGapMs: 0,
        attempts: 1,
        failureThreshold: 1,
      }),
      now: () => FIXTURE_NOW,
    });

    // The failure that opened the breaker is the one that ends the flyer.
    await expect(source.listFlyerItems('8132883')).rejects.toThrow(/Flipp request failed \(503\)/);
    expect(seen).toBe(1);
    expect(source.skipCounts()).toEqual([]);
  });

  it('reuses cached item details across multiple calls avoiding duplicate network fetches', async () => {
    const { source, calls } = sourceWith();
    // First call fetches flyer roster and item detail for 1040206756
    const deals1 = await source.listFlyerItems('8132883');
    expect(deals1).toHaveLength(1);
    const detailCallsAfterFirst = calls.filter((url) => url.includes('/flipp/items/1040206756'));
    expect(detailCallsAfterFirst).toHaveLength(1);

    // Second call on same flyer reuses the LRU cache
    const deals2 = await source.listFlyerItems('8132883');
    expect(deals2).toHaveLength(1);
    const detailCallsAfterSecond = calls.filter((url) => url.includes('/flipp/items/1040206756'));
    expect(detailCallsAfterSecond).toHaveLength(1);
  });

  it('resolves candidate items concurrently', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const get: HttpGet = async (url) => {
      if (url.includes('/flipp/flyers/test-flyer')) {
        return {
          status: 200,
          json: () =>
            Promise.resolve({
              items: [
                { id: 'item-1', display_type: 1, price: '2.99' },
                { id: 'item-2', display_type: 1, price: '3.99' },
                { id: 'item-3', display_type: 1, price: '4.99' },
              ],
            }),
        };
      }
      if (url.includes('/flipp/items/')) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 30));
        inFlight -= 1;
        return {
          status: 200,
          json: () =>
            Promise.resolve({
              item: {
                name: 'Test Item',
                merchant: 'Test Merchant',
                merchant_id: '123',
                current_price: '2.99',
                valid_from: '2026-09-16T00:00:00-04:00',
                valid_to: '2026-09-22T23:59:59-04:00',
              },
            }),
        };
      }
      return { status: 200, json: () => Promise.resolve({}) };
    };

    const source = new FlippDealSource({
      queue: new FlippRequestQueue({
        get,
        userAgent: buildUserAgent('https://hestia.aberrance.app'),
        concurrency: 4,
        minGapMs: 0,
      }),
      now: () => FIXTURE_NOW,
    });

    const deals = await source.listFlyerItems('test-flyer');
    expect(deals).toHaveLength(3);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it('aborts listFlyerItems completely when circuit breaker opens', async () => {
    const queue = new FlippRequestQueue({
      get: (url) => {
        if (url.includes('/flipp/flyers/')) {
          return Promise.resolve({
            status: 200,
            json: () =>
              Promise.resolve({
                items: [
                  { id: 'item-1', display_type: 1, price: '1.99' },
                  { id: 'item-2', display_type: 1, price: '2.99' },
                ],
              }),
          });
        }
        return Promise.resolve({
          status: 500,
          json: () => Promise.resolve({}),
        });
      },
      userAgent: buildUserAgent('https://hestia.aberrance.app'),
      minGapMs: 0,
      attempts: 1,
      failureThreshold: 1,
    });

    const source = new FlippDealSource({
      queue,
      now: () => FIXTURE_NOW,
    });

    await expect(source.listFlyerItems('test-flyer')).rejects.toThrow();
    expect(queue.isOpen).toBe(true);
  });
});

describe('ItemDetailLruCache', () => {
  it('stores and retrieves item details within TTL', () => {
    const cache = new ItemDetailLruCache(10, 6 * 60 * 60 * 1_000);
    cache.set('item-1', { name: 'Apples' }, 1_000);

    expect(cache.size).toBe(1);
    expect(cache.get('item-1', 1_000 + 1_000)).toEqual({ name: 'Apples' });
  });

  it('expires entries after the 6-hour TTL', () => {
    const ttlMs = 6 * 60 * 60 * 1_000;
    const cache = new ItemDetailLruCache(10, ttlMs);
    const now = 10_000;
    cache.set('item-1', { name: 'Apples' }, now);

    expect(cache.get('item-1', now + ttlMs)).toEqual({ name: 'Apples' });
    expect(cache.get('item-1', now + ttlMs + 1)).toBeNull();
    expect(cache.size).toBe(0);
  });

  it('evicts least recently used item when max capacity is exceeded', () => {
    const cache = new ItemDetailLruCache(3, 100_000);
    cache.set('item-1', { id: 1 }, 1_000);
    cache.set('item-2', { id: 2 }, 1_000);
    cache.set('item-3', { id: 3 }, 1_000);

    expect(cache.size).toBe(3);

    // Access item-1 so it becomes most recently used
    expect(cache.get('item-1', 2_000)).toEqual({ id: 1 });

    // Insert item-4: oldest unaccessed item (item-2) should be evicted
    cache.set('item-4', { id: 4 }, 2_000);

    expect(cache.size).toBe(3);
    expect(cache.get('item-1', 2_000)).toEqual({ id: 1 });
    expect(cache.get('item-2', 2_000)).toBeNull();
    expect(cache.get('item-3', 2_000)).toEqual({ id: 3 });
    expect(cache.get('item-4', 2_000)).toEqual({ id: 4 });
  });

  it('clears all items when clear() is called', () => {
    const cache = new ItemDetailLruCache(10);
    cache.set('item-1', { id: 1 });
    cache.set('item-2', { id: 2 });
    expect(cache.size).toBe(2);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('item-1')).toBeNull();
  });
});

describe('listMerchants', () => {
  it('returns only directory entries with an active flyer at the postal code', async () => {
    const { source } = sourceWith();
    const merchants = await source.listMerchants(FIXTURE_POSTAL_CODE);
    const ids = merchants.map((merchant) => merchant.merchantId);

    // The directory itself lists about 2,500 retailers and ignores postal code entirely.
    expect(merchants.length).toBeLessThan(100);
    expect(ids).toContain('2431');
    expect(ids).toContain('2100');
    // Walmart Canada (234) is in the directory but has no flyer here.
    expect(ids).not.toContain('234');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('takes logos from the flyers response, since the directory has none', async () => {
    const { source } = sourceWith();
    const merchants = await source.listMerchants(FIXTURE_POSTAL_CODE);
    const harrisTeeter = merchants.find((merchant) => merchant.merchantId === '2431');

    expect(harrisTeeter?.name).toBe('Harris Teeter');
    expect(harrisTeeter?.logoUrl).toMatch(/^https:\/\/images\.wishabi\.net\//);
  });

  it('trims merchant names', async () => {
    const { source } = sourceWith();
    const merchants = await source.listMerchants(FIXTURE_POSTAL_CODE);

    // "Costco " and "Tractor Supply Company " come back with trailing spaces.
    for (const merchant of merchants) expect(merchant.name).toBe(merchant.name.trim());
    expect(merchants.map((merchant) => merchant.name)).toContain('Costco');
  });

  it('caches the directory in memory across postal codes', async () => {
    const { source, calls } = sourceWith();
    await source.listMerchants(FIXTURE_POSTAL_CODE);
    await source.listMerchants(FIXTURE_POSTAL_CODE);

    expect(calls.filter((url) => url.includes('/flipp/merchants'))).toHaveLength(1);
  });
});

describe('in-flight coalescing', () => {
  /** A transport that counts its calls and holds every one open until `release` is called. */
  function gatedTransport(body: unknown): {
    get: HttpGet;
    release: () => void;
    callCount: () => number;
  } {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const get: HttpGet = async () => {
      calls += 1;
      await gate;
      return { status: 200, json: () => Promise.resolve(body) };
    };
    return { get, release, callCount: () => calls };
  }

  it('coalesces concurrent cold-cache flyer requests into one fetch', async () => {
    const { get, release, callCount } = gatedTransport({ flyers: [] });
    const source = new FlippDealSource({
      queue: new FlippRequestQueue({
        get,
        userAgent: buildUserAgent('https://hestia.aberrance.app'),
        minGapMs: 0,
        attempts: 1,
      }),
      now: () => FIXTURE_NOW,
    });

    // Three callers race a cold cache before any of them can have populated it.
    const first = source.listFlyers(FIXTURE_POSTAL_CODE);
    const second = source.listFlyers(FIXTURE_POSTAL_CODE);
    const third = source.listFlyers(FIXTURE_POSTAL_CODE);
    release();
    const [a, b, c] = await Promise.all([first, second, third]);

    expect(callCount()).toBe(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('coalesces concurrent cold-cache merchant-directory requests into one fetch', async () => {
    const flyers = gatedTransport({ flyers: [] });
    const merchants = gatedTransport({ merchants: [] });
    const get: HttpGet = (url, headers) =>
      url.includes('/flipp/merchants') ? merchants.get(url, headers) : flyers.get(url, headers);
    const source = new FlippDealSource({
      queue: new FlippRequestQueue({
        get,
        userAgent: buildUserAgent('https://hestia.aberrance.app'),
        minGapMs: 0,
        attempts: 1,
      }),
      now: () => FIXTURE_NOW,
    });

    const first = source.listMerchants(FIXTURE_POSTAL_CODE);
    const second = source.listMerchants(FIXTURE_POSTAL_CODE);
    const third = source.listMerchants(FIXTURE_POSTAL_CODE);
    flyers.release();
    merchants.release();
    await Promise.all([first, second, third]);

    expect(flyers.callCount()).toBe(1);
    expect(merchants.callCount()).toBe(1);
  });

  it('gives the caller right after a failed fetch a fresh attempt, not the failed promise', async () => {
    let calls = 0;
    const get: HttpGet = () => {
      calls += 1;
      if (calls === 1) return Promise.resolve({ status: 500, json: () => Promise.resolve({}) });
      return Promise.resolve({ status: 200, json: () => Promise.resolve({ flyers: [] }) });
    };
    const source = new FlippDealSource({
      queue: new FlippRequestQueue({
        get,
        userAgent: buildUserAgent('https://hestia.aberrance.app'),
        minGapMs: 0,
        attempts: 1,
      }),
      now: () => FIXTURE_NOW,
    });

    // Chained onto the first call's own rejection, so the second call is issued the instant the
    // first settles — the tightest race between the in-flight entry being cleared and a new
    // caller arriving. A stale-promise leak would hand this caller the first failure again
    // instead of triggering fetch #2.
    const firstFailure = source.listFlyers(FIXTURE_POSTAL_CODE).catch((error: unknown) => error);
    const second = firstFailure.then(() => source.listFlyers(FIXTURE_POSTAL_CODE));

    const failure: unknown = await firstFailure;
    expect(failure).toBeInstanceOf(Error);
    await expect(second).resolves.toEqual([]);
    expect(calls).toBe(2);
  });
});

describe('item detail fixtures', () => {
  it('covers one item per captured merchant flyer', () => {
    // Guards the roster subset the fixture transport serves: five captured details.
    expect(Object.keys(FIXTURE_ITEM_DETAIL)).toHaveLength(5);
  });
});
