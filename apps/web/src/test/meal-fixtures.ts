import type {
  MatchOverride,
  Recipe,
  RecipeDetail,
  RecipeListResponse,
  Suggestion,
  SuggestionsResponse,
} from '@hearth/shared';
import { ALEX_ID, OAK_STREET_ID } from './fixtures.ts';

/*
 * Seed Data › "Recipes" and "Matching test cases", used as the oracle these fixtures mirror.
 * Percentages and bucket splits match the seed table exactly, so component tests can assert
 * against the same numbers the seed's own tests do.
 */

export const SHEET_PAN_CHICKEN_ID = 'c0000001-0000-4000-8000-000000000001';
export const BAKED_ZITI_ID = 'c0000001-0000-4000-8000-000000000002';
export const GRILLED_CHEESE_ID = 'c0000001-0000-4000-8000-000000000003';
export const PAD_THAI_ID = 'c0000001-0000-4000-8000-000000000004';
export const TUNA_POKE_BOWL_ID = 'c0000001-0000-4000-8000-000000000006';
export const MISO_SOUP_ID = 'c0000001-0000-4000-8000-000000000007';

const CREATED_AT = '2026-09-15T12:00:00.000Z';

/** Sheet Pan Chicken and Vegetables — 6 of 7, 86% (3 on sale, 3 pantry). */
export const sheetPanChickenFixture: RecipeDetail = {
  id: SHEET_PAN_CHICKEN_ID,
  householdId: OAK_STREET_ID,
  title: 'Sheet Pan Chicken and Vegetables',
  sourceUrl: 'https://www.weeknightkitchen.test/recipes/sheet-pan-chicken-and-vegetables',
  instructions:
    'Toss everything with oil, spread on a sheet pan, and roast at 425°F for 25 minutes.',
  servings: 4,
  createdBy: ALEX_ID,
  createdAt: CREATED_AT,
  ingredients: [
    {
      id: 'a0000001-0000-4000-8000-000000000001',
      position: 0,
      rawText: '2 lb boneless, skinless chicken breast',
      itemName: 'chicken breast',
      normalizedName: 'chicken breast',
      quantity: 2,
      unit: 'lb',
    },
    {
      id: 'a0000001-0000-4000-8000-000000000002',
      position: 1,
      rawText: '1 lb broccoli florets',
      itemName: 'broccoli',
      normalizedName: 'broccoli',
      quantity: 1,
      unit: 'lb',
    },
    {
      id: 'a0000001-0000-4000-8000-000000000003',
      position: 2,
      rawText: '1 bell pepper, sliced',
      itemName: 'bell pepper',
      normalizedName: 'bell pepper',
      quantity: 1,
      unit: null,
    },
    {
      id: 'a0000001-0000-4000-8000-000000000004',
      position: 3,
      rawText: '2 tbsp olive oil',
      itemName: 'olive oil',
      normalizedName: 'olive oil',
      quantity: 2,
      unit: 'tbsp',
    },
    {
      id: 'a0000001-0000-4000-8000-000000000005',
      position: 4,
      rawText: '3 cloves garlic, minced',
      itemName: 'garlic',
      normalizedName: 'garlic',
      quantity: 3,
      unit: 'cloves',
    },
    {
      id: 'a0000001-0000-4000-8000-000000000006',
      position: 5,
      rawText: '1 tsp smoked paprika',
      itemName: 'paprika',
      normalizedName: 'paprika',
      quantity: 1,
      unit: 'tsp',
    },
    {
      id: 'a0000001-0000-4000-8000-000000000007',
      position: 6,
      rawText: '1 lemon, quartered',
      itemName: 'lemon',
      normalizedName: 'lemon',
      quantity: 1,
      unit: null,
    },
  ],
  readiness: {
    onSaleCount: 3,
    inPantryCount: 3,
    toBuyCount: 1,
    readinessPercent: 86,
    computedAt: '2026-09-25T09:00:00.000Z',
    breakdown: [
      {
        ingredientId: 'a0000001-0000-4000-8000-000000000001',
        bucket: 'on_sale',
        matchedId: 'd0000001-0000-4000-8000-000000000001',
        matchedName: 'Boneless Skinless Chicken Breast, Family Pack',
        overridden: false,
      },
      {
        ingredientId: 'a0000001-0000-4000-8000-000000000002',
        bucket: 'on_sale',
        matchedId: 'd0000001-0000-4000-8000-000000000002',
        matchedName: 'Broccoli Crowns',
        overridden: false,
      },
      {
        ingredientId: 'a0000001-0000-4000-8000-000000000003',
        bucket: 'on_sale',
        matchedId: 'd0000001-0000-4000-8000-000000000003',
        matchedName: 'Bell Peppers',
        overridden: false,
      },
      {
        ingredientId: 'a0000001-0000-4000-8000-000000000004',
        bucket: 'in_pantry',
        matchedId: 'b0000001-0000-4000-8000-000000000001',
        matchedName: 'Olive oil',
        overridden: false,
      },
      {
        ingredientId: 'a0000001-0000-4000-8000-000000000005',
        bucket: 'in_pantry',
        matchedId: 'b0000001-0000-4000-8000-000000000002',
        matchedName: 'Garlic',
        overridden: false,
      },
      {
        ingredientId: 'a0000001-0000-4000-8000-000000000006',
        bucket: 'in_pantry',
        matchedId: 'b0000001-0000-4000-8000-000000000003',
        matchedName: 'Paprika',
        overridden: false,
      },
      {
        ingredientId: 'a0000001-0000-4000-8000-000000000007',
        bucket: 'to_buy',
        matchedId: null,
        matchedName: null,
        overridden: false,
      },
    ],
  },
  matchOverrides: [],
};

/**
 * Baked Ziti — 5 of 7, 71% (1 on sale, 4 pantry). Also the Recipe detail override fixture (Seed
 * Data): a force-no-match override on "cheese" against Harris Teeter's "snack cheese", which
 * changes no score because "cheese" already matches Food Lion's "chunk or cheese" instead.
 */
export const cheeseOverrideFixture: MatchOverride = {
  id: 'f0000002-0000-4000-8000-000000000001',
  householdId: OAK_STREET_ID,
  ingredientNormalizedName: 'cheese',
  targetKind: 'deal',
  targetNormalizedName: 'snack cheese',
  decision: 'force_no_match',
  createdAt: CREATED_AT,
};

export const bakedZitiFixture: RecipeDetail = {
  id: BAKED_ZITI_ID,
  householdId: OAK_STREET_ID,
  title: 'Baked Ziti',
  sourceUrl: 'https://www.weeknightkitchen.test/recipes/baked-ziti',
  instructions: 'Boil the pasta, mix with sauce and cheeses, and bake at 375°F for 25 minutes.',
  servings: 6,
  createdBy: ALEX_ID,
  createdAt: CREATED_AT,
  ingredients: [
    {
      id: 'a0000002-0000-4000-8000-000000000001',
      position: 0,
      rawText: '1 lb pasta',
      itemName: 'pasta',
      normalizedName: 'pasta',
      quantity: 1,
      unit: 'lb',
    },
    {
      id: 'a0000002-0000-4000-8000-000000000002',
      position: 1,
      rawText: '1 lb ground beef',
      itemName: 'ground beef',
      normalizedName: 'ground beef',
      quantity: 1,
      unit: 'lb',
    },
    {
      id: 'a0000002-0000-4000-8000-000000000003',
      position: 2,
      rawText: '1 (28 oz) can crushed tomatoes',
      itemName: 'canned tomatoes',
      normalizedName: 'canned tomato',
      quantity: 28,
      unit: 'oz',
    },
    {
      id: 'a0000002-0000-4000-8000-000000000004',
      position: 3,
      rawText: '8 oz mozzarella, shredded',
      itemName: 'mozzarella',
      normalizedName: 'mozzarella',
      quantity: 8,
      unit: 'oz',
    },
    {
      id: 'a0000002-0000-4000-8000-000000000005',
      position: 4,
      rawText: '15 oz ricotta',
      itemName: 'ricotta',
      normalizedName: 'ricotta',
      quantity: 15,
      unit: 'oz',
    },
    {
      id: 'a0000002-0000-4000-8000-000000000006',
      position: 5,
      rawText: '1/2 cup grated parmesan',
      itemName: 'parmesan',
      normalizedName: 'parmesan',
      quantity: 0.5,
      unit: 'cup',
    },
    {
      id: 'a0000002-0000-4000-8000-000000000007',
      position: 6,
      rawText: '2 cloves garlic, minced',
      itemName: 'garlic',
      normalizedName: 'garlic',
      quantity: 2,
      unit: 'cloves',
    },
  ],
  readiness: {
    onSaleCount: 1,
    inPantryCount: 4,
    toBuyCount: 2,
    readinessPercent: 71,
    computedAt: '2026-09-25T09:00:00.000Z',
    breakdown: [
      {
        ingredientId: 'a0000002-0000-4000-8000-000000000001',
        bucket: 'in_pantry',
        matchedId: 'b0000001-0000-4000-8000-000000000004',
        matchedName: 'Pasta',
        overridden: false,
      },
      {
        ingredientId: 'a0000002-0000-4000-8000-000000000002',
        bucket: 'on_sale',
        matchedId: 'd0000001-0000-4000-8000-000000000004',
        matchedName: '93% Lean Fresh Ground Beef',
        overridden: false,
      },
      {
        ingredientId: 'a0000002-0000-4000-8000-000000000003',
        bucket: 'in_pantry',
        matchedId: 'b0000001-0000-4000-8000-000000000005',
        matchedName: 'Canned tomatoes',
        overridden: false,
      },
      {
        ingredientId: 'a0000002-0000-4000-8000-000000000004',
        bucket: 'to_buy',
        matchedId: null,
        matchedName: null,
        overridden: false,
      },
      {
        ingredientId: 'a0000002-0000-4000-8000-000000000005',
        bucket: 'to_buy',
        matchedId: null,
        matchedName: null,
        overridden: false,
      },
      {
        ingredientId: 'a0000002-0000-4000-8000-000000000006',
        bucket: 'in_pantry',
        matchedId: 'b0000001-0000-4000-8000-000000000006',
        matchedName: 'Parmesan',
        overridden: false,
      },
      {
        ingredientId: 'a0000002-0000-4000-8000-000000000007',
        bucket: 'in_pantry',
        matchedId: 'b0000001-0000-4000-8000-000000000002',
        matchedName: 'Garlic',
        overridden: false,
      },
    ],
  },
  matchOverrides: [cheeseOverrideFixture],
};

/** Grilled Cheese and Tomato Soup — 5 of 5, 100% (1 on sale, 4 pantry): brackets the range. */
export const grilledCheeseFixture: RecipeDetail = {
  id: GRILLED_CHEESE_ID,
  householdId: OAK_STREET_ID,
  title: 'Grilled Cheese and Tomato Soup',
  sourceUrl: 'https://www.weeknightkitchen.test/recipes/grilled-cheese-and-tomato-soup',
  instructions: 'Butter the bread, add cheese, and grill until golden. Warm the soup alongside.',
  servings: 2,
  createdBy: ALEX_ID,
  createdAt: CREATED_AT,
  ingredients: [
    {
      id: 'a0000003-0000-4000-8000-000000000001',
      position: 0,
      rawText: '4 slices bread',
      itemName: 'bread',
      normalizedName: 'bread',
      quantity: 4,
      unit: null,
    },
    {
      id: 'a0000003-0000-4000-8000-000000000002',
      position: 1,
      rawText: '2 tbsp butter',
      itemName: 'butter',
      normalizedName: 'butter',
      quantity: 2,
      unit: 'tbsp',
    },
    {
      id: 'a0000003-0000-4000-8000-000000000003',
      position: 2,
      rawText: '4 slices cheese',
      itemName: 'cheese',
      normalizedName: 'cheese',
      quantity: 4,
      unit: null,
    },
    {
      id: 'a0000003-0000-4000-8000-000000000004',
      position: 3,
      rawText: '1 can crushed tomatoes',
      itemName: 'canned tomatoes',
      normalizedName: 'canned tomato',
      quantity: 1,
      unit: null,
    },
    {
      id: 'a0000003-0000-4000-8000-000000000005',
      position: 4,
      rawText: '1 cup milk',
      itemName: 'milk',
      normalizedName: 'milk',
      quantity: 1,
      unit: 'cup',
    },
  ],
  readiness: {
    onSaleCount: 1,
    inPantryCount: 4,
    toBuyCount: 0,
    readinessPercent: 100,
    computedAt: '2026-09-25T09:00:00.000Z',
    breakdown: [
      {
        ingredientId: 'a0000003-0000-4000-8000-000000000001',
        bucket: 'in_pantry',
        matchedId: 'b0000001-0000-4000-8000-000000000007',
        matchedName: 'Bread',
        overridden: false,
      },
      {
        ingredientId: 'a0000003-0000-4000-8000-000000000002',
        bucket: 'in_pantry',
        matchedId: 'b0000001-0000-4000-8000-000000000008',
        matchedName: 'Butter',
        overridden: false,
      },
      {
        ingredientId: 'a0000003-0000-4000-8000-000000000003',
        bucket: 'on_sale',
        matchedId: 'd0000001-0000-4000-8000-000000000005',
        matchedName: 'Chunk or Shredded Cheese',
        overridden: false,
      },
      {
        ingredientId: 'a0000003-0000-4000-8000-000000000004',
        bucket: 'in_pantry',
        matchedId: 'b0000001-0000-4000-8000-000000000005',
        matchedName: 'Canned tomatoes',
        overridden: false,
      },
      {
        ingredientId: 'a0000003-0000-4000-8000-000000000005',
        bucket: 'in_pantry',
        matchedId: 'b0000001-0000-4000-8000-000000000009',
        matchedName: 'Milk',
        overridden: false,
      },
    ],
  },
  matchOverrides: [],
};

/** Shrimp Pad Thai — 1 of 8, 13% (1 on sale: the coincidental "peanuts" match). */
export const padThaiFixture: RecipeDetail = {
  id: PAD_THAI_ID,
  householdId: OAK_STREET_ID,
  title: 'Shrimp Pad Thai',
  sourceUrl: null,
  instructions: null,
  servings: null,
  createdBy: ALEX_ID,
  createdAt: CREATED_AT,
  ingredients: [
    {
      id: 'a0000004-0000-4000-8000-000000000001',
      position: 0,
      rawText: null,
      itemName: 'rice noodles',
      normalizedName: 'rice noodle',
      quantity: null,
      unit: null,
    },
    {
      id: 'a0000004-0000-4000-8000-000000000002',
      position: 1,
      rawText: null,
      itemName: 'shrimp',
      normalizedName: 'shrimp',
      quantity: null,
      unit: null,
    },
    {
      id: 'a0000004-0000-4000-8000-000000000003',
      position: 2,
      rawText: null,
      itemName: 'peanuts',
      normalizedName: 'peanut',
      quantity: null,
      unit: null,
    },
  ],
  readiness: {
    onSaleCount: 1,
    inPantryCount: 0,
    toBuyCount: 2,
    readinessPercent: 13,
    computedAt: '2026-09-25T09:00:00.000Z',
    breakdown: [
      {
        ingredientId: 'a0000004-0000-4000-8000-000000000001',
        bucket: 'to_buy',
        matchedId: null,
        matchedName: null,
        overridden: false,
      },
      {
        ingredientId: 'a0000004-0000-4000-8000-000000000002',
        bucket: 'to_buy',
        matchedId: null,
        matchedName: null,
        overridden: false,
      },
      {
        ingredientId: 'a0000004-0000-4000-8000-000000000003',
        bucket: 'on_sale',
        matchedId: 'd0000001-0000-4000-8000-000000000006',
        matchedName: 'Peanut Butter Chocolate Puffs Cereal',
        overridden: false,
      },
    ],
  },
  matchOverrides: [],
};

/** Rivera Family: Tuna Poke Bowl and Miso Soup, both 0% — no pantry, nothing on sale matches. */
export const tunaPokeBowlFixture: Suggestion = {
  recipeId: TUNA_POKE_BOWL_ID,
  title: 'Tuna Poke Bowl',
  readinessPercent: 0,
  onSaleCount: 0,
  inPantryCount: 0,
  toBuyCount: 6,
};

export const misoSoupFixture: Suggestion = {
  recipeId: MISO_SOUP_ID,
  title: 'Miso Soup',
  readinessPercent: 0,
  onSaleCount: 0,
  inPantryCount: 0,
  toBuyCount: 5,
};

export function suggestionOf(recipe: RecipeDetail): Suggestion {
  const readiness = recipe.readiness;
  return {
    recipeId: recipe.id,
    title: recipe.title,
    readinessPercent: readiness?.readinessPercent ?? 0,
    onSaleCount: readiness?.onSaleCount ?? 0,
    inPantryCount: readiness?.inPantryCount ?? 0,
    toBuyCount: readiness?.toBuyCount ?? 0,
  };
}

export const suggestionsFixture: SuggestionsResponse = {
  recipes: [
    suggestionOf(grilledCheeseFixture),
    suggestionOf(sheetPanChickenFixture),
    suggestionOf(bakedZitiFixture),
    suggestionOf(padThaiFixture),
  ],
  dealsAsOf: '2026-09-25T09:00:00.000Z',
};

export const riveraSuggestionsFixture: SuggestionsResponse = {
  recipes: [tunaPokeBowlFixture, misoSoupFixture],
  dealsAsOf: '2026-09-19T09:00:00.000Z',
};

function baseRecipe(detail: RecipeDetail): Recipe {
  return {
    id: detail.id,
    householdId: detail.householdId,
    title: detail.title,
    sourceUrl: detail.sourceUrl,
    instructions: detail.instructions,
    servings: detail.servings,
    createdBy: detail.createdBy,
    createdAt: detail.createdAt,
  };
}

/** `GET /households/:id/recipes` carries no readiness (Technical Architecture › "API surface"). */
export const recipeListResponseFixture: RecipeListResponse = {
  recipes: [
    baseRecipe(grilledCheeseFixture),
    baseRecipe(sheetPanChickenFixture),
    baseRecipe(bakedZitiFixture),
    baseRecipe(padThaiFixture),
  ],
  page: 1,
  pageSize: 50,
  total: 4,
  hasMore: false,
};
