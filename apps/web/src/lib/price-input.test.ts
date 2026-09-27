import { describe, expect, it } from 'vitest';
import {
  PRICE_INPUT_MESSAGE,
  QUANTITY_MESSAGE,
  formatPriceInput,
  parsePriceInput,
  parseQuantityInput,
} from './price-input.ts';

describe('parsePriceInput', () => {
  it.each([
    ['5.99', 599],
    ['$5.99', 599],
    [' 5.99 ', 599],
    ['5', 500],
    ['5.9', 590],
    ['0.05', 5],
    ['1850.00', 185_000],
  ])('reads %s as %i cents', (input, cents) => {
    expect(parsePriceInput(input)).toEqual({ cents });
  });

  it('never goes through floating-point dollars', () => {
    // 5.99 * 100 is 598.9999999999999, which is exactly the bug this parser exists to avoid.
    expect(parsePriceInput('5.99').cents).toBe(599);
    expect(Number.isInteger(parsePriceInput('19.99').cents)).toBe(true);
  });

  it('treats an empty field as no price, which a manual item may have', () => {
    expect(parsePriceInput('')).toEqual({});
    expect(parsePriceInput('   ')).toEqual({});
  });

  it.each(['abc', '5.999', '-1', '1,000', '5.', '$'])('refuses %s', (input) => {
    expect(parsePriceInput(input)).toEqual({ error: PRICE_INPUT_MESSAGE });
  });
});

describe('formatPriceInput', () => {
  it.each([
    [599, '5.99'],
    [500, '5.00'],
    [5, '0.05'],
    [null, ''],
  ])('puts %s back in the field as %s', (cents, text) => {
    expect(formatPriceInput(cents)).toBe(text);
  });
});

describe('parseQuantityInput', () => {
  it('accepts a count or a weight, since a quantity is never money', () => {
    expect(parseQuantityInput('2')).toEqual({ quantity: 2 });
    expect(parseQuantityInput('1.5')).toEqual({ quantity: 1.5 });
  });

  it('treats an empty field as no quantity', () => {
    expect(parseQuantityInput('')).toEqual({});
  });

  it.each(['0', '-2', 'two', '200000'])('refuses %s', (input) => {
    expect(parseQuantityInput(input)).toEqual({ error: QUANTITY_MESSAGE });
  });
});
