import { sql, type Kysely } from 'kysely';
import type { Suggestion, SuggestionsResponse } from '@hearth/shared';
import type { Database } from '../db.js';

/**
 * Deal-matched suggestions (Requirements, "Deal-matched suggestions"; Design, "13. Deal-matched
 * suggestions"). Every household recipe, ranked by readiness, alongside the deal data's own
 * as-of date. `dealsAsOf` null (no deal rows at all for the household's postal code) is what the
 * UI reads as "no deals available", so the response needs no separate boolean flag for it.
 */
export type SuggestionsResult = SuggestionsResponse;

/**
 * Readiness descending, title ascending among ties (Seed Data: "ranked by title" for the
 * all-0%-scored case). `Array.prototype.sort` is stable, so recipes tied on readiness keep
 * whatever title-ascending order the caller already gave them — pure and exported for a unit test
 * that needs no database.
 */
export function rankByReadiness(recipes: readonly Suggestion[]): Suggestion[] {
  return [...recipes].sort((left, right) => right.readinessPercent - left.readinessPercent);
}

export async function getSuggestions(
  db: Kysely<Database>,
  householdId: string,
): Promise<SuggestionsResult> {
  const household = await db
    .selectFrom('household')
    .select('postal_code')
    .where('id', '=', householdId)
    .executeTakeFirst();

  const rows = await db
    .selectFrom('recipe')
    .leftJoin('recipe_readiness', 'recipe_readiness.recipe_id', 'recipe.id')
    .select([
      'recipe.id as recipe_id',
      'recipe.title as title',
      'recipe_readiness.readiness_percent as readiness_percent',
      'recipe_readiness.on_sale_count as on_sale_count',
      'recipe_readiness.in_pantry_count as in_pantry_count',
      'recipe_readiness.to_buy_count as to_buy_count',
    ])
    .where('recipe.household_id', '=', householdId)
    .orderBy('recipe.title')
    .orderBy('recipe.id')
    .execute();

  const recipes = rankByReadiness(
    rows.map((row) => ({
      recipeId: row.recipe_id,
      title: row.title,
      // Coalesced to 0 for a recipe whose readiness has never been computed — defensive only,
      // since every recipe write recomputes it inline.
      readinessPercent: row.readiness_percent ?? 0,
      onSaleCount: row.on_sale_count ?? 0,
      inPantryCount: row.in_pantry_count ?? 0,
      toBuyCount: row.to_buy_count ?? 0,
    })),
  );

  let dealsAsOf: string | null = null;
  if (household !== undefined) {
    const { rows: dealRows } = await sql<{ deals_as_of: Date | null }>`
      select max(fetched_at) as deals_as_of from public.deal where postal_code = ${household.postal_code}
    `.execute(db);
    const newest = dealRows[0]?.deals_as_of ?? null;
    dealsAsOf = newest === null ? null : new Date(newest).toISOString();
  }

  return { recipes, dealsAsOf };
}
