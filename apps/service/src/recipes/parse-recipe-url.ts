import type { ParseRecipeResponse } from '@hearth/shared';
import { parseIngredientLine } from './ingredient-parser.js';
import { extractRecipeJsonLd } from './json-ld.js';

/**
 * Ties the fetch, the JSON-LD extraction, and the ingredient-line split together into the
 * parse-and-preview result the route returns (Technical Architecture, "Recipe fetching"). Nothing
 * here saves anything — the caller (a `recipes/parse` route) hands the result back for the user
 * to review and edit, and a separate save call persists what they confirm.
 */
export async function parseRecipeUrl(
  url: string,
  fetchPage: (url: string) => Promise<{ body: string }>,
): Promise<ParseRecipeResponse> {
  const page = await fetchPage(url);
  const extracted = extractRecipeJsonLd(page.body);
  if (extracted === undefined) {
    return {
      needsManualEntry: true,
      sourceUrl: url,
      title: null,
      instructions: null,
      servings: null,
      ingredients: [],
    };
  }
  return {
    needsManualEntry: false,
    sourceUrl: url,
    title: extracted.title,
    instructions: extracted.instructions,
    servings: extracted.servings,
    ingredients: extracted.ingredientLines.map(parseIngredientLine),
  };
}
