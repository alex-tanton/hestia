import { describe, expect, it } from 'vitest';
import { decideReprice, type CurrentDeal, type RepricedItem } from './repricing.js';

/*
 * The three repricing outcomes, which Seed Data's "Expired" deal fixtures exist to exercise:
 * a re-match against a current deal, a fall back to the regular price, and a cleared price.
 */

const expired = (overrides: Partial<RepricedItem> = {}): RepricedItem => ({
  merchantId: '2431',
  merchantName: 'Harris Teeter',
  dealExternalId: 'last-week-chicken',
  salePrice: '1.99',
  regularPrice: '4.99',
  dealValidTo: '2026-09-19',
  priceUnit: 'lb',
  conditionalPrice: false,
  price: '1.99',
  originalSalePrice: null,
  ...overrides,
});

const currentDeal = (overrides: Partial<CurrentDeal> = {}): CurrentDeal => ({
  externalId: 'this-week-chicken',
  merchantId: '2431',
  merchantName: 'Harris Teeter',
  unitPrice: '2.49',
  originalPrice: '4.99',
  priceUnit: 'lb',
  conditionalPrice: false,
  validTo: '2026-09-26',
  ...overrides,
});

describe('decideReprice', () => {
  it('takes the current deal’s snapshot when one matches', () => {
    expect(decideReprice(expired(), currentDeal())).toEqual({
      merchantId: '2431',
      merchantName: 'Harris Teeter',
      dealExternalId: 'this-week-chicken',
      salePrice: '2.49',
      regularPrice: '4.99',
      dealValidTo: '2026-09-26',
      priceUnit: 'lb',
      conditionalPrice: false,
      price: '2.49',
      // The sale price the shopper saw, shown struck through beside the new one.
      originalSalePrice: '1.99',
    });
  });

  it('carries the new deal’s conditional flag and unit into the snapshot', () => {
    const next = decideReprice(
      expired({ priceUnit: 'each', conditionalPrice: false }),
      currentDeal({ priceUnit: 'each', conditionalPrice: true, originalPrice: null }),
    );
    expect(next).toMatchObject({ priceUnit: 'each', conditionalPrice: true, regularPrice: null });
  });

  it('falls back to the regular price when no deal matches', () => {
    const next = decideReprice(
      expired({
        merchantId: '2100',
        merchantName: 'Food Lion',
        salePrice: '0.44',
        regularPrice: '0.59',
        price: '0.44',
      }),
      undefined,
    );
    expect(next).toMatchObject({ price: '0.59', originalSalePrice: '0.44' });
    // The snapshot is otherwise untouched: it still records the deal the item came from.
    expect(next?.dealExternalId).toBe('last-week-chicken');
  });

  it('clears the price when there is no deal and no regular price, never guessing one', () => {
    const next = decideReprice(
      expired({
        merchantId: '2264',
        merchantName: 'CVS Pharmacy',
        salePrice: '2.99',
        regularPrice: null,
        priceUnit: 'each',
        price: '2.99',
      }),
      undefined,
    );
    expect(next).toMatchObject({ price: null, originalSalePrice: '2.99' });
  });

  it('records the original sale price once, so a second run keeps the first one', () => {
    const alreadyRepriced = expired({
      salePrice: '1.99',
      regularPrice: null,
      price: null,
      originalSalePrice: '1.99',
    });
    expect(decideReprice(alreadyRepriced, undefined)).toBeNull();
  });

  it('changes nothing when the item already sits at its repriced value', () => {
    const settled = expired({
      salePrice: '0.44',
      regularPrice: '0.59',
      price: '0.59',
      originalSalePrice: '0.44',
    });
    expect(decideReprice(settled, undefined)).toBeNull();
  });

  it('changes nothing when the matched deal is the snapshot the item already holds', () => {
    const settled = expired({
      dealExternalId: 'this-week-chicken',
      salePrice: '2.49',
      regularPrice: '4.99',
      dealValidTo: '2026-09-26',
      price: '2.49',
      originalSalePrice: '1.99',
    });
    expect(decideReprice(settled, currentDeal())).toBeNull();
  });

  it('compares money by value, not by the string the column happens to hold', () => {
    const settled = expired({
      salePrice: '0.44',
      regularPrice: '0.5900',
      price: '0.59',
      originalSalePrice: '0.4400',
    });
    expect(decideReprice(settled, undefined)).toBeNull();
  });
});
