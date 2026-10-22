import * as cheerio from 'cheerio';

/**
 * Extracts schema.org `Recipe` markup from a page's JSON-LD. `cheerio` only locates the `<script
 * type="application/ld+json">` blocks; the JSON-LD itself is parsed directly with `JSON.parse`.
 */

export interface ExtractedRecipe {
  title: string | null;
  instructions: string | null;
  servings: number | null;
  /** Raw `recipeIngredient` lines, in document order, not yet split into quantity/unit/name. */
  ingredientLines: string[];
}

type JsonValue = unknown;

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** JSON-LD nests real nodes inside `@graph` (a common pattern) or ships a bare array of nodes. */
function collectNodes(value: JsonValue, into: Record<string, JsonValue>[]): void {
  if (Array.isArray(value)) {
    for (const entry of value) collectNodes(entry, into);
    return;
  }
  if (!isRecord(value)) return;
  const graph = value['@graph'];
  if (Array.isArray(graph)) {
    collectNodes(graph, into);
    return;
  }
  into.push(value);
}

function hasRecipeType(node: Record<string, JsonValue>): boolean {
  const type = node['@type'];
  if (typeof type === 'string') return type === 'Recipe';
  if (Array.isArray(type)) return type.includes('Recipe');
  return false;
}

function readTitle(node: Record<string, JsonValue>): string | null {
  const name = node['name'];
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed === '' ? null : trimmed;
}

/**
 * `recipeInstructions` is one of the least consistent fields in the wild: a single string, an
 * array of strings, an array of `HowToStep` objects, or `HowToSection`s that nest steps inside
 * `itemListElement`. Every shape flattens to the same joined, numbered-by-the-source-order text.
 */
function flattenInstructionText(value: JsonValue): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? [] : [trimmed];
  }
  if (Array.isArray(value)) return value.flatMap(flattenInstructionText);
  if (isRecord(value)) {
    const text = value['text'];
    if (typeof text === 'string') return flattenInstructionText(text);
    const items = value['itemListElement'];
    if (Array.isArray(items)) return flattenInstructionText(items);
  }
  return [];
}

function readInstructions(node: Record<string, JsonValue>): string | null {
  const lines = flattenInstructionText(node['recipeInstructions']);
  return lines.length === 0 ? null : lines.join('\n');
}

/** `recipeYield` is free text ("4 servings", "Serves 4-6", a bare number, or an array of either). */
function readServings(value: JsonValue): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const match = /\d+/.exec(value);
    if (match === null) return null;
    const parsed = Number(match[0]);
    return parsed > 0 ? parsed : null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const servings = readServings(entry);
      if (servings !== null) return servings;
    }
  }
  return null;
}

function readIngredientLines(node: Record<string, JsonValue>): string[] {
  const raw = node['recipeIngredient'];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

/** Undefined means no usable `Recipe` node was found — the caller's cue for "needs manual entry". */
export function extractRecipeJsonLd(html: string): ExtractedRecipe | undefined {
  const $ = cheerio.load(html);
  const nodes: Record<string, JsonValue>[] = [];
  $('script[type="application/ld+json"]').each((_index, element) => {
    const text = $(element).html();
    if (text === null || text.trim() === '') return;
    try {
      collectNodes(JSON.parse(text) as JsonValue, nodes);
    } catch {
      // Malformed JSON-LD shows up on real sites; skip that one block, not the whole page.
    }
  });

  const recipeNode = nodes.find(hasRecipeType);
  if (recipeNode === undefined) return undefined;

  return {
    title: readTitle(recipeNode),
    instructions: readInstructions(recipeNode),
    servings: readServings(recipeNode['recipeYield']),
    ingredientLines: readIngredientLines(recipeNode),
  };
}
