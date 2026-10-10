import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extractRecipeJsonLd } from './json-ld.js';

/**
 * JSON-LD extraction over the Seed Data fixture set (Seed Data, "Recipe sources"): full markup,
 * none at all, partial markup, and awkward ingredient lines. These are local fixtures under
 * `fixtures/`, never a live URL — the parser is exercised on saved HTML, not the network.
 */
function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');
}

describe('extractRecipeJsonLd', () => {
  it('extracts title, instructions, servings, and ingredient lines from full JSON-LD', () => {
    const extracted = extractRecipeJsonLd(fixture('full-json-ld.html'));
    expect(extracted).toBeDefined();
    expect(extracted?.title).toBe('Weeknight Sheet Pan Chicken');
    expect(extracted?.servings).toBe(4);
    expect(extracted?.instructions).toBe(
      [
        'Preheat the oven to 425°F.',
        'Toss the chicken and vegetables with oil and spices.',
        'Spread on a sheet pan and roast 25 minutes.',
        'Squeeze lemon over everything before serving.',
      ].join('\n'),
    );
    expect(extracted?.ingredientLines).toEqual([
      '2 lb boneless chicken breast',
      '1 lb broccoli florets',
      '1 red bell pepper, sliced',
      '2 tbsp olive oil',
      '3 cloves garlic, minced',
      '1 tsp smoked paprika',
      '1 lemon, quartered',
    ]);
  });

  it('returns undefined for a page with no JSON-LD Recipe node at all', () => {
    expect(extractRecipeJsonLd(fixture('no-json-ld.html'))).toBeUndefined();
  });

  it('leaves instructions null when the markup never included them', () => {
    const extracted = extractRecipeJsonLd(fixture('partial-json-ld.html'));
    expect(extracted).toBeDefined();
    expect(extracted?.title).toBe('Quick Greek Salad');
    expect(extracted?.instructions).toBeNull();
    expect(extracted?.servings).toBeNull();
    expect(extracted?.ingredientLines).toHaveLength(7);
  });

  it('extracts the awkward ingredient lines verbatim, for the parser to split', () => {
    const extracted = extractRecipeJsonLd(fixture('awkward-lines.html'));
    expect(extracted).toBeDefined();
    expect(extracted?.servings).toBe(6);
    expect(extracted?.ingredientLines).toEqual([
      '1 (14.5 oz) can diced tomatoes, drained',
      'salt and pepper to taste',
      '2-3 cloves garlic',
      'a splash of red wine',
      '1 lb ground beef',
      '1/2 cup grated parmesan, plus more for serving',
    ]);
  });

  it('reads a Recipe node nested in @graph', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'Example' },
        {
          '@type': 'Recipe',
          name: 'Graph Recipe',
          recipeIngredient: ['1 cup rice'],
          recipeInstructions: 'Cook the rice.',
        },
      ],
    })}</script>`;
    const extracted = extractRecipeJsonLd(html);
    expect(extracted?.title).toBe('Graph Recipe');
    expect(extracted?.ingredientLines).toEqual(['1 cup rice']);
  });

  it('flattens nested HowToSection steps and a multi-type @type array', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': ['Recipe', 'NewsArticle'],
      name: 'Sectioned Recipe',
      recipeIngredient: ['1 egg'],
      recipeInstructions: [
        {
          '@type': 'HowToSection',
          name: 'Prep',
          itemListElement: [
            { '@type': 'HowToStep', text: 'Crack the egg.' },
            { '@type': 'HowToStep', text: 'Beat it.' },
          ],
        },
      ],
    })}</script>`;
    const extracted = extractRecipeJsonLd(html);
    expect(extracted?.instructions).toBe('Crack the egg.\nBeat it.');
  });

  it('skips a malformed JSON-LD block rather than failing the whole page', () => {
    const html = `
      <script type="application/ld+json">{ not valid json </script>
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'Recipe',
        name: 'Still Found',
        recipeIngredient: [],
      })}</script>
    `;
    expect(extractRecipeJsonLd(html)?.title).toBe('Still Found');
  });

  it('reads a numeric recipeYield directly', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Recipe',
      name: 'Numeric Yield',
      recipeYield: 6,
      recipeIngredient: [],
    })}</script>`;
    expect(extractRecipeJsonLd(html)?.servings).toBe(6);
  });

  it('ignores a node whose @type is neither a string nor an array (not a Recipe)', () => {
    // hasRecipeType's fallback: @type present but of some other shape entirely (here, a number),
    // which is neither of the two shapes schema.org actually uses. Falls through to "no Recipe
    // node found" rather than throwing, the same as a page with no JSON-LD at all.
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 42,
      name: 'Not Actually A Recipe',
      recipeIngredient: ['1 cup rice'],
    })}</script>`;
    expect(extractRecipeJsonLd(html)).toBeUndefined();
  });

  it('reads the first usable recipeYield out of an array, skipping an unusable leading entry', () => {
    // readServings' array branch recurses per entry and returns the first that parses; a leading
    // entry with no digits (readServings returns null for it) must not short-circuit the whole
    // field to null when a later entry is usable.
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Recipe',
      name: 'Array Yield',
      recipeYield: ['', '8 servings'],
      recipeIngredient: [],
    })}</script>`;
    expect(extractRecipeJsonLd(html)?.servings).toBe(8);
  });
});
