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
 * Minimum-quantity pricing: the price does not apply to one item unless the minimum quantity is
 * purchased. When shelf price exists, parse the unit price directly unless copy.pre indicates
 * a multi-buy bundle (e.g. "2/$6.00 MUST BUY 2"), in which case defer to parseMultiBuy.
 */
export const parseMinimumQuantity: PriceParser = (copy) => {
  if (/\bwhen you buy\b|\bmust buy\b|\bbuy \d+ or more\b/i.test(copy.offer)) {
    if (/\d+\s*(?:\/|for\b)/i.test(copy.pre)) {
      return null;
    }
    const current = copy.price.currentPrice;
    if (current !== null) {
      return { unitPrice: current, priceUnit: 'each', originalPrice: copy.price.originalPrice };
    }
    return skip('minimum_quantity');
  }
  return null;
};

/**
 * Flyers write the count with a filler word in between: Food Lion prints both "BUY 2 GET 1 FREE"
 * and "BUY ANY 2 GET 1 FREE" in the same capture.
 */
const BUY_N = String.raw`\bbuy ?(?:any )?`;

/** Half off, 60% off, "half price": anything but "free" on the second item. */
const PARTIAL_BOGO = /\b(?:bogo|buy ?\d ?get ?\d)\b[^.]{0,20}?(?:\d+ ?%|half price)/i;

/**
 * Publix Liquors prints the amount both ways: "Buy 2 Get $6.00 Off" and "Buy 2 Get 10.00 Off".
 * The bare-number form needs the trailing "off", or "get 1 free" would match its own count.
 */
const BUY_N_GET_AMOUNT = new RegExp(
  `${BUY_N}(\\d+)\\b[^.]{0,25}?\\bget\\b[^.]{0,15}?(?:\\$\\s*(\\d+(?:\\.\\d{1,2})?)|(\\d+(?:\\.\\d{1,2})?)\\s*off\\b)`,
  'i',
);
const BUY_N_GET_FREE = new RegExp(
  `${BUY_N}(\\d+)\\b[^.]{0,30}?\\bget ?(?:any )?(\\d+)\\b[^.]{0,20}?\\bfree\\b`,
  'i',
);
const BUY_1_GET_1_FREE = new RegExp(
  `${BUY_N}1\\b[^.]{0,20}?\\bget ?(?:any )?1\\b[^.]{0,20}?\\bfree\\b`,
  'i',
);

/**
 * Buy-N-get-M promotions derive effective unit price from base price:
 * e.g. "BUY 2 GET 1 FREE" at $1.99 each -> unitPrice $1.33, originalPrice $1.99.
 * Without a base price, the promotion is skipped as buy_n_get_m.
 */
export const parseBuyNGetM: PriceParser = (copy) => {
  if (PARTIAL_BOGO.test(copy.offer)) return skip('buy_n_get_m');

  const freeMatch = BUY_N_GET_FREE.exec(copy.offer);
  if (freeMatch !== null) {
    const n = Number(freeMatch[1]);
    const m = Number(freeMatch[2]);
    if (n === 1 && m === 1) return null; // delegating to parseBogo
    const base = copy.price.currentPrice ?? copy.price.originalPrice;
    if (base === null) return skip('buy_n_get_m');
    if (!Number.isInteger(n) || !Number.isInteger(m) || n < 1 || m < 1) return null;
    const paidCount = n;
    const totalCount = n + m;
    const totalPaid = paidCount * base;
    const unitPrice = divideCents(totalPaid, totalCount);
    const originalPrice = base;
    const discountPercent = Math.round(((originalPrice - unitPrice) / originalPrice) * 100);
    return { unitPrice, priceUnit: 'each', originalPrice, discountPercent };
  }

  const amountMatch = BUY_N_GET_AMOUNT.exec(copy.offer);
  if (amountMatch !== null) {
    const base = copy.price.currentPrice ?? copy.price.originalPrice;
    if (base === null) return skip('buy_n_get_m');
    const n = Number(amountMatch[1]);
    const dollars = amountMatch[2] ?? amountMatch[3];
    if (dollars !== undefined && Number.isInteger(n) && n >= 1) {
      const amountCents = Math.round(Number(dollars) * 100);
      if (n * base > amountCents) {
        const totalPaid = n * base - amountCents;
        const unitPrice = divideCents(totalPaid, n);
        const originalPrice = base;
        const discountPercent = Math.round(((originalPrice - unitPrice) / originalPrice) * 100);
        return { unitPrice, priceUnit: 'each', originalPrice, discountPercent };
      }
    }
    return skip('buy_n_get_m');
  }

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

const BUNDLE_SAVINGS_DOLLARS =
  /(?:\bsave\s+\$ ?(\d+(?:\.\d{1,2})?)(?:\s*(?:on|off|for)\s*(\d+))?|\$ ?(\d+(?:\.\d{1,2})?)\s*off(?:\s*(?:on|off|for)\s*(\d+))?)/i;
const BUNDLE_SAVINGS_CENTS =
  /(?:\bsave\s+(?:at least\s+)?(\d+)¢(?:\s*(?:on|off|for)\s*(\d+))?|(\d+)¢\s*off(?:\s*(?:on|off|for)\s*(\d+))?)/i;

/**
 * Multi-buy, divided and rounded half-up, with the copy kept for display. Real copy: Harris
 * Teeter's "2/" over $6.00, Food Lion's "MVP 2/" over $5.00, CVS's "2/" over $14.00, Lowes Foods'
 * "FINAL PRICE 2/" over $4.00 against an original of $6.00 — where the original is the bundle total
 * too, so both are divided (unit $2.00, original $3.00, 33% off).
 *
 * When bundle savings are specified in marketing text (e.g. "save $1.50 on 2" or "save 98¢ on 2"),
 * the original price is derived as (total + savings) / count.
 *
 * The multiplier is only ever in the pre-price text; post-price text such as "/lb" starts with
 * the same slash and means something else entirely.
 */
export const parseMultiBuy: PriceParser = (copy) => {
  const total = copy.price.currentPrice;
  if (total === null) return null;
  const match = /(\d+) ?(?:\/|for\b)/i.exec(copy.pre);
  if (match === null) return null;

  const count = Number(match[1]);
  if (!Number.isInteger(count) || count < 2) return null;

  // Check if copy contains bundle savings
  const dollarMatch = BUNDLE_SAVINGS_DOLLARS.exec(copy.text);
  const centMatch = dollarMatch === null ? BUNDLE_SAVINGS_CENTS.exec(copy.text) : null;

  if (dollarMatch !== null) {
    const dollars = dollarMatch[1] ?? dollarMatch[3];
    const savingsCents = Math.round(Number(dollars) * 100);
    const countStr = dollarMatch[2] ?? dollarMatch[4];
    const savingsCount = countStr !== undefined ? Number(countStr) : null;

    if (savingsCount === null || savingsCount === count) {
      const totalCents = total;
      const originalTotal = copy.price.originalPrice ?? totalCents + savingsCents;
      const unitPrice = divideCents(totalCents, count);
      const originalPrice = divideCents(originalTotal, count);
      const discountPercent = Math.round(((originalPrice - unitPrice) / originalPrice) * 100);
      return { unitPrice, priceUnit: 'each', originalPrice, discountPercent };
    }
  } else if (centMatch !== null) {
    const cents = centMatch[1] ?? centMatch[3];
    const savingsCents = Number(cents);
    const countStr = centMatch[2] ?? centMatch[4];
    const savingsCount = countStr !== undefined ? Number(countStr) : null;

    if (savingsCount === null || savingsCount === count) {
      const totalCents = total;
      const originalTotal = copy.price.originalPrice ?? totalCents + savingsCents;
      const unitPrice = divideCents(totalCents, count);
      const originalPrice = divideCents(originalTotal, count);
      const discountPercent = Math.round(((originalPrice - unitPrice) / originalPrice) * 100);
      return { unitPrice, priceUnit: 'each', originalPrice, discountPercent };
    }
  }

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
