import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type {
  Household,
  ListItem,
  PantryItem,
  ShoppingList,
  ShoppingListDetail,
} from '@hearth/shared';
import {
  adminPool,
  as,
  createHouseholdFor,
  household as sharedHousehold,
  signUp,
  type HouseholdFixture,
  type SignedUpUser,
} from './test/service-stack.js';
import { app, expectStatus, registerStackHooks } from './test/stack-hooks.js';

/*
 * Lists, items, and the pantry against `supabase start`: real Postgres as hearth_service, every
 * request through withUserDb, so RLS is what decides each assertion. Requests here commit, so
 * each test makes its own users, household, and deals.
 */

registerStackHooks();

// A postal code of this file's own: deals are shared by postal code and these rows commit, so
// reusing a fixture's code would change what another test file sees.
const POSTAL_CODE = '27517';

async function createHousehold(
  user: SignedUpUser,
  postalCode = POSTAL_CODE,
  timezone = 'America/New_York',
): Promise<Household> {
  return createHouseholdFor(app, user, postalCode, timezone);
}

type Home = HouseholdFixture;

async function household(
  name = 'Alex Rivera',
  postalCode = POSTAL_CODE,
  timezone = 'America/New_York',
): Promise<Home> {
  return sharedHousehold(app, name, postalCode, timezone);
}

async function createList(home: Home, name = 'This Week'): Promise<ShoppingListDetail> {
  const response = await as(app, home.user, 'POST', `/api/households/${home.household.id}/lists`, {
    name,
  });
  expectStatus(response, 201);
  return response.json<ShoppingListDetail>();
}

async function getList(home: Home, listId: string): Promise<ShoppingListDetail> {
  const response = await as(app, home.user, 'GET', `/api/lists/${listId}`);
  expectStatus(response, 200);
  return response.json<ShoppingListDetail>();
}

async function addItem(
  home: Home,
  listId: string,
  body: Record<string, unknown>,
): Promise<ShoppingListDetail> {
  const response = await as(app, home.user, 'POST', `/api/lists/${listId}/items`, body);
  expectStatus(response, 201);
  return response.json<ShoppingListDetail>();
}

function allItems(list: ShoppingListDetail): ListItem[] {
  return [...list.storeGroups.flatMap((group) => group.items), ...list.bought];
}

function itemNamed(list: ShoppingListDetail, name: string): ListItem {
  const found = allItems(list).find((item) => item.itemName === name);
  if (found === undefined) throw new Error(`no item named ${name}`);
  return found;
}

interface DealFields {
  merchantId?: string;
  merchantName?: string;
  name: string;
  normalizedName: string;
  unitPrice: string;
  originalPrice?: string | null;
  priceUnit?: 'each' | 'lb' | 'oz';
  conditional?: boolean;
  validTo: string;
  postalCode?: string;
}

/** A deal row, inserted as the database owner the way the refresh job would write it. */
async function insertDeal(fields: DealFields): Promise<{ id: string; externalId: string }> {
  const externalId = `item-${randomUUID()}`;
  const { rows } = await adminPool.query<{ id: string }>(
    `insert into public.deal (external_id, merchant_id, merchant_name, name, normalized_name,
       unit_price, price_unit, original_price, display_price, conditional_price,
       conditional_reason, flyer_id, postal_code, valid_from, valid_to)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, current_date - 7, $14)
     returning id`,
    [
      externalId,
      fields.merchantId ?? '2431',
      fields.merchantName ?? 'Harris Teeter',
      fields.name,
      fields.normalizedName,
      fields.unitPrice,
      fields.priceUnit ?? 'each',
      fields.originalPrice ?? null,
      `$${fields.unitPrice}`,
      fields.conditional ?? false,
      fields.conditional === true ? 'coupon' : null,
      `flyer-${randomUUID()}`,
      fields.postalCode ?? POSTAL_CODE,
      fields.validTo,
    ],
  );
  const row = rows[0];
  if (row === undefined) throw new Error('no deal inserted');
  return { id: row.id, externalId };
}

/** An item already on a list whose deal ended yesterday, the state repricing acts on. */
async function addExpiredItem(
  listId: string,
  fields: {
    itemName: string;
    normalizedName: string;
    merchantId: string;
    salePrice: string;
    regularPrice: string | null;
    priceUnit?: 'each' | 'lb' | 'oz';
    /** An explicit `deal_valid_to`; the default is yesterday in the household's own timezone. */
    validTo?: string;
  },
): Promise<void> {
  await adminPool.query(
    `insert into public.shopping_list_item (list_id, item_name, normalized_name, status, source,
       merchant_id, merchant_name, deal_external_id, sale_price, regular_price, deal_valid_to,
       price_unit, price, added_by)
     select $1, $2, $3, 'needed', 'from_deal', $4, 'Store', 'last-week', $5, $6,
       coalesce($8::date, (pg_catalog.now() at time zone h.timezone)::date - 1), $7, $5,
       l.created_by
     from public.shopping_list l
     join public.household h on h.id = l.household_id
     where l.id = $1`,
    [
      listId,
      fields.itemName,
      fields.normalizedName,
      fields.merchantId,
      fields.salePrice,
      fields.regularPrice,
      fields.priceUnit ?? 'each',
      fields.validTo ?? null,
    ],
  );
}

/** Today in a named timezone, as Postgres sees it. */
async function todayIn(timezone: string): Promise<string> {
  const { rows } = await adminPool.query<{ day: string }>(
    'select (pg_catalog.now() at time zone $1)::date::text as day',
    [timezone],
  );
  const row = rows[0];
  if (row === undefined) throw new Error('no date');
  return row.day;
}

describe('shopping lists', () => {
  it('creates, renames, archives, unarchives, and deletes a list', async () => {
    const home = await household();
    const created = await createList(home);
    expect(created).toMatchObject({
      name: 'This Week',
      householdId: home.household.id,
      createdBy: home.user.id,
      archivedAt: null,
      itemCount: 0,
      outstandingCount: 0,
      storeGroups: [],
      bought: [],
    });

    const renamed = await as(app, home.user, 'PATCH', `/api/lists/${created.id}`, {
      name: 'Next Week',
    });
    expectStatus(renamed, 200);
    expect(renamed.json<ShoppingListDetail>().name).toBe('Next Week');

    const archived = await as(app, home.user, 'POST', `/api/lists/${created.id}/archive`);
    expectStatus(archived, 200);
    expect(archived.json<ShoppingListDetail>().archivedAt).not.toBeNull();

    const active = await as(app, home.user, 'GET', `/api/households/${home.household.id}/lists`);
    expect(active.json<ShoppingList[]>()).toHaveLength(0);
    const hidden = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/lists?archived=true`,
    );
    expect(hidden.json<ShoppingList[]>().map((list) => list.id)).toEqual([created.id]);

    const unarchived = await as(app, home.user, 'POST', `/api/lists/${created.id}/unarchive`);
    expectStatus(unarchived, 200);
    expect(unarchived.json<ShoppingListDetail>().archivedAt).toBeNull();

    const deleted = await as(app, home.user, 'DELETE', `/api/lists/${created.id}`);
    expectStatus(deleted, 204);
    expectStatus(await as(app, home.user, 'GET', `/api/lists/${created.id}`), 404);
  });

  it('deletes a list’s items with it, and counts them for the confirmation', async () => {
    const home = await household();
    const list = await createList(home);
    await addItem(home, list.id, { source: 'manual', itemName: 'Trash bags' });
    await addItem(home, list.id, { source: 'manual', itemName: 'Apples' });

    const index = await as(app, home.user, 'GET', `/api/households/${home.household.id}/lists`);
    expect(index.json<ShoppingList[]>()[0]).toMatchObject({ itemCount: 2, outstandingCount: 2 });

    expectStatus(await as(app, home.user, 'DELETE', `/api/lists/${list.id}`), 204);
    const { rows } = await adminPool.query(
      'select 1 from public.shopping_list_item where list_id = $1',
      [list.id],
    );
    expect(rows).toHaveLength(0);
  });

  it('keeps every list, item, and pantry row inside its household', async () => {
    const mine = await household('Alex Rivera');
    const theirs = await household('Blake Stranger');
    const list = await createList(mine);
    const item = itemNamed(
      await addItem(mine, list.id, { source: 'manual', itemName: 'Milk' }),
      'Milk',
    );
    const pantry = await as(app, mine.user, 'POST', `/api/households/${mine.household.id}/pantry`, {
      itemName: 'Rice',
    });
    expectStatus(pantry, 201);
    const pantryId = pantry.json<PantryItem>().id;

    for (const [method, url, payload] of [
      ['GET', `/api/households/${mine.household.id}/lists`, undefined],
      ['POST', `/api/households/${mine.household.id}/lists`, { name: 'Theirs' }],
      ['GET', `/api/lists/${list.id}`, undefined],
      ['PATCH', `/api/lists/${list.id}`, { name: 'Theirs' }],
      ['DELETE', `/api/lists/${list.id}`, undefined],
      ['POST', `/api/lists/${list.id}/archive`, undefined],
      ['POST', `/api/lists/${list.id}/items`, { source: 'manual', itemName: 'Theirs' }],
      ['PATCH', `/api/lists/${list.id}/items/${item.id}`, { status: 'bought' }],
      ['DELETE', `/api/lists/${list.id}/items/${item.id}`, undefined],
      ['POST', `/api/lists/${list.id}/add-bought-to-pantry`, undefined],
      ['GET', `/api/households/${mine.household.id}/pantry`, undefined],
      ['POST', `/api/households/${mine.household.id}/pantry`, { itemName: 'Theirs' }],
      ['PATCH', `/api/pantry/${pantryId}`, { itemName: 'Theirs' }],
      ['DELETE', `/api/pantry/${pantryId}`, undefined],
    ] as const) {
      const response = await as(app, theirs.user, method, url, payload);
      expect(response.statusCode, `${method} ${url}`).toBe(404);
    }

    // Nothing the stranger tried changed anything.
    const after = await getList(mine, list.id);
    expect(after.name).toBe('This Week');
    expect(allItems(after).map((one) => one.itemName)).toEqual(['Milk']);
  });
});

describe('list items', () => {
  it('adds a manual item with a hand-entered price, unit, and store', async () => {
    const home = await household();
    const list = await createList(home);
    const detail = await addItem(home, list.id, {
      source: 'manual',
      itemName: 'Paper towels',
      quantity: 1,
      priceCents: 599,
      priceUnit: 'each',
      merchantId: '2264',
      merchantName: 'CVS Pharmacy',
    });
    expect(itemNamed(detail, 'Paper towels')).toMatchObject({
      source: 'manual',
      normalizedName: 'paper towel',
      priceCents: 599,
      priceUnit: 'each',
      merchantId: '2264',
      merchantName: 'CVS Pharmacy',
      addedBy: home.user.id,
      status: 'needed',
      salePriceCents: null,
      dealExternalId: null,
    });
  });

  it('takes the deal’s snapshot when an item comes from a deal', async () => {
    const home = await household();
    const list = await createList(home);
    const deal = await insertDeal({
      name: 'Boneless Skinless Chicken Breast, Family Pack',
      normalizedName: 'chicken breast',
      unitPrice: '2.49',
      originalPrice: '4.99',
      priceUnit: 'lb',
      validTo: '2099-01-01',
    });

    const detail = await addItem(home, list.id, {
      source: 'from_deal',
      dealId: deal.id,
      quantity: 2,
    });
    expect(itemNamed(detail, 'Boneless Skinless Chicken Breast, Family Pack')).toMatchObject({
      source: 'from_deal',
      normalizedName: 'chicken breast',
      merchantId: '2431',
      merchantName: 'Harris Teeter',
      dealExternalId: deal.externalId,
      salePriceCents: 249,
      regularPriceCents: 499,
      priceCents: 249,
      priceUnit: 'lb',
      dealValidTo: '2099-01-01',
      conditionalPrice: false,
      addedBy: home.user.id,
    });
  });

  it('ignores every price and store a client sends alongside a deal id', async () => {
    const home = await household();
    const list = await createList(home);
    const deal = await insertDeal({
      name: 'Kraft Shredded Cheese, 8 oz',
      normalizedName: `cheese ${randomUUID().slice(0, 8)}`,
      unitPrice: '2.50',
      originalPrice: '3.99',
      validTo: '2099-01-01',
    });
    // Everything after `dealId` is an injection attempt: the snapshot comes from the deal row.
    const detail = await addItem(home, list.id, {
      source: 'from_deal',
      dealId: deal.id,
      quantity: 1,
      priceCents: 1,
      salePriceCents: 1,
      regularPriceCents: 1,
      priceUnit: 'lb',
      merchantId: '9999',
      merchantName: 'Fake Mart',
      dealValidTo: '2099-12-31',
      conditionalPrice: true,
      itemName: 'Injected',
    });
    expect(itemNamed(detail, 'Kraft Shredded Cheese, 8 oz')).toMatchObject({
      priceCents: 250,
      salePriceCents: 250,
      regularPriceCents: 399,
      priceUnit: 'each',
      merchantId: '2431',
      merchantName: 'Harris Teeter',
      dealValidTo: '2099-01-01',
      conditionalPrice: false,
    });
  });

  it('refuses a deal it cannot see, and one that has been pruned', async () => {
    const home = await household();
    const elsewhere = await insertDeal({
      name: 'Publix Deli Subs',
      normalizedName: 'deli sub',
      unitPrice: '4.50',
      validTo: '2099-01-01',
      postalCode: '99998',
    });
    const list = await createList(home);
    expectStatus(
      await as(app, home.user, 'POST', `/api/lists/${list.id}/items`, {
        source: 'from_deal',
        dealId: elsewhere.id,
      }),
      404,
    );
    expectStatus(
      await as(app, home.user, 'POST', `/api/lists/${list.id}/items`, {
        source: 'from_deal',
        dealId: randomUUID(),
      }),
      404,
    );
  });

  it('bought items stay on the list, in their own group', async () => {
    const home = await household();
    const list = await createList(home);
    const detail = await addItem(home, list.id, { source: 'manual', itemName: 'Lemon' });
    const lemon = itemNamed(detail, 'Lemon');

    const bought = await as(app, home.user, 'PATCH', `/api/lists/${list.id}/items/${lemon.id}`, {
      status: 'bought',
    });
    expectStatus(bought, 200);
    const after = bought.json<ShoppingListDetail>();
    expect(after.bought.map((item) => item.id)).toEqual([lemon.id]);
    expect(after.storeGroups).toHaveLength(0);
    expect(after.itemCount).toBe(1);
    expect(after.outstandingCount).toBe(0);
  });

  it('groups by store, sorts Anywhere last, and subtotals each group', async () => {
    const home = await household();
    const list = await createList(home);
    // Seed Data's "This Week" Harris Teeter group: 2 lb × $2.49 + $3.99, plus one unpriced.
    await addItem(home, list.id, {
      source: 'manual',
      itemName: 'Chicken breast',
      quantity: 2,
      priceCents: 249,
      priceUnit: 'lb',
      merchantId: '2431',
      merchantName: 'Harris Teeter',
    });
    await addItem(home, list.id, {
      source: 'manual',
      itemName: 'Tide Pods 42ct',
      quantity: 1,
      priceCents: 399,
      merchantId: '2431',
      merchantName: 'Harris Teeter',
    });
    await addItem(home, list.id, {
      source: 'manual',
      itemName: 'Trash bags',
      quantity: 1,
      merchantId: '2431',
      merchantName: 'Harris Teeter',
    });
    await addItem(home, list.id, { source: 'manual', itemName: 'Celery', quantity: 1 });
    const detail = await addItem(home, list.id, {
      source: 'manual',
      itemName: 'Coca-Cola 2L',
      quantity: 3,
      priceCents: 199,
      merchantId: '2100',
      merchantName: 'Food Lion',
    });

    expect(
      detail.storeGroups.map((group) => [
        group.merchantName,
        group.subtotalCents,
        group.unpricedCount,
      ]),
    ).toEqual([
      ['Food Lion', 597, 0],
      ['Harris Teeter', 897, 1],
      [null, 0, 1],
    ]);
  });

  it('applies every subtotal rule, rounding a half cent up', async () => {
    const home = await household();
    const list = await createList(home);
    const store = { merchantId: '2431', merchantName: 'Harris Teeter' };
    for (const body of [
      // $3.33/lb × 1.5 lb is 499.5 cents, which rounds up to 500 (Requirements, "Subtotals").
      { itemName: 'Beef', priceCents: 333, priceUnit: 'lb', quantity: 1.5 },
      { itemName: 'Sliver', priceCents: 1, priceUnit: 'lb', quantity: 0.5 },
      // `each` with no quantity counts as one.
      { itemName: 'Soap', priceCents: 249, priceUnit: 'each' },
      // `lb` with no quantity, per-oz, and no price at all are the three exclusions.
      { itemName: 'Grapes', priceCents: 199, priceUnit: 'lb' },
      { itemName: 'Deli ham', priceCents: 80, priceUnit: 'oz', quantity: 8 },
      { itemName: 'Foil', priceUnit: 'each', quantity: 1 },
    ]) {
      await addItem(home, list.id, { source: 'manual', ...store, ...body });
    }
    const group = (await getList(home, list.id)).storeGroups[0];
    expect(group?.subtotalCents).toBe(500 + 1 + 249);
    expect(group?.unpricedCount).toBe(3);
  });

  it('round-trips the largest price the column holds', async () => {
    const home = await household();
    const list = await createList(home);
    const detail = await addItem(home, list.id, {
      source: 'manual',
      itemName: 'A yacht',
      priceCents: 99_999_999,
      quantity: 1,
      merchantId: '2431',
      merchantName: 'Harris Teeter',
    });
    expect(itemNamed(detail, 'A yacht').priceCents).toBe(99_999_999);
    expect(detail.storeGroups[0]?.subtotalCents).toBe(99_999_999);
  });

  it('removes an item', async () => {
    const home = await household();
    const list = await createList(home);
    const item = itemNamed(
      await addItem(home, list.id, { source: 'manual', itemName: 'Dish soap' }),
      'Dish soap',
    );
    expectStatus(await as(app, home.user, 'DELETE', `/api/lists/${list.id}/items/${item.id}`), 204);
    expect(allItems(await getList(home, list.id))).toHaveLength(0);
    expectStatus(await as(app, home.user, 'DELETE', `/api/lists/${list.id}/items/${item.id}`), 404);
  });
});

describe('offline writes replay safely', () => {
  it('ignores a duplicate add of the same client-generated id', async () => {
    const home = await household();
    const list = await createList(home);
    const id = randomUUID();
    const body = { source: 'manual', id, itemName: 'Milk', quantity: 1 };

    const first = await addItem(home, list.id, body);
    expect(allItems(first)).toHaveLength(1);
    const createdAt = itemNamed(first, 'Milk').createdAt;

    // The same write, replayed after reconnecting: it must change nothing, not fail.
    const replay = await addItem(home, list.id, body);
    expect(allItems(replay)).toHaveLength(1);
    expect(itemNamed(replay, 'Milk')).toMatchObject({ id, createdAt, quantity: 1 });

    // A replay that arrives after the item was edited must not undo the edit either.
    await as(app, home.user, 'PATCH', `/api/lists/${list.id}/items/${id}`, { status: 'bought' });
    const third = await addItem(home, list.id, body);
    expect(third.bought.map((item) => item.id)).toEqual([id]);
  });

  it('ignores a replay that carries a different payload under the same id', async () => {
    const home = await household();
    const list = await createList(home);
    const id = randomUUID();
    await addItem(home, list.id, {
      source: 'manual',
      id,
      itemName: 'Milk',
      quantity: 1,
      priceCents: 100,
    });
    // A queued add that the device edited locally before it reconnected: the id has been used, so
    // the second arrival is not a second write.
    const replay = await addItem(home, list.id, {
      source: 'manual',
      id,
      itemName: 'Caviar',
      quantity: 99,
      priceCents: 99_900,
    });
    expect(allItems(replay)).toHaveLength(1);
    expect(itemNamed(replay, 'Milk')).toMatchObject({ quantity: 1, priceCents: 100 });
  });

  it('never moves an item when a replay names another list, or another household’s id', async () => {
    const home = await household('Alex Rivera');
    const first = await createList(home, 'First');
    const second = await createList(home, 'Second');
    const id = randomUUID();
    await addItem(home, first.id, { source: 'manual', id, itemName: 'Milk' });
    expect(allItems(await addItem(home, second.id, { source: 'manual', id, itemName: 'Milk' })));
    expect(allItems(await getList(home, first.id))).toHaveLength(1);
    expect(allItems(await getList(home, second.id))).toHaveLength(0);

    // The same id replayed from another household leaves the original row untouched.
    const theirs = await household('Blake Stranger');
    const theirList = await createList(theirs);
    const attempt = await as(app, theirs.user, 'POST', `/api/lists/${theirList.id}/items`, {
      source: 'manual',
      id,
      itemName: 'Theirs',
    });
    expect([201, 404, 409]).toContain(attempt.statusCode);
    const { rows } = await adminPool.query<{ item_name: string; list_id: string }>(
      'select item_name, list_id from public.shopping_list_item where id = $1',
      [id],
    );
    expect(rows[0]).toMatchObject({ item_name: 'Milk', list_id: first.id });
  });

  it('takes a queued write against an archived list, and answers 404 once it is gone', async () => {
    const home = await household();
    const list = await createList(home);
    expectStatus(await as(app, home.user, 'POST', `/api/lists/${list.id}/archive`), 200);
    // Archiving is a state the device could not have known about (Requirements, "Shopping list
    // lifecycle"): the queued write still lands.
    const item = itemNamed(
      await addItem(home, list.id, { source: 'manual', itemName: 'Late milk' }),
      'Late milk',
    );
    expectStatus(
      await as(app, home.user, 'PATCH', `/api/lists/${list.id}/items/${item.id}`, {
        status: 'bought',
      }),
      200,
    );

    expectStatus(await as(app, home.user, 'DELETE', `/api/lists/${list.id}`), 204);
    for (const [method, url, payload] of [
      ['POST', `/api/lists/${list.id}/items`, { source: 'manual', itemName: 'Ghost' }],
      ['PATCH', `/api/lists/${list.id}/items/${item.id}`, { status: 'needed' }],
      ['DELETE', `/api/lists/${list.id}/items/${item.id}`, undefined],
      ['POST', `/api/lists/${list.id}/add-bought-to-pantry`, undefined],
    ] as const) {
      const response = await as(app, home.user, method, url, payload);
      expect(response.statusCode, `${method} ${url}`).toBe(404);
    }
  });

  it('refuses an edit that names no field, rather than failing in the database', async () => {
    const home = await household();
    const list = await createList(home);
    const item = itemNamed(
      await addItem(home, list.id, { source: 'manual', itemName: 'Milk' }),
      'Milk',
    );
    expectStatus(
      await as(app, home.user, 'PATCH', `/api/lists/${list.id}/items/${item.id}`, {}),
      400,
    );
  });

  it('will not reach an item through a sibling list’s path', async () => {
    const home = await household();
    const first = await createList(home, 'First');
    const second = await createList(home, 'Second');
    const item = itemNamed(
      await addItem(home, first.id, { source: 'manual', itemName: 'Milk' }),
      'Milk',
    );
    expectStatus(
      await as(app, home.user, 'PATCH', `/api/lists/${second.id}/items/${item.id}`, {
        status: 'bought',
      }),
      404,
    );
    expectStatus(
      await as(app, home.user, 'DELETE', `/api/lists/${second.id}/items/${item.id}`),
      404,
    );
    expect(itemNamed(await getList(home, first.id), 'Milk').status).toBe('needed');
  });

  it('applies absolute updates, last write wins, in whatever order they arrive', async () => {
    const home = await household();
    const list = await createList(home);
    const id = randomUUID();
    await addItem(home, list.id, { source: 'manual', id, itemName: 'Milk' });
    const url = `/api/lists/${list.id}/items/${id}`;

    // The quirk the Requirements document accepts: a late offline "in cart" moves a bought item
    // back to "in cart", because the last write to arrive wins.
    expectStatus(await as(app, home.user, 'PATCH', url, { status: 'bought' }), 200);
    const late = await as(app, home.user, 'PATCH', url, { status: 'in_cart' });
    expectStatus(late, 200);
    expect(itemNamed(late.json<ShoppingListDetail>(), 'Milk').status).toBe('in_cart');

    // Replaying the same absolute update changes nothing further.
    const again = await as(app, home.user, 'PATCH', url, { status: 'in_cart' });
    expect(itemNamed(again.json<ShoppingListDetail>(), 'Milk').status).toBe('in_cart');

    // An edit sets exactly the fields it names, and clears the ones it sends as null.
    expectStatus(
      await as(app, home.user, 'PATCH', url, {
        itemName: 'Whole milk',
        quantity: 2,
        priceCents: 349,
        merchantId: '2431',
        merchantName: 'Harris Teeter',
      }),
      200,
    );
    const cleared = await as(app, home.user, 'PATCH', url, {
      quantity: null,
      priceCents: null,
      merchantId: null,
      merchantName: null,
    });
    expect(itemNamed(cleared.json<ShoppingListDetail>(), 'Whole milk')).toMatchObject({
      normalizedName: 'whole milk',
      quantity: null,
      priceCents: null,
      merchantId: null,
      merchantName: null,
      status: 'in_cart',
    });

    expectStatus(
      await as(app, home.user, 'PATCH', `/api/lists/${list.id}/items/${randomUUID()}`, {
        status: 'bought',
      }),
      404,
    );
  });

  it('bumps the list’s last activity on every path, including an item delete', async () => {
    const home = await household();
    const list = await createList(home);
    const added = await addItem(home, list.id, { source: 'manual', itemName: 'Milk' });
    expect(Date.parse(added.updatedAt)).toBeGreaterThanOrEqual(Date.parse(list.updatedAt));

    const item = itemNamed(added, 'Milk');
    const patched = await as(app, home.user, 'PATCH', `/api/lists/${list.id}/items/${item.id}`, {
      status: 'in_cart',
    });
    const afterPatch = patched.json<ShoppingListDetail>();
    expect(Date.parse(afterPatch.updatedAt)).toBeGreaterThan(Date.parse(added.updatedAt));

    await as(app, home.user, 'DELETE', `/api/lists/${list.id}/items/${item.id}`);
    const afterDelete = await getList(home, list.id);
    expect(Date.parse(afterDelete.updatedAt)).toBeGreaterThan(Date.parse(afterPatch.updatedAt));

    const renamed = await as(app, home.user, 'PATCH', `/api/lists/${list.id}`, { name: 'Later' });
    expect(Date.parse(renamed.json<ShoppingListDetail>().updatedAt)).toBeGreaterThan(
      Date.parse(afterDelete.updatedAt),
    );
  });
});

describe('expired deal repricing', () => {
  it('re-matches the current deal, falls back to the regular price, or clears it', async () => {
    const home = await household();
    const list = await createList(home);
    const chicken = `chicken breast ${randomUUID().slice(0, 8)}`;
    const banana = `banana ${randomUUID().slice(0, 8)}`;
    const trailMix = `trail mix ${randomUUID().slice(0, 8)}`;

    // Harris Teeter's chicken breast is on sale again this week, at a higher price.
    const current = await insertDeal({
      name: 'Boneless Skinless Chicken Breast, Family Pack',
      normalizedName: chicken,
      unitPrice: '2.49',
      originalPrice: '4.99',
      priceUnit: 'lb',
      validTo: '2099-01-01',
    });
    // A dearer deal for the same item: the lowest unit price is the one that wins.
    await insertDeal({
      name: 'Chicken Breast',
      normalizedName: chicken,
      unitPrice: '3.29',
      priceUnit: 'lb',
      validTo: '2099-01-01',
    });

    await addExpiredItem(list.id, {
      itemName: 'Chicken breast',
      normalizedName: chicken,
      merchantId: '2431',
      salePrice: '1.99',
      regularPrice: '4.99',
      priceUnit: 'lb',
    });
    await addExpiredItem(list.id, {
      itemName: 'Bananas',
      normalizedName: banana,
      merchantId: '2100',
      salePrice: '0.44',
      regularPrice: '0.59',
      priceUnit: 'lb',
    });
    await addExpiredItem(list.id, {
      itemName: 'Gold Emblem Trail Mix',
      normalizedName: trailMix,
      merchantId: '2264',
      salePrice: '2.99',
      regularPrice: null,
    });

    const repriced = await getList(home, list.id);

    expect(itemNamed(repriced, 'Chicken breast')).toMatchObject({
      priceCents: 249,
      salePriceCents: 249,
      originalSalePriceCents: 199,
      dealExternalId: current.externalId,
      dealValidTo: '2099-01-01',
      priceUnit: 'lb',
    });
    expect(itemNamed(repriced, 'Bananas')).toMatchObject({
      priceCents: 59,
      originalSalePriceCents: 44,
    });
    expect(itemNamed(repriced, 'Gold Emblem Trail Mix')).toMatchObject({
      priceCents: null,
      originalSalePriceCents: 299,
    });
    for (const name of ['Chicken breast', 'Bananas', 'Gold Emblem Trail Mix']) {
      expect(itemNamed(repriced, name).repricedAt).not.toBeNull();
    }

    // Deterministic and safe to run again: a second fetch writes nothing, so the list's last
    // activity does not move.
    const second = await getList(home, list.id);
    expect(second.updatedAt).toBe(repriced.updatedAt);
    expect(itemNamed(second, 'Chicken breast').repricedAt).toBe(
      itemNamed(repriced, 'Chicken breast').repricedAt,
    );
  });

  it('decides that a deal has expired in the household’s own timezone', async () => {
    // Two households 25 hours apart, so their local dates always differ. One `deal_valid_to` is
    // therefore today in the west and yesterday in the east (Handoff non-negotiable 8).
    const west = await household('West Rivera', POSTAL_CODE, 'Pacific/Niue');
    const east = await household('East Rivera', POSTAL_CODE, 'Pacific/Kiritimati');
    const validTo = await todayIn('Pacific/Niue');
    const normalizedName = `tuna ${randomUUID().slice(0, 8)}`;
    const lists = new Map<string, string>();
    for (const home of [west, east]) {
      const list = await createList(home);
      lists.set(home.user.id, list.id);
      await addExpiredItem(list.id, {
        itemName: 'Tuna',
        normalizedName,
        merchantId: '2431',
        salePrice: '1.00',
        regularPrice: '1.79',
        validTo,
      });
    }

    const stillValid = itemNamed(await getList(west, String(lists.get(west.user.id))), 'Tuna');
    expect(stillValid).toMatchObject({ priceCents: 100, repricedAt: null });

    const expired = itemNamed(await getList(east, String(lists.get(east.user.id))), 'Tuna');
    expect(expired.priceCents).toBe(179);
    expect(expired.repricedAt).not.toBeNull();
  });

  it('never re-matches a deal from another postal code', async () => {
    const home = await household();
    const list = await createList(home);
    const normalizedName = `oats ${randomUUID().slice(0, 8)}`;
    await insertDeal({
      name: 'Rolled Oats',
      normalizedName,
      unitPrice: '0.99',
      validTo: '2099-01-01',
      postalCode: '99997',
    });
    await addExpiredItem(list.id, {
      itemName: 'Oats',
      normalizedName,
      merchantId: '2431',
      salePrice: '2.00',
      regularPrice: '3.00',
    });
    expect(itemNamed(await getList(home, list.id), 'Oats')).toMatchObject({
      priceCents: 300,
      originalSalePriceCents: 200,
    });
  });

  it('records the price the item was added at once, across two repricings', async () => {
    const home = await household();
    const list = await createList(home);
    const normalizedName = `rice ${randomUUID().slice(0, 8)}`;
    await addExpiredItem(list.id, {
      itemName: 'Rice',
      normalizedName,
      merchantId: '2431',
      salePrice: '1.50',
      regularPrice: '2.50',
    });
    expect(itemNamed(await getList(home, list.id), 'Rice')).toMatchObject({
      priceCents: 250,
      originalSalePriceCents: 150,
    });

    // A deal appears next week: the sale price the shopper first saw must survive the second pass.
    await insertDeal({
      name: 'Rice',
      normalizedName,
      unitPrice: '1.75',
      validTo: '2099-01-01',
    });
    expect(itemNamed(await getList(home, list.id), 'Rice')).toMatchObject({
      priceCents: 175,
      originalSalePriceCents: 150,
    });
  });

  it('leaves a bought item at the price it was bought at', async () => {
    const home = await household();
    const list = await createList(home);
    const name = `soup ${randomUUID().slice(0, 8)}`;
    await addExpiredItem(list.id, {
      itemName: 'Progresso Soup',
      normalizedName: name,
      merchantId: '2431',
      salePrice: '1.00',
      regularPrice: '1.79',
    });
    const item = itemNamed(await getList(home, list.id), 'Progresso Soup');
    await as(app, home.user, 'PATCH', `/api/lists/${list.id}/items/${item.id}`, {
      status: 'bought',
    });

    const after = itemNamed(await getList(home, list.id), 'Progresso Soup');
    expect(after.priceCents).toBe(179);
    // Already repriced once while it was needed; being bought freezes it there.
    const again = itemNamed(await getList(home, list.id), 'Progresso Soup');
    expect(again.repricedAt).toBe(after.repricedAt);
  });

  it('leaves an item whose deal is still valid alone', async () => {
    const home = await household();
    const list = await createList(home);
    const deal = await insertDeal({
      name: 'Kraft Shredded Cheese, 8 oz',
      normalizedName: `cheese ${randomUUID().slice(0, 8)}`,
      unitPrice: '2.50',
      validTo: '2099-01-01',
    });
    await addItem(home, list.id, { source: 'from_deal', dealId: deal.id, quantity: 2 });
    const item = itemNamed(await getList(home, list.id), 'Kraft Shredded Cheese, 8 oz');
    expect(item).toMatchObject({ priceCents: 250, repricedAt: null, originalSalePriceCents: null });
  });
});

describe('the pantry', () => {
  it('adds, updates in place, edits, and removes an item', async () => {
    const home = await household();
    const url = `/api/households/${home.household.id}/pantry`;

    const created = await as(app, home.user, 'POST', url, {
      itemName: 'Canned tomatoes',
      quantityNote: '3 cans',
    });
    expectStatus(created, 201);
    const item = created.json<PantryItem>();
    expect(item).toMatchObject({
      itemName: 'Canned tomatoes',
      normalizedName: 'canned tomato',
      quantityNote: '3 cans',
      householdId: home.household.id,
    });

    // The same normalized name updates the row rather than duplicating it.
    const again = await as(app, home.user, 'POST', url, {
      itemName: 'Canned Tomatoes',
      quantityNote: '1 can',
    });
    expectStatus(again, 201);
    expect(again.json<PantryItem>().id).toBe(item.id);
    expect(again.json<PantryItem>().quantityNote).toBe('1 can');

    const listed = await as(app, home.user, 'GET', url);
    expect(listed.json<PantryItem[]>()).toHaveLength(1);

    const edited = await as(app, home.user, 'PATCH', `/api/pantry/${item.id}`, {
      itemName: 'Diced tomatoes',
      quantityNote: null,
    });
    expectStatus(edited, 200);
    expect(edited.json<PantryItem>()).toMatchObject({
      itemName: 'Diced tomatoes',
      normalizedName: 'diced tomato',
      quantityNote: null,
    });

    expectStatus(await as(app, home.user, 'DELETE', `/api/pantry/${item.id}`), 204);
    expect((await as(app, home.user, 'GET', url)).json<PantryItem[]>()).toHaveLength(0);
    expectStatus(
      await as(app, home.user, 'PATCH', `/api/pantry/${item.id}`, { itemName: 'x' }),
      404,
    );
  });

  it('refuses an edit that would collide with another pantry row', async () => {
    const home = await household();
    const url = `/api/households/${home.household.id}/pantry`;
    await as(app, home.user, 'POST', url, { itemName: 'Rice' });
    const second = await as(app, home.user, 'POST', url, { itemName: 'Pasta' });
    const collide = await as(
      app,
      home.user,
      'PATCH',
      `/api/pantry/${second.json<PantryItem>().id}`,
      {
        itemName: 'Rice',
      },
    );
    expectStatus(collide, 409);
  });

  it('merges a list’s bought items into the pantry, leaving them on the list', async () => {
    const home = await household();
    const list = await createList(home, 'Weekend Cookout');
    for (const itemName of ['Hot dogs', 'Buns', 'Charcoal']) {
      const detail = await addItem(home, list.id, { source: 'manual', itemName });
      const item = itemNamed(detail, itemName);
      await as(app, home.user, 'PATCH', `/api/lists/${list.id}/items/${item.id}`, {
        status: 'bought',
      });
    }
    await addItem(home, list.id, { source: 'manual', itemName: 'Ketchup' });
    // Already in the pantry under the same normalized name: it merges rather than duplicating.
    await as(app, home.user, 'POST', `/api/households/${home.household.id}/pantry`, {
      itemName: 'Charcoal',
      quantityNote: 'one bag',
    });

    const added = await as(app, home.user, 'POST', `/api/lists/${list.id}/add-bought-to-pantry`);
    expectStatus(added, 200);
    expect(added.json<PantryItem[]>().map((item) => item.itemName)).toEqual([
      'Buns',
      'Charcoal',
      'Hot dogs',
    ]);

    const pantry = await as(app, home.user, 'GET', `/api/households/${home.household.id}/pantry`);
    expect(pantry.json<PantryItem[]>().map((item) => item.normalizedName)).toEqual([
      'bun',
      'charcoal',
      'hot dog',
    ]);

    // The bought items are still on the list; the unbought one did not join the pantry.
    const after = await getList(home, list.id);
    expect(after.bought).toHaveLength(3);
    expect(after.itemCount).toBe(4);

    // Running it twice is harmless.
    const twice = await as(app, home.user, 'POST', `/api/lists/${list.id}/add-bought-to-pantry`);
    expectStatus(twice, 200);
    expect(twice.json<PantryItem[]>()).toHaveLength(3);
  });
});

describe('a co-member sees and changes the same list', () => {
  it('shares lists and the pantry across the household', async () => {
    const admin = await signUp(app, 'Alex Rivera');
    const home: Home = { user: admin, household: await createHousehold(admin) };
    const invite = await as(app, admin, 'POST', `/api/households/${home.household.id}/invites`);
    expectStatus(invite, 201);
    const { code } = invite.json<{ code: string }>();
    const member = await signUp(app, 'Sam Chen');
    expectStatus(await as(app, member, 'POST', '/api/households/join', { tokenOrCode: code }), 200);

    const list = await createList(home);
    const item = itemNamed(
      await addItem(home, list.id, { source: 'manual', itemName: 'Milk' }),
      'Milk',
    );

    const checked = await as(app, member, 'PATCH', `/api/lists/${list.id}/items/${item.id}`, {
      status: 'bought',
    });
    expectStatus(checked, 200);
    expect(checked.json<ShoppingListDetail>().bought[0]).toMatchObject({
      // The item still records who added it, not who checked it off.
      addedBy: admin.id,
      status: 'bought',
    });
  });
});
