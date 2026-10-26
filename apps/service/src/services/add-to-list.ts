import { sql, type Kysely } from 'kysely';
import { matchIngredient } from '@hestia/matching';
import type { ShoppingListDetail } from '@hestia/shared';
import type { Database } from '../db.js';
import { aggregateIngredients, type IngredientContribution } from './list-aggregation.js';
import { detailOf, refreshed, requireList } from './lists.js';
import { buildMatchCandidates, listMatchOverridesFor } from './matching-candidates.js';
import type { DroppedCopyReport } from '../notifications/copy.js';
import { recordListActivity } from './list-activity.js';
import { toNumber } from './money.js';

/*
 * "Add missing to list": one converging function behind all three entry points (a recipe, a planned
 * meal, a whole planned week) — only the list of recipe ids differs per caller, and duplicates are
 * deliberate (a recipe planned twice contributes its ingredients twice; "cook it twice, buy it
 * twice").
 */

export async function addMissingIngredientsToList(
  db: Kysely<Database>,
  listId: string,
  recipeIds: readonly string[],
  userId: string,
  report?: DroppedCopyReport,
): Promise<ShoppingListDetail> {
  const list = await requireList(db, listId);
  const householdId = list.household_id;

  // "Already on the list" is read before anything is written, so two overlapping calls for one
  // list (a retry that arrives while the first request is still running, or two members adding
  // together) would each see an empty list and each add every ingredient. Serialising them per
  // list makes the second call read the first one's rows. The lock is transaction-scoped, so it
  // is released when this request's transaction ends. It is always taken before
  // `recordListActivity`'s own list-activity lock, which fixes the order between the two.
  await sql`select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(${`add-to-list:${listId}`}, 0))`.execute(
    db,
  );

  const existingItems = await db
    .selectFrom('shopping_list_item')
    .select('normalized_name')
    .where('list_id', '=', listId)
    .where('status', 'in', ['needed', 'in_cart'])
    .execute();
  const existingNormalizedNames = new Set(existingItems.map((item) => item.normalized_name));

  // Built once for the whole call: matching is a pure function of the household's current
  // candidates and overrides, both fixed here, so a given normalized_name always lands in the
  // same bucket no matter which recipe contributed it — there is no cross-group collision to
  // reconcile when the two groups are aggregated separately below.
  const context = await buildMatchCandidates(db, householdId);
  const overrides = await listMatchOverridesFor(db, householdId);

  const onSaleContributions: IngredientContribution[] = [];
  const toBuyContributions: IngredientContribution[] = [];
  const dealIdByNormalizedName = new Map<string, string>();

  for (const recipeId of recipeIds) {
    const ingredients = await db
      .selectFrom('recipe_ingredient')
      .select(['item_name', 'normalized_name', 'quantity', 'unit'])
      .where('recipe_id', '=', recipeId)
      .execute();

    for (const ingredient of ingredients) {
      if (existingNormalizedNames.has(ingredient.normalized_name)) continue;
      const result = matchIngredient(ingredient.normalized_name, context.candidates, overrides);
      if (result.matched && result.candidate?.targetKind === 'pantry') continue;

      const contribution: IngredientContribution = {
        itemName: ingredient.item_name,
        normalizedName: ingredient.normalized_name,
        quantity: toNumber(ingredient.quantity),
        unit: ingredient.unit,
        recipeId,
      };

      if (result.matched && result.candidate?.targetKind === 'deal') {
        dealIdByNormalizedName.set(ingredient.normalized_name, result.candidate.id);
        onSaleContributions.push(contribution);
      } else {
        toBuyContributions.push(contribution);
      }
    }
  }

  // Items actually written, which is what a batch of list activity counts.
  let added = 0;
  for (const aggregated of aggregateIngredients(onSaleContributions)) {
    const dealId = dealIdByNormalizedName.get(aggregated.normalizedName);
    const deal = dealId === undefined ? undefined : context.dealsById.get(dealId);
    // Should not happen (the deal that decided the match is the one just read); defensive only.
    if (deal === undefined) continue;
    await db
      .insertInto('shopping_list_item')
      .values({
        list_id: listId,
        added_by: userId,
        // The ingredient's own name, not the deal's product name: a recipe-sourced item stays named
        // after the ingredient even though its price/store/validity is the matched deal's.
        item_name: aggregated.itemName,
        normalized_name: aggregated.normalizedName,
        quantity: aggregated.quantity,
        quantity_note: aggregated.quantityNote,
        contributing_recipe_ids: aggregated.contributingRecipeIds,
        source: 'from_recipe',
        merchant_id: deal.merchant_id,
        merchant_name: deal.merchant_name,
        deal_external_id: deal.external_id,
        sale_price: deal.unit_price,
        regular_price: deal.original_price,
        deal_valid_to: deal.valid_to,
        price_unit: deal.price_unit,
        conditional_price: deal.conditional_price,
        price: deal.unit_price,
      })
      .execute();
    added += 1;
  }

  for (const aggregated of aggregateIngredients(toBuyContributions)) {
    await db
      .insertInto('shopping_list_item')
      .values({
        list_id: listId,
        added_by: userId,
        item_name: aggregated.itemName,
        normalized_name: aggregated.normalizedName,
        quantity: aggregated.quantity,
        quantity_note: aggregated.quantityNote,
        contributing_recipe_ids: aggregated.contributingRecipeIds,
        source: 'from_recipe',
        merchant_id: null,
        merchant_name: null,
        deal_external_id: null,
        sale_price: null,
        regular_price: null,
        deal_valid_to: null,
        price_unit: 'each',
        conditional_price: false,
        price: null,
      })
      .execute();
    added += 1;
  }

  await recordListActivity(db, list, userId, added, new Date(), report);
  return detailOf(db, await refreshed(db, list));
}
