/**
 * Ingredient aggregation (Requirements, "Ingredient aggregation"): when more than one recipe
 * contributes the same ingredient to a list, the contributions become one item.
 *
 * - the merge key is `normalized_name`, the key the readiness matcher uses
 * - matching units sum: 1 cup and 2 cups of milk become one item for 3 cups
 * - mismatched units merge into one item that keeps both quantities in `quantity_note`
 *   ("2 cups + 1 lb"), with **no unit conversion ever** (Handoff non-negotiable 20): converting
 *   volume to weight needs per-ingredient density and would produce confident wrong answers
 * - every contributing recipe is recorded, so the item's origin stays visible
 *
 * Phase 3's "Add missing to list" calls this from the recipe side; it is pure so it can be
 * table-tested without a database.
 */

export interface IngredientContribution {
  itemName: string;
  normalizedName: string;
  quantity: number | null;
  unit: string | null;
  recipeId: string;
}

export interface AggregatedIngredient {
  itemName: string;
  normalizedName: string;
  /** Null whenever the units disagree: one number cannot express "2 cups + 1 lb". */
  quantity: number | null;
  quantityNote: string | null;
  contributingRecipeIds: string[];
}

/**
 * Trailing zeros off, and binary-float noise with them, so 1.50 reads as "1.5", 2.00 as "2", and
 * a quarter cup plus a fifth of one as 0.45 rather than 0.45000000000000001.
 */
function exact(quantity: number): number {
  return Number(quantity.toFixed(4));
}

function formatQuantity(quantity: number): string {
  return String(exact(quantity));
}

function describe(contribution: IngredientContribution): string {
  const quantity = contribution.quantity === null ? '' : formatQuantity(contribution.quantity);
  return [quantity, contribution.unit ?? ''].filter((part) => part !== '').join(' ');
}

function merge(contributions: readonly IngredientContribution[]): AggregatedIngredient {
  const first = contributions[0];
  if (first === undefined) throw new Error('an ingredient group is never empty');

  const recipeIds = [...new Set(contributions.map((one) => one.recipeId))];
  const unitsMatch = contributions.every((one) => one.unit === first.unit);

  if (unitsMatch) {
    const quantities = contributions
      .map((one) => one.quantity)
      .filter((quantity) => quantity !== null);
    const summed =
      quantities.length === 0 ? null : exact(quantities.reduce((total, one) => total + one, 0));
    return {
      itemName: first.itemName,
      normalizedName: first.normalizedName,
      quantity: summed,
      // A single contribution with a unit still needs the unit written down somewhere. With no
      // quantity anywhere the unit stands alone, because "0 tsp" is a quantity no recipe gave.
      quantityNote: first.unit === null ? null : describe({ ...first, quantity: summed }),
      contributingRecipeIds: recipeIds,
    };
  }

  const parts = contributions.map(describe).filter((part) => part !== '');
  return {
    itemName: first.itemName,
    normalizedName: first.normalizedName,
    quantity: null,
    quantityNote: parts.length === 0 ? null : parts.join(' + '),
    contributingRecipeIds: recipeIds,
  };
}

/** One item per `normalized_name`, in the order each name was first contributed. */
export function aggregateIngredients(
  contributions: readonly IngredientContribution[],
): AggregatedIngredient[] {
  const groups = new Map<string, IngredientContribution[]>();
  for (const contribution of contributions) {
    const group = groups.get(contribution.normalizedName);
    if (group === undefined) groups.set(contribution.normalizedName, [contribution]);
    else group.push(contribution);
  }
  return [...groups.values()].map(merge);
}
