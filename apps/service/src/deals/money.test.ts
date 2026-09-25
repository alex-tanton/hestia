import { describe, expect, it } from 'vitest';
import { discountPercent, divideCents, formatUsd, toCents } from './money.js';

describe('toCents', () => {
  it('takes search prices, which are numbers', () => {
    expect(toCents(3.99)).toBe(399);
  });

  it('takes flyer and detail prices, which are strings', () => {
    expect(toCents('6.0')).toBe(600);
    expect(toCents('18.99')).toBe(1899);
  });

  it('treats an absent, empty, or zero price as no price', () => {
    // A zero is Flipp saying "no price", not "free" (non-negotiable 6).
    expect(toCents('')).toBeNull();
    expect(toCents('   ')).toBeNull();
    expect(toCents(null)).toBeNull();
    expect(toCents(undefined)).toBeNull();
    expect(toCents(0)).toBeNull();
    expect(toCents('0')).toBeNull();
    expect(toCents(-1.5)).toBeNull();
    expect(toCents('free')).toBeNull();
  });

  it('rounds to a whole cent', () => {
    // Flipp prints at most two decimals, so this only guards against float noise.
    expect(toCents(2.394)).toBe(239);
    expect(toCents(23.9)).toBe(2390);
  });
});

describe('divideCents', () => {
  it('rounds half-up, the documented rule', () => {
    expect(divideCents(1000, 3)).toBe(333);
    expect(divideCents(500, 2)).toBe(250);
    expect(divideCents(5, 2)).toBe(3);
    expect(divideCents(949, 2)).toBe(475);
    expect(divideCents(596, 3)).toBe(199);
  });

  it('refuses a non-positive divisor', () => {
    expect(() => divideCents(500, 0)).toThrow(RangeError);
  });
});

describe('discountPercent', () => {
  it('floors the percentage', () => {
    expect(discountPercent(399, 599)).toBe(33);
    expect(discountPercent(249, 499)).toBe(50);
    expect(discountPercent(200, 300)).toBe(33);
    expect(discountPercent(449, 549)).toBe(18);
  });

  it('is null without an original, or when the original does not beat the price', () => {
    expect(discountPercent(399, null)).toBeNull();
    expect(discountPercent(399, 399)).toBeNull();
    expect(discountPercent(399, 299)).toBeNull();
  });
});

describe('formatUsd', () => {
  it('formats cents as dollars', () => {
    expect(formatUsd(250)).toBe('$2.50');
    expect(formatUsd(5)).toBe('$0.05');
    expect(formatUsd(1899)).toBe('$18.99');
    expect(formatUsd(600)).toBe('$6.00');
    expect(formatUsd(-125)).toBe('-$1.25');
  });
});
