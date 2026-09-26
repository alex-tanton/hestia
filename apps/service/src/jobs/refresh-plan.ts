import type { Flyer } from '../deals/deal-source.js';
import { wasCoveredByLastRun } from '../services/deals/dormancy.js';

/**
 * What one postal code's refresh will fetch, decided before anything is fetched (Technical
 * Architecture, "Daily refresh"). Pure, so the rate-discipline rules are a table-driven unit test
 * rather than something only a live run would reveal.
 *
 * The rules, in order:
 *
 * 1. Flyer items are fetched only for flyers whose merchant is in the union of
 *    `household_favorite_store` merchant ids across the households at that postal code
 *    (Handoff non-negotiable 19).
 * 2. A flyer is fetched only once: never again while `deal` rows for its `flyer_id` exist and it
 *    is still valid. An expired flyer with rows is left alone; pruning removes its rows.
 * 3. A flyer counts as **new** when, before the run, no `deal` row had its `flyer_id`. That is
 *    what `flyer_refresh` notifies about.
 */

export interface RefreshPlanInput {
  flyers: readonly Flyer[];
  /** The union of favorited merchant ids across every household at the postal code. */
  favoriteMerchantIds: ReadonlySet<string>;
  /** `flyer_id`s that already have `deal` rows at this postal code, read before the run. */
  knownFlyerIds: ReadonlySet<string>;
  /** Today in the postal code's own terms; a flyer is valid while `valid_to` is not before it. */
  today: string;
}

export interface RefreshPlan {
  /** The flyers whose items this run fetches, in the order it will fetch them. */
  fetch: Flyer[];
  /** Favorited flyers already stored and still valid, so this run costs nothing for them. */
  alreadyStored: Flyer[];
  /** Favorited flyers that had no `deal` row before the run. */
  newFlyers: Flyer[];
  /** Flyers whose merchant nobody at this postal code favorites; never fetched. */
  notFavorited: Flyer[];
}

export function planRefresh(input: RefreshPlanInput): RefreshPlan {
  const plan: RefreshPlan = { fetch: [], alreadyStored: [], newFlyers: [], notFavorited: [] };

  for (const flyer of input.flyers) {
    if (!input.favoriteMerchantIds.has(flyer.merchantId)) {
      plan.notFavorited.push(flyer);
      continue;
    }
    const known = input.knownFlyerIds.has(flyer.flyerId);
    if (!known) plan.newFlyers.push(flyer);
    // Still valid and already stored: the stored rows are the cache, so there is nothing to do.
    if (known && flyer.validTo >= input.today) {
      plan.alreadyStored.push(flyer);
      continue;
    }
    plan.fetch.push(flyer);
  }

  return plan;
}

export interface FlyerRefreshInput {
  /** `postal_code_refresh.last_refreshed_at` as it was before this run. */
  lastRefreshedAt: Date | null;
  /** When this run started, which is what that stamp is judged against. */
  startedAt: Date;
  /** The favorited flyers this run found to be new, from `planRefresh`. */
  newFlyers: readonly Flyer[];
  /** Each household at the postal code and the merchant ids it favorites. */
  households: readonly { householdId: string; favoriteMerchantIds: readonly string[] }[];
}

/**
 * Which households get a `flyer_refresh` row (Requirements, "Notifications › Triggers and outbox
 * keys"; Technical Architecture, "Daily refresh"). Nothing is enqueued when the last daily run
 * did not cover this postal code — whether that is its first refresh ever or its first after
 * dormancy — because every flyer would read as new and the household would be told its whole
 * week is fresh news.
 *
 * Dormancy is judged from `last_refreshed_at`, never from `last_active_at`: the request that
 * queues a dormant postal code's refresh has already stamped its own household active, so by the
 * time that refresh runs there is no dormant household left for it to see.
 */
export function planFlyerRefreshNotifications(input: FlyerRefreshInput): string[] {
  if (!wasCoveredByLastRun(input.lastRefreshedAt, input.startedAt)) return [];
  const newMerchantIds = new Set(input.newFlyers.map((flyer) => flyer.merchantId));
  return input.households
    .filter((household) =>
      household.favoriteMerchantIds.some((merchantId) => newMerchantIds.has(merchantId)),
    )
    .map((household) => household.householdId);
}
