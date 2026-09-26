import type {
  DealSource,
  DealSourceStats,
  Flyer,
  Merchant,
  MerchantSkipCount,
  NormalizedDeal,
} from '../deals/deal-source.js';
import { FlippDealSource } from '../deals/flipp/flipp-deal-source.js';
import { FIXTURE_NOW, fixtureTransport } from '../deals/flipp/fixture-transport.js';
import {
  buildUserAgent,
  FlippRequestError,
  FlippRequestQueue,
} from '../deals/flipp/request-queue.js';

/**
 * Deal sources for tests. Tests never call Flipp (Handoff non-negotiable 17): either the real
 * wrapper over the recorded captures, or a double that answers from whatever the test set up.
 */

/** The real wrapper, reading the raw captures from disk at the instant they were captured. */
export function fixtureDealSource(): FlippDealSource {
  return new FlippDealSource({
    queue: new FlippRequestQueue({
      get: fixtureTransport(),
      userAgent: buildUserAgent('https://hearth.invalid'),
      minGapMs: 0,
      attempts: 1,
    }),
    now: () => FIXTURE_NOW,
  });
}

export interface FakeSourceData {
  flyers?: Flyer[];
  merchants?: Merchant[];
  /** Search results by query, verbatim. */
  search?: Record<string, NormalizedDeal[]>;
  /** Flyer items by flyer id. */
  flyerItems?: Record<string, NormalizedDeal[]>;
}

/** A `DealSource` double that records what was asked of it and can be made to fail. */
export class FakeDealSource implements DealSource, DealSourceStats {
  data: FakeSourceData;
  /** When set, every call throws it, which is how the stale-fallback paths are exercised. */
  failure: Error | null = null;
  readonly calls: { mode: string; argument: string }[] = [];
  counts: MerchantSkipCount[] = [];
  resets = 0;

  constructor(data: FakeSourceData = {}) {
    this.data = data;
  }

  searchItems(postalCode: string, query: string): Promise<NormalizedDeal[]> {
    this.calls.push({ mode: 'search', argument: `${postalCode}:${query}` });
    return this.answer(this.data.search?.[query] ?? []);
  }

  listFlyers(postalCode: string): Promise<Flyer[]> {
    this.calls.push({ mode: 'flyers', argument: postalCode });
    return this.answer(this.data.flyers ?? []);
  }

  listFlyerItems(flyerId: string): Promise<NormalizedDeal[]> {
    this.calls.push({ mode: 'flyerItems', argument: flyerId });
    return this.answer(this.data.flyerItems?.[flyerId] ?? []);
  }

  listMerchants(postalCode: string): Promise<Merchant[]> {
    this.calls.push({ mode: 'merchants', argument: postalCode });
    return this.answer(this.data.merchants ?? []);
  }

  skipCounts(): MerchantSkipCount[] {
    return this.counts;
  }

  resetSkipCounts(): void {
    this.resets += 1;
  }

  countOf(mode: string): number {
    return this.calls.filter((call) => call.mode === mode).length;
  }

  private answer<T>(value: T): Promise<T> {
    if (this.failure !== null) return Promise.reject(this.failure);
    return Promise.resolve(value);
  }
}

/** The failure the wrapper raises when a request is spent, which the service treats as stale-able. */
export function fetchFailure(): FlippRequestError {
  return new FlippRequestError('https://backflipp.wishabi.com/flipp/flyers', 503);
}

let dealCounter = 0;

/** A `NormalizedDeal` with everything set, overridable per field. */
export function aDeal(overrides: Partial<NormalizedDeal> = {}): NormalizedDeal {
  dealCounter += 1;
  return {
    externalId: `item-${String(dealCounter)}`,
    name: 'Whole Milk',
    merchantId: '2431',
    merchantName: 'Harris Teeter',
    unitPrice: 399,
    priceUnit: 'each',
    originalPrice: 499,
    discountPercent: 20,
    displayPrice: '$3.99',
    conditionalPrice: false,
    conditionalReason: null,
    category: 'Dairy',
    flyerId: '8132883',
    validFrom: '2026-09-19',
    validTo: '2026-09-25',
    imageUrl: 'https://f.wishabi.net/milk.png',
    sourceUrl: null,
    ...overrides,
  };
}

export function aFlyer(overrides: Partial<Flyer> = {}): Flyer {
  return {
    flyerId: '8132883',
    merchantId: '2431',
    merchantName: 'Harris Teeter',
    validFrom: '2026-09-19',
    validTo: '2026-09-25',
    thumbnailUrl: 'https://f.wishabi.net/thumb.png',
    logoUrl: 'https://images.wishabi.net/logo.png',
    ...overrides,
  };
}
