import type { Recipe, ReadinessBucket } from '@hearth/shared';

/**
 * The words readiness and the week planner are shown and announced with. Copy lives here, rather
 * than in each component, so the visible fragments and the accessible sentence can never drift
 * apart (plain, brief, never cute).
 */

export const BUCKET_LABEL: Readonly<Record<ReadinessBucket, string>> = {
  on_sale: 'On sale',
  in_pantry: 'In pantry',
  to_buy: 'To buy',
};

/**
 * Readiness is announced as "4 of 5 ingredients ready", not
 * just a number; the ring itself is `aria-hidden` and this sentence carries the meaning.
 */
export function readinessSentence(readyCount: number, total: number): string {
  return `${String(readyCount)} of ${String(total)} ingredients ready`;
}

/**
 * The breakdown reads "4 of 5 ready — 2 on sale, 2 in pantry, 1 to buy". Every bucket is named,
 * even at zero, so the sentence always accounts for the whole ingredient list.
 */
export function breakdownLine(
  onSaleCount: number,
  inPantryCount: number,
  toBuyCount: number,
): string {
  const total = onSaleCount + inPantryCount + toBuyCount;
  const ready = onSaleCount + inPantryCount;
  return (
    `${String(ready)} of ${String(total)} ready — ${String(onSaleCount)} on sale, ` +
    `${String(inPantryCount)} in pantry, ${String(toBuyCount)} to buy`
  );
}

export const RECIPE_LIBRARY_EMPTY_COPY = 'No recipes yet. Paste a link or add one by hand.';
export const RECIPE_LIBRARY_NO_MATCH_COPY = 'No recipes match that search.';

export const PARSE_FAILED_COPY = "Couldn't read that page. Add it by hand?";
/** A parse that succeeded but is incomplete: flag it rather than save silently. */
export const PARSE_INCOMPLETE_COPY =
  "That page didn't have everything. Fill in what's missing before saving.";

/** A destructive confirmation names the consequence. */
export function deleteRecipeConfirmation(recipe: Pick<Recipe, 'title'>): string {
  return `Delete ${recipe.title}? Planned meals keep its name.`;
}

export const SUGGESTIONS_EMPTY_COPY = 'No recipes yet. Add one to see what you can make this week.';
export const SUGGESTIONS_NO_DEALS_COPY = "Suggestions need this week's deals.";

export const PLANNER_PAST_WEEK_COPY = 'This week is history — placed meals are read-only.';

/** A deleted recipe's snapshot entry: no readiness, no link. */
export const DELETED_RECIPE_NOTE = 'This recipe was deleted.';

export function mealTypeLabel(mealType: 'breakfast' | 'lunch' | 'dinner'): string {
  return mealType === 'breakfast' ? 'Breakfast' : mealType === 'lunch' ? 'Lunch' : 'Dinner';
}
