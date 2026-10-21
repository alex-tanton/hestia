import { formatUsd } from '../money.js';

/**
 * The raw price copy one Flipp item carries, and the derived text the parser chain reads.
 *
 * Flipp spreads a price over four fields: a number, an optional original, and up to three
 * scraps of marketing text. `"6.0"` alone may really mean "2/$6.00 with your VIC card", so no
 * parser may look at the number without the words around it.
 *
 * The item's *name* is deliberately not part of the copy. Names carry their own marketing
 * ("… BOGO*"), and reading them would let a product description override a real shelf price.
 */
export interface PriceCopy {
  /** Integer cents, or null when Flipp gives no price. */
  currentPrice: number | null;
  originalPrice: number | null;
  prePriceText: string | null;
  postPriceText: string | null;
  saleStory: string | null;
}

export type PriceUnit = 'each' | 'lb' | 'oz';
export type ConditionalReason = 'coupon' | 'loyalty_card';

/** Lowercased, whitespace-collapsed views of one item's copy, built once per item. */
export interface Copy {
  readonly price: PriceCopy;
  /** pre, post, and sale story joined: everything Flipp printed about the price. */
  readonly text: string;
  /**
   * `text` without any secondary offer stacked on top of the shelf price. CVS prints "$4.79 WITH
   * CARD" alongside "Also get savings with $5.00 on 2 Digital mfr coupon + Buy 2 get $6 ExtraBucks
   * Rewards®": the coupon and the rebate are extras, not the terms of the price, and reading them
   * as terms would skip thirteen priced CVS items whose shelf price is perfectly clear (the shelf
   * price is parsed; the rebate is ignored). Every parser that decides whether a price *applies*
   * reads this; the qualifier check still reads `text`, because "WITH CARD" often trails the
   * secondary clause.
   */
  readonly offer: string;
  readonly pre: string;
  readonly post: string;
  readonly story: string;
}

function clean(value: string | null): string {
  return (
    (value ?? '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      // Spelled-out counts appear in flyer copy ("BUY ONE ... GET ... FREE"); the parsers all
      // count in digits.
      .replace(/\bone\b/g, '1')
      .replace(/\btwo\b/g, '2')
      .replace(/\bthree\b/g, '3')
  );
}

export function buildCopy(price: PriceCopy): Copy {
  const pre = clean(price.prePriceText);
  const post = clean(price.postPriceText);
  const story = clean(price.saleStory);
  const text = [pre, post, story].filter((part) => part !== '').join(' ');
  return { price, pre, post, story, text, offer: text.replace(/\balso get savings\b.*$/, '') };
}

/**
 * A secondary offer stacked on top of a shelf price, which never decides whether the shelf
 * price is conditional. CVS writes "Also get savings with $5.00 Digital mfr coupon WITH CARD":
 * the card is required, the coupon is a bonus, so the coupon clause is removed before the
 * qualifier is read and the trailing "WITH CARD" is kept.
 */
function withoutSecondaryOffers(text: string): string {
  return text.replace(/also get savings with[\s\S]*?coupon\b/g, ' ');
}

const LOYALTY =
  /\bwith card\b|\bw\/ ?card\b|\bvic\b|\bmyvic\b|\bmvp\b|\bmembership\b|\bmember price\b|\bwith your [a-z ]{0,12}card\b|\bloyalty card\b/;
const COUPON = /\bcoupon\b/;

/**
 * A digital-coupon qualifier makes the price conditional with reason `coupon`; a loyalty-card
 * qualifier ("w/ MVP Card", an "MVP" price prefix, "with your VIC card", "WITH CARD", a membership
 * price) with reason `loyalty_card`.
 *
 * The card wins when both appear, because the card is what the shelf price requires:
 * "FINAL PRICE 2/$5.00" with "$1 OFF TWO DIGITAL COUPON" is a coupon price, while
 * "$4.79 WITH CARD" plus a coupon offer is a card price with a coupon available.
 */
export function detectQualifier(copy: Copy): ConditionalReason | null {
  const text = withoutSecondaryOffers(copy.text);
  if (LOYALTY.test(text)) return 'loyalty_card';
  if (COUPON.test(text)) return 'coupon';
  return null;
}

/**
 * The copy as Flipp renders it, kept verbatim so the UI can show "2 for $5.00" beside the
 * computed $2.50. Pre-price text ending in a slash runs straight into the price, which is how "2/"
 * becomes "2/$6.00".
 */
export function formatDisplayPrice(price: PriceCopy): string {
  const pre = price.prePriceText?.trim() ?? '';
  const post = price.postPriceText?.trim() ?? '';
  const amount = price.currentPrice === null ? '' : formatUsd(price.currentPrice);
  const head = pre === '' ? amount : pre.endsWith('/') ? `${pre}${amount}` : `${pre} ${amount}`;
  return (post === '' ? head : `${head} ${post}`).trim();
}
