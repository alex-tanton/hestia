import { parseIngredient } from 'parse-ingredient';

/**
 * Splits one free-text `recipeIngredient` line into quantity, unit, and item name (Requirements,
 * "Recipe library"; Engineering Practices, "Key libraries": `parse-ingredient`, chosen for the
 * Phase 3 ingredient-line parser — see the version pinned in `apps/service/package.json`). Each
 * line is parsed on its own, so one awkward line ("salt and pepper to taste", with nothing
 * parseable) can never affect its neighbours, and the original is always kept as `rawText`
 * regardless of what the library made of it.
 */

export interface ParsedIngredientLine {
  rawText: string;
  itemName: string;
  quantity: number | null;
  unit: string | null;
}

export function parseIngredientLine(rawText: string): ParsedIngredientLine {
  const trimmed = rawText.trim();
  // The library never returns an empty array for a non-empty line; a blank input would, so the
  // caller is expected to have already filtered those out (json-ld.ts's readIngredientLines does).
  const [parsed] = parseIngredient(trimmed);
  const itemName = parsed?.description.trim();
  return {
    rawText,
    itemName: itemName !== undefined && itemName !== '' ? itemName : trimmed,
    quantity: parsed?.quantity ?? null,
    unit: parsed?.unitOfMeasure ?? null,
  };
}

export function parseIngredientLines(rawTexts: readonly string[]): ParsedIngredientLine[] {
  return rawTexts.map(parseIngredientLine);
}
