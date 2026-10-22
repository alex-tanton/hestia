import { describe, expect, it } from 'vitest';
import { aggregateIngredients, type IngredientContribution } from './list-aggregation.js';

const TACOS = '11111111-1111-4111-8111-111111111111';
const SALAD = '22222222-2222-4222-8222-222222222222';
const BURRITOS = '33333333-3333-4333-8333-333333333333';

const from = (
  recipeId: string,
  itemName: string,
  quantity: number | null,
  unit: string | null,
): IngredientContribution => ({
  itemName,
  normalizedName: itemName.toLowerCase(),
  quantity,
  unit,
  recipeId,
});

describe('ingredient aggregation', () => {
  it('leaves a single contribution alone', () => {
    expect(aggregateIngredients([from(TACOS, 'celery', 1, null)])).toEqual([
      {
        itemName: 'celery',
        normalizedName: 'celery',
        quantity: 1,
        quantityNote: null,
        contributingRecipeIds: [TACOS],
      },
    ]);
  });

  it('sums matching units, as the seed data’s red onion does', () => {
    expect(
      aggregateIngredients([from(TACOS, 'red onion', 1, null), from(SALAD, 'red onion', 1, null)]),
    ).toEqual([
      {
        itemName: 'red onion',
        normalizedName: 'red onion',
        quantity: 2,
        quantityNote: null,
        contributingRecipeIds: [TACOS, SALAD],
      },
    ]);
  });

  it('sums matching named units and writes the unit into the note', () => {
    expect(
      aggregateIngredients([from(TACOS, 'milk', 1, 'cup'), from(SALAD, 'milk', 2, 'cup')]),
    ).toEqual([
      {
        itemName: 'milk',
        normalizedName: 'milk',
        quantity: 3,
        quantityNote: '3 cup',
        contributingRecipeIds: [TACOS, SALAD],
      },
    ]);
  });

  it('keeps both quantities when the units differ, converting nothing', () => {
    expect(
      aggregateIngredients([from(TACOS, 'salsa', 1, 'cup'), from(BURRITOS, 'salsa', 16, 'oz')]),
    ).toEqual([
      {
        itemName: 'salsa',
        normalizedName: 'salsa',
        quantity: null,
        quantityNote: '1 cup + 16 oz',
        contributingRecipeIds: [TACOS, BURRITOS],
      },
    ]);
  });

  it('treats a missing unit as a unit of its own rather than guessing', () => {
    const [merged] = aggregateIngredients([
      from(TACOS, 'onion', 2, null),
      from(SALAD, 'onion', 1, 'lb'),
    ]);
    expect(merged?.quantity).toBeNull();
    expect(merged?.quantityNote).toBe('2 + 1 lb');
  });

  it('merges three recipes and records each once', () => {
    const [merged] = aggregateIngredients([
      from(TACOS, 'cheese', 1, 'cup'),
      from(SALAD, 'cheese', 8, 'oz'),
      from(BURRITOS, 'cheese', 2, 'cup'),
      from(BURRITOS, 'cheese', 1, 'cup'),
    ]);
    expect(merged?.quantityNote).toBe('1 cup + 8 oz + 2 cup + 1 cup');
    expect(merged?.contributingRecipeIds).toEqual([TACOS, SALAD, BURRITOS]);
  });

  it('merges only on the normalized name, and keeps first-seen order', () => {
    const contributions = [
      { ...from(TACOS, 'Red Onions', 1, null), normalizedName: 'red onion' },
      { ...from(SALAD, 'red onion', 1, null), normalizedName: 'red onion' },
      { ...from(SALAD, 'Cucumbers', 1, null), normalizedName: 'cucumber' },
    ];
    const aggregated = aggregateIngredients(contributions);
    expect(aggregated.map((one) => one.normalizedName)).toEqual(['red onion', 'cucumber']);
    // The first contribution's name is the one the shopper sees.
    expect(aggregated[0]?.itemName).toBe('Red Onions');
    expect(aggregated[0]?.quantity).toBe(2);
  });

  it('keeps a null quantity null rather than inventing a count', () => {
    expect(
      aggregateIngredients([from(TACOS, 'salt', null, null), from(SALAD, 'salt', null, null)]),
    ).toEqual([
      {
        itemName: 'salt',
        normalizedName: 'salt',
        quantity: null,
        quantityNote: null,
        contributingRecipeIds: [TACOS, SALAD],
      },
    ]);
  });

  it('names the unit alone when a unit arrives with no quantity', () => {
    expect(aggregateIngredients([from(TACOS, 'salt', null, 'tsp')])).toEqual([
      {
        itemName: 'salt',
        normalizedName: 'salt',
        quantity: null,
        quantityNote: 'tsp',
        contributingRecipeIds: [TACOS],
      },
    ]);
  });

  it('sums fractions to the quantity its note reads, not to a float’s tail', () => {
    const [merged] = aggregateIngredients([
      from(TACOS, 'oil', 0.1, 'cup'),
      from(SALAD, 'oil', 0.2, 'cup'),
    ]);
    expect(merged?.quantity).toBe(0.3);
    expect(merged?.quantityNote).toBe('0.3 cup');
  });

  it('formats fractional quantities without trailing zeros', () => {
    const [merged] = aggregateIngredients([
      from(TACOS, 'butter', 0.5, 'cup'),
      from(SALAD, 'butter', 2, 'tbsp'),
    ]);
    expect(merged?.quantityNote).toBe('0.5 cup + 2 tbsp');
  });

  it('aggregates nothing into nothing', () => {
    expect(aggregateIngredients([])).toEqual([]);
  });
});
