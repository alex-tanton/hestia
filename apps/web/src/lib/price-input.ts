/**
 * A hand-entered price, at the one boundary where dollars become money. Money is integer cents
 * everywhere else, so the digits are read as integers rather than multiplied: `Number('5.99') *
 * 100` is 598.9999999999999.
 */

export const PRICE_INPUT_MESSAGE = 'Enter a price like 5.99.';

const PRICE_PATTERN = /^\$?\s*(\d{1,6})(?:\.(\d{1,2}))?$/;

export interface ParsedPrice {
  cents?: number;
  error?: string;
}

/** An empty field means no price, which is a valid answer for a manual item. */
export function parsePriceInput(value: string): ParsedPrice {
  const trimmed = value.trim();
  if (trimmed === '') return {};
  const match = PRICE_PATTERN.exec(trimmed);
  if (!match) return { error: PRICE_INPUT_MESSAGE };
  const dollars = Number(match[1]);
  const cents = Number((match[2] ?? '0').padEnd(2, '0'));
  return { cents: dollars * 100 + cents };
}

/** Integer cents back into the field, so opening the edit sheet shows what was entered. */
export function formatPriceInput(cents: number | null): string {
  if (cents === null) return '';
  const dollars = Math.trunc(cents / 100);
  const remainder = cents % 100;
  return `${String(dollars)}.${String(remainder).padStart(2, '0')}`;
}

export const QUANTITY_MESSAGE = 'Enter a quantity like 2.';

export interface ParsedQuantity {
  quantity?: number;
  error?: string;
}

export function parseQuantityInput(value: string): ParsedQuantity {
  const trimmed = value.trim();
  if (trimmed === '') return {};
  const quantity = Number(trimmed);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100_000) {
    return { error: QUANTITY_MESSAGE };
  }
  return { quantity };
}
