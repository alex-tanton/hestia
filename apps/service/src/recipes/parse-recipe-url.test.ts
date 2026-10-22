import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseRecipeUrl } from './parse-recipe-url.js';

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');
}

function fakeFetch(body: string): (url: string) => Promise<{ body: string }> {
  return () => Promise.resolve({ body });
}

/**
 * The parse-and-preview result the `recipes/parse` route sends back: a successful fetch with usable
 * JSON-LD comes back split into an editable preview; one with none comes back as a clear "needs
 * manual entry" result, never a thrown error.
 */
describe('parseRecipeUrl', () => {
  it('returns a full preview, with ingredient lines already split, for usable JSON-LD', async () => {
    const result = await parseRecipeUrl(
      'https://example.com/recipe',
      fakeFetch(fixture('full-json-ld.html')),
    );
    expect(result.needsManualEntry).toBe(false);
    expect(result.sourceUrl).toBe('https://example.com/recipe');
    expect(result.title).toBe('Weeknight Sheet Pan Chicken');
    expect(result.servings).toBe(4);
    expect(result.ingredients).toHaveLength(7);
    expect(result.ingredients[0]).toEqual({
      rawText: '2 lb boneless chicken breast',
      quantity: 2,
      unit: 'lb',
      itemName: 'boneless chicken breast',
    });
  });

  it('reports needsManualEntry, with nothing to preview, when there is no JSON-LD at all', async () => {
    const result = await parseRecipeUrl(
      'https://example.com/notes',
      fakeFetch(fixture('no-json-ld.html')),
    );
    expect(result).toEqual({
      needsManualEntry: true,
      sourceUrl: 'https://example.com/notes',
      title: null,
      instructions: null,
      servings: null,
      ingredients: [],
    });
  });

  it('is not a manual-entry result when the markup is merely incomplete', async () => {
    const result = await parseRecipeUrl(
      'https://example.com/salad',
      fakeFetch(fixture('partial-json-ld.html')),
    );
    expect(result.needsManualEntry).toBe(false);
    expect(result.title).toBe('Quick Greek Salad');
    expect(result.instructions).toBeNull();
    expect(result.ingredients).toHaveLength(7);
  });

  it('splits the awkward ingredient lines into an editable preview', async () => {
    const result = await parseRecipeUrl(
      'https://example.com/sauce',
      fakeFetch(fixture('awkward-lines.html')),
    );
    expect(result.ingredients).toContainEqual({
      rawText: '1 (14.5 oz) can diced tomatoes, drained',
      quantity: 1,
      unit: null,
      itemName: '(14.5 oz) can diced tomatoes, drained',
    });
    expect(result.ingredients).toContainEqual({
      rawText: 'salt and pepper to taste',
      quantity: null,
      unit: null,
      itemName: 'salt and pepper to taste',
    });
    expect(result.ingredients).toContainEqual({
      rawText: '2-3 cloves garlic',
      quantity: 2,
      unit: 'cloves',
      itemName: 'garlic',
    });
  });
});
