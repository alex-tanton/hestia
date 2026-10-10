import { describe, expect, it } from 'vitest';
import { createListItemRequestSchema, updateListItemRequestSchema } from './lists.js';

/**
 * Both schemas below route through the shared `storePair` helper via `.refine`, and neither is
 * ever safeParse()d with real data outside this file (contract.ts only converts them to JSON
 * Schema), so storePair and both refine predicates have never run.
 */
describe('createListItemRequestSchema: manual item store pairing', () => {
  it('accepts a manual item with neither a store id nor a store name', () => {
    expect(
      createListItemRequestSchema.safeParse({ source: 'manual', itemName: 'Chicken breast' })
        .success,
    ).toBe(true);
  });

  it('accepts a manual item with both a store id and a store name', () => {
    expect(
      createListItemRequestSchema.safeParse({
        source: 'manual',
        itemName: 'Chicken breast',
        merchantId: 'lowes',
        merchantName: 'Lowes Foods',
      }).success,
    ).toBe(true);
  });

  it('refuses a store id with no store name', () => {
    expect(
      createListItemRequestSchema.safeParse({
        source: 'manual',
        itemName: 'Chicken breast',
        merchantId: 'lowes',
      }).success,
    ).toBe(false);
  });

  it('refuses a store name with no store id', () => {
    expect(
      createListItemRequestSchema.safeParse({
        source: 'manual',
        itemName: 'Chicken breast',
        merchantName: 'Lowes Foods',
      }).success,
    ).toBe(false);
  });

  it('accepts a from_deal item, which carries no store fields at all', () => {
    const dealId = '3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b';
    expect(createListItemRequestSchema.safeParse({ source: 'from_deal', dealId }).success).toBe(
      true,
    );
  });
});

describe('updateListItemRequestSchema', () => {
  it('refuses an empty PATCH', () => {
    expect(updateListItemRequestSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a PATCH that only changes status', () => {
    expect(updateListItemRequestSchema.safeParse({ status: 'bought' }).success).toBe(true);
  });

  it('accepts clearing both store fields together with null', () => {
    expect(
      updateListItemRequestSchema.safeParse({ merchantId: null, merchantName: null }).success,
    ).toBe(true);
  });

  it('accepts setting both store fields together', () => {
    expect(
      updateListItemRequestSchema.safeParse({ merchantId: 'lowes', merchantName: 'Lowes Foods' })
        .success,
    ).toBe(true);
  });

  it('refuses setting a store id while leaving merchantName absent entirely', () => {
    // The second refine requires merchantId and merchantName to be present/absent together, not
    // merely paired in value: supplying one key without the other must fail even before
    // storePair's null-vs-present check runs.
    expect(updateListItemRequestSchema.safeParse({ merchantId: 'lowes' }).success).toBe(false);
  });

  it('refuses clearing the store id while leaving the store name untouched', () => {
    expect(
      updateListItemRequestSchema.safeParse({ merchantId: null, merchantName: 'Lowes Foods' })
        .success,
    ).toBe(false);
  });
});
