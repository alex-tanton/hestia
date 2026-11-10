import { describe, expect, it } from 'vitest';
import type { ListItem } from '@hestia/shared';
import { matchScannedItem } from './matching.ts';

function fakeItem(overrides: Partial<ListItem> = {}): ListItem {
  return {
    id: 'item-1',
    listId: 'list-1',
    itemName: 'Milk',
    normalizedName: 'milk',
    quantity: 1,
    quantityNote: null,
    status: 'needed',
    barcode: null,
    addedBy: 'user-1',
    source: 'manual',
    merchantId: null,
    merchantName: null,
    dealExternalId: null,
    salePriceCents: null,
    regularPriceCents: null,
    dealValidTo: null,
    priceUnit: 'each',
    conditionalPrice: false,
    priceCents: null,
    originalSalePriceCents: null,
    repricedAt: null,
    contributingRecipeIds: [],
    createdAt: '2026-11-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('matchScannedItem', () => {
  it('returns exactBarcodeMatch when an item has the identical barcode', () => {
    const items = [
      fakeItem({ id: 'item-1', itemName: 'Apples', barcode: '111111111111' }),
      fakeItem({ id: 'item-2', itemName: 'Whole Milk', barcode: '012345678905' }),
      fakeItem({ id: 'item-3', itemName: 'Bread', barcode: null }),
    ];

    const result = matchScannedItem(items, '012345678905', 'Some Other Title');
    expect(result.exactBarcodeMatch).toBeDefined();
    expect(result.exactBarcodeMatch?.id).toBe('item-2');
    expect(result.candidateMatches).toHaveLength(1);
    expect(result.candidateMatches[0]?.id).toBe('item-2');
  });

  it('matches by normalized name when barcode is not in list', () => {
    const items = [
      fakeItem({ id: 'item-1', itemName: 'Whole Milk', normalizedName: 'whole milk' }),
      fakeItem({ id: 'item-2', itemName: 'Sourdough Bread', normalizedName: 'sourdough bread' }),
    ];

    // "Horizon Organic Whole Milk" normalizes to "whole milk" via brand/descriptor stripping
    const result = matchScannedItem(items, '999999999999', 'Horizon Organic Whole Milk');
    expect(result.exactBarcodeMatch).toBeNull();
    expect(result.normalizedNameMatch).toBeDefined();
    expect(result.normalizedNameMatch?.id).toBe('item-1');
    expect(result.candidateMatches).toHaveLength(1);
  });

  it('returns multiple candidates on ambiguous matches', () => {
    const items = [
      fakeItem({ id: 'item-1', itemName: 'Milk 1 Gallon', normalizedName: 'milk' }),
      fakeItem({ id: 'item-2', itemName: 'Almond Milk', normalizedName: 'almond milk' }),
      fakeItem({ id: 'item-3', itemName: 'Oat Milk', normalizedName: 'oat milk' }),
    ];

    // Scanned "Milk" substring-matches all 3
    const result = matchScannedItem(items, '888888888888', 'Milk');
    expect(result.exactBarcodeMatch).toBeNull();
    expect(result.normalizedNameMatch).toBeNull();
    expect(result.candidateMatches.length).toBeGreaterThan(1);
    // Exact normalized match 'milk' is sorted first
    expect(result.candidateMatches[0]?.id).toBe('item-1');
  });

  it('returns empty candidates when no item matches', () => {
    const items = [
      fakeItem({ id: 'item-1', itemName: 'Bananas', normalizedName: 'banana' }),
      fakeItem({ id: 'item-2', itemName: 'Eggs', normalizedName: 'egg' }),
    ];

    const result = matchScannedItem(items, '777777777777', 'Chocolate Bar');
    expect(result.exactBarcodeMatch).toBeNull();
    expect(result.normalizedNameMatch).toBeNull();
    expect(result.candidateMatches).toHaveLength(0);
  });

  it('returns empty candidates when product name is null and barcode is not found', () => {
    const items = [fakeItem({ id: 'item-1', itemName: 'Bananas', barcode: '123' })];

    const result = matchScannedItem(items, '999', null);
    expect(result.exactBarcodeMatch).toBeNull();
    expect(result.normalizedNameMatch).toBeNull();
    expect(result.candidateMatches).toHaveLength(0);
  });
});
