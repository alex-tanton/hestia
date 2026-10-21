/**
 * Money helpers for the deal pipeline. Every amount here is an integer number of cents (all price
 * arithmetic is done in integer cents, and only formatted as dollars for display). Nothing in this
 * module produces a float.
 */

/**
 * Flipp gives prices as numbers in search (`3.99`) and strings elsewhere (`"6.0"`, `""`).
 * Both become cents here; anything empty, non-numeric, negative, or zero becomes null, because
 * a zero price is Flipp saying "no price", not "free".
 */
export function toCents(value: unknown): number | null {
  const numeric =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return Math.round(numeric * 100);
}

/** Divides cents by a whole count, rounding half-up: 1000 / 3 = 333, 5 / 2 = 3. */
export function divideCents(cents: number, divisor: number): number {
  if (divisor <= 0) throw new RangeError('divisor must be positive');
  return Math.round(cents / divisor);
}

/**
 * `(original − unit) ÷ original × 100`, floored. Null when there is no original, or when it does
 * not beat the unit price — a "discount" of 0% or less is noise, not a saving.
 */
export function discountPercent(unitPrice: number, originalPrice: number | null): number | null {
  if (originalPrice === null || originalPrice <= unitPrice) return null;
  return Math.floor(((originalPrice - unitPrice) / originalPrice) * 100);
}

/** Cents as display dollars: 250 → "$2.50". Display only; never parsed back. */
export function formatUsd(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  return `${sign}$${Math.trunc(absolute / 100).toString()}.${(absolute % 100).toString().padStart(2, '0')}`;
}
