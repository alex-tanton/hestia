import { sql, type Kysely } from 'kysely';
import type { Database } from '../db.js';
import type { DealSource, DealSourceStats, Flyer } from '../deals/deal-source.js';
import { CircuitOpenError } from '../deals/flipp/request-queue.js';
import { selectActivePostalCodes } from '../services/deals/dormancy.js';
import {
  markRefreshed,
  readKnownFlyerIds,
  readRefreshBookkeeping,
  upsertDeals,
} from '../services/deals/storage.js';
import { planFlyerRefreshNotifications, planRefresh } from './refresh-plan.js';
import type { JobDatabase, JobLogger } from './types.js';

/**
 * `refresh-deals` — daily 08:00 UTC (Technical Architecture, "Scheduled jobs", "Daily refresh").
 *
 * The set of postal codes comes from households active within 14 days, one entry per postal code,
 * never one per household: ten households in one ZIP cost one flyer fetch. For each postal code it
 * fetches the active flyers, then flyer items only for flyers whose merchant somebody there
 * favorites, upserts them, reprices expired list items, recomputes readiness, stamps
 * `last_refreshed_at`, and enqueues `flyer_refresh` rows.
 *
 * A failed fetch for one postal code never aborts the others (Technical Architecture, "Failure
 * handling"), and a flyer cut short by the circuit breaker writes nothing, so the next run fetches
 * it whole rather than leaving it half-priced.
 */

export interface RefreshDeps {
  database: JobDatabase;
  source: DealSource & DealSourceStats;
  logger: JobLogger;
  /** The refresh's per-merchant counts, handed to System health and nothing else. */
  publishSkipRates: (
    counts: readonly {
      merchantId: string;
      merchantName: string;
      fetched: number;
      skipped: number;
    }[],
  ) => void;
  /**
   * Expired-deal repricing (Technical Architecture, "Repricing"; Handoff non-negotiable 22). The
   * list pillar owns the implementation and it is deterministic from current data, so the job
   * runs it once after every postal code rather than inside the loop: a postal code whose fetch
   * failed must not stop another's items being corrected.
   */
  repriceExpiredItems: (db: Kysely<Database>) => Promise<number>;
  /**
   * Readiness recomputation for the affected households. Phase 3 owns `recipe_readiness`; until
   * then this seam is a deliberate no-op, not a forgotten step.
   */
  recomputeReadiness: (db: Kysely<Database>, householdIds: readonly string[]) => Promise<void>;
  now?: () => Date;
}

export interface PostalCodeOutcome {
  postalCode: string;
  flyers: number;
  flyersFetched: number;
  flyersAlreadyStored: number;
  flyersNotFavorited: number;
  deals: number;
  notificationsEnqueued: number;
  /** The households at this postal code, whose readiness the run recomputes. */
  householdIds: string[];
  failed: boolean;
}

export interface RefreshOutcome {
  postalCodes: PostalCodeOutcome[];
  repriced: number;
  startedAt: string;
  finishedAt: string;
}

/** A no-op readiness seam until Phase 3 builds `recipe_readiness`. */
export const readinessNotBuiltYet: RefreshDeps['recomputeReadiness'] = () => Promise.resolve();

interface HouseholdAtPostalCode {
  householdId: string;
  favoriteMerchantIds: string[];
}

/** Every household at one postal code with the merchant ids it favorites. Service-role read. */
async function householdsAt(
  db: Kysely<Database>,
  postalCode: string,
): Promise<HouseholdAtPostalCode[]> {
  const rows = await db
    .selectFrom('household as h')
    .leftJoin('household_favorite_store as f', 'f.household_id', 'h.id')
    .select(['h.id as household_id', 'f.merchant_id'])
    .where('h.postal_code', '=', postalCode)
    .execute();
  const byHousehold = new Map<string, string[]>();
  for (const row of rows) {
    const favorites = byHousehold.get(row.household_id) ?? [];
    if (row.merchant_id !== null) favorites.push(row.merchant_id);
    byHousehold.set(row.household_id, favorites);
  }
  return [...byHousehold.entries()].map(([householdId, favoriteMerchantIds]) => ({
    householdId,
    favoriteMerchantIds,
  }));
}

/**
 * The `flyer_refresh` outbox rows for the households with a new favorite-merchant flyer. Only the
 * rows are written here; sending is Phase 5. The outbox's unique key (user, type, target,
 * occurrence key) is the dedupe, so a rerun is a no-op (Handoff non-negotiable 7).
 *
 * `occurrence_key` is the run day's date in the household's own timezone, which owns household
 * dates (non-negotiable 8), so a household is told at most once a day. `send_after` is the next
 * 09:00 in that same household timezone, which every recipient shares, moved to the end of their own
 * quiet-hours window if it lands inside one (quiet hours alone use the recipient's timezone).
 *
 * `flyer_refresh` defaults to off, so a recipient needs an explicit enabled preference row.
 */
async function enqueueFlyerRefresh(
  db: Kysely<Database>,
  householdIds: readonly string[],
  at: Date,
): Promise<number> {
  if (householdIds.length === 0) return 0;
  const { rows } = await sql<{ id: string }>`
    with target as (
      select h.id as household_id, h.name as household_name, h.timezone as household_timezone,
             (${at}::timestamptz at time zone h.timezone)::date as occurrence_date
      from public.household h
      where h.id = any(${sql.val(householdIds)}::uuid[])
    ),
    recipient as (
      select t.household_id, t.household_name, t.household_timezone, t.occurrence_date,
             p.id as user_id, p.timezone, p.quiet_hours_start, p.quiet_hours_end
      from target t
      join public.household_member m on m.household_id = t.household_id
      join public.profile p on p.id = m.user_id
      join public.notification_preference np
        on np.user_id = p.id and np.notification_type = 'flyer_refresh' and np.enabled
    ),
    scheduled as (
      select r.*,
             public.next_local_time(${at}::timestamptz, r.household_timezone, time '09:00')
               as plain_send_after
      from recipient r
    )
    insert into public.notification (user_id, type, target_id, occurrence_key, payload, send_after)
    select s.user_id, 'flyer_refresh', s.household_id, s.occurrence_date::text,
           jsonb_build_object(
             'title', 'New flyers this week',
             'body', 'Fresh deals at your favorite stores near ' || s.household_name || '.',
             'householdId', s.household_id,
             'target', 'flyers'
           ),
           public.after_quiet_hours(s.plain_send_after, s.timezone, s.quiet_hours_start,
             s.quiet_hours_end)
    from scheduled s
    on conflict (user_id, type, target_id, occurrence_key) do nothing
    returning id
  `.execute(db);
  return rows.length;
}

/** One postal code, start to finish. Never throws: its failure is recorded in the outcome. */
async function refreshPostalCode(
  deps: RefreshDeps,
  postalCode: string,
  startedAt: Date,
): Promise<PostalCodeOutcome> {
  const now = deps.now ?? ((): Date => new Date());
  const log = deps.logger;
  const outcome: PostalCodeOutcome = {
    postalCode,
    flyers: 0,
    flyersFetched: 0,
    flyersAlreadyStored: 0,
    flyersNotFavorited: 0,
    deals: 0,
    notificationsEnqueued: 0,
    householdIds: [],
    failed: false,
  };

  try {
    const bookkeeping = await deps.database.asServiceRole((db) =>
      readRefreshBookkeeping(db, postalCode),
    );
    const { households, knownFlyerIds } = await deps.database.asServiceRole(async (db) => ({
      households: await householdsAt(db, postalCode),
      knownFlyerIds: await readKnownFlyerIds(db, postalCode),
    }));
    const favoriteMerchantIds = new Set(
      households.flatMap((household) => household.favoriteMerchantIds),
    );
    outcome.householdIds = households.map((one) => one.householdId);

    // One flyers request per postal code, not per household.
    const flyers = await deps.source.listFlyers(postalCode);
    const plan = planRefresh({
      flyers,
      favoriteMerchantIds,
      knownFlyerIds,
      today: now().toISOString().slice(0, 10),
    });
    outcome.flyers = flyers.length;
    outcome.flyersAlreadyStored = plan.alreadyStored.length;
    outcome.flyersNotFavorited = plan.notFavorited.length;

    log.info(
      {
        postalCode,
        flyers: flyers.length,
        toFetch: plan.fetch.map((flyer) => flyer.merchantName),
        alreadyStored: plan.alreadyStored.length,
        skippedNotFavorited: plan.notFavorited.length,
      },
      'planned one postal code’s flyer-item fetches',
    );

    const fetched: Flyer[] = [];
    for (const flyer of plan.fetch) {
      try {
        // All or nothing per flyer: the wrapper throws rather than returning a half-priced flyer.
        const deals = await deps.source.listFlyerItems(flyer.flyerId);
        const written = await deps.database.asServiceRole((db) =>
          upsertDeals(db, postalCode, deals, now()),
        );
        outcome.deals += written.length;
        outcome.flyersFetched += 1;
        fetched.push(flyer);
        log.info(
          {
            postalCode,
            merchantId: flyer.merchantId,
            merchantName: flyer.merchantName,
            flyerId: flyer.flyerId,
            deals: written.length,
          },
          'stored one flyer’s deals',
        );
      } catch (error: unknown) {
        // The breaker ends the postal code: every further call would be refused anyway.
        if (error instanceof CircuitOpenError) throw error;
        log.warn(
          { postalCode, flyerId: flyer.flyerId, merchantName: flyer.merchantName, err: error },
          'could not fetch one flyer’s items; leaving it for the next run',
        );
      }
    }

    const notify = planFlyerRefreshNotifications({
      lastRefreshedAt: bookkeeping?.lastRefreshedAt ?? null,
      startedAt,
      newFlyers: plan.newFlyers.filter((flyer) =>
        fetched.some((one) => one.flyerId === flyer.flyerId),
      ),
      households,
    });
    outcome.notificationsEnqueued = await deps.database.asServiceRole((db) =>
      enqueueFlyerRefresh(db, notify, now()),
    );

    await deps.database.asServiceRole((db) => markRefreshed(db, postalCode, now()));
  } catch (error: unknown) {
    outcome.failed = true;
    log.error({ postalCode, err: error }, 'refresh failed for one postal code');
  }

  return outcome;
}

/** Every active postal code. The daily run. */
export async function runRefreshDeals(deps: RefreshDeps): Promise<RefreshOutcome> {
  const now = deps.now ?? ((): Date => new Date());
  const startedAt = now();
  deps.logger.info({ startedAt: startedAt.toISOString() }, 'refresh-deals starting');

  const households = await deps.database.asServiceRole(async (db) => {
    const rows = await db
      .selectFrom('household')
      .select(['postal_code', 'last_active_at'])
      .execute();
    return rows.map((row) => ({
      postalCode: row.postal_code,
      lastActiveAt: new Date(row.last_active_at),
    }));
  });
  const postalCodes = selectActivePostalCodes(households, startedAt);

  deps.source.resetSkipCounts();
  const outcomes: PostalCodeOutcome[] = [];
  for (const postalCode of postalCodes) {
    outcomes.push(await refreshPostalCode(deps, postalCode, startedAt));
  }

  return finish(deps, outcomes, startedAt, now);
}

/**
 * The one on-demand refresh a dormant postal code gets per UTC day. Identical steps to a daily
 * run, for one postal code, through the same serialized queue and circuit breaker; the only
 * difference is that `flyer_refresh` is suppressed, because the postal code was dormant — which
 * `refreshPostalCode` reads from `last_refreshed_at`, the one stamp the triggering request has
 * not already moved.
 */
export async function runOnDemandRefresh(
  deps: RefreshDeps,
  postalCode: string,
): Promise<RefreshOutcome> {
  const now = deps.now ?? ((): Date => new Date());
  const startedAt = now();
  deps.logger.info(
    { postalCode, startedAt: startedAt.toISOString(), trigger: 'on-demand' },
    'refresh-deals starting for one dormant postal code',
  );

  deps.source.resetSkipCounts();
  const outcome = await refreshPostalCode(deps, postalCode, startedAt);
  return finish(deps, [outcome], startedAt, now);
}

/**
 * Repricing and readiness, then the run's skip rates and the per-merchant counts System health
 * also shows. Repricing runs here rather than per postal code because it is deterministic from
 * current data, so one pass corrects every list whatever any single fetch did.
 */
async function finish(
  deps: RefreshDeps,
  outcomes: PostalCodeOutcome[],
  startedAt: Date,
  now: () => Date,
): Promise<RefreshOutcome> {
  const repriced = await deps.database.asServiceRole((db) => deps.repriceExpiredItems(db));
  const householdIds = [...new Set(outcomes.flatMap((one) => one.householdIds))];
  await deps.database.asServiceRole((db) => deps.recomputeReadiness(db, householdIds));

  const counts = deps.source.skipCounts();
  deps.publishSkipRates(counts);
  for (const count of counts) {
    deps.logger.info(
      {
        merchantId: count.merchantId,
        merchantName: count.merchantName,
        fetched: count.fetched,
        skipped: count.skipped,
        skipRate: count.fetched === 0 ? 0 : count.skipped / count.fetched,
        reasons: count.reasons,
      },
      'deals fetched and skipped for one merchant this run',
    );
  }

  const finishedAt = now();
  deps.logger.info(
    {
      postalCodes: outcomes.length,
      failed: outcomes.filter((one) => one.failed).length,
      deals: outcomes.reduce((total, one) => total + one.deals, 0),
      flyersFetched: outcomes.reduce((total, one) => total + one.flyersFetched, 0),
      repriced,
      households: householdIds.length,
      notificationsEnqueued: outcomes.reduce((total, one) => total + one.notificationsEnqueued, 0),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    },
    'refresh-deals finished',
  );

  return {
    postalCodes: outcomes,
    repriced,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  };
}
