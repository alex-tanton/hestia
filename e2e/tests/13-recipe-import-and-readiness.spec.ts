import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectDashboard, openList, signIn } from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { SEED } from '../support/env.ts';

/**
 * Journey 4 (Engineering Practices › "E2E journeys"): import a recipe by URL, view its readiness
 * breakdown, and add its missing ingredients to a list (Requirements, "Recipe library",
 * "Deal-matched suggestions", "Add missing to list"; Design › Screens › 11 and 12; Handoff, Phase
 * 3 "Done when"). Also covers the acceptance-critical parse-failure fallback, and folds in two
 * "Done when" spot checks that are cheap to verify live rather than only at the unit/integration
 * layer: Seed Data's own readiness percentages, and that a match-override correction is reachable.
 *
 * Every URL pasted is a fixture the E2E stack serves in-process (Engineering Practices › "E2E
 * environment"): `HEARTH_RECIPE_FIXTURE_DIR` swaps the recipe-fetch step itself for a read of the
 * matching file under `e2e/fixtures/recipes/`, so nothing here ever opens a socket, real or
 * loopback. See that file's own comment and `apps/service/src/recipes/fixture-fetch.ts` for why a
 * same-network fixture server was not an option: `fetchRecipePage`'s private-address refusal
 * (Technical Architecture, "Recipe fetching") would refuse the Compose network's own subnet just
 * as correctly as it refuses loopback.
 *
 * Each theme imports a different fixture recipe, so the two runs never save a same-titled recipe
 * or fight over one shopping list: light imports "Baked Cod with Asparagus" (both new ingredients
 * land in the to-buy bucket); dark imports "Baked Cod with Broccoli", whose broccoli is a
 * deliberate match against Food Lion's current "Broccoli Crowns" deal (Seed Data, "Favorite-store
 * groceries"), so that run's "add missing to list" also exercises the on-sale bucket. Both recipes
 * share the same five pantry ingredients (butter, garlic, salt, black pepper, olive oil), all of
 * which are on Oak Street's seeded pantry, so neither is ever added to the list.
 */

const FIXTURE_ORIGIN = 'https://fixtures.hearth-e2e.test';

interface OnSaleIngredient {
  itemName: string;
  merchant: string;
  priceFragment: string;
}

interface Scenario {
  recipeTitle: string;
  url: string;
  readinessPercent: string;
  readinessSentence: string;
  breakdownLine: string;
  toBuy: readonly string[];
  onSale: readonly OnSaleIngredient[];
  listName: string;
  manualFallbackTitle: string;
}

const SCENARIOS: Readonly<Record<'light' | 'dark', Scenario>> = {
  light: {
    recipeTitle: 'Baked Cod with Asparagus',
    url: `${FIXTURE_ORIGIN}/recipes/baked-cod-with-asparagus`,
    readinessPercent: '71%',
    readinessSentence: '5 of 7 ingredients ready',
    breakdownLine: '5 of 7 ready — 0 on sale, 5 in pantry, 2 to buy',
    toBuy: ['cod fillets', 'asparagus'],
    onSale: [],
    listName: 'Light Theme Cod Dinner List',
    manualFallbackTitle: 'Light Theme Handwritten Recipe',
  },
  dark: {
    recipeTitle: 'Baked Cod with Broccoli',
    url: `${FIXTURE_ORIGIN}/recipes/baked-cod-with-broccoli`,
    readinessPercent: '86%',
    readinessSentence: '6 of 7 ingredients ready',
    breakdownLine: '6 of 7 ready — 1 on sale, 5 in pantry, 1 to buy',
    toBuy: ['cod fillets'],
    onSale: [{ itemName: 'broccoli', merchant: 'Food Lion', priceFragment: '1.99' }],
    listName: 'Dark Theme Cod Dinner List',
    manualFallbackTitle: 'Dark Theme Handwritten Recipe',
  },
};

const NO_JSON_LD_URL = `${FIXTURE_ORIGIN}/recipes/no-recipe-markup`;
const PANTRY_ONLY_INGREDIENTS = ['butter', 'garlic', 'salt', 'black pepper', 'olive oil'];

/** Seed Data, "Recipes": three of the twelve Oak Street readiness buckets, spanning the range. */
const SEED_READINESS_SPOT_CHECKS = [
  {
    title: 'Grilled Cheese and Tomato Soup',
    percent: '100%',
    breakdownLine: '5 of 5 ready — 1 on sale, 4 in pantry, 0 to buy',
  },
  {
    title: 'Sheet Pan Chicken and Vegetables',
    percent: '86%',
    breakdownLine: '6 of 7 ready — 3 on sale, 3 in pantry, 1 to buy',
  },
  {
    title: 'Shrimp Pad Thai',
    percent: '13%',
    breakdownLine: '1 of 8 ready — 1 on sale, 0 in pantry, 7 to buy',
  },
] as const;

async function createList(page: Page, name: string): Promise<void> {
  await page.goto('/lists');
  await expect(page.getByRole('heading', { name: 'Lists', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'New list' }).click();
  const sheet = page.getByRole('dialog', { name: 'New list' });
  await sheet.getByLabel('List name').fill(name);
  await sheet.getByRole('button', { name: 'Create list' }).click();
  // ListNameSheet's onCreated navigates straight to the new (empty) list.
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
}

async function openAddRecipeSheet(page: Page): Promise<Locator> {
  await page.goto('/meals/recipes');
  await expect(page.getByRole('heading', { name: 'Recipes', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Add a recipe' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add a recipe' });
  await expect(sheet).toBeVisible();
  return sheet;
}

async function pasteAndParse(sheet: Locator, url: string): Promise<void> {
  await sheet.getByRole('button', { name: 'Paste a link' }).click();
  await sheet.getByLabel('Recipe URL').fill(url);
  await sheet.getByRole('button', { name: 'Parse' }).click();
}

/** An ingredient row's bucket badge, scoped to the `Readiness` region (Design › `IngredientRow`). */
function ingredientRow(readiness: Locator, itemName: string): Locator {
  return readiness.getByRole('listitem').filter({ hasText: itemName });
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`journey 4 — import a recipe, view readiness, add missing to a list (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('imports by URL, matches Seed Data readiness, and lists exactly what is missing', async ({
      page,
    }) => {
      const scenario = SCENARIOS[theme];

      await signIn(page, SEED.alex.email);
      await expectDashboard(page, SEED.oakStreet.name);

      // A list to add the missing ingredients to, created up front so the picker later has
      // something new and empty to assert against (Design › Screens › 10, 12: the picker opens
      // "always", for any list).
      await createList(page, scenario.listName);
      await expectAccessible(page, `new empty list (${theme})`);

      // --- Import by URL: valid JSON-LD parses to an editable, accurate preview. ---
      let sheet = await openAddRecipeSheet(page);
      await expectAccessible(page, `add-a-recipe, choose mode (${theme})`);

      await sheet.getByRole('button', { name: 'Paste a link' }).click();
      await expectAccessible(page, `add-a-recipe, paste-a-link mode (${theme})`);

      await sheet.getByLabel('Recipe URL').fill(scenario.url);
      await sheet.getByRole('button', { name: 'Parse' }).click();

      await expect(sheet.getByLabel('Title')).toHaveValue(scenario.recipeTitle);
      await expect(sheet.getByLabel('Servings')).toHaveValue('4');
      // Every parsed row keeps its original line, so a bad split can be corrected before saving
      // (Design › Screens › 11); this one line is enough to prove the raw text survived.
      await expect(sheet.getByText('"1 lb cod fillets"')).toBeVisible();
      await expect(sheet.getByRole('button', { name: /^Remove ingredient/ })).toHaveCount(7);
      await expectAccessible(page, `add-a-recipe, parsed preview (${theme})`);

      await sheet.getByRole('button', { name: 'Save recipe' }).click();
      await expect(page.getByText(`Added ${scenario.recipeTitle}.`).first()).toBeVisible();
      await expect(sheet).toBeHidden();

      // --- Readiness breakdown on the new recipe's own detail page. ---
      await page.getByRole('link', { name: new RegExp(scenario.recipeTitle) }).click();
      await expect(
        page.getByRole('heading', { name: scenario.recipeTitle, level: 1 }),
      ).toBeVisible();

      const readiness = page.getByRole('region', { name: 'Readiness' });
      await expect(readiness).toContainText(scenario.readinessPercent);
      await expect(readiness.getByText(scenario.readinessSentence)).toBeVisible();
      for (const itemName of scenario.toBuy) {
        await expect(
          ingredientRow(readiness, itemName).getByText('To buy', { exact: true }),
        ).toBeVisible();
      }
      for (const { itemName } of scenario.onSale) {
        await expect(
          ingredientRow(readiness, itemName).getByText('On sale', { exact: true }),
        ).toBeVisible();
      }
      for (const itemName of PANTRY_ONLY_INGREDIENTS) {
        await expect(
          ingredientRow(readiness, itemName).getByText('In pantry', { exact: true }),
        ).toBeVisible();
      }
      await expectAccessible(page, `new recipe detail with readiness (${theme})`);

      // --- Add missing ingredients to the list created above. ---
      await page.getByRole('button', { name: 'Add missing to list' }).click();
      const picker = page.getByRole('dialog', { name: 'Add missing to which list?' });
      await expect(picker).toBeVisible();
      await expectAccessible(page, `add-missing-to-list picker (${theme})`);
      await picker.getByRole('button', { name: new RegExp(`^${scenario.listName}`) }).click();
      await expect(page.getByText(`Added to ${scenario.listName}.`).first()).toBeVisible();
      await expect(picker).toBeHidden();

      // The list started empty, so "exactly the missing ingredients" is: every to-buy and
      // on-sale ingredient present once, nothing else, and no pantry ingredient at all.
      await openList(page, scenario.listName);
      const main = page.getByRole('main');
      const totalItemCount = scenario.toBuy.length + scenario.onSale.length;
      await expect(main.getByRole('checkbox')).toHaveCount(totalItemCount);

      const anywhere = main.getByRole('region', { name: 'Anywhere' });
      for (const itemName of scenario.toBuy) {
        await expect(anywhere.getByRole('checkbox', { name: itemName })).toBeVisible();
      }
      for (const { itemName, merchant, priceFragment } of scenario.onSale) {
        const merchantRegion = main.getByRole('region', { name: merchant });
        await expect(merchantRegion.getByRole('checkbox', { name: itemName })).toBeVisible();
        await expect(merchantRegion).toContainText(priceFragment);
      }
      for (const itemName of PANTRY_ONLY_INGREDIENTS) {
        await expect(main.getByRole('checkbox', { name: itemName })).toHaveCount(0);
      }
      await expectAccessible(page, `list with exactly the missing ingredients (${theme})`);

      // --- Seed Data readiness spot check: real seeded recipes still score exactly as documented. ---
      await page.goto('/meals/recipes');
      for (const check of SEED_READINESS_SPOT_CHECKS) {
        const card = page.getByRole('listitem').filter({ hasText: check.title });
        await expect(card).toContainText(check.percent);
        await expect(card).toContainText(check.breakdownLine);
      }
      await expectAccessible(page, `recipe library with seed readiness (${theme})`);

      // --- Match override reachability: Oak Street's seeded "cheese" force-no-match override. ---
      // Not anchored: `RecipeCard`'s accessible name leads with its sr-only readiness sentence
      // (Design › `RecipeCard`), so the title itself is a substring, never a prefix.
      await page.getByRole('link', { name: /Black Bean Tacos/ }).click();
      await expect(page.getByRole('heading', { name: 'Black Bean Tacos', level: 1 })).toBeVisible();
      const overrideReadiness = page.getByRole('region', { name: 'Readiness' });
      const cheeseRow = ingredientRow(overrideReadiness, 'cheese');
      await expect(cheeseRow.getByText('Corrected')).toBeVisible();
      await expect(cheeseRow.getByRole('button', { name: 'Remove correction' })).toBeVisible();
      // The override forces away Harris Teeter's "snack cheese" only; "cheese" still matches Food
      // Lion's "chunk or cheese" normally (Seed Data, "Recipes"), so the bucket stays on_sale.
      await expect(cheeseRow.getByText('On sale', { exact: true })).toBeVisible();
      await expectAccessible(page, `recipe detail with a match override (${theme})`);

      // --- Parse-failure fallback: a page with no JSON-LD falls back cleanly to an editable form. ---
      sheet = await openAddRecipeSheet(page);
      await pasteAndParse(sheet, NO_JSON_LD_URL);
      await expect(sheet.getByText("Couldn't read that page. Add it by hand?")).toBeVisible();
      const titleField = sheet.getByLabel('Title');
      await expect(titleField).toHaveValue('');
      await expect(sheet.getByLabel('Source URL')).toHaveValue(NO_JSON_LD_URL);
      await expect(sheet.getByRole('button', { name: /^Remove ingredient/ })).toHaveCount(0);
      await expectAccessible(page, `add-a-recipe, parse-failure fallback (${theme})`);

      // The fallback form is genuinely usable, not just visually present: fill it in and save.
      await titleField.fill(scenario.manualFallbackTitle);
      await sheet.getByRole('button', { name: 'Add ingredient' }).click();
      await sheet.getByLabel('Item').fill('a handwritten ingredient');
      await sheet.getByRole('button', { name: 'Save recipe' }).click();
      await expect(page.getByText(`Added ${scenario.manualFallbackTitle}.`).first()).toBeVisible();
      await expect(sheet).toBeHidden();
    });
  });
}
