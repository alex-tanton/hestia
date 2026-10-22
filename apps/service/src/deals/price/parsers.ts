import { divideCents } from '../money.js';
import type { Copy, PriceUnit } from './price-copy.js';

/**
 * The ordered parser chain.
 *
 * Every parser is pure, tries the raw copy, and passes (returns null) when the copy is not its
 * shape. Each carries the real captured string that motivates it. Guards — the parsers that
 * skip — come first, because a shape like "Buy 2 Get 1 Free" often *does* carry a price, and
 * pricing one item at the two-item price would be a confident wrong answer.
 */

export type SkipReason =
  | 'no_price'
  | 'unparseable'
  | 'rebate'
  | 'bogo_no_base'
  | 'buy_n_get_m'
  | 'minimum_quantity'
  | 'mix_and_match'
  | 'percent_off_no_base'
  | 'amount_off_no_original'
  | 'detail_unavailable';

/** What a parser produces before qualifiers, discounts, and display copy are applied. */
export interface PriceCore {
  unitPrice: number;
  priceUnit: PriceUnit;
  originalPrice: number | null;
  /**
   * Set only where the offer states its own discount. Buy-one-get-one is 50% off by
   * definition, but halving an odd base rounds up a cent — $9.49 becomes $4.75 — and the
   * generic `(original − unit) ÷ original` would then floor to 49%, contradicting the copy.
   */
  discountPercent?: number | undefined;
}

export type ParserOutcome = { skip: SkipReason } | PriceCore;

export type PriceParser = (copy: Copy) => ParserOutcome | null;

function skip(reason: SkipReason): { skip: SkipReason } {
  return { skip: reason };
}

/**
 * Rebates are not shelf prices: the money comes back later, and only if the basket qualifies. Real
 * copy: "Spend $20 get $5 ExtraBucks Rewards®◆ WITH CARD" and "FREE with $25 purchase". A rebate
 * printed *beside* a shelf price is a different row — that one parses, which is why this only fires
 * when the item has no price of its own.
 */
export const parseRebate: PriceParser = (copy) => {
  if (copy.price.currentPrice !== null) return null;
  if (
    /extrabucks|extra bucks|\bspend \$?\d|\bspent \$?\d|free with \$?\d|with \$\d+ purchase/.test(
      copy.text,
    )
  ) {
    return skip('rebate');
  }
  return null;
};

/**
 * Mix-and-match with a purchase limit: "Mix & Match 10/$10 with card, limit 2, select
 * varieties". Which items count toward the ten, and what the limit does to the price, are not
 * in the data, so a confident parse would be wrong.
 */
export const parseMixAndMatchLimit: PriceParser = (copy) => {
  if (/mix\s*(?:&|and)\s*match/.test(copy.offer) && /\blimit\b/.test(copy.offer)) {
    return skip('mix_and_match');
  }
  return null;
};

/**
 * Minimum-quantity pricing: the price does not apply to one item. Real copy: Lowes Foods'
 * "ea MUST BUY 2" and Harris Teeter's "save at least $2.08 over our already low VIC price when
 * you buy 4".
 */
export const parseMinimumQuantity: PriceParser = (copy) => {
  if (/\bwhen you buy\b|\bmust buy\b|\bbuy \d+ or more\b/.test(copy.offer)) {
    return skip('minimum_quantity');
  }
  return null;
};

/**
 * Flyers write the count with a filler word in between: Food Lion prints both "BUY 2 GET 1 FREE"
 * and "BUY ANY 2 GET 1 FREE" in the same capture, and reading only the first would price the
 * second as though it were a plain shelf price.
 */
const BUY_N = String.raw`\bbuy ?(?:any )?`;

/** Half off, 60% off, "half price": anything but "free" on the second item. */
const PARTIAL_BOGO = /\b(?:bogo|buy ?\d ?get ?\d)\b[^.]{0,20}?(?:\d+ ?%|half price)/;
/**
 * Publix Liquors prints the amount both ways: "Buy 2 Get $6.00 Off" and "Buy 2 Get 10.00 Off".
 * The bare-number form needs the trailing "off", or "get 1 free" would match its own count.
 */
const BUY_N_GET_AMOUNT = new RegExp(
  `${BUY_N}\\d+\\b[^.]{0,25}?\\bget\\b[^.]{0,15}?(?:\\$\\d|\\d+(?:\\.\\d+)? ?off\\b)`,
);
const BUY_N_GET_FREE = new RegExp(
  `${BUY_N}(\\d+)\\b[^.]{0,30}?\\bget ?(?:any )?(\\d+)\\b[^.]{0,20}?\\bfree\\b`,
);
const BUY_1_GET_1_FREE = new RegExp(
  `${BUY_N}1\\b[^.]{0,20}?\\bget ?(?:any )?1\\b[^.]{0,20}?\\bfree\\b`,
);

/**
 * Buy-N-get-M in every form except a plain buy-one-get-one free, with or without a base price.
 * Real copy: Food Lion's "BUY 2 GET 1 FREE" printed over an each price of $1.99, Harris Teeter's
 * "BUY 2 GET $8.00 OFF", CVS's "Buy 1 get 1 50% OFF* WITH CARD".
 *
 * A buy-2-get-1 at $1.99 each is $1.33 an item only if you buy three, so the shelf price is not
 * the price of one.
 */
export const parseBuyNGetM: PriceParser = (copy) => {
  if (PARTIAL_BOGO.test(copy.offer)) return skip('buy_n_get_m');
  if (BUY_N_GET_AMOUNT.test(copy.offer)) return skip('buy_n_get_m');

  const free = BUY_N_GET_FREE.exec(copy.offer);
  if (free !== null && !(free[1] === '1' && free[2] === '1')) return skip('buy_n_get_m');
  return null;
};

/**
 * BOGO with a known base price is half of it. Real copy: Publix's "Buy 1 Get 1 FREE*" over $9.49
 * for Mifroma Le Gruyère AOP Cheese, which is $4.75 each at 50% off. Without a base — Harris
 * Teeter's "BUY 1 GET 1 FREE each item rings at half price with your VIC card", printed with no
 * price at all — there is nothing to halve, so it is skipped.
 */
export const parseBogo: PriceParser = (copy) => {
  const isBogo = /\bbogo\b|\bb1g1\b/.test(copy.offer) || BUY_1_GET_1_FREE.test(copy.offer);
  if (!isBogo) return null;

  const base = copy.price.currentPrice ?? copy.price.originalPrice;
  if (base === null) return skip('bogo_no_base');
  return {
    unitPrice: divideCents(base, 2),
    priceUnit: 'each',
    originalPrice: base,
    discountPercent: 50,
  };
};

/**
 * A percentage with nothing to apply it to: CVS's "25% OFF WITH CARD" on an item with no
 * price. Where a shelf price *is* printed, the percentage is describing it — Food Lion's
 * "-20% OFF" beside $6.39 was $7.99 — so this passes and the direct parser takes over.
 */
export const parsePercentOffNoBase: PriceParser = (copy) => {
  if (copy.price.currentPrice !== null) return null;
  if (/\d+ ?% ?off/.test(copy.offer)) return skip('percent_off_no_base');
  return null;
};

/**
 * "$1.00 off" subtracted from a known original. Real copy: Lowes Foods' "Sale! $1 OFF" and "Save $2
 * on Tillamook Cheese Block". With no original there is nothing to subtract from, so it is skipped.
 *
 * Only reached when the item has no price of its own: when Flipp prints both, the number is
 * already the after-discount shelf price and the words are just saying why.
 */
export const parseAmountOff: PriceParser = (copy) => {
  if (copy.price.currentPrice !== null) return null;
  // "save up to $4.99" and "save at least $1.00" are ceilings and floors, not an amount off.
  const text = copy.offer.replace(/\bsave (?:up to|at least)\b[^.]*/g, ' ');
  const match = /\$ ?(\d+(?:\.\d{1,2})?) ?off\b|\bsave \$ ?(\d+(?:\.\d{1,2})?)\b/.exec(text);
  const dollars = match?.[1] ?? match?.[2];
  if (dollars === undefined) return null;

  const amount = Math.round(Number(dollars) * 100);
  const original = copy.price.originalPrice;
  if (original === null || original <= amount) return skip('amount_off_no_original');
  return { unitPrice: original - amount, priceUnit: 'each', originalPrice: original };
};

/**
 * Multi-buy, divided and rounded half-up, with the copy kept for display. Real copy: Harris
 * Teeter's "2/" over $6.00, Food Lion's "MVP 2/" over $5.00, CVS's "2/" over $14.00, Lowes Foods'
 * "FINAL PRICE 2/" over $4.00 against an original of $6.00 — where the original is the bundle total
 * too, so both are divided (unit $2.00, original $3.00, 33% off).
 *
 * The multiplier is only ever in the pre-price text; post-price text such as "/lb" starts with
 * the same slash and means something else entirely.
 */
export const parseMultiBuy: PriceParser = (copy) => {
  const total = copy.price.currentPrice;
  if (total === null) return null;
  const match = /(\d+) ?(?:\/|for\b)/.exec(copy.pre);
  if (match === null) return null;

  const count = Number(match[1]);
  if (!Number.isInteger(count) || count < 2) return null;
  const original = copy.price.originalPrice;
  return {
    unitPrice: divideCents(total, count),
    priceUnit: 'each',
    originalPrice: original === null ? null : divideCents(original, count),
  };
};

/**
 * A package whose size happens to be written as a weight: ALDI's "Per 3-Lb. Bag" over $3.29
 * for Washington Bartlett Pears, or "Per 8-oz. Pkg." for mushrooms. That is the price of the
 * bag, not of a pound, so the unit is `each` — and it has to be tested before the per-weight
 * parser, which would otherwise see the "Lb." and call it a pound price.
 */
export const parsePackagePricedByWeight: PriceParser = (copy) => {
  const total = copy.price.currentPrice;
  if (total === null) return null;
  if (!/per ?\d+(?:\.\d+)? ?-? ?(?:lb|lbs|ib|oz|ounce)\b/.test(`${copy.pre} ${copy.post}`)) {
    return null;
  }
  return { unitPrice: total, priceUnit: 'each', originalPrice: copy.price.originalPrice };
};

/** "lb", "LB", "/lb", "Per Lb.", "PER LB", and the OCR misreading "per Ib" all mean pounds. */
const WEIGHT_SUFFIX = /(?:^|[\s/])(?:per )?(lb|lbs|ib|ibs|pound|pounds|oz|ounce|ounces)\b\.?$/;
/** Some flyers put the unit only in the sale story: "save at least 50¢ per lb. with your VIC card". */
const WEIGHT_IN_STORY = /\bper lb\b|\bper pound\b|\bper oz\b/;

/**
 * Per-weight pricing. Real copy: Food Lion's "LB" over $1.99 for Broccoli Crowns, ALDI's "Per Lb.",
 * Lidl's "/lb", and Harris Teeter's "per Ib" — an OCR misreading of "lb" that appears on eleven
 * captured items and would otherwise be priced as `each`.
 */
export const parsePerWeight: PriceParser = (copy) => {
  const total = copy.price.currentPrice;
  if (total === null) return null;

  const suffix = WEIGHT_SUFFIX.exec(copy.post) ?? WEIGHT_SUFFIX.exec(copy.pre);
  const unit: PriceUnit | null =
    suffix !== null
      ? suffix[1]?.startsWith('o') === true
        ? 'oz'
        : 'lb'
      : WEIGHT_IN_STORY.test(copy.story)
        ? copy.story.includes('per oz')
          ? 'oz'
          : 'lb'
        : null;
  if (unit === null) return null;
  return { unitPrice: total, priceUnit: unit, originalPrice: copy.price.originalPrice };
};

/**
 * A plain shelf price, with an original when Flipp gives one: "$3.99" against "$5.99" is 33%
 * off. Real copy: ALDI's "PRICE DROPS" over $1.45 for peanut butter, was $1.95.
 */
export const parseDirectPrice: PriceParser = (copy) => {
  const total = copy.price.currentPrice;
  if (total === null) return null;
  return { unitPrice: total, priceUnit: 'each', originalPrice: copy.price.originalPrice };
};

/** The chain, in order. */
export const PRICE_PARSERS: readonly PriceParser[] = [
  parseRebate,
  parseMixAndMatchLimit,
  parseMinimumQuantity,
  parseBuyNGetM,
  parseBogo,
  parsePercentOffNoBase,
  parseAmountOff,
  parseMultiBuy,
  parsePackagePricedByWeight,
  parsePerWeight,
  parseDirectPrice,
];
