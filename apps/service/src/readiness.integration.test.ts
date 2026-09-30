import { randomUUID } from 'node:crypto';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Household, MatchOverride, PantryItem, RecipeDetail } from '@hearth/shared';
import { withServiceRoleDb } from './privileged/service-role-db.js';
import { recomputeReadinessForHousehold } from './services/readiness.js';
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
 * Recipe readiness against `supabase start` (Requirements, "Deal-matched suggestions"; Seed Data,
 * "Recipes" — the 12+2 readiness table is this test's own oracle). Real Postgres as
 * hearth_service, every request through withUserDb, so RLS and the real `@hearth/matching`
 * decide every bucket. This file reproduces the Seed Data fixture (pantry, favorite-store deals,
 * the twelve Oak Street recipes and two Rivera Family recipes, the "cheese" override) through the
 * real API and asserts the table's own numbers exactly, one recipe at a time.
 */

let stack: Stack;
let app: FastifyInstance;

/**
 * Every postal code this file hardcodes (rather than `uniqueName()`-generating), so a `deal` row
 * this file inserts can never survive into a later run against the same un-reset `supabase start`
 * volume (Engineering Practices, "Integration test database": "every integration file that writes
 * rows scoped to a postal code deletes exactly those rows in its own `beforeEach`"). A stray
 * leftover here previously made "a simulated deal-refresh recompute" see a deal before it inserted
 * one, scoring a fresh recipe 100% instead of the 0% the test asserts before its own insert.
 */
const HARDCODED_POSTAL_CODES = ['27524', '27525', '27526', '27527', '27529', '27530'];

beforeAll(async () => {
  stack = await startStack();
  await adminPool.query('delete from public.deal where postal_code = any($1)', [
    HARDCODED_POSTAL_CODES,
  ]);
});

beforeEach(async () => {
  app = await stack.newApp();
});

afterAll(async () => {
  await stack.close();
});

const OAK_POSTAL_CODE = '27524';
const RIVERA_POSTAL_CODE = '27525';

function expectStatus(response: LightMyRequestResponse, status: number): void {
  expect(response.statusCode, response.body).toBe(status);
}

interface Home {
  user: SignedUpUser;
  household: Household;
}

async function household(name: string, postalCode: string): Promise<Home> {
  const user = await signUp(app, name);
  const response = await as(app, user, 'POST', '/api/households', {
    name: uniqueName('Household'),
    postalCode,
    timezone: 'America/New_York',
  });
  expectStatus(response, 201);
  return { user, household: response.json<Household>() };
}

async function favoriteStore(home: Home, merchantId: string, merchantName: string): Promise<void> {
  expectStatus(
    await as(app, home.user, 'POST', `/api/households/${home.household.id}/favorite-stores`, {
      merchantId,
      merchantName,
    }),
    201,
  );
}

async function addPantryItem(home: Home, itemName: string): Promise<PantryItem> {
  const response = await as(app, home.user, 'POST', `/api/households/${home.household.id}/pantry`, {
    itemName,
  });
  expectStatus(response, 201);
  return response.json<PantryItem>();
}

interface DealFields {
  merchantId: string;
  merchantName: string;
  name: string;
  normalizedName: string;
  unitPrice: string;
  priceUnit?: 'each' | 'lb' | 'oz';
  postalCode: string;
}

/** A deal row, inserted as the database owner the way the daily refresh job would write it. */
async function insertDeal(fields: DealFields): Promise<void> {
  await adminPool.query(
    `insert into public.deal (external_id, merchant_id, merchant_name, name, normalized_name,
       unit_price, price_unit, display_price, conditional_price, flyer_id, postal_code,
       valid_from, valid_to)
     values ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, $10, current_date - 2, current_date + 5)`,
    [
      `item-${randomUUID()}`,
      fields.merchantId,
      fields.merchantName,
      fields.name,
      fields.normalizedName,
      fields.unitPrice,
      fields.priceUnit ?? 'each',
      `$${fields.unitPrice}`,
      `flyer-${randomUUID()}`,
      fields.postalCode,
    ],
  );
}

async function createRecipe(
  home: Home,
  title: string,
  ingredientNames: readonly string[],
): Promise<RecipeDetail> {
  const response = await as(
    app,
    home.user,
    'POST',
    `/api/households/${home.household.id}/recipes`,
    { title, ingredients: ingredientNames.map((itemName) => ({ itemName })) },
  );
  expectStatus(response, 201);
  return response.json<RecipeDetail>();
}

async function getRecipe(home: Home, id: string): Promise<RecipeDetail> {
  const response = await as(app, home.user, 'GET', `/api/recipes/${id}`);
  expectStatus(response, 200);
  return response.json<RecipeDetail>();
}

function breakdownEntry(recipe: RecipeDetail, itemName: string) {
  const ingredient = recipe.ingredients.find((one) => one.itemName === itemName);
  if (ingredient === undefined) throw new Error(`no ingredient named ${itemName}`);
  const entry = recipe.readiness?.breakdown.find((one) => one.ingredientId === ingredient.id);
  if (entry === undefined) throw new Error(`no breakdown entry for ${itemName}`);
  return entry;
}

/** The Oak Street fixture (Seed Data, "Pantry", "Favorite-store groceries"), built once. */
async function seedOakStreet(): Promise<Home> {
  const home = await household('Alex', OAK_POSTAL_CODE);
  await favoriteStore(home, 'ht-2431', 'Harris Teeter');
  await favoriteStore(home, 'fl-2100', 'Food Lion');

  for (const itemName of [
    'Olive oil',
    'Salt',
    'Black pepper',
    'Garlic',
    'Rice',
    'Flour',
    'Sugar',
    'Butter',
    'Milk',
    'Bread',
    'Soy sauce',
    'Cumin',
    'Paprika',
    'Canned tomatoes',
    'Black beans',
    'Chicken broth',
    'Parmesan',
    'Eggs',
    'Yellow onions',
    'Pasta',
  ]) {
    await addPantryItem(home, itemName);
  }

  const fl = { merchantId: 'fl-2100', merchantName: 'Food Lion', postalCode: OAK_POSTAL_CODE };
  const ht = { merchantId: 'ht-2431', merchantName: 'Harris Teeter', postalCode: OAK_POSTAL_CODE };
  await insertDeal({
    ...fl,
    name: 'Broccoli Crowns',
    normalizedName: 'broccoli',
    unitPrice: '1.99',
    priceUnit: 'lb',
  });
  await insertDeal({
    ...fl,
    name: 'Food Lion Rainbow Bell Peppers',
    normalizedName: 'rainbow bell pepper',
    unitPrice: '2.99',
  });
  await insertDeal({
    ...fl,
    name: 'Food Lion Baby Cut Carrots',
    normalizedName: 'baby cut carrot',
    unitPrice: '0.99',
  });
  await insertDeal({
    ...fl,
    name: 'Food Lion Mini Cucumbers',
    normalizedName: 'mini cucumber',
    unitPrice: '2.49',
  });
  await insertDeal({
    ...fl,
    name: "Nature's Promise Organic Potatoes",
    normalizedName: 'nature s promise potato',
    unitPrice: '3.99',
  });
  await insertDeal({ ...fl, name: 'Food Lion Pasta', normalizedName: 'pasta', unitPrice: '0.99' });
  await insertDeal({
    ...fl,
    name: 'Food Lion Chunk or Shredded Cheese',
    normalizedName: 'chunk or cheese',
    unitPrice: '3.49',
  });
  await insertDeal({
    ...fl,
    name: "Nature's Promise Jumbo Chicken Breast",
    normalizedName: 'nature s promise jumbo chicken breast',
    unitPrice: '3.49',
    priceUnit: 'lb',
  });
  await insertDeal({
    ...fl,
    name: '93% Lean Fresh Ground Beef',
    normalizedName: 'lean ground beef',
    unitPrice: '7.29',
    priceUnit: 'lb',
  });
  await insertDeal({
    ...fl,
    name: 'Beef Chuck Roast',
    normalizedName: 'beef chuck roast',
    unitPrice: '7.99',
    priceUnit: 'lb',
  });
  await insertDeal({
    ...ht,
    name: 'Bone-In Pork Chops',
    normalizedName: 'bone in pork chop',
    unitPrice: '3.49',
    priceUnit: 'lb',
  });
  await insertDeal({
    ...ht,
    name: 'Artesano Bakery Bread',
    normalizedName: 'artesano bakery bread',
    unitPrice: '3.50',
  });
  await insertDeal({
    ...ht,
    name: "Egg-Land's Best Extra Large Eggs",
    normalizedName: 'egg land s best egg',
    unitPrice: '2.50',
  });
  await insertDeal({
    ...ht,
    name: 'Harris Teeter Snack Cheese',
    normalizedName: 'snack cheese',
    unitPrice: '3.00',
  });
  // Real 27514 capture (Seed Data, "Clean prices"), unrelated to any recipe on purpose — it exists
  // to prove Shrimp Pad Thai's "peanuts" contain-matches it (shares the token "peanut"), the same
  // direction of match the Matching test cases table endorses for "eggs" against "Egg Noodles".
  // Seed Data corrected Pad Thai's expected score from 0% to 13% once this coincidental match was
  // found against the real capture; leaving this deal out would silently understate this test's
  // own fixture relative to what `seed.sql` actually seeds.
  await insertDeal({
    ...ht,
    name: 'Harris Teeter Peanut Butter Chocolate Puffs Cereal',
    normalizedName: 'peanut butter chocolate puff cereal',
    unitPrice: '3.19',
  });

  // Never favorited by Oak Street: proves onions never come from a sale for it, whatever else
  // matches "onion" (see the dedicated test below).
  await insertDeal({
    merchantId: 'lf-2469',
    merchantName: 'Lowes Foods',
    postalCode: OAK_POSTAL_CODE,
    name: 'JUMBO YELLOW ONIONS',
    normalizedName: 'jumbo yellow onion',
    unitPrice: '1.49',
    priceUnit: 'lb',
  });

  return home;
}

describe('recipe readiness — the Seed Data table', () => {
  let oak: Home;
  let recipes: Record<string, RecipeDetail>;

  beforeAll(async () => {
    app = await stack.newApp();
    oak = await seedOakStreet();

    const fixtures: [string, string[]][] = [
      [
        'Sheet Pan Chicken and Vegetables',
        ['chicken breast', 'broccoli', 'bell pepper', 'olive oil', 'garlic', 'paprika', 'lemon'],
      ],
      [
        'Spaghetti with Meat Sauce',
        [
          'pasta',
          'ground beef',
          'canned tomatoes',
          'onion',
          'garlic',
          'tomato paste',
          'parmesan',
          'dried oregano',
        ],
      ],
      [
        'Vegetable Fried Rice',
        [
          'rice',
          'eggs',
          'frozen peas',
          'carrots',
          'soy sauce',
          'green onions',
          'sesame oil',
          'garlic',
        ],
      ],
      [
        'Black Bean Tacos',
        [
          'black beans',
          'flour tortillas',
          'cumin',
          'avocado',
          'lime',
          'salsa',
          'cheese',
          'red onion',
        ],
      ],
      [
        'Chicken Noodle Soup',
        [
          'chicken breast',
          'egg noodles',
          'carrots',
          'celery',
          'onion',
          'garlic',
          'chicken broth',
          'thyme',
          'bay leaves',
        ],
      ],
      [
        'Greek Salad',
        [
          'cucumber',
          'roma tomatoes',
          'red onion',
          'feta cheese',
          'kalamata olives',
          'olive oil',
          'red wine vinegar',
        ],
      ],
      [
        'Baked Ziti',
        ['pasta', 'ground beef', 'canned tomatoes', 'mozzarella', 'ricotta', 'parmesan', 'garlic'],
      ],
      [
        'Breakfast Burritos',
        ['eggs', 'flour tortillas', 'cheese', 'potatoes', 'bell pepper', 'salsa'],
      ],
      [
        'Lentil Curry',
        [
          'lentils',
          'coconut milk',
          'onion',
          'garlic',
          'ginger',
          'curry powder',
          'cumin',
          'canned tomatoes',
          'basmati rice',
          'cilantro',
        ],
      ],
      ['Grilled Cheese and Tomato Soup', ['bread', 'butter', 'cheese', 'canned tomatoes', 'milk']],
      [
        'Shrimp Pad Thai',
        [
          'rice noodles',
          'shrimp',
          'tamarind paste',
          'fish sauce',
          'bean sprouts',
          'peanuts',
          'lime',
          'green onions',
        ],
      ],
      [
        'Sunday Pot Roast',
        [
          'chuck roast',
          'russet potatoes',
          'carrots',
          'onion',
          'beef broth',
          'rosemary',
          'worcestershire sauce',
          'flour',
        ],
      ],
    ];

    recipes = {};
    for (const [title, ingredients] of fixtures) {
      recipes[title] = await createRecipe(oak, title, ingredients);
    }

    // The force-no-match override (Seed Data, "Recipes"): changes no score above, because
    // "cheese" already matches Food Lion's "chunk or cheese".
    expectStatus(
      await as(app, oak.user, 'POST', `/api/households/${oak.household.id}/match-overrides`, {
        ingredientName: 'cheese',
        targetKind: 'deal',
        targetName: 'snack cheese',
        decision: 'force_no_match',
      }),
      201,
    );

    // Refetch every recipe once the override is in place, since it recomputes readiness.
    for (const title of Object.keys(recipes)) {
      recipes[title] = await getRecipe(oak, recipes[title]!.id);
    }
  });

  function expectReadiness(
    title: string,
    onSale: number,
    inPantry: number,
    toBuy: number,
    percent: number,
  ): void {
    const readiness = recipes[title]?.readiness;
    expect(readiness, `${title} has no computed readiness`).not.toBeNull();
    expect(readiness?.onSaleCount, `${title} onSaleCount`).toBe(onSale);
    expect(readiness?.inPantryCount, `${title} inPantryCount`).toBe(inPantry);
    expect(readiness?.toBuyCount, `${title} toBuyCount`).toBe(toBuy);
    expect(readiness?.readinessPercent, `${title} readinessPercent`).toBe(percent);
  }

  it('Sheet Pan Chicken and Vegetables — 6 of 7, 86% (3 on sale, 3 pantry)', () => {
    expectReadiness('Sheet Pan Chicken and Vegetables', 3, 3, 1, 86);
  });

  it('Spaghetti with Meat Sauce — 6 of 8, 75% (1 on sale, 5 pantry)', () => {
    expectReadiness('Spaghetti with Meat Sauce', 1, 5, 2, 75);
  });

  it('Vegetable Fried Rice — 5 of 8, 63% (1 on sale, 4 pantry)', () => {
    expectReadiness('Vegetable Fried Rice', 1, 4, 3, 63);
  });

  it('Black Bean Tacos — 3 of 8, 38% (1 on sale, 2 pantry)', () => {
    expectReadiness('Black Bean Tacos', 1, 2, 5, 38);
  });

  it('Chicken Noodle Soup — 5 of 9, 56% (2 on sale, 3 pantry)', () => {
    expectReadiness('Chicken Noodle Soup', 2, 3, 4, 56);
  });

  it('Greek Salad — 2 of 7, 29% (1 on sale, 1 pantry)', () => {
    expectReadiness('Greek Salad', 1, 1, 5, 29);
  });

  it('Baked Ziti — 5 of 7, 71% (1 on sale, 4 pantry)', () => {
    expectReadiness('Baked Ziti', 1, 4, 2, 71);
  });

  it('Breakfast Burritos — 4 of 6, 67% (3 on sale, 1 pantry)', () => {
    expectReadiness('Breakfast Burritos', 3, 1, 2, 67);
  });

  it('Lentil Curry — 4 of 10, 40% (0 on sale, 4 pantry)', () => {
    expectReadiness('Lentil Curry', 0, 4, 6, 40);
  });

  it('Grilled Cheese and Tomato Soup — 5 of 5, 100% (1 on sale, 4 pantry)', () => {
    expectReadiness('Grilled Cheese and Tomato Soup', 1, 4, 0, 100);
  });

  // "peanuts" contain-matches Harris Teeter's real "Peanut Butter Chocolate Puffs Cereal" deal
  // (both share the token "peanut") — a legitimate token-containment match, the same direction
  // Matching test cases endorses for "eggs" against "Egg Noodles, 12 oz", not a defect (Seed Data,
  // "Recipes").
  it('Shrimp Pad Thai — 1 of 8, 13% (1 on sale)', () => {
    expectReadiness('Shrimp Pad Thai', 1, 0, 7, 13);
    expect(breakdownEntry(recipes['Shrimp Pad Thai']!, 'peanuts').matchedName).toBe(
      'Harris Teeter Peanut Butter Chocolate Puffs Cereal',
    );
  });

  it('Sunday Pot Roast — 4 of 8, 50% (2 on sale, 2 pantry)', () => {
    expectReadiness('Sunday Pot Roast', 2, 2, 4, 50);
  });

  it('pantry-beats-sale: eggs, bread, and pasta count once, in the pantry bucket', () => {
    expect(breakdownEntry(recipes['Vegetable Fried Rice']!, 'eggs').bucket).toBe('in_pantry');
    expect(breakdownEntry(recipes['Grilled Cheese and Tomato Soup']!, 'bread').bucket).toBe(
      'in_pantry',
    );
    expect(breakdownEntry(recipes['Spaghetti with Meat Sauce']!, 'pasta').bucket).toBe('in_pantry');
  });

  it('the override applies to recipes that use "cheese" and does not override their match', () => {
    const tacos = recipes['Black Bean Tacos']!;
    const cheese = breakdownEntry(tacos, 'cheese');
    expect(cheese.bucket).toBe('on_sale');
    expect(cheese.matchedName).toBe('Food Lion Chunk or Shredded Cheese');
    // It matched fuzzily against a different deal, not because of the override.
    expect(cheese.overridden).toBe(false);
    expect(tacos.matchOverrides.map((one: MatchOverride) => one.targetNormalizedName)).toContain(
      'snack cheese',
    );
  });

  it('yellow onions never count as on sale for Oak Street (Lowes Foods is not favorited)', () => {
    for (const title of ['Spaghetti with Meat Sauce', 'Chicken Noodle Soup', 'Sunday Pot Roast']) {
      expect(breakdownEntry(recipes[title]!, 'onion').bucket).toBe('in_pantry');
    }
  });
});

describe('recipe readiness — Rivera Family (no pantry, nothing matches at Publix or Walmart)', () => {
  it('both recipes score 0%', async () => {
    app = await stack.newApp();
    const rivera = await household('Morgan', RIVERA_POSTAL_CODE);
    await favoriteStore(rivera, 'pub-2361', 'Publix');
    await favoriteStore(rivera, 'wm-2175', 'Walmart');

    const tuna = await createRecipe(rivera, 'Tuna Poke Bowl', [
      'ahi tuna',
      'sushi rice',
      'soy sauce',
      'avocado',
      'cucumber',
      'sesame seeds',
    ]);
    const miso = await createRecipe(rivera, 'Miso Soup', [
      'miso paste',
      'tofu',
      'green onions',
      'dashi',
      'wakame',
    ]);

    expect(tuna.readiness?.readinessPercent).toBe(0);
    expect(tuna.readiness?.onSaleCount).toBe(0);
    expect(tuna.readiness?.inPantryCount).toBe(0);
    expect(tuna.readiness?.toBuyCount).toBe(6);
    expect(miso.readiness?.readinessPercent).toBe(0);
    expect(miso.readiness?.toBuyCount).toBe(5);
  });
});

describe('readiness recompute triggers', () => {
  it('recomputes after a pantry write', async () => {
    app = await stack.newApp();
    const home = await household('Alex', '27526');
    const recipe = await createRecipe(home, 'Simple Soup', ['carrot', 'celery']);
    expect(recipe.readiness?.readinessPercent).toBe(0);

    await addPantryItem(home, 'Carrot');
    const updated = await getRecipe(home, recipe.id);
    expect(updated.readiness?.readinessPercent).toBe(50);
    expect(updated.readiness?.inPantryCount).toBe(1);
  });

  it('recomputes after a recipe-ingredient write', async () => {
    app = await stack.newApp();
    const home = await household('Alex', '27527');
    await addPantryItem(home, 'Garlic');
    const recipe = await createRecipe(home, 'Bare Recipe', ['onion']);
    expect(recipe.readiness?.readinessPercent).toBe(0);

    const patched = await as(app, home.user, 'PATCH', `/api/recipes/${recipe.id}`, {
      ingredients: [{ itemName: 'onion' }, { itemName: 'garlic' }],
    });
    expectStatus(patched, 200);
    expect(patched.json<RecipeDetail>().readiness?.readinessPercent).toBe(50);
  });

  it('recomputes after a match override is created and after it is deleted', async () => {
    app = await stack.newApp();
    const home = await household('Alex', '27529');
    // Does not naturally token-contain "gravy"; only the override should make it match.
    await addPantryItem(home, 'Brown Sauce');
    const recipe = await createRecipe(home, 'Overridden Recipe', ['gravy']);
    expect(recipe.readiness?.readinessPercent).toBe(0);

    const override = await as(
      app,
      home.user,
      'POST',
      `/api/households/${home.household.id}/match-overrides`,
      {
        ingredientName: 'gravy',
        targetKind: 'pantry',
        targetName: 'Brown Sauce',
        decision: 'force_match',
      },
    );
    expectStatus(override, 201);
    const forced = await getRecipe(home, recipe.id);
    expect(forced.readiness?.readinessPercent).toBe(100);
    expect(breakdownEntry(forced, 'gravy').overridden).toBe(true);

    const overrideId = override.json<MatchOverride>().id;
    expectStatus(await as(app, home.user, 'DELETE', `/api/match-overrides/${overrideId}`), 204);
    const restored = await getRecipe(home, recipe.id);
    expect(restored.readiness?.readinessPercent).toBe(0);
  });

  it('a simulated deal-refresh recompute (recomputeReadinessForHousehold) picks up a new deal', async () => {
    app = await stack.newApp();
    const home = await household('Alex', '27530');
    await favoriteStore(home, 'fl-sim', 'Food Lion');
    const recipe = await createRecipe(home, 'Deal Recipe', ['broccoli']);
    expect(recipe.readiness?.readinessPercent).toBe(0);

    await insertDeal({
      merchantId: 'fl-sim',
      merchantName: 'Food Lion',
      postalCode: '27530',
      name: 'Broccoli Crowns',
      normalizedName: 'broccoli',
      unitPrice: '1.99',
      priceUnit: 'lb',
    });
    // The route layer never sees this: it stands in for the daily refresh job's own call.
    await withServiceRoleDb(stack.database.db, (db) =>
      recomputeReadinessForHousehold(db, home.household.id),
    );

    const refreshed = await getRecipe(home, recipe.id);
    expect(refreshed.readiness?.readinessPercent).toBe(100);
    expect(refreshed.readiness?.onSaleCount).toBe(1);
  });
});
