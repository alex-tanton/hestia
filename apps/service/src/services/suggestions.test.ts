import { describe, expect, it } from 'vitest';
import type { Suggestion } from '@hestia/shared';
import { rankByReadiness } from './suggestions.js';

function suggestion(title: string, readinessPercent: number): Suggestion {
  return {
    recipeId: title,
    title,
    readinessPercent,
    onSaleCount: 0,
    inPantryCount: 0,
    toBuyCount: 0,
  };
}

/*
 * Ranking (the Rivera Family recipes both score 0% and are ranked by title). Pure and exported so
 * the tiebreak rule is table-tested without a database.
 */
describe('rankByReadiness', () => {
  it('orders readiness descending', () => {
    const ranked = rankByReadiness([
      suggestion('Shrimp Pad Thai', 0),
      suggestion('Grilled Cheese and Tomato Soup', 100),
      suggestion('Sunday Pot Roast', 50),
    ]);
    expect(ranked.map((one) => one.title)).toEqual([
      'Grilled Cheese and Tomato Soup',
      'Sunday Pot Roast',
      'Shrimp Pad Thai',
    ]);
  });

  it('keeps recipes tied at the same readiness in their given (title-ascending) order', () => {
    const ranked = rankByReadiness([suggestion('Miso Soup', 0), suggestion('Tuna Poke Bowl', 0)]);
    expect(ranked.map((one) => one.title)).toEqual(['Miso Soup', 'Tuna Poke Bowl']);
  });

  it('does not mutate its input', () => {
    const input = [suggestion('B', 0), suggestion('A', 100)];
    rankByReadiness(input);
    expect(input.map((one) => one.title)).toEqual(['B', 'A']);
  });
});
