import { describe, expect, it } from 'vitest';
import { updatePantryItemRequestSchema } from './pantry.js';

/**
 * updatePantryItemRequestSchema's refine is never exercised with real data elsewhere (contract.ts
 * only converts it to JSON Schema), so the "change at least one field" predicate has never run.
 */
describe('updatePantryItemRequestSchema', () => {
  it('refuses an empty PATCH', () => {
    expect(updatePantryItemRequestSchema.safeParse({}).success).toBe(false);
  });

  it('accepts renaming the item alone', () => {
    expect(updatePantryItemRequestSchema.safeParse({ itemName: 'Oat milk' }).success).toBe(true);
  });

  it('accepts clearing the quantity note alone', () => {
    expect(updatePantryItemRequestSchema.safeParse({ quantityNote: null }).success).toBe(true);
  });
});
