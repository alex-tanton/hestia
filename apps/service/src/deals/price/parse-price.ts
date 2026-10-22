import { discountPercent } from '../money.js';
import {
  buildCopy,
  detectQualifier,
  formatDisplayPrice,
  type ConditionalReason,
  type PriceCopy,
  type PriceUnit,
} from './price-copy.js';
import { PRICE_PARSERS, type PriceCore, type SkipReason } from './parsers.js';

/** A deal's price after the chain has run: every amount an integer number of cents. */
export interface ParsedPrice {
  unitPrice: number;
  priceUnit: PriceUnit;
  originalPrice: number | null;
  discountPercent: number | null;
  displayPrice: string;
  conditionalPrice: boolean;
  conditionalReason: ConditionalReason | null;
}

export type PriceResult =
  { readonly parsed: ParsedPrice; readonly parser: string } | { readonly skipped: SkipReason };

/**
 * An original ten times the unit price or more is not a discount, it is a different unit:
 * Restaurant Depot's chicken steak is "$2.39 LB" against an original of $23.90, a case price.
 * Treating it as 90% off would put a fictional saving on the screen, so the original is
 * dropped and the discount goes null.
 */
export function withoutImplausibleOriginal(core: PriceCore): PriceCore {
  if (core.originalPrice !== null && core.originalPrice >= core.unitPrice * 10) {
    return { ...core, originalPrice: null };
  }
  return core;
}

/**
 * Runs the ordered chain over one item's price copy. Every parser passes on copy it does not
 * recognise; a deal no parser handles is skipped, never stored with a null or zero price.
 */
export function parsePrice(price: PriceCopy): PriceResult {
  const copy = buildCopy(price);

  for (const parser of PRICE_PARSERS) {
    const outcome = parser(copy);
    if (outcome === null) continue;
    if ('skip' in outcome) return { skipped: outcome.skip };

    const core = withoutImplausibleOriginal(outcome);
    if (core.unitPrice <= 0) return { skipped: 'unparseable' };
    const reason = detectQualifier(copy);
    return {
      parser: parser.name,
      parsed: {
        unitPrice: core.unitPrice,
        priceUnit: core.priceUnit,
        originalPrice: core.originalPrice,
        discountPercent:
          core.discountPercent ?? discountPercent(core.unitPrice, core.originalPrice),
        displayPrice: formatDisplayPrice(price),
        conditionalPrice: reason !== null,
        conditionalReason: reason,
      },
    };
  }

  return { skipped: price.currentPrice === null ? 'no_price' : 'unparseable' };
}
