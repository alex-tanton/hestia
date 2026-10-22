import { describe, expect, it } from 'vitest';
import { computeReadinessPercent } from './readiness.js';

/*
 * Readiness math (equal weighting, half-up rounding, 0% for a recipe with no ingredients). Pure, so
 * the rounding rule is table-tested without a database.
 */
describe('computeReadinessPercent', () => {
  it('is 0% for a recipe with no ingredients', () => {
    expect(computeReadinessPercent(0, 0, 0)).toBe(0);
  });

  it('weighs on-sale and in-pantry ingredients equally', () => {
    // 3 on sale, 3 in pantry, 1 to buy, of 7 — matches Sheet Pan Chicken and Vegetables in
    // the seed data: 6 of 7, 86%.
    expect(computeReadinessPercent(3, 3, 7)).toBe(86);
  });

  it('rounds half-up', () => {
    // 5 of 9 = 55.55...%, rounds up to 56% (Chicken Noodle Soup in the seed data).
    expect(computeReadinessPercent(2, 3, 9)).toBe(56);
    // 1 of 8 = 12.5%, half-up rounds to 13%, not banker's-rounds to 12%.
    expect(computeReadinessPercent(1, 0, 8)).toBe(13);
    // A clean fraction stays clean: 5 of 5 = 100%.
    expect(computeReadinessPercent(1, 4, 5)).toBe(100);
  });

  it('is 0% when nothing matches', () => {
    expect(computeReadinessPercent(0, 0, 8)).toBe(0);
  });
});
