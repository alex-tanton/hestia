/**
 * Money is integer cents everywhere above the database boundary (Engineering Practices, "Code
 * conventions"). `numeric(10, 2)` arrives from pg as a decimal string, so these convert without
 * ever going through a floating-point dollar amount.
 */

const NUMERIC = /^(-?)(\d+)(?:\.(\d*))?$/;

export function toCents(value: string | null): number | null {
  if (value === null) return null;
  const match = NUMERIC.exec(value.trim());
  if (match === null) throw new Error('not a numeric value');
  const [, sign = '', whole = '0', fraction = ''] = match;
  const cents = Number(whole) * 100 + Number(`${fraction}00`.slice(0, 2));
  return sign === '-' ? -cents : cents;
}

/** The decimal string a `numeric(10, 2)` column takes, built without dividing by 100. */
export function fromCents(cents: number | null): string | null {
  if (cents === null) return null;
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  return `${sign}${String(Math.floor(absolute / 100))}.${String(absolute % 100).padStart(2, '0')}`;
}

/**
 * `cents × quantity`, rounded half-up to a whole cent (Requirements, "Deal price normalization").
 * The quantity is a `numeric` column's decimal string, so the multiplication stays in integers.
 */
export function multiplyCents(cents: number, quantity: string): number {
  const match = NUMERIC.exec(quantity.trim());
  if (match === null) throw new Error('not a numeric quantity');
  const [, sign = '', whole = '0', fraction = ''] = match;
  const scale = 10 ** fraction.length;
  const scaled = Number(whole) * scale + Number(fraction === '' ? '0' : fraction);
  const product = cents * scaled;
  const rounded = Math.floor((product * 2 + scale) / (2 * scale));
  return sign === '-' ? -rounded : rounded;
}

/** A `numeric` column's decimal string as a JSON number; quantities are counts, not money. */
export function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}
