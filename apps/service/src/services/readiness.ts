import type { Kysely } from 'kysely';
import { matchIngredient, type MatchOverride } from '@hearth/matching';
import type { ReadinessBreakdownEntry } from '@hearth/shared';
import type { Database } from '../db.js';
import {
  buildMatchCandidates,
  listMatchOverridesFor,
  type HouseholdMatchContext,
} from './matching-candidates.js';

/**
 * Recipe readiness (equal weighting, half-up rounding, 0% for a recipe with no ingredients; stored
 * in `recipe_readiness`). Recomputed inline, in the same transaction, right after any write that
 * could change a bucket assignment (pantry, recipe ingredients, match overrides), and from the
 * daily deal refresh job for every affected household. It runs the same way whether the caller's
 * transaction is `authenticated` (a household member's write) or `service_role` (the job): the RLS
 * `household_write` policy already lets a member write their own household's `recipe_readiness`
 * row, and the job runs as service_role, so neither path needs a special case.
 */

interface IngredientRow {
  id: string;
  normalized_name: string;
}

/**
 * Equal weighting, half-up rounding, 0% for a recipe with no ingredients. Pure and exported so the
 * rounding rule is table-tested without a database.
 */
export function computeReadinessPercent(
  onSaleCount: number,
  inPantryCount: number,
  totalIngredients: number,
): number {
  if (totalIngredients === 0) return 0;
  return Math.round(((onSaleCount + inPantryCount) / totalIngredients) * 100);
}

function bucketOf(
  ingredient: IngredientRow,
  context: HouseholdMatchContext,
  overrides: readonly MatchOverride[],
): ReadinessBreakdownEntry {
  const result = matchIngredient(ingredient.normalized_name, context.candidates, overrides);
  if (!result.matched || result.candidate === undefined) {
    return {
      ingredientId: ingredient.id,
      bucket: 'to_buy',
      matchedId: null,
      matchedName: null,
      overridden: false,
    };
  }
  const overridden = result.reason === 'override';
  if (result.candidate.targetKind === 'pantry') {
    const pantry = context.pantryById.get(result.candidate.id);
    return {
      ingredientId: ingredient.id,
      bucket: 'in_pantry',
      matchedId: result.candidate.id,
      matchedName: pantry?.item_name ?? null,
      overridden,
    };
  }
  const deal = context.dealsById.get(result.candidate.id);
  return {
    ingredientId: ingredient.id,
    bucket: 'on_sale',
    matchedId: result.candidate.id,
    matchedName: deal?.name ?? null,
    overridden,
  };
}

/**
 * Recomputes and upserts one recipe's `recipe_readiness` row. Reuses an already-built
 * `HouseholdMatchContext`/override list, so a caller recomputing several recipes for the same
 * household builds the candidate set once rather than per recipe.
 */
async function recomputeOne(
  db: Kysely<Database>,
  recipeId: string,
  householdId: string,
  context: HouseholdMatchContext,
  overrides: readonly MatchOverride[],
): Promise<void> {
  const ingredients = await db
    .selectFrom('recipe_ingredient')
    .select(['id', 'normalized_name'])
    .where('recipe_id', '=', recipeId)
    .execute();

  const breakdown = ingredients.map((ingredient) => bucketOf(ingredient, context, overrides));
  const onSaleCount = breakdown.filter((entry) => entry.bucket === 'on_sale').length;
  const inPantryCount = breakdown.filter((entry) => entry.bucket === 'in_pantry').length;
  const toBuyCount = breakdown.filter((entry) => entry.bucket === 'to_buy').length;
  const readinessPercent = computeReadinessPercent(onSaleCount, inPantryCount, ingredients.length);

  // Keyed by ingredient id (`breakdown` is jsonb: per ingredient id, its bucket and the matched
  // deal or pantry name); the API response converts it back to an array of entries.
  const breakdownByIngredientId = Object.fromEntries(
    breakdown.map((entry) => [entry.ingredientId, entry]),
  );

  await db
    .insertInto('recipe_readiness')
    .values({
      recipe_id: recipeId,
      household_id: householdId,
      on_sale_count: onSaleCount,
      in_pantry_count: inPantryCount,
      to_buy_count: toBuyCount,
      readiness_percent: readinessPercent,
      breakdown: JSON.stringify(breakdownByIngredientId),
      computed_at: new Date(),
    })
    .onConflict((conflict) =>
      conflict.column('recipe_id').doUpdateSet((eb) => ({
        on_sale_count: eb.ref('excluded.on_sale_count'),
        in_pantry_count: eb.ref('excluded.in_pantry_count'),
        to_buy_count: eb.ref('excluded.to_buy_count'),
        readiness_percent: eb.ref('excluded.readiness_percent'),
        breakdown: eb.ref('excluded.breakdown'),
        computed_at: eb.ref('excluded.computed_at'),
      })),
    )
    .execute();
}

/**
 * Recomputes every recipe's readiness in one household. A household with no recipes is a no-op,
 * not an error. Builds the household's match candidates and overrides once and reuses them for
 * every recipe, since neither changes across recipes within a single call.
 */
export async function recomputeReadinessForHousehold(
  db: Kysely<Database>,
  householdId: string,
): Promise<void> {
  const recipes = await db
    .selectFrom('recipe')
    .select('id')
    .where('household_id', '=', householdId)
    .execute();
  if (recipes.length === 0) return;

  const context = await buildMatchCandidates(db, householdId);
  const overrides = await listMatchOverridesFor(db, householdId);
  for (const recipe of recipes) {
    await recomputeOne(db, recipe.id, householdId, context, overrides);
  }
}
