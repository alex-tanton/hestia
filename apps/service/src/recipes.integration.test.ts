import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { normalize } from '@hearth/matching';
import type { ParseRecipeResponse, Recipe, RecipeDetail } from '@hearth/shared';
import { RecipeFetchError } from './recipes/fetch-recipe.js';
import {
  adminPool,
  as,
  household as sharedHousehold,
  startStack,
  type HouseholdFixture,
  type Stack,
} from './test/service-stack.js';
import { expectStatus } from './test/stack-hooks.js';

/*
 * Recipes against `supabase start`: real Postgres as hearth_service, every request through
 * withUserDb, so RLS is what decides each assertion. Requests here commit, so each test makes its
 * own users and households. `parseRecipeUrl` is stubbed per app instance — never the network —
 * since the fetch mechanics themselves are unit-tested in `recipes/`.
 */

let stack: Stack;

beforeAll(async () => {
  stack = await startStack();
});

afterAll(async () => {
  await stack.close();
});

const POSTAL_CODE = '27599';

interface Home extends HouseholdFixture {
  app: FastifyInstance;
}

async function household(
  app: FastifyInstance,
  name = 'Alex Rivera',
  postalCode = POSTAL_CODE,
): Promise<Home> {
  return { app, ...(await sharedHousehold(app, name, postalCode)) };
}

const MANUAL_RECIPE_BODY = {
  title: 'Lentil Curry',
  instructions: 'Simmer everything for 30 minutes.',
  servings: 4,
  ingredients: [
    { itemName: 'lentils', quantity: 2, unit: 'cups' },
    { itemName: 'coconut milk', quantity: 1, unit: 'can' },
    { itemName: 'onion' },
  ],
};

async function createRecipe(
  home: Home,
  body: Record<string, unknown> = MANUAL_RECIPE_BODY,
): Promise<RecipeDetail> {
  const response = await as(
    home.app,
    home.user,
    'POST',
    `/api/households/${home.household.id}/recipes`,
    body,
  );
  expectStatus(response, 201);
  return response.json<RecipeDetail>();
}

describe('recipe CRUD', () => {
  it('creates a manual recipe with no source URL and no raw text, then reads it back', async () => {
    const app = await stack.newApp();
    const home = await household(app);
    const recipe = await createRecipe(home);

    expect(recipe.title).toBe('Lentil Curry');
    expect(recipe.sourceUrl).toBeNull();
    expect(recipe.servings).toBe(4);
    expect(recipe.householdId).toBe(home.household.id);
    expect(recipe.ingredients).toHaveLength(3);
    expect(recipe.ingredients.every((ingredient) => ingredient.rawText === null)).toBe(true);
    // normalized_name is computed from item_name by @hearth/matching on save.
    expect(recipe.ingredients.map((ingredient) => ingredient.normalizedName)).toEqual(
      ['lentils', 'coconut milk', 'onion'].map(normalize),
    );
    // Ingredients keep the order they were sent in.
    expect(recipe.ingredients.map((ingredient) => ingredient.itemName)).toEqual([
      'lentils',
      'coconut milk',
      'onion',
    ]);

    const fetched = await as(app, home.user, 'GET', `/api/recipes/${recipe.id}`);
    expectStatus(fetched, 200);
    expect(fetched.json<RecipeDetail>()).toEqual(recipe);
  });

  it('lists a household’s recipes, paginated', async () => {
    const app = await stack.newApp();
    const home = await household(app);
    await createRecipe(home, { ...MANUAL_RECIPE_BODY, title: 'Recipe A', ingredients: [] });
    await createRecipe(home, { ...MANUAL_RECIPE_BODY, title: 'Recipe B', ingredients: [] });

    const response = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/recipes`,
    );
    expectStatus(response, 200);
    const body = response.json<{
      recipes: Recipe[];
      page: number;
      pageSize: number;
      total: number;
      hasMore: boolean;
    }>();
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(50);
    expect(body.total).toBe(2);
    expect(body.hasMore).toBe(false);
    expect(body.recipes.map((recipe) => recipe.title).sort()).toEqual(['Recipe A', 'Recipe B']);
  });

  it('updates fields and wholesale-replaces the ingredient list', async () => {
    const app = await stack.newApp();
    const home = await household(app);
    const recipe = await createRecipe(home);

    const renamed = await as(app, home.user, 'PATCH', `/api/recipes/${recipe.id}`, {
      title: 'Spicy Lentil Curry',
      servings: 6,
    });
    expectStatus(renamed, 200);
    const renamedBody = renamed.json<RecipeDetail>();
    expect(renamedBody.title).toBe('Spicy Lentil Curry');
    expect(renamedBody.servings).toBe(6);
    // Ingredients untouched when not given.
    expect(renamedBody.ingredients).toHaveLength(3);

    const replaced = await as(app, home.user, 'PATCH', `/api/recipes/${recipe.id}`, {
      ingredients: [{ itemName: 'chickpeas', quantity: 1, unit: 'can' }],
    });
    expectStatus(replaced, 200);
    const replacedBody = replaced.json<RecipeDetail>();
    expect(replacedBody.ingredients).toHaveLength(1);
    expect(replacedBody.ingredients[0]?.itemName).toBe('chickpeas');
    expect(replacedBody.ingredients[0]?.normalizedName).toBe(normalize('chickpeas'));

    const refusedEmpty = await as(app, home.user, 'PATCH', `/api/recipes/${recipe.id}`, {});
    expectStatus(refusedEmpty, 400);
  });

  it('refuses a recipe with a blank title', async () => {
    const app = await stack.newApp();
    const home = await household(app);
    const response = await as(
      app,
      home.user,
      'POST',
      `/api/households/${home.household.id}/recipes`,
      { title: '   ', ingredients: [] },
    );
    expectStatus(response, 400);
  });

  it('deletes a recipe, cascading its ingredients', async () => {
    const app = await stack.newApp();
    const home = await household(app);
    const recipe = await createRecipe(home);

    expectStatus(await as(app, home.user, 'DELETE', `/api/recipes/${recipe.id}`), 204);
    expectStatus(await as(app, home.user, 'GET', `/api/recipes/${recipe.id}`), 404);

    const { rows } = await adminPool.query(
      'select 1 from public.recipe_ingredient where recipe_id = $1',
      [recipe.id],
    );
    expect(rows).toHaveLength(0);
  });

  it('keeps every recipe inside its household', async () => {
    const app = await stack.newApp();
    const mine = await household(app, 'Alex Rivera');
    const theirs = await household(app, 'Blake Stranger');
    const recipe = await createRecipe(mine);

    for (const [method, url, payload] of [
      ['GET', `/api/households/${mine.household.id}/recipes`, undefined],
      ['POST', `/api/households/${mine.household.id}/recipes`, MANUAL_RECIPE_BODY],
      [
        'POST',
        `/api/households/${mine.household.id}/recipes/parse`,
        { url: 'https://example.com/recipe' },
      ],
      ['GET', `/api/recipes/${recipe.id}`, undefined],
      ['PATCH', `/api/recipes/${recipe.id}`, { title: 'Stolen' }],
      ['DELETE', `/api/recipes/${recipe.id}`, undefined],
    ] as const) {
      const response = await as(app, theirs.user, method, url, payload);
      expect(response.statusCode, `${method} ${url}`).toBe(404);
    }

    // Nothing the stranger tried changed anything.
    const after = await as(app, mine.user, 'GET', `/api/recipes/${recipe.id}`);
    expectStatus(after, 200);
    expect(after.json<RecipeDetail>().title).toBe('Lentil Curry');
  });
});

describe('parse-then-save', () => {
  it('round-trips a parsed preview into a saved recipe, keeping raw_text', async () => {
    const parsePreview: ParseRecipeResponse = {
      needsManualEntry: false,
      sourceUrl: 'https://example.com/sheet-pan-chicken',
      title: 'Sheet Pan Chicken',
      instructions: 'Roast at 425°F for 25 minutes.',
      servings: 4,
      ingredients: [
        {
          rawText: '2 lb boneless chicken breast',
          itemName: 'boneless chicken breast',
          quantity: 2,
          unit: 'lb',
        },
        {
          rawText: 'salt and pepper to taste',
          itemName: 'salt and pepper to taste',
          quantity: null,
          unit: null,
        },
      ],
    };
    const app = await stack.newApp({
      deps: { parseRecipeUrl: () => Promise.resolve(parsePreview) },
    });
    const home = await household(app);

    const parsed = await as(
      app,
      home.user,
      'POST',
      `/api/households/${home.household.id}/recipes/parse`,
      { url: parsePreview.sourceUrl },
    );
    expectStatus(parsed, 200);
    expect(parsed.json<ParseRecipeResponse>()).toEqual(parsePreview);

    // The user edits the preview (fixes the second ingredient) before confirming the save.
    const saved = await as(app, home.user, 'POST', `/api/households/${home.household.id}/recipes`, {
      title: parsePreview.title,
      sourceUrl: parsePreview.sourceUrl,
      instructions: parsePreview.instructions,
      servings: parsePreview.servings,
      ingredients: [
        parsePreview.ingredients[0],
        { rawText: 'salt and pepper to taste', itemName: 'salt', quantity: null, unit: null },
      ],
    });
    expectStatus(saved, 201);
    const savedRecipe = saved.json<RecipeDetail>();
    expect(savedRecipe.sourceUrl).toBe(parsePreview.sourceUrl);
    expect(savedRecipe.ingredients[0]?.rawText).toBe('2 lb boneless chicken breast');
    expect(savedRecipe.ingredients[1]?.itemName).toBe('salt');
    expect(savedRecipe.ingredients[1]?.rawText).toBe('salt and pepper to taste');
  });

  it('returns needsManualEntry rather than throwing when nothing usable was found', async () => {
    const app = await stack.newApp({
      deps: {
        parseRecipeUrl: () =>
          Promise.resolve({
            needsManualEntry: true,
            sourceUrl: 'https://example.com/notes',
            title: null,
            instructions: null,
            servings: null,
            ingredients: [],
          }),
      },
    });
    const home = await household(app);
    const response = await as(
      app,
      home.user,
      'POST',
      `/api/households/${home.household.id}/recipes/parse`,
      { url: 'https://example.com/notes' },
    );
    expectStatus(response, 200);
    expect(response.json<ParseRecipeResponse>().needsManualEntry).toBe(true);
  });

  it('maps a recipe-fetch failure to its problem status, not a bare 500', async () => {
    const app = await stack.newApp({
      deps: {
        parseRecipeUrl: () =>
          Promise.reject(
            new RecipeFetchError(
              'That URL points at a private or local address.',
              'private_address',
            ),
          ),
      },
    });
    const home = await household(app);
    const response = await as(
      app,
      home.user,
      'POST',
      `/api/households/${home.household.id}/recipes/parse`,
      { url: 'http://127.0.0.1/' },
    );
    expectStatus(response, 400);
  });
});

describe('deleting a recipe and the meal plan', () => {
  it('sets meal_plan_entry.recipe_id to null and keeps the recipe_title snapshot', async () => {
    const app = await stack.newApp();
    const home = await household(app);
    const recipe = await createRecipe(home, { ...MANUAL_RECIPE_BODY, title: 'Baked Ziti' });

    // The week planner API is a later unit; a raw row here proves the FK keeps a planned meal's
    // title when its recipe is deleted, without depending on that route.
    const inserted = await adminPool.query<{ id: string }>(
      `insert into public.meal_plan_entry
         (household_id, recipe_id, recipe_title, planned_date, meal_type, added_by)
       values ($1, $2, $3, current_date, 'dinner', $4)
       returning id`,
      [home.household.id, recipe.id, recipe.title, home.user.id],
    );
    const entryId = inserted.rows[0]?.id;
    expect(entryId).toBeDefined();

    expectStatus(await as(app, home.user, 'DELETE', `/api/recipes/${recipe.id}`), 204);

    const { rows } = await adminPool.query<{ recipe_id: string | null; recipe_title: string }>(
      'select recipe_id, recipe_title from public.meal_plan_entry where id = $1',
      [entryId],
    );
    expect(rows).toEqual([{ recipe_id: null, recipe_title: 'Baked Ziti' }]);
  });
});
