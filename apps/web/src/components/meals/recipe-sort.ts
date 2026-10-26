import type { Recipe, Suggestion } from '@hestia/shared';

/**
 * `GET /households/:id/recipes` carries no readiness (`recipeSchema` has no readiness field,
 * only `GET /households/:id/suggestions` does, for every recipe including 0% ones). The library
 * still wants readiness on every card, so the two responses are joined client-side by
 * `recipeId` rather than inventing a new field on the recipes endpoint — the simpler option, and
 * one the API surface already supports.
 */
export interface RecipeWithReadiness extends Recipe {
  readinessPercent: number;
  onSaleCount: number;
  inPantryCount: number;
  toBuyCount: number;
}

export function mergeReadiness(
  recipes: readonly Recipe[],
  suggestions: readonly Suggestion[],
): RecipeWithReadiness[] {
  const byId = new Map(suggestions.map((suggestion) => [suggestion.recipeId, suggestion]));
  return recipes.map((recipe) => {
    const match = byId.get(recipe.id);
    return {
      ...recipe,
      readinessPercent: match?.readinessPercent ?? 0,
      onSaleCount: match?.onSaleCount ?? 0,
      inPantryCount: match?.inPantryCount ?? 0,
      toBuyCount: match?.toBuyCount ?? 0,
    };
  });
}

export type LibrarySort = 'recent' | 'title' | 'readiness';

/** Sort by recently added, title, or readiness. */
export function sortRecipes<
  T extends Pick<RecipeWithReadiness, 'title' | 'createdAt' | 'readinessPercent'>,
>(recipes: readonly T[], sort: LibrarySort): T[] {
  const copy = [...recipes];
  if (sort === 'recent') return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (sort === 'title') return copy.sort((a, b) => a.title.localeCompare(b.title));
  return copy.sort(
    (a, b) => b.readinessPercent - a.readinessPercent || a.title.localeCompare(b.title),
  );
}

/** Ranked by readiness descending, ties by title. */
export function sortSuggestions(suggestions: readonly Suggestion[]): Suggestion[] {
  return [...suggestions].sort(
    (a, b) => b.readinessPercent - a.readinessPercent || a.title.localeCompare(b.title),
  );
}
