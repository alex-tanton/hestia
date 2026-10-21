import { randomUUID } from 'node:crypto';
import type { LightMyRequestResponse } from 'fastify';
import { describe, expect, it } from 'vitest';
import type {
  ListItem,
  MealPlanEntry,
  MealPlanWeekResponse,
  RecipeDetail,
  ShoppingListDetail,
  SuggestionsResponse,
} from '@hearth/shared';
import { adminPool, as, household, type HouseholdFixture } from './test/service-stack.js';
import { app, expectStatus, registerStackHooks } from './test/stack-hooks.js';
import { currentInstant } from './test/zone-dates.js';

/*
 * The week planner, "Add missing to list", and suggestions against `supabase start` (Technical
 * Architecture, "API surface" — "Meal plan"; Requirements, "Add missing to list", "Deal-matched
 * suggestions"). Real Postgres as hearth_service, every request through withUserDb, so RLS
 * decides every isolation assertion.
 */

registerStackHooks();

type Home = HouseholdFixture;

async function favoriteStore(home: Home, merchantId: string, merchantName: string): Promise<void> {
  expectStatus(
    await as(app, home.user, 'POST', `/api/households/${home.household.id}/favorite-stores`, {
      merchantId,
      merchantName,
    }),
    201,
  );
}

async function addPantryItem(home: Home, itemName: string): Promise<void> {
  expectStatus(
    await as(app, home.user, 'POST', `/api/households/${home.household.id}/pantry`, { itemName }),
    201,
  );
}

async function insertDeal(fields: {
  merchantId: string;
  merchantName: string;
  postalCode: string;
  name: string;
  normalizedName: string;
  unitPrice: string;
}): Promise<void> {
  await adminPool.query(
    `insert into public.deal (external_id, merchant_id, merchant_name, name, normalized_name,
       unit_price, price_unit, display_price, conditional_price, flyer_id, postal_code,
       valid_from, valid_to)
     values ($1, $2, $3, $4, $5, $6, 'each', $7, false, $8, $9, current_date - 2, current_date + 5)`,
    [
      `item-${randomUUID()}`,
      fields.merchantId,
      fields.merchantName,
      fields.name,
      fields.normalizedName,
      fields.unitPrice,
      `$${fields.unitPrice}`,
      `flyer-${randomUUID()}`,
      fields.postalCode,
    ],
  );
}

interface IngredientSpec {
  itemName: string;
  quantity?: number;
  unit?: string;
}

async function createRecipe(
  home: Home,
  title: string,
  ingredients: readonly IngredientSpec[],
): Promise<RecipeDetail> {
  const response = await as(
    app,
    home.user,
    'POST',
    `/api/households/${home.household.id}/recipes`,
    { title, ingredients },
  );
  expectStatus(response, 201);
  return response.json<RecipeDetail>();
}

async function createList(home: Home, name = 'Groceries'): Promise<ShoppingListDetail> {
  const response = await as(app, home.user, 'POST', `/api/households/${home.household.id}/lists`, {
    name,
  });
  expectStatus(response, 201);
  return response.json<ShoppingListDetail>();
}

function allItems(list: ShoppingListDetail): ListItem[] {
  return [...list.storeGroups.flatMap((group) => group.items), ...list.bought];
}

function itemNamed(list: ShoppingListDetail, name: string): ListItem {
  const found = allItems(list).find((item) => item.itemName === name);
  if (found === undefined)
    throw new Error(
      `no item named ${name}; got ${JSON.stringify(allItems(list).map((i) => i.itemName))}`,
    );
  return found;
}

/** The current week's Sunday, from the API's own default (no `week` query given). */
async function currentSunday(home: Home): Promise<string> {
  const response = await as(
    app,
    home.user,
    'GET',
    `/api/households/${home.household.id}/meal-plan`,
  );
  expectStatus(response, 200);
  return response.json<MealPlanWeekResponse>().week;
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function planMeal(
  home: Home,
  recipeId: string,
  plannedDate: string,
  mealType: 'breakfast' | 'lunch' | 'dinner' = 'dinner',
): Promise<MealPlanEntry> {
  const response = await as(
    app,
    home.user,
    'POST',
    `/api/households/${home.household.id}/meal-plan`,
    { recipeId, plannedDate, mealType },
  );
  expectStatus(response, 201);
  return response.json<MealPlanEntry>();
}

describe('week planner', () => {
  it('creates an entry with a readiness snapshot and lists it back by its week', async () => {
    const home = await household(app);
    const recipe = await createRecipe(home, 'Pancakes', [{ itemName: 'Flour' }]);
    const sunday = await currentSunday(home);

    const entry = await planMeal(home, recipe.id, sunday, 'breakfast');
    expect(entry.recipeTitle).toBe('Pancakes');
    expect(entry.readinessPercent).toBe(0);

    const week = await as(app, home.user, 'GET', `/api/households/${home.household.id}/meal-plan`);
    expectStatus(week, 200);
    const body = week.json<MealPlanWeekResponse>();
    expect(body.week).toBe(sunday);
    expect(body.entries.map((one) => one.id)).toContain(entry.id);
  });

  it('rejects a week query that is not a Sunday', async () => {
    const home = await household(app);
    const sunday = await currentSunday(home);
    const monday = addDays(sunday, 1);
    expectStatus(
      await as(
        app,
        home.user,
        'GET',
        `/api/households/${home.household.id}/meal-plan?week=${monday}`,
      ),
      400,
    );
  });

  it('computes the current week’s Sunday in the household’s own timezone, not a naive UTC date (non-negotiable 8)', async () => {
    // `currentWeekSunday` (services/meal-plan.ts) hardcodes `pg_catalog.now()`, so there is no
    // seam to inject a fake wall clock through the API. This runs the identical SQL fragment
    // against a literal instant instead of `now()`, which is the only way to pin the clock at a
    // real UTC/local day-boundary divergence deterministically (today's date does not reliably
    // land on one). If this formula and the one in `currentWeekSunday` ever drift apart, this
    // test does not catch that drift — the two are asserted to match, in the Sunday-only case
    // below, via `currentSunday`'s live call.
    async function sundayAt(instantUtc: string, timezone: string): Promise<string> {
      const { rows } = await adminPool.query<{ week: string }>(
        `select (
           ($1::timestamptz at time zone $2)::date
           - (extract(dow from ($1::timestamptz at time zone $2)::date))::int
         )::text as week`,
        [instantUtc, timezone],
      );
      const week = rows[0]?.week;
      if (week === undefined) throw new Error('formula produced no row');
      return week;
    }

    // 2026-10-04 is a Sunday, 2026-10-03 a Saturday (Technical Architecture and Seed Data agree
    // via the existing 'assertSunday' unit tests). Kiritimati is UTC+14 with no DST.
    // 23:00 UTC on Saturday the 3rd is already 13:00 Sunday the 4th in Kiritimati: a naive
    // UTC-date calculation would still be looking at Saturday and answer last week's Sunday,
    // 2026-09-27, while the household's own timezone says today already is this week's Sunday.
    expect(await sundayAt('2026-10-03T23:00:00Z', 'Pacific/Kiritimati')).toBe('2026-10-04');
    const naiveUtc = await sundayAt('2026-10-03T23:00:00Z', 'UTC');
    expect(naiveUtc).toBe('2026-09-27');
    expect(naiveUtc).not.toBe(await sundayAt('2026-10-03T23:00:00Z', 'Pacific/Kiritimati'));

    // The opposite direction: 05:00 UTC on Sunday the 4th is only 18:00 Saturday the 3rd in
    // Midway (UTC-11). A naive UTC-date calculation is already on Sunday and would answer
    // 2026-10-04 — a whole week too early — while the household's own timezone still has last
    // week's Sunday, 2026-09-27, as the current week.
    expect(await sundayAt('2026-10-04T05:00:00Z', 'Pacific/Midway')).toBe('2026-09-27');
    expect(await sundayAt('2026-10-04T05:00:00Z', 'UTC')).toBe('2026-10-04');

    // The same formula, exercised live through a real household and the real API, for a
    // timezone offset from UTC in the ordinary case: this is what ties the formula above back
    // to `currentWeekSunday`'s own behavior, so a drift between the two is at least visible as
    // "the API's Sunday is not today's actual household-timezone Sunday" rather than silent.
    const home = await household(app, 'Alex');
    const liveSunday = await currentSunday(home);
    expect(liveSunday).toBe(await sundayAt(currentInstant().toISOString(), 'America/New_York'));
  });

  it('an explicit week filters to that week only', async () => {
    const home = await household(app);
    const recipe = await createRecipe(home, 'Waffles', [{ itemName: 'Flour' }]);
    const sunday = await currentSunday(home);
    const nextWeekSunday = addDays(sunday, 7);
    await planMeal(home, recipe.id, sunday, 'breakfast');
    await planMeal(home, recipe.id, nextWeekSunday, 'breakfast');

    const thisWeek = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/meal-plan?week=${sunday}`,
    );
    expect(thisWeek.json<MealPlanWeekResponse>().entries).toHaveLength(1);

    const nextWeek = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/meal-plan?week=${nextWeekSunday}`,
    );
    expect(nextWeek.json<MealPlanWeekResponse>().entries).toHaveLength(1);
  });

  it('a past week is excluded from the default view but still viewable as history (Use Cases, "Plan the week": "Past plan entries")', async () => {
    const home = await household(app);
    const recipe = await createRecipe(home, 'Leftover Stew', [{ itemName: 'Beef' }]);
    const sunday = await currentSunday(home);
    const pastWeekSunday = addDays(sunday, -7);
    const entry = await planMeal(home, recipe.id, pastWeekSunday, 'dinner');

    // The default (current-week) view excludes the past entry entirely.
    const defaultView = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/meal-plan`,
    );
    expectStatus(defaultView, 200);
    expect(defaultView.json<MealPlanWeekResponse>().entries.map((one) => one.id)).not.toContain(
      entry.id,
    );

    // An explicit query for that past week still returns it: past entries are kept indefinitely
    // and remain viewable as history, just excluded from the active/current week view.
    const pastView = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/meal-plan?week=${pastWeekSunday}`,
    );
    expectStatus(pastView, 200);
    const pastBody = pastView.json<MealPlanWeekResponse>();
    expect(pastBody.week).toBe(pastWeekSunday);
    expect(pastBody.entries.map((one) => one.id)).toContain(entry.id);
  });

  it('deletes an entry, and a second delete answers 404', async () => {
    const home = await household(app);
    const recipe = await createRecipe(home, 'Omelette', [{ itemName: 'Eggs' }]);
    const entry = await planMeal(home, recipe.id, await currentSunday(home));

    expectStatus(await as(app, home.user, 'DELETE', `/api/meal-plan/${entry.id}`), 204);
    expectStatus(await as(app, home.user, 'DELETE', `/api/meal-plan/${entry.id}`), 404);
  });

  it('a deleted recipe keeps its snapshot title and shows a null readiness percent', async () => {
    const home = await household(app);
    const recipe = await createRecipe(home, 'Mushroom Stroganoff', [{ itemName: 'Mushrooms' }]);
    const sunday = await currentSunday(home);
    await planMeal(home, recipe.id, sunday, 'dinner');

    expectStatus(await as(app, home.user, 'DELETE', `/api/recipes/${recipe.id}`), 204);

    const week = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/meal-plan?week=${sunday}`,
    );
    const entry = week
      .json<MealPlanWeekResponse>()
      .entries.find((one) => one.recipeTitle === 'Mushroom Stroganoff');
    expect(entry).toBeDefined();
    expect(entry?.recipeId).toBeNull();
    expect(entry?.readinessPercent).toBeNull();
  });
});

describe('add missing to list', () => {
  it('from a recipe: skips pantry matches and items already on the list, links on-sale items to the deal, keeps the ingredient’s own name', async () => {
    const home = await household(app);
    await favoriteStore(home, 'ht', 'Harris Teeter');
    await addPantryItem(home, 'Milk');
    await insertDeal({
      merchantId: 'ht',
      merchantName: 'Harris Teeter',
      postalCode: home.household.postalCode,
      name: 'Kraft Shredded Cheese',
      normalizedName: 'cheese',
      unitPrice: '3.49',
    });

    const list = await createList(home);
    // Already on the list: "onion" should be skipped, not duplicated.
    await as(app, home.user, 'POST', `/api/lists/${list.id}/items`, {
      source: 'manual',
      itemName: 'Onion',
    });

    const recipe = await createRecipe(home, 'Cheese Toast', [
      { itemName: 'Milk', quantity: 1, unit: 'cup' },
      { itemName: 'Cheese' },
      { itemName: 'Onion' },
      { itemName: 'Bread', quantity: 2 },
    ]);

    const response = await as(app, home.user, 'POST', `/api/recipes/${recipe.id}/add-to-list`, {
      listId: list.id,
    });
    expectStatus(response, 200);
    const updated = response.json<ShoppingListDetail>();

    // Milk (pantry) is not added.
    expect(allItems(updated).some((item) => item.itemName === 'Milk')).toBe(false);
    // Onion is not duplicated (it was already there as a manual item).
    expect(allItems(updated).filter((item) => item.normalizedName === 'onion')).toHaveLength(1);

    const cheese = itemNamed(updated, 'Cheese');
    expect(cheese.source).toBe('from_recipe');
    expect(cheese.merchantId).toBe('ht');
    expect(cheese.merchantName).toBe('Harris Teeter');
    expect(cheese.salePriceCents).toBe(349);
    expect(cheese.priceCents).toBe(349);
    expect(cheese.contributingRecipeIds).toEqual([recipe.id]);

    const bread = itemNamed(updated, 'Bread');
    expect(bread.source).toBe('from_recipe');
    expect(bread.merchantId).toBeNull();
    expect(bread.priceCents).toBeNull();
    expect(bread.quantity).toBe(2);

    // Running it again is a no-op: everything added the first time is now "already on the list".
    const again = await as(app, home.user, 'POST', `/api/recipes/${recipe.id}/add-to-list`, {
      listId: list.id,
    });
    const secondPass = again.json<ShoppingListDetail>();
    expect(allItems(secondPass).filter((item) => item.itemName === 'Cheese')).toHaveLength(1);
    expect(allItems(secondPass).filter((item) => item.itemName === 'Bread')).toHaveLength(1);
  });

  describe('when the same call arrives again', () => {
    async function recipeAndList(): Promise<{
      home: Home;
      list: ShoppingListDetail;
      recipeId: string;
    }> {
      const home = await household(app);
      const list = await createList(home);
      const recipe = await createRecipe(home, 'Cheese Toast', [
        { itemName: 'Cheese' },
        { itemName: 'Bread', quantity: 2 },
        { itemName: 'Butter', quantity: 1, unit: 'tbsp' },
      ]);
      return { home, list, recipeId: recipe.id };
    }

    const addToList = (
      home: Home,
      recipeId: string,
      listId: string,
    ): Promise<LightMyRequestResponse> =>
      as(app, home.user, 'POST', `/api/recipes/${recipeId}/add-to-list`, { listId });

    const idsOf = (list: ShoppingListDetail): string[] =>
      allItems(list)
        .map((item) => item.id)
        .toSorted();

    it('a replay after a lost response changes nothing, item for item', async () => {
      const { home, list, recipeId } = await recipeAndList();

      const first = await addToList(home, recipeId, list.id);
      expectStatus(first, 200);
      const replay = await addToList(home, recipeId, list.id);
      expectStatus(replay, 200);

      expect(idsOf(first.json<ShoppingListDetail>())).toHaveLength(3);
      expect(idsOf(replay.json<ShoppingListDetail>())).toEqual(
        idsOf(first.json<ShoppingListDetail>()),
      );
    });

    it('two calls in flight at once add each ingredient once', async () => {
      const { home, list, recipeId } = await recipeAndList();

      const [one, other] = await Promise.all([
        addToList(home, recipeId, list.id),
        addToList(home, recipeId, list.id),
      ]);
      expectStatus(one, 200);
      expectStatus(other, 200);

      const after = await as(app, home.user, 'GET', `/api/lists/${list.id}`);
      expectStatus(after, 200);
      expect(
        allItems(after.json<ShoppingListDetail>())
          .map((item) => item.normalizedName)
          .toSorted(),
      ).toEqual(['bread', 'butter', 'cheese']);
    });

    it('adds an ingredient again once its item is bought, since only needed and in-cart items count as on the list', async () => {
      const { home, list, recipeId } = await recipeAndList();
      const first = (await addToList(home, recipeId, list.id)).json<ShoppingListDetail>();
      const bread = itemNamed(first, 'Bread');
      expectStatus(
        await as(app, home.user, 'PATCH', `/api/lists/${list.id}/items/${bread.id}`, {
          status: 'bought',
        }),
        200,
      );

      const again = (await addToList(home, recipeId, list.id)).json<ShoppingListDetail>();

      expect(allItems(again).filter((item) => item.normalizedName === 'bread')).toHaveLength(2);
      expect(allItems(again)).toHaveLength(4);
    });
  });

  it('answers 404 for a foreign or missing recipe before touching the list', async () => {
    const home = await household(app);
    const list = await createList(home);
    expectStatus(
      await as(app, home.user, 'POST', `/api/recipes/${randomUUID()}/add-to-list`, {
        listId: list.id,
      }),
      404,
    );
  });

  it('from a planned meal: adds the recipe’s missing ingredients, and 404s once its recipe is deleted', async () => {
    const home = await household(app);
    const list = await createList(home);
    const recipe = await createRecipe(home, 'Simple Salad', [{ itemName: 'Lettuce' }]);
    const entry = await planMeal(home, recipe.id, await currentSunday(home));

    const response = await as(app, home.user, 'POST', `/api/meal-plan/${entry.id}/add-to-list`, {
      listId: list.id,
    });
    expectStatus(response, 200);
    expect(itemNamed(response.json<ShoppingListDetail>(), 'Lettuce')).toBeDefined();

    await as(app, home.user, 'DELETE', `/api/recipes/${recipe.id}`);
    expectStatus(
      await as(app, home.user, 'POST', `/api/meal-plan/${entry.id}/add-to-list`, {
        listId: list.id,
      }),
      404,
    );
  });

  it('from a whole week: aggregates matching units by summing, and mismatched units by merging into a note', async () => {
    const home = await household(app);
    const list = await createList(home);
    const sunday = await currentSunday(home);

    const carrotSoup = await createRecipe(home, 'Carrot Soup', [
      { itemName: 'Carrot', quantity: 1, unit: 'cup' },
    ]);
    const carrotSalad = await createRecipe(home, 'Carrot Salad', [
      { itemName: 'Carrot', quantity: 2, unit: 'cup' },
    ]);
    const mashedPotatoes = await createRecipe(home, 'Mashed Potatoes', [
      { itemName: 'Potato', quantity: 1, unit: 'cup' },
    ]);
    const potatoChips = await createRecipe(home, 'Potato Chips', [
      { itemName: 'Potato', quantity: 16, unit: 'oz' },
    ]);

    await planMeal(home, carrotSoup.id, sunday);
    await planMeal(home, carrotSalad.id, addDays(sunday, 1));
    await planMeal(home, mashedPotatoes.id, addDays(sunday, 2));
    await planMeal(home, potatoChips.id, addDays(sunday, 3));

    const response = await as(
      app,
      home.user,
      'POST',
      `/api/households/${home.household.id}/meal-plan/add-to-list`,
      { week: sunday, listId: list.id },
    );
    expectStatus(response, 200);
    const list2 = response.json<ShoppingListDetail>();

    const carrot = itemNamed(list2, 'Carrot');
    expect(carrot.quantity).toBe(3);
    expect(carrot.contributingRecipeIds.sort()).toEqual([carrotSalad.id, carrotSoup.id].sort());

    const potato = itemNamed(list2, 'Potato');
    expect(potato.quantity).toBeNull();
    expect(potato.quantityNote).toBe('1 cup + 16 oz');
    expect(potato.contributingRecipeIds.sort()).toEqual([mashedPotatoes.id, potatoChips.id].sort());
  });

  it('rejects a non-Sunday week for the whole-week add-to-list', async () => {
    const home = await household(app);
    const list = await createList(home);
    const sunday = await currentSunday(home);
    expectStatus(
      await as(
        app,
        home.user,
        'POST',
        `/api/households/${home.household.id}/meal-plan/add-to-list`,
        { week: addDays(sunday, 1), listId: list.id },
      ),
      400,
    );
  });
});

describe('suggestions', () => {
  it('ranks recipes by readiness, descending, and reports the deals’ as-of date', async () => {
    const home = await household(app);
    await favoriteStore(home, 'fl', 'Food Lion');
    await insertDeal({
      merchantId: 'fl',
      merchantName: 'Food Lion',
      postalCode: home.household.postalCode,
      name: 'Broccoli Crowns',
      normalizedName: 'broccoli',
      unitPrice: '1.99',
    });
    await createRecipe(home, 'All Broccoli', [{ itemName: 'Broccoli' }]);
    await createRecipe(home, 'Nothing Matches', [{ itemName: 'Kumquat' }]);

    const response = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/suggestions`,
    );
    expectStatus(response, 200);
    const body = response.json<SuggestionsResponse>();
    expect(body.recipes[0]?.title).toBe('All Broccoli');
    expect(body.recipes[0]?.readinessPercent).toBe(100);
    expect(body.recipes.at(-1)?.title).toBe('Nothing Matches');
    expect(body.dealsAsOf).not.toBeNull();
  });

  it('reports a null as-of date when there are no deals for the postal code at all', async () => {
    const home = await household(app);
    await createRecipe(home, 'Solo Recipe', [{ itemName: 'Kumquat' }]);
    const response = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/suggestions`,
    );
    expectStatus(response, 200);
    expect(response.json<SuggestionsResponse>().dealsAsOf).toBeNull();
  });
});

describe('RLS isolation: a stranger gets 404, never 403', () => {
  it('across the meal plan, suggestions, and add-to-list routes', async () => {
    const mine = await household(app, 'Alex');
    const stranger = await household(app, 'Blake');

    const recipe = await createRecipe(mine, 'Private Recipe', [{ itemName: 'Salt' }]);
    const sunday = await currentSunday(mine);
    const entry = await planMeal(mine, recipe.id, sunday);
    const list = await createList(mine);

    expectStatus(
      await as(app, stranger.user, 'GET', `/api/households/${mine.household.id}/meal-plan`),
      404,
    );
    expectStatus(
      await as(app, stranger.user, 'POST', `/api/households/${mine.household.id}/meal-plan`, {
        recipeId: recipe.id,
        plannedDate: sunday,
        mealType: 'dinner',
      }),
      404,
    );
    expectStatus(await as(app, stranger.user, 'DELETE', `/api/meal-plan/${entry.id}`), 404);
    expectStatus(
      await as(app, stranger.user, 'POST', `/api/meal-plan/${entry.id}/add-to-list`, {
        listId: list.id,
      }),
      404,
    );
    expectStatus(
      await as(
        app,
        stranger.user,
        'POST',
        `/api/households/${mine.household.id}/meal-plan/add-to-list`,
        { week: sunday, listId: list.id },
      ),
      404,
    );
    expectStatus(
      await as(app, stranger.user, 'GET', `/api/households/${mine.household.id}/suggestions`),
      404,
    );
    expectStatus(
      await as(app, stranger.user, 'POST', `/api/recipes/${recipe.id}/add-to-list`, {
        listId: list.id,
      }),
      404,
    );

    // The entry, recipe, and list all survive the stranger's attempts.
    expectStatus(await as(app, mine.user, 'GET', `/api/recipes/${recipe.id}`), 200);
  });
});
