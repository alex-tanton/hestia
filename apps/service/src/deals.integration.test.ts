import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  DealSearchResponse,
  FavoriteStore,
  FlyerItemsResponse,
  FlyersResponse,
  Household,
  MerchantsResponse,
} from '@hearth/shared';
import { createDealsService, type DealsService } from './services/deals/deals.js';
import { aDeal, aFlyer, FakeDealSource, fetchFailure } from './test/fixture-deal-source.js';
import {
  adminPool,
  as,
  signUp,
  startStack,
  uniqueName,
  type SignedUpUser,
  type Stack,
} from './test/service-stack.js';

/*
 * Deals, flyers, merchants, and favorite stores against `supabase start`: real Postgres as
 * hearth_service, every request through withUserDb, so RLS decides each assertion. The deal
 * source is always a double — tests never call Flipp (Handoff non-negotiable 17).
 */

let stack: Stack;
let app: FastifyInstance;
let source: FakeDealSource;
let deals: DealsService;
let queued: string[];
let clock: Date;

beforeAll(async () => {
  stack = await startStack();
});

// A postal code of this file's own: `deal` rows are shared by postal code and these requests
// commit, so reusing another file's code would change what it sees.
const POSTAL_CODE = '27518';
const OTHER_POSTAL_CODE = '27519';
const DORMANT_POSTAL_CODE = '27520';

beforeEach(async () => {
  clock = new Date();
  source = new FakeDealSource();
  queued = [];
  deals = createDealsService({
    source,
    queueBackgroundRefresh: (postalCode) => queued.push(postalCode),
    now: () => clock,
  });
  app = await stack.newApp({ deps: { deals } });
  for (const postalCode of [POSTAL_CODE, OTHER_POSTAL_CODE, DORMANT_POSTAL_CODE]) {
    await adminPool.query('delete from public.deal where postal_code = $1', [postalCode]);
    await adminPool.query('delete from public.deal_query_cache where postal_code = $1', [
      postalCode,
    ]);
    await adminPool.query('delete from public.postal_code_refresh where postal_code = $1', [
      postalCode,
    ]);
  }
  // Every postal code but the dormant one looks like this morning's run covered it.
  for (const postalCode of [POSTAL_CODE, OTHER_POSTAL_CODE]) {
    await adminPool.query(
      `insert into public.postal_code_refresh (postal_code, last_refreshed_at)
       values ($1, now() - interval '6 hours')`,
      [postalCode],
    );
  }
});

afterAll(async () => {
  await stack.close();
});

function expectStatus(response: LightMyRequestResponse, status: number): void {
  expect(response.statusCode, response.body).toBe(status);
}

interface Home {
  user: SignedUpUser;
  household: Household;
}

async function household(name = 'Alex Rivera', postalCode = POSTAL_CODE): Promise<Home> {
  const user = await signUp(app, name);
  const response = await as(app, user, 'POST', '/api/households', {
    name: uniqueName('Oak Street'),
    postalCode,
    timezone: 'America/New_York',
  });
  expectStatus(response, 201);
  return { user, household: response.json<Household>() };
}

async function favorite(home: Home, merchantId: string, merchantName: string): Promise<void> {
  const response = await as(
    app,
    home.user,
    'POST',
    `/api/households/${home.household.id}/favorite-stores`,
    { merchantId, merchantName },
  );
  expectStatus(response, 201);
}

const broccoli = (overrides = {}): ReturnType<typeof aDeal> =>
  aDeal({
    externalId: 'fl-broccoli',
    name: 'Broccoli Crowns',
    merchantId: '2100',
    merchantName: 'Food Lion',
    unitPrice: 199,
    priceUnit: 'lb',
    originalPrice: null,
    discountPercent: null,
    displayPrice: 'MVP $1.99 LB',
    conditionalPrice: true,
    conditionalReason: 'loyalty_card',
    category: 'Food Items',
    flyerId: '8128502',
    ...overrides,
  });

describe('GET /households/:id/deals/search', () => {
  it('fetches live on a cache miss and returns normalized, camelCase deals in integer cents', async () => {
    const home = await household();
    await favorite(home, '2100', 'Food Lion');
    source.data.search = { broccoli: [broccoli()] };

    const response = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/deals/search?q=broccoli`,
    );
    expectStatus(response, 200);
    const body = response.json<DealSearchResponse>();

    expect(body.deals).toHaveLength(1);
    const deal = body.deals[0];
    expect(deal?.unitPrice).toBe(199);
    expect(deal?.priceUnit).toBe('lb');
    expect(deal?.displayPrice).toBe('MVP $1.99 LB');
    expect(deal?.conditionalPrice).toBe(true);
    expect(deal?.conditionalReason).toBe('loyalty_card');
    expect(deal?.normalizedName).toBe('broccoli');
    expect(deal?.validTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.pageSize).toBe(50);
    expect(body.stale).toBe(false);
    expect(body.refreshing).toBe(false);
    expect(body.asOf).not.toBeNull();
  });

  it('serves the second search from deal_query_cache without another fetch', async () => {
    const home = await household();
    source.data.search = { broccoli: [broccoli()] };
    const url = `/api/households/${home.household.id}/deals/search?q=broccoli&scope=all`;

    expectStatus(await as(app, home.user, 'GET', url), 200);
    const second = await as(app, home.user, 'GET', url);
    expectStatus(second, 200);

    expect(source.countOf('search')).toBe(1);
    expect(second.json<DealSearchResponse>().deals).toHaveLength(1);
  });

  it('refetches once the six-hour TTL has passed', async () => {
    const home = await household();
    source.data.search = { broccoli: [broccoli()] };
    const url = `/api/households/${home.household.id}/deals/search?q=broccoli&scope=all`;

    expectStatus(await as(app, home.user, 'GET', url), 200);
    clock = new Date(clock.getTime() + 7 * 60 * 60 * 1_000);
    expectStatus(await as(app, home.user, 'GET', url), 200);

    expect(source.countOf('search')).toBe(2);
  });

  it('keys the cache on the normalized query, so "Broccoli " hits the same row', async () => {
    const home = await household();
    source.data.search = { broccoli: [broccoli()], 'Broccoli Crowns': [broccoli()] };

    expectStatus(
      await as(
        app,
        home.user,
        'GET',
        `/api/households/${home.household.id}/deals/search?q=broccoli`,
      ),
      200,
    );
    expectStatus(
      await as(
        app,
        home.user,
        'GET',
        `/api/households/${home.household.id}/deals/search?q=Broccoli%20Crowns`,
      ),
      200,
    );
    expect(source.countOf('search')).toBe(1);
  });

  it('upserts on (postal_code, external_id), so a rerun changes nothing', async () => {
    const home = await household();
    source.data.search = { broccoli: [broccoli()] };
    const url = `/api/households/${home.household.id}/deals/search?q=broccoli&scope=all`;

    const first = await as(app, home.user, 'GET', url);
    expectStatus(first, 200);
    const firstId = first.json<DealSearchResponse>().deals[0]?.id;

    // A second live fetch of the same item, with a changed price.
    clock = new Date(clock.getTime() + 7 * 60 * 60 * 1_000);
    source.data.search = { broccoli: [broccoli({ unitPrice: 249, displayPrice: 'MVP $2.49 LB' })] };
    const second = await as(app, home.user, 'GET', url);
    expectStatus(second, 200);

    const { rows } = await adminPool.query<{ count: string }>(
      'select count(*) as count from public.deal where postal_code = $1',
      [POSTAL_CODE],
    );
    expect(rows[0]?.count).toBe('1');
    expect(second.json<DealSearchResponse>().deals[0]?.id).toBe(firstId);
    expect(second.json<DealSearchResponse>().deals[0]?.unitPrice).toBe(249);
  });

  it('never replaces a known category with null', async () => {
    const home = await household();
    source.data.search = { broccoli: [broccoli({ category: 'Produce' })] };
    const url = `/api/households/${home.household.id}/deals/search?q=broccoli&scope=all`;
    expectStatus(await as(app, home.user, 'GET', url), 200);

    clock = new Date(clock.getTime() + 7 * 60 * 60 * 1_000);
    source.data.search = { broccoli: [broccoli({ category: null })] };
    const second = await as(app, home.user, 'GET', url);
    expect(second.json<DealSearchResponse>().deals[0]?.category).toBe('Produce');
  });

  it('scopes to favorite stores by default and widens with scope=all', async () => {
    const home = await household();
    await favorite(home, '2100', 'Food Lion');
    source.data.search = {
      cheese: [
        broccoli({ externalId: 'fl-cheese', name: 'Food Lion Cheese' }),
        aDeal({ externalId: 'ht-cheese', merchantId: '2431', merchantName: 'Harris Teeter' }),
      ],
    };
    const base = `/api/households/${home.household.id}/deals/search?q=cheese`;

    const favorites = await as(app, home.user, 'GET', base);
    expect(favorites.json<DealSearchResponse>().deals.map((d) => d.merchantId)).toStrictEqual([
      '2100',
    ]);

    const all = await as(app, home.user, 'GET', `${base}&scope=all`);
    expect(all.json<DealSearchResponse>().deals).toHaveLength(2);
  });

  it('shows everything when the household has no favorites yet', async () => {
    const home = await household();
    source.data.search = { cheese: [broccoli(), aDeal({ merchantId: '2431' })] };
    const response = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/deals/search?q=cheese`,
    );
    expect(response.json<DealSearchResponse>().deals).toHaveLength(2);
  });

  it('filters by store, category, and price range, and sorts by price', async () => {
    const home = await household();
    source.data.search = {
      mix: [
        aDeal({ externalId: 'a', merchantId: '2100', unitPrice: 900, category: 'Food Items' }),
        aDeal({ externalId: 'b', merchantId: '2100', unitPrice: 100, category: 'Food Items' }),
        aDeal({ externalId: 'c', merchantId: '2431', unitPrice: 450, category: 'Personal Care' }),
      ],
    };
    const base = `/api/households/${home.household.id}/deals/search?q=mix&scope=all`;

    const byStore = await as(app, home.user, 'GET', `${base}&stores=2431`);
    expect(byStore.json<DealSearchResponse>().deals.map((d) => d.externalId)).toStrictEqual(['c']);

    const byCategory = await as(app, home.user, 'GET', `${base}&category=Food%20Items`);
    expect(byCategory.json<DealSearchResponse>().total).toBe(2);

    const byPrice = await as(app, home.user, 'GET', `${base}&minPrice=101&maxPrice=899`);
    expect(byPrice.json<DealSearchResponse>().deals.map((d) => d.externalId)).toStrictEqual(['c']);

    const sorted = await as(app, home.user, 'GET', `${base}&sort=price`);
    expect(sorted.json<DealSearchResponse>().deals.map((d) => d.unitPrice)).toStrictEqual([
      100, 450, 900,
    ]);
  });

  it('keeps the source’s order for relevance', async () => {
    const home = await household();
    source.data.search = {
      mix: [aDeal({ externalId: 'a', unitPrice: 900 }), aDeal({ externalId: 'b', unitPrice: 100 })],
    };
    const response = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/deals/search?q=mix&scope=all`,
    );
    expect(response.json<DealSearchResponse>().deals.map((d) => d.externalId)).toStrictEqual([
      'a',
      'b',
    ]);
  });

  it('paginates at 50', async () => {
    const home = await household();
    source.data.search = {
      many: Array.from({ length: 120 }, (_, index) =>
        aDeal({ externalId: `item-${String(index)}`, unitPrice: index + 1 }),
      ),
    };
    const base = `/api/households/${home.household.id}/deals/search?q=many&scope=all&sort=price`;

    const first = await as(app, home.user, 'GET', base);
    const firstBody = first.json<DealSearchResponse>();
    expect(firstBody.deals).toHaveLength(50);
    expect(firstBody.total).toBe(120);
    expect(firstBody.hasMore).toBe(true);
    expect(firstBody.deals[0]?.unitPrice).toBe(1);

    const last = await as(app, home.user, 'GET', `${base}&page=3`);
    expect(last.json<DealSearchResponse>().deals).toHaveLength(20);
    expect(last.json<DealSearchResponse>().hasMore).toBe(false);
  });

  it('serves the stale cache with its as-of date when a live fetch fails (non-negotiable 18)', async () => {
    const home = await household();
    source.data.search = { broccoli: [broccoli()] };
    const url = `/api/households/${home.household.id}/deals/search?q=broccoli&scope=all`;
    const warm = await as(app, home.user, 'GET', url);
    const warmedAt = warm.json<DealSearchResponse>().asOf;

    clock = new Date(clock.getTime() + 7 * 60 * 60 * 1_000);
    source.failure = fetchFailure();
    const stale = await as(app, home.user, 'GET', url);

    expectStatus(stale, 200);
    const body = stale.json<DealSearchResponse>();
    expect(body.deals).toHaveLength(1);
    expect(body.stale).toBe(true);
    expect(body.asOf).toBe(warmedAt);
  });

  it('answers 503 when a fetch fails with nothing cached', async () => {
    const home = await household();
    source.failure = fetchFailure();
    const response = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/deals/search?q=broccoli`,
    );
    expectStatus(response, 503);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
  });

  it('always fetches live on a cache miss, even for a dormant postal code', async () => {
    const home = await household('Casey Nguyen', DORMANT_POSTAL_CODE);
    source.data.search = { broccoli: [broccoli()] };
    const response = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/deals/search?q=broccoli&scope=all`,
    );
    expectStatus(response, 200);
    expect(response.json<DealSearchResponse>().deals).toHaveLength(1);
    expect(source.countOf('search')).toBe(1);
    // Dormancy governs flyers and flyer items only.
    expect(queued).toStrictEqual([]);
  });

  it('rejects a blank query and an inverted price range', async () => {
    const home = await household();
    const base = `/api/households/${home.household.id}/deals/search`;
    expectStatus(await as(app, home.user, 'GET', `${base}?q=`), 400);
    expectStatus(await as(app, home.user, 'GET', `${base}?q=milk&minPrice=900&maxPrice=100`), 400);
  });
});

describe('postal-code scoping and household isolation', () => {
  it('never returns another postal code’s deals', async () => {
    const here = await household('Alex Rivera', POSTAL_CODE);
    const there = await household('Morgan Reed', OTHER_POSTAL_CODE);

    source.data.search = { milk: [aDeal({ externalId: 'here-milk' })] };
    expectStatus(
      await as(
        app,
        here.user,
        'GET',
        `/api/households/${here.household.id}/deals/search?q=milk&scope=all`,
      ),
      200,
    );

    source.data.search = { milk: [aDeal({ externalId: 'there-milk' })] };
    const other = await as(
      app,
      there.user,
      'GET',
      `/api/households/${there.household.id}/deals/search?q=milk&scope=all`,
    );
    expect(other.json<DealSearchResponse>().deals.map((d) => d.externalId)).toStrictEqual([
      'there-milk',
    ]);
  });

  it('answers 404 to a member of another household, never 403', async () => {
    const mine = await household('Alex Rivera');
    const stranger = await signUp(app, 'Blake Stranger');

    for (const path of [
      `/api/households/${mine.household.id}/deals/search?q=milk`,
      `/api/households/${mine.household.id}/flyers`,
      `/api/households/${mine.household.id}/flyers/8128502/items`,
      `/api/households/${mine.household.id}/merchants`,
      `/api/households/${mine.household.id}/favorite-stores`,
    ]) {
      expectStatus(await as(app, stranger, 'GET', path), 404);
    }
    expectStatus(
      await as(app, stranger, 'POST', `/api/households/${mine.household.id}/favorite-stores`, {
        merchantId: '2100',
        merchantName: 'Food Lion',
      }),
      404,
    );
    expectStatus(
      await as(
        app,
        stranger,
        'DELETE',
        `/api/households/${mine.household.id}/favorite-stores/2100`,
      ),
      404,
    );
  });

  it('hides one postal code’s deal rows from a member of another, at the database level', async () => {
    const here = await household('Alex Rivera', POSTAL_CODE);
    const there = await household('Morgan Reed', OTHER_POSTAL_CODE);
    source.data.search = { milk: [aDeal({ externalId: 'here-milk' })] };
    expectStatus(
      await as(
        app,
        here.user,
        'GET',
        `/api/households/${here.household.id}/deals/search?q=milk&scope=all`,
      ),
      200,
    );

    const claims = JSON.stringify({
      sub: there.user.id,
      email: there.user.email,
      role: 'authenticated',
      aud: 'authenticated',
    });
    const client = await adminPool.connect();
    try {
      await client.query('begin');
      await client.query('set local role authenticated');
      await client.query("select set_config('request.jwt.claims', $1, true)", [claims]);
      const visible = await client.query<{ count: string }>(
        'select count(*) as count from public.deal where postal_code = $1',
        [POSTAL_CODE],
      );
      expect(visible.rows[0]?.count).toBe('0');
    } finally {
      await client.query('rollback');
      client.release();
    }
  });
});

describe('GET /households/:id/flyers', () => {
  it('lists favorite stores’ flyers with their stored item counts', async () => {
    const home = await household();
    await favorite(home, '2100', 'Food Lion');
    source.data.flyers = [
      aFlyer({ flyerId: '8128502', merchantId: '2100', merchantName: 'Food Lion' }),
      aFlyer({ flyerId: '8132883', merchantId: '2431', merchantName: 'Harris Teeter' }),
    ];
    source.data.search = { broccoli: [broccoli()] };
    expectStatus(
      await as(
        app,
        home.user,
        'GET',
        `/api/households/${home.household.id}/deals/search?q=broccoli`,
      ),
      200,
    );

    const response = await as(app, home.user, 'GET', `/api/households/${home.household.id}/flyers`);
    expectStatus(response, 200);
    const body = response.json<FlyersResponse>();
    expect(body.flyers.map((f) => f.merchantName)).toStrictEqual(['Food Lion']);
    expect(body.flyers[0]?.isFavorite).toBe(true);
    expect(body.flyers[0]?.itemCount).toBe(1);
    expect(body.refreshing).toBe(false);
    expect(body.asOf).not.toBeNull();
  });

  it('widens to every merchant with scope=all', async () => {
    const home = await household();
    await favorite(home, '2100', 'Food Lion');
    source.data.flyers = [
      aFlyer({ flyerId: '8128502', merchantId: '2100', merchantName: 'Food Lion' }),
      aFlyer({ flyerId: '8132883', merchantId: '2431', merchantName: 'Harris Teeter' }),
    ];
    const response = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/flyers?scope=all`,
    );
    const body = response.json<FlyersResponse>();
    expect(body.flyers).toHaveLength(2);
    expect(body.flyers.filter((f) => f.isFavorite)).toHaveLength(1);
  });

  it('serves the 12-hour cache without another fetch, and refetches after it', async () => {
    const home = await household();
    source.data.flyers = [aFlyer()];
    const url = `/api/households/${home.household.id}/flyers?scope=all`;

    expectStatus(await as(app, home.user, 'GET', url), 200);
    expectStatus(await as(app, home.user, 'GET', url), 200);
    expect(source.countOf('flyers')).toBe(1);

    clock = new Date(clock.getTime() + 13 * 60 * 60 * 1_000);
    expectStatus(await as(app, home.user, 'GET', url), 200);
    expect(source.countOf('flyers')).toBe(2);
  });

  it('serves stale flyers with their as-of date when a fetch fails', async () => {
    const home = await household();
    source.data.flyers = [aFlyer()];
    const url = `/api/households/${home.household.id}/flyers?scope=all`;
    const warm = await as(app, home.user, 'GET', url);
    const warmedAt = warm.json<FlyersResponse>().asOf;

    clock = new Date(clock.getTime() + 13 * 60 * 60 * 1_000);
    source.failure = fetchFailure();
    const stale = await as(app, home.user, 'GET', url);

    expectStatus(stale, 200);
    expect(stale.json<FlyersResponse>().stale).toBe(true);
    expect(stale.json<FlyersResponse>().asOf).toBe(warmedAt);
    expect(stale.json<FlyersResponse>().flyers).toHaveLength(1);
  });

  it('answers 503 when a fetch fails with nothing cached', async () => {
    const home = await household();
    source.failure = fetchFailure();
    expectStatus(
      await as(app, home.user, 'GET', `/api/households/${home.household.id}/flyers`),
      503,
    );
  });
});

describe('dormant postal codes', () => {
  it('queues one background refresh, returns the refreshing state, and fetches nothing', async () => {
    const home = await household('Casey Nguyen', DORMANT_POSTAL_CODE);
    const response = await as(app, home.user, 'GET', `/api/households/${home.household.id}/flyers`);

    expectStatus(response, 200);
    const body = response.json<FlyersResponse>();
    expect(body.flyers).toStrictEqual([]);
    expect(body.refreshing).toBe(true);
    expect(body.asOf).toBeNull();
    expect(queued).toStrictEqual([DORMANT_POSTAL_CODE]);
    expect(source.countOf('flyers')).toBe(0);
  });

  it('sets last_on_demand_at and claims it only once per UTC day', async () => {
    const home = await household('Casey Nguyen', DORMANT_POSTAL_CODE);
    const url = `/api/households/${home.household.id}/flyers`;

    expectStatus(await as(app, home.user, 'GET', url), 200);
    const { rows } = await adminPool.query<{ last_on_demand_at: Date | null }>(
      'select last_on_demand_at from public.postal_code_refresh where postal_code = $1',
      [DORMANT_POSTAL_CODE],
    );
    expect(rows[0]?.last_on_demand_at).not.toBeNull();

    const second = await as(app, home.user, 'GET', url);
    expect(second.json<FlyersResponse>().refreshing).toBe(false);
    expect(queued).toStrictEqual([DORMANT_POSTAL_CODE]);
  });

  it('queues exactly one refresh for two genuinely concurrent requests at the same dormant postal code', async () => {
    // Two different households at the same postal code, so this is real concurrency between two
    // independent requests racing the same claim — not two calls on one connection in sequence.
    const first = await household('Casey Nguyen', DORMANT_POSTAL_CODE);
    const second = await household('Drew Okafor', DORMANT_POSTAL_CODE);

    const [firstResponse, secondResponse] = await Promise.all([
      as(app, first.user, 'GET', `/api/households/${first.household.id}/flyers`),
      as(app, second.user, 'GET', `/api/households/${second.household.id}/flyers`),
    ]);

    expectStatus(firstResponse, 200);
    expectStatus(secondResponse, 200);
    // The claim commits in its own transaction before the refresh is ever queued (Fix 2), so
    // interleaving the two requests however the scheduler likes still queues the refresh exactly
    // once — never zero, and never twice.
    expect(queued).toStrictEqual([DORMANT_POSTAL_CODE]);

    const { rows } = await adminPool.query<{ last_on_demand_at: Date | null }>(
      'select last_on_demand_at from public.postal_code_refresh where postal_code = $1',
      [DORMANT_POSTAL_CODE],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.last_on_demand_at).not.toBeNull();
  });

  it('claims again once the UTC day has rolled over', async () => {
    const home = await household('Casey Nguyen', DORMANT_POSTAL_CODE);
    const url = `/api/households/${home.household.id}/flyers`;
    expectStatus(await as(app, home.user, 'GET', url), 200);

    clock = new Date(clock.getTime() + 36 * 60 * 60 * 1_000);
    expectStatus(await as(app, home.user, 'GET', url), 200);
    expect(queued).toStrictEqual([DORMANT_POSTAL_CODE, DORMANT_POSTAL_CODE]);
  });

  it('queues from a flyer-items request too, when nothing is stored', async () => {
    const home = await household('Casey Nguyen', DORMANT_POSTAL_CODE);
    const response = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/flyers/8128502/items`,
    );
    expectStatus(response, 200);
    const body = response.json<FlyerItemsResponse>();
    expect(body.deals).toStrictEqual([]);
    expect(body.refreshing).toBe(true);
    expect(queued).toStrictEqual([DORMANT_POSTAL_CODE]);
  });

  it('shows the cached flyers, marked stale, while the refresh runs', async () => {
    const home = await household('Casey Nguyen', DORMANT_POSTAL_CODE);
    // Warm the in-process cache the way a run that has already happened would.
    await adminPool.query(
      `insert into public.postal_code_refresh (postal_code, last_refreshed_at)
       values ($1, now())
       on conflict (postal_code) do update set last_refreshed_at = excluded.last_refreshed_at`,
      [DORMANT_POSTAL_CODE],
    );
    source.data.flyers = [aFlyer()];
    const url = `/api/households/${home.household.id}/flyers?scope=all`;
    const warm = await as(app, home.user, 'GET', url);
    const warmedAt = warm.json<FlyersResponse>().asOf;

    await adminPool.query(
      `update public.postal_code_refresh
         set last_refreshed_at = now() - interval '3 days' where postal_code = $1`,
      [DORMANT_POSTAL_CODE],
    );
    const dormant = await as(app, home.user, 'GET', url);
    const body = dormant.json<FlyersResponse>();
    expect(body.refreshing).toBe(true);
    expect(body.stale).toBe(true);
    expect(body.asOf).toBe(warmedAt);
    expect(body.flyers).toHaveLength(1);
  });
});

describe('GET /households/:id/flyers/:flyerId/items', () => {
  it('serves the stored deals for the flyer, with their as-of time', async () => {
    const home = await household();
    source.data.search = {
      broccoli: [broccoli(), broccoli({ externalId: 'fl-2', name: 'Broccoli Florets' })],
    };
    expectStatus(
      await as(
        app,
        home.user,
        'GET',
        `/api/households/${home.household.id}/deals/search?q=broccoli&scope=all`,
      ),
      200,
    );

    const response = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/flyers/8128502/items`,
    );
    expectStatus(response, 200);
    const body = response.json<FlyerItemsResponse>();
    expect(body.deals).toHaveLength(2);
    expect(body.pageSize).toBe(50);
    expect(body.asOf).not.toBeNull();
    // A flyer's items are never fetched inline: they cost hundreds of requests.
    expect(source.countOf('flyerItems')).toBe(0);
  });

  it('filters by category and paginates', async () => {
    const home = await household();
    source.data.search = {
      mix: [
        broccoli({ externalId: 'a', category: 'Produce' }),
        broccoli({ externalId: 'b', category: 'Dairy' }),
      ],
    };
    expectStatus(
      await as(
        app,
        home.user,
        'GET',
        `/api/households/${home.household.id}/deals/search?q=mix&scope=all`,
      ),
      200,
    );

    const response = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/flyers/8128502/items?category=Dairy`,
    );
    expect(response.json<FlyerItemsResponse>().deals.map((d) => d.externalId)).toStrictEqual(['b']);
  });

  it('is an ordinary empty list for an unfavorited flyer at an active postal code', async () => {
    const home = await household();
    const response = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/flyers/9999999/items`,
    );
    expectStatus(response, 200);
    const body = response.json<FlyerItemsResponse>();
    expect(body.deals).toStrictEqual([]);
    expect(body.refreshing).toBe(false);
    expect(body.asOf).toBeNull();
    expect(queued).toStrictEqual([]);
  });
});

describe('GET /households/:id/merchants', () => {
  it('marks the household’s favorites and leaves browse-all available', async () => {
    const home = await household();
    await favorite(home, '2100', 'Food Lion');
    source.data.merchants = [
      { merchantId: '2100', name: 'Food Lion', logoUrl: null },
      { merchantId: '2431', name: 'Harris Teeter', logoUrl: null },
    ];

    const response = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/merchants`,
    );
    expectStatus(response, 200);
    const body = response.json<MerchantsResponse>();
    expect(body.merchants).toHaveLength(2);
    expect(body.merchants.find((m) => m.merchantId === '2100')?.isFavorite).toBe(true);
    expect(body.merchants.find((m) => m.merchantId === '2431')?.isFavorite).toBe(false);
  });

  it('returns an empty list for a postal code with no merchants', async () => {
    const home = await household();
    source.data.merchants = [];
    const response = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/merchants`,
    );
    expectStatus(response, 200);
    expect(response.json<MerchantsResponse>().merchants).toStrictEqual([]);
  });

  it('caches the directory for seven days', async () => {
    const home = await household();
    source.data.merchants = [{ merchantId: '2100', name: 'Food Lion', logoUrl: null }];
    const url = `/api/households/${home.household.id}/merchants`;

    expectStatus(await as(app, home.user, 'GET', url), 200);
    clock = new Date(clock.getTime() + 6 * 24 * 60 * 60 * 1_000);
    expectStatus(await as(app, home.user, 'GET', url), 200);
    expect(source.countOf('merchants')).toBe(1);

    clock = new Date(clock.getTime() + 2 * 24 * 60 * 60 * 1_000);
    expectStatus(await as(app, home.user, 'GET', url), 200);
    expect(source.countOf('merchants')).toBe(2);
  });
});

describe('favorite stores', () => {
  it('adds, lists, and removes, and any member may do it', async () => {
    const home = await household();
    await favorite(home, '2100', 'Food Lion');
    await favorite(home, '2431', 'Harris Teeter');

    const listed = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/favorite-stores`,
    );
    expectStatus(listed, 200);
    expect(listed.json<FavoriteStore[]>().map((s) => s.merchantName)).toStrictEqual([
      'Food Lion',
      'Harris Teeter',
    ]);

    expectStatus(
      await as(
        app,
        home.user,
        'DELETE',
        `/api/households/${home.household.id}/favorite-stores/2100`,
      ),
      204,
    );
    const after = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/favorite-stores`,
    );
    expect(after.json<FavoriteStore[]>()).toHaveLength(1);
  });

  it('is idempotent on (household, merchant), so a replayed add changes nothing', async () => {
    const home = await household();
    await favorite(home, '2100', 'Food Lion');
    await favorite(home, '2100', 'Food Lion');
    const listed = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/favorite-stores`,
    );
    expect(listed.json<FavoriteStore[]>()).toHaveLength(1);
  });

  it('answers 404 when removing a store that is not a favorite', async () => {
    const home = await household();
    expectStatus(
      await as(
        app,
        home.user,
        'DELETE',
        `/api/households/${home.household.id}/favorite-stores/9999`,
      ),
      404,
    );
  });

  it('rejects an empty merchant id', async () => {
    const home = await household();
    expectStatus(
      await as(app, home.user, 'POST', `/api/households/${home.household.id}/favorite-stores`, {
        merchantId: '  ',
        merchantName: 'Food Lion',
      }),
      400,
    );
  });
});
