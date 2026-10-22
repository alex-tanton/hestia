import type { Kysely } from 'kysely';
import { normalize } from '@hearth/matching';
import type {
  Deal,
  DealSearchQuery,
  DealSearchResponse,
  FlyerItemsQuery,
  FlyerItemsResponse,
  FlyersQuery,
  FlyersResponse,
  MerchantsResponse,
} from '@hearth/shared';
import type { Database } from '../../db.js';
import type {
  DealSource,
  Flyer as SourceFlyer,
  Merchant as SourceMerchant,
} from '../../deals/deal-source.js';
import { CircuitOpenError, FlippRequestError } from '../../deals/flipp/request-queue.js';
import { fail } from '../../problem.js';
import { favoriteMerchantIds } from './favorite-stores.js';
import {
  FLYERS_TTL_MS,
  MERCHANTS_TTL_MS,
  SEARCH_TTL_MS,
  StaleWhileFailingCache,
  freshness,
  isFresh,
  serveAfterFailure,
  type CacheEntry,
} from './cache.js';
import { shouldQueueOnDemandRefresh } from './dormancy.js';
import { selectDeals } from './filter.js';
import {
  countDealsByFlyer,
  readDealsInOrder,
  readFlyerDeals,
  readQueryCache,
  readRefreshBookkeeping,
  upsertDeals,
  writeQueryCache,
} from './storage.js';

/**
 * The deals read path.
 *
 * Three rules govern every function here:
 *
 * 1. **A cache serves what it can.** No fetch is ever triggered by a user action a cache could
 *    answer.
 * 2. **Stale beats empty.** When a live fetch fails and anything is cached, the cached data comes
 *    back with its "as of" age rather than an error.
 * 3. **Dormancy governs flyers and flyer items only.** A keyword search that misses its cache
 *    always fetches live, dormant or not.
 */

export interface HouseholdContext {
  householdId: string;
  postalCode: string;
}

/**
 * Claims the dormant postal code's one on-demand refresh for the UTC day. The caller must run
 * this in its own transaction, committed before it resolves — never the request's own, still-open
 * transaction — so that a later, unrelated failure in the same request cannot roll the claim back
 * out from under a refresh that has already been queued, and so a concurrent claimant reliably
 * sees it (rate discipline for dormant postal codes).
 */
export type ClaimOnDemandRefresh = (postalCode: string, now: Date) => Promise<boolean>;

export interface DealsLogger {
  info: (data: Record<string, unknown>, message: string) => void;
  warn: (data: Record<string, unknown>, message: string) => void;
}

export interface DealsServiceOptions {
  source: DealSource;
  /**
   * Queues one background refresh of a dormant postal code, through the same serialized queue and
   * circuit breaker as the daily run. Fire and forget: the request that triggered it returns
   * immediately with whatever is cached.
   */
  queueBackgroundRefresh: (postalCode: string) => void;
  now?: () => Date;
  logger?: DealsLogger;
}

/** A fetch that failed upstream, as opposed to a bug here. */
function isFetchFailure(error: unknown): boolean {
  return error instanceof FlippRequestError || error instanceof CircuitOpenError;
}

const UNAVAILABLE = 'Deals are unavailable right now. Try again in a few minutes.';

export class DealsService {
  private readonly source: DealSource;
  private readonly queueBackgroundRefresh: (postalCode: string) => void;
  private readonly now: () => Date;
  private readonly logger: DealsLogger | undefined;
  /** Flyers by postal code, 12 hours, and the merchant directory, 7 days: both in process. */
  private readonly flyerCache = new StaleWhileFailingCache<SourceFlyer[]>();
  private readonly merchantCache = new StaleWhileFailingCache<SourceMerchant[]>();

  constructor(options: DealsServiceOptions) {
    this.source = options.source;
    this.queueBackgroundRefresh = options.queueBackgroundRefresh;
    this.now = options.now ?? (() => new Date());
    this.logger = options.logger;
  }

  /**
   * Keyword search. The cache is `deal_query_cache`, keyed on (postal code, normalized query),
   * holding the ids the last live search returned in the order it ranked them; the deals
   * themselves live in `deal`. Dormancy does not apply.
   */
  async searchDeals(
    db: Kysely<Database>,
    household: HouseholdContext,
    query: DealSearchQuery,
  ): Promise<DealSearchResponse> {
    const now = this.now();
    const normalizedQuery = normalize(query.q);
    const cached = await readQueryCache(db, household.postalCode, normalizedQuery);

    let dealIds: readonly string[];
    let asOf: Date;
    let stale = false;

    if (cached !== undefined && isFresh(cached.cachedAt, now, SEARCH_TTL_MS)) {
      dealIds = cached.dealIds;
      asOf = cached.cachedAt;
    } else {
      try {
        const found = await this.source.searchItems(household.postalCode, query.q);
        dealIds = await upsertDeals(db, household.postalCode, found, now);
        await writeQueryCache(db, household.postalCode, normalizedQuery, dealIds, now);
        asOf = now;
      } catch (error: unknown) {
        if (!isFetchFailure(error)) throw error;
        // Stale beats empty: an expired entry is still this week's deals.
        const fallback = serveAfterFailure(
          cached === undefined ? undefined : { value: cached.dealIds, fetchedAt: cached.cachedAt },
        );
        if (fallback === 'unavailable') throw fail(503, UNAVAILABLE);
        this.logger?.warn(
          { postalCode: household.postalCode, cachedAt: fallback.fetchedAt.toISOString() },
          'serving a stale deal search after a failed fetch',
        );
        dealIds = fallback.value;
        asOf = fallback.fetchedAt;
        stale = true;
      }
    }

    const deals = await readDealsInOrder(db, household.postalCode, dealIds);
    const scoped = await this.scopeToFavorites(db, household, query.scope, query.stores, deals);
    const page = selectDeals(scoped, {
      category: query.category,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      sort: query.sort,
      page: query.page,
    });

    return {
      deals: page.items,
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      hasMore: page.hasMore,
      asOf: asOf.toISOString(),
      stale,
      refreshing: false,
    };
  }

  /**
   * The active flyers near the household. A dormant postal code queues its one background
   * refresh for the UTC day and returns immediately with whatever is cached, marked stale, or an
   * empty list, both with `refreshing: true`.
   */
  async listFlyers(
    db: Kysely<Database>,
    household: HouseholdContext,
    query: FlyersQuery,
    claimOnDemandRefresh: ClaimOnDemandRefresh,
  ): Promise<FlyersResponse> {
    const now = this.now();
    const refreshing = await this.maybeQueueRefresh(
      db,
      household.postalCode,
      now,
      claimOnDemandRefresh,
    );
    const cached = this.flyerCache.get(household.postalCode);

    let entry: CacheEntry<SourceFlyer[]> | undefined = cached;
    let stale = false;

    if (refreshing) {
      // The refresh is already queued; a second fetch on this request would break the one-per-day
      // rule the claim above enforces.
      stale = cached !== undefined;
    } else if (cached !== undefined && isFresh(cached.fetchedAt, now, FLYERS_TTL_MS)) {
      entry = cached;
    } else {
      try {
        entry = this.flyerCache.set(
          household.postalCode,
          await this.source.listFlyers(household.postalCode),
          now,
        );
      } catch (error: unknown) {
        if (!isFetchFailure(error)) throw error;
        if (cached === undefined) throw fail(503, UNAVAILABLE);
        this.logger?.warn(
          { postalCode: household.postalCode, cachedAt: cached.fetchedAt.toISOString() },
          'serving stale flyers after a failed fetch',
        );
        entry = cached;
        stale = true;
      }
    }

    const favorites = new Set(await favoriteMerchantIds(db, household.householdId));
    const counts = await countDealsByFlyer(db, household.postalCode);
    const flyers = (entry?.value ?? [])
      .filter((flyer) => query.scope === 'all' || favorites.has(flyer.merchantId))
      .map((flyer) => ({
        flyerId: flyer.flyerId,
        merchantId: flyer.merchantId,
        merchantName: flyer.merchantName,
        validFrom: flyer.validFrom,
        validTo: flyer.validTo,
        thumbnailUrl: flyer.thumbnailUrl,
        logoUrl: flyer.logoUrl,
        isFavorite: favorites.has(flyer.merchantId),
        itemCount: counts.get(flyer.flyerId) ?? 0,
      }));

    return { flyers, ...freshness(entry, { stale, refreshing }) };
  }

  /**
   * One flyer's deals, served from `deal` — which is the flyer-item cache, by `flyer_id`, until
   * the flyer's `valid_to`. A flyer's items are fetched by the refresh, for favorited merchants
   * only, and never inline: one flyer costs its roster request plus an item-detail request per
   * priced product, a few hundred requests over minutes, which is not something a screen may
   * trigger.
   */
  async listFlyerItems(
    db: Kysely<Database>,
    household: HouseholdContext,
    flyerId: string,
    query: FlyerItemsQuery,
    claimOnDemandRefresh: ClaimOnDemandRefresh,
  ): Promise<FlyerItemsResponse> {
    const now = this.now();
    const deals = await readFlyerDeals(db, household.postalCode, flyerId);
    const refreshing =
      deals.length === 0 &&
      (await this.maybeQueueRefresh(db, household.postalCode, now, claimOnDemandRefresh));

    const page = selectDeals(deals, {
      category: query.category,
      sort: query.sort,
      page: query.page,
    });

    return {
      deals: page.items,
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      hasMore: page.hasMore,
      asOf: newestFetch(deals),
      stale: false,
      refreshing,
    };
  }

  /**
   * The merchants with an active flyer near the postal code, from the global directory cached for
   * seven days. Not governed by dormancy: the directory is one request and it is what the
   * favorite-store picker needs.
   */
  async listMerchants(
    db: Kysely<Database>,
    household: HouseholdContext,
  ): Promise<MerchantsResponse> {
    const now = this.now();
    const cached = this.merchantCache.get(household.postalCode);
    let entry = cached;
    let stale = false;

    if (cached === undefined || !isFresh(cached.fetchedAt, now, MERCHANTS_TTL_MS)) {
      try {
        entry = this.merchantCache.set(
          household.postalCode,
          await this.source.listMerchants(household.postalCode),
          now,
        );
      } catch (error: unknown) {
        if (!isFetchFailure(error)) throw error;
        if (cached === undefined) throw fail(503, UNAVAILABLE);
        entry = cached;
        stale = true;
      }
    }

    const favorites = new Set(await favoriteMerchantIds(db, household.householdId));
    return {
      merchants: (entry?.value ?? []).map((merchant) => ({
        merchantId: merchant.merchantId,
        name: merchant.name,
        logoUrl: merchant.logoUrl,
        isFavorite: favorites.has(merchant.merchantId),
      })),
      ...freshness(entry, { stale, refreshing: false }),
    };
  }

  /** Only the tests reset the in-process caches; the process outlives them otherwise. */
  clearCaches(): void {
    this.flyerCache.clear();
    this.merchantCache.clear();
  }

  private async scopeToFavorites(
    db: Kysely<Database>,
    household: HouseholdContext,
    scope: DealSearchQuery['scope'],
    stores: readonly string[],
    deals: readonly Deal[],
  ): Promise<Deal[]> {
    const explicit = stores.length > 0 ? new Set(stores) : undefined;
    if (scope === 'all') {
      return explicit === undefined ? [...deals] : deals.filter((d) => explicit.has(d.merchantId));
    }
    const favorites = new Set(await favoriteMerchantIds(db, household.householdId));
    // A household with no favorites yet sees everything rather than nothing; the screen prompts
    // for favorites and browse-all is available immediately.
    if (favorites.size === 0) {
      return explicit === undefined ? [...deals] : deals.filter((d) => explicit.has(d.merchantId));
    }
    return deals.filter(
      (deal) =>
        favorites.has(deal.merchantId) && (explicit === undefined || explicit.has(deal.merchantId)),
    );
  }

  /**
   * Claims and queues the one background refresh a dormant postal code gets per UTC day. The
   * claim is the write to `last_on_demand_at`, so the limit holds whether or not any deal rows
   * exist, and two concurrent requests queue one refresh between them.
   *
   * `claim` runs and commits in its own transaction, independent of this request's — see
   * `ClaimOnDemandRefresh`. Only a claim that has actually committed ever reaches
   * `queueBackgroundRefresh`, so a later failure elsewhere in this same request, which rolls this
   * request's own transaction back, can never retroactively un-happen a refresh already queued.
   */
  private async maybeQueueRefresh(
    db: Kysely<Database>,
    postalCode: string,
    now: Date,
    claim: ClaimOnDemandRefresh,
  ): Promise<boolean> {
    const bookkeeping = await readRefreshBookkeeping(db, postalCode);
    if (!shouldQueueOnDemandRefresh(bookkeeping, now)) return false;
    if (!(await claim(postalCode, now))) return false;
    this.logger?.info(
      { postalCode, job: 'refresh-deals', trigger: 'on-demand' },
      'queued one on-demand refresh for a dormant postal code',
    );
    this.queueBackgroundRefresh(postalCode);
    return true;
  }
}

function newestFetch(deals: readonly Deal[]): string | null {
  let newest: string | null = null;
  for (const deal of deals) {
    if (newest === null || deal.fetchedAt > newest) newest = deal.fetchedAt;
  }
  return newest;
}

export function createDealsService(options: DealsServiceOptions): DealsService {
  return new DealsService(options);
}
