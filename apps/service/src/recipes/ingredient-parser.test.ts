import { describe, expect, it } from 'vitest';
import { parseIngredientLine, parseIngredientLines } from './ingredient-parser.js';

/**
 * The ingredient-line parser (Requirements, "Recipe library"; Seed Data, "Recipe sources": the
 * awkward-lines fixture). `parse-ingredient` 3.0.0 does the actual splitting; these are the real
 * forms Seed Data and everyday recipe pages produce, plus the parser's own edge cases.
 */
describe('parseIngredientLine', () => {
  it.each([
    // The three named awkward lines (Seed Data, "Recipe sources").
    {
      rawText: '1 (14.5 oz) can diced tomatoes, drained',
      quantity: 1,
      unit: null,
      itemName: '(14.5 oz) can diced tomatoes, drained',
    },
    {
      rawText: 'salt and pepper to taste',
      quantity: null,
      unit: null,
      itemName: 'salt and pepper to taste',
    },
    { rawText: '2-3 cloves garlic', quantity: 2, unit: 'cloves', itemName: 'garlic' },
    // Ordinary forms a real ingredient list is mostly made of.
    {
      rawText: '2 cups chopped yellow onion',
      quantity: 2,
      unit: 'cups',
      itemName: 'chopped yellow onion',
    },
    { rawText: '1 1/2 cups sugar', quantity: 1.5, unit: 'cups', itemName: 'sugar' },
    { rawText: '1/2 tsp salt', quantity: 0.5, unit: 'tsp', itemName: 'salt' },
    { rawText: '1 lb ground beef', quantity: 1, unit: 'lb', itemName: 'ground beef' },
    { rawText: '3 large eggs', quantity: 3, unit: 'large', itemName: 'eggs' },
    { rawText: 'Garlic powder', quantity: null, unit: null, itemName: 'Garlic powder' },
  ])('splits "$rawText"', ({ rawText, quantity, unit, itemName }) => {
    expect(parseIngredientLine(rawText)).toEqual({ rawText, quantity, unit, itemName });
  });

  it('keeps the original line as rawText even when nothing else parses', () => {
    const result = parseIngredientLine('  a splash of red wine  ');
    expect(result.rawText).toBe('  a splash of red wine  ');
    expect(result.quantity).toBeNull();
    expect(result.itemName).toBe('a splash of red wine');
  });

  it('parses a batch independently, line by line', () => {
    const lines = ['2 cups flour', 'salt and pepper to taste', '1 tsp baking soda'];
    expect(parseIngredientLines(lines)).toEqual([
      { rawText: '2 cups flour', quantity: 2, unit: 'cups', itemName: 'flour' },
      {
        rawText: 'salt and pepper to taste',
        quantity: null,
        unit: null,
        itemName: 'salt and pepper to taste',
      },
      { rawText: '1 tsp baking soda', quantity: 1, unit: 'tsp', itemName: 'baking soda' },
    ]);
  });
});
