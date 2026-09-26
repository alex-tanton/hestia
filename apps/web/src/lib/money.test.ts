import { describe, expect, it } from 'vitest';
import { formatCents, formatUnitPrice, parsePriceInput, speakUnitPrice } from './money.ts';

/** Values are the Seed Data deal fixtures, so the formatting is checked against real prices. */
describe('formatting money from integer cents', () => {
  it.each([
    [250, '$2.50'],
    [167, '$1.67'],
    [199, '$1.99'],
    [349, '$3.49'],
    [719, '$7.19'],
    [899, '$8.99'],
    [0, '$0.00'],
    [1_999_999, '$19,999.99'],
  ])('formats %i cents as %s', (cents, expected) => {
    expect(formatCents(cents)).toBe(expected);
  });

  it.each([
    [199, 'lb', '$1.99/lb'],
    [349, 'lb', '$3.49/lb'],
    [250, 'each', '$2.50'],
    [89, 'oz', '$0.89/oz'],
  ] as const)('formats %i cents per %s as %s', (cents, unit, expected) => {
    expect(formatUnitPrice(cents, unit)).toBe(expected);
  });

  it.each([
    [199, 'lb', '$1.99 per pound'],
    [250, 'each', '$2.50 each'],
    [89, 'oz', '$0.89 per ounce'],
  ] as const)('speaks %i cents per %s as "%s"', (cents, unit, expected) => {
    expect(speakUnitPrice(cents, unit)).toBe(expected);
  });
});

describe('parsing a typed price into cents', () => {
  it.each([
    ['4.99', 499],
    ['$4.99', 499],
    ['4', 400],
    ['4.', 400],
    ['4.5', 450],
    ['0.09', 9],
    ['  7.19 ', 719],
    ['.5', 50],
  ])('reads %s as %i cents', (input, expected) => {
    expect(parsePriceInput(input)).toBe(expected);
  });

  // 19.99 through a float would be 1998.9999999999998; the digits are read instead.
  it('reads the values a float would round wrongly', () => {
    expect(parsePriceInput('19.99')).toBe(1999);
    expect(parsePriceInput('1.15')).toBe(115);
    expect(parsePriceInput('8.29')).toBe(829);
  });

  it.each(['', '  ', 'free', '4.999', '1,000', '-5', '$', 'NaN'])(
    'refuses %s rather than guessing',
    (input) => {
      expect(parsePriceInput(input)).toBeUndefined();
    },
  );
});
