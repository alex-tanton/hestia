import { describe, expect, it } from 'vitest';
import { fromCents, multiplyCents, toCents } from './money.js';
import { subtotal, type SubtotalItem } from './subtotals.js';

const item = (overrides: Partial<SubtotalItem> = {}): SubtotalItem => ({
  priceCents: 199,
  priceUnit: 'each',
  quantity: null,
  ...overrides,
});

describe('money stays in integer cents', () => {
  it.each([
    ['0.00', 0],
    ['0.44', 44],
    ['2.49', 249],
    ['12.60', 1260],
    ['1234.50', 123_450],
  ])('reads %s as %i cents', (value, cents) => {
    expect(toCents(value)).toBe(cents);
    expect(fromCents(cents)).toBe(value);
  });

  it('keeps null as null', () => {
    expect(toCents(null)).toBeNull();
    expect(fromCents(null)).toBeNull();
  });

  it.each([
    [249, '2', 498],
    [199, '3', 597],
    [333, '2', 666],
    // Half-up at the cent, the rounding rule for every price division.
    [249, '1.5', 374],
    [251, '1.5', 377],
    [333, '0.5', 167],
    [100, '0.333', 33],
  ])('multiplies %i cents by %s to %i', (cents, quantity, expected) => {
    expect(multiplyCents(cents, quantity)).toBe(expected);
  });
});

describe('the Subtotals rule', () => {
  it('counts an each-priced item as price × quantity', () => {
    expect(subtotal([item({ priceCents: 333, quantity: '2' })])).toEqual({
      subtotalCents: 666,
      unpricedCount: 0,
    });
  });

  it('counts a missing quantity as one', () => {
    expect(subtotal([item({ priceCents: 599, quantity: null })]).subtotalCents).toBe(599);
  });

  it('counts a per-pound item by its quantity in pounds', () => {
    expect(subtotal([item({ priceCents: 249, priceUnit: 'lb', quantity: '2' })])).toEqual({
      subtotalCents: 498,
      unpricedCount: 0,
    });
  });

  it('excludes a per-pound item with no quantity, and counts it as unpriced', () => {
    expect(subtotal([item({ priceCents: 59, priceUnit: 'lb', quantity: null })])).toEqual({
      subtotalCents: 0,
      unpricedCount: 1,
    });
  });

  it('excludes a per-ounce item however it is priced', () => {
    expect(subtotal([item({ priceCents: 25, priceUnit: 'oz', quantity: '8' })])).toEqual({
      subtotalCents: 0,
      unpricedCount: 1,
    });
  });

  it.each([['each'], ['lb'], ['oz']] as const)('excludes a %s item with no price', (priceUnit) => {
    expect(subtotal([item({ priceCents: null, priceUnit, quantity: '2' })])).toEqual({
      subtotalCents: 0,
      unpricedCount: 1,
    });
  });

  it('is zero with nothing to count', () => {
    expect(subtotal([])).toEqual({ subtotalCents: 0, unpricedCount: 0 });
  });

  /*
   * The expected store headers of the seed data's "This Week" list, which is the oracle for this
   * rule. Bought items are not part of a store group, so they never reach here.
   */
  it.each([
    [
      'Harris Teeter',
      [
        item({ priceCents: 249, priceUnit: 'lb', quantity: '2' }),
        item({ priceCents: 399, quantity: '1' }),
        item({ priceCents: null, quantity: '1' }),
      ],
      { subtotalCents: 897, unpricedCount: 1 },
    ],
    [
      'Food Lion',
      [
        item({ priceCents: 333, quantity: '2' }),
        item({ priceCents: 199, quantity: '3' }),
        item({ priceCents: 59, priceUnit: 'lb', quantity: null }),
        item({ priceCents: null, quantity: null }),
      ],
      { subtotalCents: 1263, unpricedCount: 2 },
    ],
    [
      'CVS Pharmacy',
      [item({ priceCents: 599, quantity: '1' }), item({ priceCents: null, quantity: '1' })],
      { subtotalCents: 599, unpricedCount: 1 },
    ],
    [
      'Anywhere',
      [
        item({ priceCents: null, quantity: '2' }),
        item({ priceCents: null, quantity: null }),
        item({ priceCents: null, quantity: '1' }),
      ],
      { subtotalCents: 0, unpricedCount: 3 },
    ],
  ])('matches Seed Data’s %s header', (_store, items, expected) => {
    expect(subtotal(items)).toEqual(expected);
  });
});
