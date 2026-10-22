import type { PriceUnit } from '@hearth/shared';

/**
 * Money crosses the API as an integer number of cents and is only ever *formatted* here.
 * Nothing in the client adds, discounts, or
 * divides a price — every figure the UI shows was computed by the service.
 *
 * USD with a `$` prefix, through `Intl`, so a future locale is a change of constants.
 */

const LOCALE = 'en-US';

const MONEY = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'USD' });

/**
 * Cents to "$2.49". The division is display scaling, not arithmetic on a price: a double holds
 * every cent value the schema allows exactly, and `Intl` rounds to the two places it prints.
 */
export function formatCents(cents: number): string {
  return MONEY.format(cents / 100);
}

/** Shown on a deal card: "$2.49/lb", "$3.99". An each-priced item carries no suffix. */
export const UNIT_SUFFIX: Readonly<Record<PriceUnit, string>> = {
  each: '',
  lb: '/lb',
  oz: '/oz',
};

export function formatUnitPrice(cents: number, unit: PriceUnit): string {
  return `${formatCents(cents)}${UNIT_SUFFIX[unit]}`;
}

/** How the price reads in a sentence, where a suffix would be heard as punctuation. */
export const UNIT_PHRASE: Readonly<Record<PriceUnit, string>> = {
  each: 'each',
  lb: 'per pound',
  oz: 'per ounce',
};

export function speakUnitPrice(cents: number, unit: PriceUnit): string {
  return `${formatCents(cents)} ${UNIT_PHRASE[unit]}`;
}

const PRICE_INPUT = /^\$?(\d{0,8})(?:\.(\d{0,2}))?$/;

/**
 * A price typed as dollars, as an integer number of cents. Parsed digit by digit rather than
 * through `Number`, so "19.99" can never arrive as 1998.9999999999998, and an unparseable entry
 * is rejected rather than guessed at — the same discipline the deal parsers follow.
 */
export function parsePriceInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const match = PRICE_INPUT.exec(trimmed);
  if (!match) return undefined;
  const [, dollars = '', decimals = ''] = match;
  if (dollars === '' && decimals === '') return undefined;
  const cents = `${decimals}00`.slice(0, 2);
  return Number(dollars || '0') * 100 + Number(cents);
}
