import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDatabase, type Database, type DatabaseHandle } from './db.js';
import { withJobLock } from './jobs/advisory-lock.js';
import { pruneCache } from './jobs/prune-cache.js';
import {
  readinessNotBuiltYet,
  runOnDemandRefresh,
  runRefreshDeals,
  type RefreshDeps,
} from './jobs/refresh-deals.js';
import { createScheduler, type SchedulerDeps } from './jobs/scheduler.js';
import type { JobDatabase, JobLogger } from './jobs/types.js';
import { createNotificationOutbox } from './privileged/notification-outbox.js';
import { withServiceRoleDb } from './privileged/service-role-db.js';
import { RecordingPushTransport } from './test/push-double.js';
import { recomputeReadinessForHousehold } from './services/readiness.js';
import { repriceExpiredItems } from './services/repricing.js';
import { aDeal, aFlyer, FakeDealSource, fetchFailure } from './test/fixture-deal-source.js';
import { adminPool, enableServiceLogin, stackConfig } from './test/service-stack.js';

/*
 * The scheduled jobs against `supabase start`. Jobs run as `service_role`, which is one of the
 * sanctioned uses (Technical Architecture, "The RLS rule"), so they see every household — which
 * is exactly what makes their idempotency worth asserting against the real schema.
 *
 * The deal source is always a double: tests never call Flipp (non-negotiable 17).
 */

let handle: DatabaseHandle;
let source: FakeDealSource;
let lines: { level: string; data: Record<string, unknown>; message: string }[];
let logger: JobLogger;
let jobDb: JobDatabase;
let clock: Date;

const POSTAL_CODE = '27521';
const DORMANT_POSTAL_CODE = '27522';
const QUIET_POSTAL_CODE = '27523';
const ALL_POSTAL_CODES = [POSTAL_CODE, DORMANT_POSTAL_CODE, QUIET_POSTAL_CODE];

// Scheduler deps for the runs below, which never reach the dispatch job: its own behaviour is
// covered by dispatch-notifications.integration.test.ts.
function dispatchDeps(): SchedulerDeps['dispatch'] {
  return { outbox: createNotificationOutbox(jobDb), transport: new RecordingPushTransport() };
}

function makeLogger(): JobLogger {
  const record = (level: string) => (data: Record<string, unknown>, message: string) => {
    lines.push({ level, data, message });
  };
  const self: JobLogger = {
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
    child: () => self,
  };
  return self;
}

beforeAll(async () => {
  await enableServiceLogin();
  handle = createDatabase(stackConfig().serviceDatabaseUrl);
  jobDb = {
    asServiceRole: (fn) => withServiceRoleDb(handle.db, fn),
    pool: handle.db,
  };
});

afterAll(async () => {
  // A daily run covers every active postal code in the database, including the ones other test
  // files created, so it leaves `deal` and `postal_code_refresh` rows behind for them. Both are
  // caches that `prune-cache` and `supabase db reset` clear wholesale, and every file seeds its
  // own, so clearing them here keeps the files independent.
  await adminPool.query('delete from public.deal');
  await adminPool.query('delete from public.deal_query_cache');
  await adminPool.query('delete from public.postal_code_refresh');
  await handle.close();
  await adminPool.end();
});

beforeEach(async () => {
  clock = new Date();
  source = new FakeDealSource();
  lines = [];
  logger = makeLogger();
  for (const postalCode of ALL_POSTAL_CODES) {
    await adminPool.query('delete from public.deal where postal_code = $1', [postalCode]);
    await adminPool.query('delete from public.deal_query_cache where postal_code = $1', [
      postalCode,
    ]);
    await adminPool.query('delete from public.postal_code_refresh where postal_code = $1', [
      postalCode,
    ]);
    await adminPool.query(
      `delete from public.household_member where household_id in
         (select id from public.household where postal_code = $1)`,
      [postalCode],
    );
    await adminPool.query('delete from public.household where postal_code = $1', [postalCode]);
  }
});

function deps(overrides: Partial<RefreshDeps> = {}): RefreshDeps {
  return {
    database: jobDb,
    source,
    logger,
    publishSkipRates: () => undefined,
    repriceExpiredItems: (db) => repriceExpiredItems(db, { kind: 'all' }),
    recomputeReadiness: readinessNotBuiltYet,
    now: () => clock,
    ...overrides,
  };
}

interface Seeded {
  userId: string;
  householdId: string;
}

/** A household at a postal code, with favorites, created directly as `postgres`. */
async function seedHousehold(options: {
  postalCode: string;
  favorites?: [string, string][];
  lastActiveDaysAgo?: number;
  timezone?: string;
  quietHours?: [string, string];
  flyerRefreshEnabled?: boolean;
}): Promise<Seeded> {
  const userId = randomUUID();
  const email = `job.${userId.slice(0, 8)}@example.com`;
  await adminPool.query(
    `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, $3)`,
    [
      userId,
      email,
      JSON.stringify({
        display_name: 'Job Tester',
        timezone: options.timezone ?? 'America/New_York',
      }),
    ],
  );
  if (options.quietHours !== undefined) {
    await adminPool.query(
      'update public.profile set quiet_hours_start = $2, quiet_hours_end = $3 where id = $1',
      [userId, options.quietHours[0], options.quietHours[1]],
    );
  }
  const { rows } = await adminPool.query<{ id: string }>(
    `insert into public.household (name, postal_code, timezone, last_active_at, created_by)
     values ($1, $2, $3, now() - ($4 || ' days')::interval, $5) returning id`,
    [
      `Jobs ${userId.slice(0, 6)}`,
      options.postalCode,
      options.timezone ?? 'America/New_York',
      String(options.lastActiveDaysAgo ?? 0),
      userId,
    ],
  );
  const householdId = rows[0]?.id ?? '';
  await adminPool.query(
    `insert into public.household_member (household_id, user_id, role) values ($1, $2, 'admin')`,
    [householdId, userId],
  );
  for (const [merchantId, merchantName] of options.favorites ?? []) {
    await adminPool.query(
      `insert into public.household_favorite_store (household_id, merchant_id, merchant_name)
       values ($1, $2, $3)`,
      [householdId, merchantId, merchantName],
    );
  }
  if (options.flyerRefreshEnabled === true) {
    await adminPool.query(
      `insert into public.notification_preference (user_id, notification_type, enabled)
       values ($1, 'flyer_refresh', true)
       on conflict do nothing`,
      [userId],
    );
  }
  return { userId, householdId };
}

async function dealCount(postalCode: string): Promise<number> {
  const { rows } = await adminPool.query<{ count: string }>(
    'select count(*) as count from public.deal where postal_code = $1',
    [postalCode],
  );
  return Number(rows[0]?.count ?? '0');
}

async function notifications(
  userId: string,
): Promise<{ occurrence_key: string; send_after: Date }[]> {
  const { rows } = await adminPool.query<{ occurrence_key: string; send_after: Date }>(
    `select occurrence_key, send_after from public.notification
     where user_id = $1 and type = 'flyer_refresh' order by occurrence_key`,
    [userId],
  );
  return rows;
}

/**
 * A one-ingredient recipe, seeded directly as `postgres` the same way `seedHousehold` does, so the
 * readiness-recompute-across-households test below does not need the route layer to exercise the
 * job's own recompute wiring (Technical Architecture, "Daily refresh": "recomputes `recipe_readiness`
 * for every household it covered").
 */
async function seedOneIngredientRecipe(
  householdId: string,
  userId: string,
  ingredientNormalizedName: string,
): Promise<string> {
  const { rows: recipeRows } = await adminPool.query<{ id: string }>(
    `insert into public.recipe (household_id, title, servings, created_by)
     values ($1, 'Readiness Job Test Recipe', 1, $2) returning id`,
    [householdId, userId],
  );
  const recipeId = recipeRows[0]?.id ?? '';
  await adminPool.query(
    `insert into public.recipe_ingredient (recipe_id, "position", item_name, normalized_name)
     values ($1, 0, $2, $2)`,
    [recipeId, ingredientNormalizedName],
  );
  return recipeId;
}

async function readinessPercentOf(recipeId: string): Promise<number | null> {
  const { rows } = await adminPool.query<{ readiness_percent: number }>(
    `select readiness_percent from public.recipe_readiness where recipe_id = $1`,
    [recipeId],
  );
  return rows[0]?.readiness_percent ?? null;
}

const foodLionFlyer = aFlyer({
  flyerId: '8128502',
  merchantId: '2100',
  merchantName: 'Food Lion',
  validFrom: '2026-01-01',
  validTo: '2099-12-31',
});
const harrisTeeterFlyer = aFlyer({
  flyerId: '8132883',
  merchantId: '2431',
  merchantName: 'Harris Teeter',
  validFrom: '2026-01-01',
  validTo: '2099-12-31',
});
const aldiFlyer = aFlyer({
  flyerId: '8131738',
  merchantId: '2353',
  merchantName: 'ALDI',
  validFrom: '2026-01-01',
  validTo: '2099-12-31',
});

function flyerDeal(flyerId: string, externalId: string, overrides = {}): ReturnType<typeof aDeal> {
  return aDeal({
    externalId,
    flyerId,
    validFrom: '2026-01-01',
    validTo: '2099-12-31',
    ...overrides,
  });
}

describe('refresh-deals', () => {
  it('covers active postal codes once and skips dormant ones', async () => {
    await seedHousehold({ postalCode: POSTAL_CODE, favorites: [['2100', 'Food Lion']] });
    await seedHousehold({ postalCode: POSTAL_CODE, favorites: [['2100', 'Food Lion']] });
    await seedHousehold({
      postalCode: DORMANT_POSTAL_CODE,
      favorites: [['2100', 'Food Lion']],
      lastActiveDaysAgo: 20,
    });
    source.data.flyers = [foodLionFlyer];
    source.data.flyerItems = { '8128502': [flyerDeal('8128502', 'fl-1')] };

    const outcome = await runRefreshDeals(deps());
    const covered = outcome.postalCodes.map((one) => one.postalCode);

    expect(covered).toContain(POSTAL_CODE);
    expect(covered).not.toContain(DORMANT_POSTAL_CODE);
    // Two households at one postal code still cost one flyers request.
    expect(
      source.calls.filter((c) => c.mode === 'flyers' && c.argument === POSTAL_CODE),
    ).toHaveLength(1);
  });

  it('fetches flyer items only for favorited merchants', async () => {
    await seedHousehold({ postalCode: POSTAL_CODE, favorites: [['2100', 'Food Lion']] });
    await seedHousehold({ postalCode: POSTAL_CODE, favorites: [['2431', 'Harris Teeter']] });
    source.data.flyers = [foodLionFlyer, harrisTeeterFlyer, aldiFlyer];
    source.data.flyerItems = {
      '8128502': [flyerDeal('8128502', 'fl-1')],
      '8132883': [flyerDeal('8132883', 'ht-1')],
      '8131738': [flyerDeal('8131738', 'aldi-1')],
    };

    const outcome = await runRefreshDeals(deps());
    const mine = outcome.postalCodes.find((one) => one.postalCode === POSTAL_CODE);

    expect(mine?.flyersFetched).toBe(2);
    expect(mine?.flyersNotFavorited).toBe(1);
    // ALDI's flyer is never fetched: nobody at this postal code favorites it.
    expect(source.calls.map((c) => c.argument)).not.toContain('8131738');
    expect(await dealCount(POSTAL_CODE)).toBe(2);
  });

  it('never re-fetches a flyer whose deals are stored and still valid', async () => {
    await seedHousehold({ postalCode: POSTAL_CODE, favorites: [['2100', 'Food Lion']] });
    source.data.flyers = [foodLionFlyer];
    source.data.flyerItems = { '8128502': [flyerDeal('8128502', 'fl-1')] };

    await runRefreshDeals(deps());
    await runRefreshDeals(deps());

    expect(source.countOf('flyerItems')).toBe(1);
  });

  it('is a no-op on a rerun: the same deals upsert to the same rows', async () => {
    await seedHousehold({ postalCode: POSTAL_CODE, favorites: [['2100', 'Food Lion']] });
    source.data.flyers = [foodLionFlyer];
    source.data.flyerItems = {
      '8128502': [flyerDeal('8128502', 'fl-1'), flyerDeal('8128502', 'fl-2')],
    };

    await runRefreshDeals(deps());
    const { rows: first } = await adminPool.query<{ id: string }>(
      'select id from public.deal where postal_code = $1 order by external_id',
      [POSTAL_CODE],
    );

    // Force a re-fetch of the same flyer by clearing what marks it stored.
    await adminPool.query(
      `update public.deal set valid_to = current_date - 1 where postal_code = $1`,
      [POSTAL_CODE],
    );
    await runRefreshDeals(deps());

    const { rows: second } = await adminPool.query<{ id: string }>(
      'select id from public.deal where postal_code = $1 order by external_id',
      [POSTAL_CODE],
    );
    expect(second.map((r) => r.id)).toStrictEqual(first.map((r) => r.id));
    expect(await dealCount(POSTAL_CODE)).toBe(2);
  });

  it('stamps postal_code_refresh.last_refreshed_at', async () => {
    await seedHousehold({ postalCode: POSTAL_CODE, favorites: [['2100', 'Food Lion']] });
    source.data.flyers = [foodLionFlyer];
    await runRefreshDeals(deps());

    const { rows } = await adminPool.query<{ last_refreshed_at: Date | null }>(
      'select last_refreshed_at from public.postal_code_refresh where postal_code = $1',
      [POSTAL_CODE],
    );
    expect(rows[0]?.last_refreshed_at).not.toBeNull();
  });

  it('does not let one postal code’s failure abort the others', async () => {
    await seedHousehold({ postalCode: POSTAL_CODE, favorites: [['2100', 'Food Lion']] });
    await seedHousehold({ postalCode: QUIET_POSTAL_CODE, favorites: [['2100', 'Food Lion']] });
    source.data.flyers = [foodLionFlyer];
    source.data.flyerItems = { '8128502': [flyerDeal('8128502', 'fl-1')] };

    // A plain delegate rather than a subclass: one mode fails, the rest go to the double.
    const failing: RefreshDeps['source'] = {
      listFlyers: (postalCode: string) =>
        postalCode === POSTAL_CODE ? Promise.reject(fetchFailure()) : source.listFlyers(postalCode),
      listFlyerItems: (flyerId: string) => source.listFlyerItems(flyerId),
      listMerchants: (postalCode: string) => source.listMerchants(postalCode),
      searchItems: (postalCode: string, query: string) => source.searchItems(postalCode, query),
      skipCounts: () => [],
      resetSkipCounts: () => undefined,
    };

    const outcome = await runRefreshDeals(deps({ source: failing }));
    const failed = outcome.postalCodes.find((one) => one.postalCode === POSTAL_CODE);
    const ok = outcome.postalCodes.find((one) => one.postalCode === QUIET_POSTAL_CODE);

    expect(failed?.failed).toBe(true);
    expect(ok?.failed).toBe(false);
    expect(await dealCount(QUIET_POSTAL_CODE)).toBe(1);
  });

  it('leaves a flyer whose items fail for the next run rather than storing it half-priced', async () => {
    await seedHousehold({
      postalCode: POSTAL_CODE,
      favorites: [
        ['2100', 'Food Lion'],
        ['2431', 'Harris Teeter'],
      ],
    });
    source.data.flyers = [foodLionFlyer, harrisTeeterFlyer];
    source.data.flyerItems = { '8132883': [flyerDeal('8132883', 'ht-1')] };

    const partial: RefreshDeps['source'] = {
      searchItems: (p: string, q: string) => source.searchItems(p, q),
      listFlyers: (p: string) => source.listFlyers(p),
      listMerchants: (p: string) => source.listMerchants(p),
      listFlyerItems: (flyerId: string) =>
        flyerId === '8128502' ? Promise.reject(fetchFailure()) : source.listFlyerItems(flyerId),
      skipCounts: () => [],
      resetSkipCounts: () => undefined,
    };

    const outcome = await runRefreshDeals(deps({ source: partial }));
    const mine = outcome.postalCodes.find((one) => one.postalCode === POSTAL_CODE);
    expect(mine?.failed).toBe(false);
    expect(mine?.flyersFetched).toBe(1);
    expect(await dealCount(POSTAL_CODE)).toBe(1);
  });

  it('logs deals fetched and skipped per merchant, and publishes them to System health', async () => {
    await seedHousehold({ postalCode: POSTAL_CODE, favorites: [['2100', 'Food Lion']] });
    source.data.flyers = [foodLionFlyer];
    source.data.flyerItems = { '8128502': [flyerDeal('8128502', 'fl-1')] };
    source.counts = [
      {
        merchantId: '2100',
        merchantName: 'Food Lion',
        fetched: 10,
        skipped: 2,
        reasons: { no_price: 2 },
      },
    ];
    const publish = vi.fn();

    await runRefreshDeals(deps({ publishSkipRates: publish }));

    const line = lines.find((one) => one.message.includes('fetched and skipped for one merchant'));
    expect(line?.data['merchantName']).toBe('Food Lion');
    expect(line?.data['fetched']).toBe(10);
    expect(line?.data['skipped']).toBe(2);
    expect(publish).toHaveBeenCalledWith(source.counts);
    expect(source.resets).toBe(1);
  });

  it('reprices expired list items once per run', async () => {
    await seedHousehold({ postalCode: POSTAL_CODE, favorites: [['2100', 'Food Lion']] });
    const reprice = vi.fn(() => Promise.resolve(3));
    await runRefreshDeals(deps({ repriceExpiredItems: reprice }));
    expect(reprice).toHaveBeenCalledTimes(1);
  });
});

describe('readiness recompute across households (Technical Architecture, "Daily refresh")', () => {
  // `jobDb.asServiceRole` gives the recompute step a `service_role` connection, the same as
  // `main.ts` wires it; `readinessNotBuiltYet` (the no-op every other test in this file uses)
  // would hide a regression that recomputes only the first household at a postal code, so this
  // uses the real function instead.
  const recomputeReadiness: RefreshDeps['recomputeReadiness'] = (db, householdIds) =>
    Promise.all(householdIds.map((id) => recomputeReadinessForHousehold(db, id))).then(
      () => undefined,
    );

  it('recomputes every household at the refreshed postal code, not just one', async () => {
    const first = await seedHousehold({
      postalCode: POSTAL_CODE,
      favorites: [['2100', 'Food Lion']],
    });
    const second = await seedHousehold({
      postalCode: POSTAL_CODE,
      favorites: [['2100', 'Food Lion']],
    });
    const firstRecipe = await seedOneIngredientRecipe(first.householdId, first.userId, 'milk');
    const secondRecipe = await seedOneIngredientRecipe(second.householdId, second.userId, 'milk');

    // Both recipes start unreadied: no deal and no pantry match "milk" yet.
    await withServiceRoleDb(handle.db, (db) =>
      Promise.all([
        recomputeReadinessForHousehold(db, first.householdId),
        recomputeReadinessForHousehold(db, second.householdId),
      ]),
    );
    expect(await readinessPercentOf(firstRecipe)).toBe(0);
    expect(await readinessPercentOf(secondRecipe)).toBe(0);

    source.data.flyers = [foodLionFlyer];
    // `aDeal`'s default name, "Whole Milk", normalizes to contain "milk" — the same token
    // containment the Matching test cases table exercises, not an override. Both households
    // favorited Food Lion ('2100'), not `aDeal`'s own default merchant, so the deal is
    // attributed to Food Lion's flyer explicitly.
    source.data.flyerItems = {
      '8128502': [
        flyerDeal('8128502', 'milk-1', { merchantId: '2100', merchantName: 'Food Lion' }),
      ],
    };

    await runRefreshDeals(deps({ recomputeReadiness }));

    expect(await readinessPercentOf(firstRecipe)).toBe(100);
    expect(await readinessPercentOf(secondRecipe)).toBe(100);
  });
});

describe('flyer_refresh outbox rows', () => {
  it('enqueues nothing when the postal code had no previous refresh', async () => {
    const home = await seedHousehold({
      postalCode: POSTAL_CODE,
      favorites: [['2100', 'Food Lion']],
      flyerRefreshEnabled: true,
    });
    source.data.flyers = [foodLionFlyer];
    source.data.flyerItems = { '8128502': [flyerDeal('8128502', 'fl-1')] };

    await runRefreshDeals(deps());
    expect(await notifications(home.userId)).toStrictEqual([]);
  });

  it('enqueues nothing on the first daily run after dormancy', async () => {
    // The household went quiet for a month and is active again, so the run covers its postal
    // code — but the last run that did is a month old, and every flyer it finds reads as new.
    const home = await seedHousehold({
      postalCode: POSTAL_CODE,
      favorites: [['2100', 'Food Lion']],
      flyerRefreshEnabled: true,
    });
    await adminPool.query(
      `insert into public.postal_code_refresh (postal_code, last_refreshed_at)
       values ($1, now() - interval '30 days')`,
      [POSTAL_CODE],
    );
    source.data.flyers = [foodLionFlyer];
    source.data.flyerItems = { '8128502': [flyerDeal('8128502', 'fl-1')] };

    await runRefreshDeals(deps());
    expect(await notifications(home.userId)).toStrictEqual([]);
  });

  it('enqueues one row per opted-in member once a previous refresh exists', async () => {
    const home = await seedHousehold({
      postalCode: POSTAL_CODE,
      favorites: [
        ['2100', 'Food Lion'],
        ['2431', 'Harris Teeter'],
      ],
      flyerRefreshEnabled: true,
    });
    source.data.flyers = [foodLionFlyer];
    source.data.flyerItems = {
      '8128502': [flyerDeal('8128502', 'fl-1')],
      '8132883': [flyerDeal('8132883', 'ht-1')],
    };
    await runRefreshDeals(deps());

    // The second run finds Harris Teeter's flyer, which no deal row carried before it.
    source.data.flyers = [foodLionFlyer, harrisTeeterFlyer];
    await runRefreshDeals(deps());

    const rows = await notifications(home.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.occurrence_key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('dedupes a rerun on the outbox key (non-negotiable 7)', async () => {
    const home = await seedHousehold({
      postalCode: POSTAL_CODE,
      favorites: [
        ['2100', 'Food Lion'],
        ['2431', 'Harris Teeter'],
      ],
      flyerRefreshEnabled: true,
    });
    source.data.flyers = [foodLionFlyer];
    source.data.flyerItems = {
      '8128502': [flyerDeal('8128502', 'fl-1')],
      '8132883': [flyerDeal('8132883', 'ht-1')],
    };
    await runRefreshDeals(deps());

    source.data.flyers = [foodLionFlyer, harrisTeeterFlyer];
    await runRefreshDeals(deps());
    await adminPool.query('delete from public.deal where flyer_id = $1', ['8132883']);
    await runRefreshDeals(deps());

    expect(await notifications(home.userId)).toHaveLength(1);
  });

  it('sends nothing to a member who has not opted in, since flyer_refresh defaults to off', async () => {
    const home = await seedHousehold({
      postalCode: POSTAL_CODE,
      favorites: [
        ['2100', 'Food Lion'],
        ['2431', 'Harris Teeter'],
      ],
    });
    source.data.flyers = [foodLionFlyer];
    source.data.flyerItems = {
      '8128502': [flyerDeal('8128502', 'fl-1')],
      '8132883': [flyerDeal('8132883', 'ht-1')],
    };
    await runRefreshDeals(deps());
    source.data.flyers = [foodLionFlyer, harrisTeeterFlyer];
    await runRefreshDeals(deps());

    expect(await notifications(home.userId)).toStrictEqual([]);
  });

  it('sets send_after to the next 09:00 in the household timezone, not the recipient’s', async () => {
    // Kiritimati is UTC+14 and Pago Pago UTC-11, so the two zones are always a day or more apart:
    // a 09:00 in the profile's zone can never be the household's 09:00.
    const home = await seedHousehold({
      postalCode: QUIET_POSTAL_CODE,
      favorites: [
        ['2100', 'Food Lion'],
        ['2431', 'Harris Teeter'],
      ],
      timezone: 'Pacific/Kiritimati',
      flyerRefreshEnabled: true,
    });
    await adminPool.query(
      `update public.profile set timezone = 'Pacific/Pago_Pago' where id = $1`,
      [home.userId],
    );
    source.data.flyers = [foodLionFlyer];
    source.data.flyerItems = {
      '8128502': [flyerDeal('8128502', 'fl-1')],
      '8132883': [flyerDeal('8132883', 'ht-1')],
    };
    await runRefreshDeals(deps());
    source.data.flyers = [foodLionFlyer, harrisTeeterFlyer];
    await runRefreshDeals(deps());

    const { rows } = await adminPool.query<{ local: string; profile_local: string }>(
      `select pg_catalog.to_char(n.send_after at time zone h.timezone, 'HH24:MI') as local,
              pg_catalog.to_char(n.send_after at time zone p.timezone, 'HH24:MI') as profile_local
       from public.notification n
       join public.household h on h.id = n.target_id
       join public.profile p on p.id = n.user_id
       where n.user_id = $1 and n.type = 'flyer_refresh'`,
      [home.userId],
    );
    expect(rows[0]?.local).toBe('09:00');
    expect(rows[0]?.profile_local).not.toBe('09:00');
  });

  it('moves a send time inside quiet hours to the end of the window', async () => {
    const home = await seedHousehold({
      postalCode: QUIET_POSTAL_CODE,
      favorites: [
        ['2100', 'Food Lion'],
        ['2431', 'Harris Teeter'],
      ],
      quietHours: ['08:00', '10:30'],
      flyerRefreshEnabled: true,
    });
    source.data.flyers = [foodLionFlyer];
    source.data.flyerItems = {
      '8128502': [flyerDeal('8128502', 'fl-1')],
      '8132883': [flyerDeal('8132883', 'ht-1')],
    };
    await runRefreshDeals(deps());
    source.data.flyers = [foodLionFlyer, harrisTeeterFlyer];
    await runRefreshDeals(deps());

    const { rows } = await adminPool.query<{ local: string }>(
      `select pg_catalog.to_char(n.send_after at time zone p.timezone, 'HH24:MI') as local
       from public.notification n join public.profile p on p.id = n.user_id
       where n.user_id = $1 and n.type = 'flyer_refresh'`,
      [home.userId],
    );
    expect(rows[0]?.local).toBe('10:30');
  });
});

describe('the on-demand refresh of a dormant postal code', () => {
  it('runs the same steps for one postal code and enqueues no flyer_refresh', async () => {
    const home = await seedHousehold({
      postalCode: DORMANT_POSTAL_CODE,
      favorites: [['2100', 'Food Lion']],
      lastActiveDaysAgo: 20,
      flyerRefreshEnabled: true,
    });
    await adminPool.query(
      `insert into public.postal_code_refresh (postal_code, last_refreshed_at)
       values ($1, now() - interval '30 days')`,
      [DORMANT_POSTAL_CODE],
    );
    source.data.flyers = [foodLionFlyer];
    source.data.flyerItems = { '8128502': [flyerDeal('8128502', 'fl-1')] };

    const outcome = await runOnDemandRefresh(deps(), DORMANT_POSTAL_CODE);

    expect(outcome.postalCodes).toHaveLength(1);
    expect(await dealCount(DORMANT_POSTAL_CODE)).toBe(1);
    expect(await notifications(home.userId)).toStrictEqual([]);
    expect(source.countOf('flyers')).toBe(1);
  });

  it('still enqueues nothing once the triggering request has stamped the household active', async () => {
    // `mark_household_active` runs before the handler, so by the time the queued refresh starts,
    // `last_active_at` says the postal code is active. Dormancy has to be read from
    // `last_refreshed_at`, or the returning household is told its whole week is fresh news.
    const home = await seedHousehold({
      postalCode: DORMANT_POSTAL_CODE,
      favorites: [['2100', 'Food Lion']],
      lastActiveDaysAgo: 0,
      flyerRefreshEnabled: true,
    });
    await adminPool.query(
      `insert into public.postal_code_refresh (postal_code, last_refreshed_at, last_on_demand_at)
       values ($1, now() - interval '30 days', now())`,
      [DORMANT_POSTAL_CODE],
    );
    source.data.flyers = [foodLionFlyer];
    source.data.flyerItems = { '8128502': [flyerDeal('8128502', 'fl-1')] };

    await runOnDemandRefresh(deps(), DORMANT_POSTAL_CODE);

    expect(await dealCount(DORMANT_POSTAL_CODE)).toBe(1);
    expect(await notifications(home.userId)).toStrictEqual([]);
  });
});

describe('the scheduler', () => {
  it('runs a job under its lock, and skips it while another run holds it', async () => {
    const scheduler = createScheduler({
      database: jobDb,
      logger,
      dispatch: dispatchDeps(),
      refresh: {
        source,
        publishSkipRates: () => undefined,
        repriceExpiredItems: (db) => repriceExpiredItems(db, { kind: 'all' }),
        recomputeReadiness: readinessNotBuiltYet,
      },
    });

    await expect(scheduler.run('prune-cache')).resolves.toBe(true);

    const holder = await adminPool.connect();
    try {
      await holder.query(`select pg_advisory_lock(hashtext('prune-cache'))`);
      await expect(scheduler.run('prune-cache')).resolves.toBe(false);
    } finally {
      await holder.query(`select pg_advisory_unlock(hashtext('prune-cache'))`);
      holder.release();
    }
    await scheduler.stop();
  });

  it('runs the one on-demand refresh it queues for a dormant postal code', async () => {
    await seedHousehold({
      postalCode: DORMANT_POSTAL_CODE,
      favorites: [['2100', 'Food Lion']],
      lastActiveDaysAgo: 20,
    });
    source.data.flyers = [foodLionFlyer];
    source.data.flyerItems = { '8128502': [flyerDeal('8128502', 'fl-1')] };

    const scheduler = createScheduler({
      database: jobDb,
      logger,
      dispatch: dispatchDeps(),
      refresh: {
        source,
        publishSkipRates: () => undefined,
        repriceExpiredItems: () => Promise.resolve(0),
        recomputeReadiness: readinessNotBuiltYet,
      },
    });
    scheduler.queueBackgroundRefresh(DORMANT_POSTAL_CODE);
    await scheduler.stop();

    expect(await dealCount(DORMANT_POSTAL_CODE)).toBe(1);
  });
});

describe('prune-cache', () => {
  it('deletes exactly what Retention names, and nothing else', async () => {
    const home = await seedHousehold({ postalCode: POSTAL_CODE });
    await adminPool.query(
      `insert into public.deal (external_id, merchant_id, merchant_name, name, normalized_name,
         unit_price, price_unit, display_price, flyer_id, postal_code, valid_from, valid_to)
       values
         ('expired', '2100', 'Food Lion', 'Old', 'old', 1.00, 'each', '$1.00', 'f1', $1,
           current_date - 9, current_date - 1),
         ('current', '2100', 'Food Lion', 'New', 'new', 1.00, 'each', '$1.00', 'f2', $1,
           current_date - 1, current_date + 5)`,
      [POSTAL_CODE],
    );
    await adminPool.query(
      `insert into public.deal_query_cache (postal_code, normalized_query, cached_at) values
         ($1, 'stale', now() - interval '7 hours'),
         ($1, 'fresh', now() - interval '1 hour')`,
      [POSTAL_CODE],
    );
    await adminPool.query(
      `insert into public.notification (user_id, type, target_id, occurrence_key, payload,
         send_after, sent_at) values
         ($1, 'flyer_refresh', $2, 'old', '{}'::jsonb, now() - interval '200 days',
           now() - interval '120 days'),
         ($1, 'flyer_refresh', $2, 'recent', '{}'::jsonb, now() - interval '10 days',
           now() - interval '10 days'),
         ($1, 'flyer_refresh', $2, 'unsent', '{}'::jsonb, now() - interval '200 days', null)`,
      [home.userId, home.householdId],
    );
    // The fingerprint is a SHA-256 in lowercase hex, which the column checks.
    const oldFingerprint = 'a'.repeat(64);
    const recentFingerprint = 'b'.repeat(64);
    await adminPool.query(
      `insert into public.app_error (fingerprint, message, count, first_seen, last_seen) values
         ($1, 'old', 1, now() - interval '200 days', now() - interval '120 days'),
         ($2, 'recent', 1, now() - interval '10 days', now() - interval '2 days')
       on conflict (fingerprint) do nothing`,
      [oldFingerprint, recentFingerprint],
    );

    const outcome = await withServiceRoleDb(handle.db, (db: Kysely<Database>) =>
      pruneCache(db, new Date()),
    );

    expect(outcome.deals).toBeGreaterThanOrEqual(1);
    expect(outcome.queryCache).toBeGreaterThanOrEqual(1);
    expect(outcome.notifications).toBeGreaterThanOrEqual(1);
    expect(outcome.errors).toBeGreaterThanOrEqual(1);

    const { rows: deals } = await adminPool.query<{ external_id: string }>(
      'select external_id from public.deal where postal_code = $1',
      [POSTAL_CODE],
    );
    expect(deals.map((r) => r.external_id)).toStrictEqual(['current']);

    const { rows: cache } = await adminPool.query<{ normalized_query: string }>(
      'select normalized_query from public.deal_query_cache where postal_code = $1',
      [POSTAL_CODE],
    );
    expect(cache.map((r) => r.normalized_query)).toStrictEqual(['fresh']);

    const { rows: kept } = await adminPool.query<{ occurrence_key: string }>(
      'select occurrence_key from public.notification where user_id = $1 order by occurrence_key',
      [home.userId],
    );
    // The unsent row survives however old it is: it has not been delivered yet.
    expect(kept.map((r) => r.occurrence_key).sort()).toStrictEqual(['recent', 'unsent']);

    const { rows: errors } = await adminPool.query<{ fingerprint: string }>(
      `select fingerprint from public.app_error where fingerprint in ($1, $2)`,
      [oldFingerprint, recentFingerprint],
    );
    expect(errors.map((r) => r.fingerprint)).toStrictEqual([recentFingerprint]);
  });
});

describe('the advisory lock', () => {
  it('runs the job when the lock is free and releases it afterwards', async () => {
    const first = await withJobLock(handle.db, 'test-job', () => Promise.resolve('ran'));
    expect(first).toStrictEqual({ ran: true, result: 'ran' });

    const second = await withJobLock(handle.db, 'test-job', () => Promise.resolve('ran again'));
    expect(second.ran).toBe(true);
  });

  it('skips a second run while another connection holds the lock', async () => {
    const holder = await adminPool.connect();
    try {
      await holder.query(`select pg_advisory_lock(hashtext('refresh-deals'))`);
      const run = vi.fn(() => Promise.resolve('ran'));
      const outcome = await withJobLock(handle.db, 'refresh-deals', run);

      expect(outcome.ran).toBe(false);
      expect(run).not.toHaveBeenCalled();
    } finally {
      await holder.query(`select pg_advisory_unlock(hashtext('refresh-deals'))`);
      holder.release();
    }
  });

  it('releases the lock when the job throws', async () => {
    await expect(
      withJobLock(handle.db, 'failing-job', () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');

    const after = await withJobLock(handle.db, 'failing-job', () => Promise.resolve('ok'));
    expect(after.ran).toBe(true);
  });

  it('is keyed per job name, so two jobs never block each other', async () => {
    const holder = await adminPool.connect();
    try {
      await holder.query(`select pg_advisory_lock(hashtext('refresh-deals'))`);
      const outcome = await withJobLock(handle.db, 'prune-cache', () => Promise.resolve('ok'));
      expect(outcome.ran).toBe(true);
    } finally {
      await holder.query(`select pg_advisory_unlock(hashtext('refresh-deals'))`);
      holder.release();
    }
  });
});

describe('send-time helpers', () => {
  it('finds the next local 09:00 strictly after the given instant', async () => {
    const { rows } = await adminPool.query<{ at: string }>(
      `select pg_catalog.to_char(
         public.next_local_time($1::timestamptz, 'America/New_York', time '09:00')
           at time zone 'America/New_York', 'YYYY-MM-DD HH24:MI') as at`,
      ['2026-09-25T18:00:00Z'],
    );
    // 18:00Z is 14:00 in New York, so the next 09:00 is tomorrow's.
    expect(rows[0]?.at).toBe('2026-09-26 09:00');
  });

  it('leaves a send time outside the quiet window alone', async () => {
    const { rows } = await adminPool.query<{ same: boolean }>(
      `select public.after_quiet_hours($1::timestamptz, 'America/New_York', time '22:00',
         time '07:00') = $1::timestamptz as same`,
      ['2026-09-25T13:00:00Z'],
    );
    expect(rows[0]?.same).toBe(true);
  });

  it('moves a send time inside a window that crosses midnight to the window’s end', async () => {
    const { rows } = await adminPool.query<{ at: string }>(
      `select pg_catalog.to_char(
         public.after_quiet_hours($1::timestamptz, 'America/New_York', time '22:00', time '07:00')
           at time zone 'America/New_York', 'YYYY-MM-DD HH24:MI') as at`,
      // 04:00Z on the 26th is 00:00 on the 26th in New York, inside 22:00-07:00.
      ['2026-09-26T04:00:00Z'],
    );
    expect(rows[0]?.at).toBe('2026-09-26 07:00');
  });

  it('is a no-op when the user has no quiet hours', async () => {
    const { rows } = await adminPool.query<{ same: boolean }>(
      `select public.after_quiet_hours($1::timestamptz, 'America/New_York', null, null)
         = $1::timestamptz as same`,
      ['2026-09-26T04:00:00Z'],
    );
    expect(rows[0]?.same).toBe(true);
  });
});
