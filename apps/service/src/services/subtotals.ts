import type { PriceUnit } from '@hestia/shared';
import { multiplyCents } from './money.js';

/**
 * The Subtotals rule, computed here so the UI never does money arithmetic. A store group's subtotal
 * covers its needed and in-cart items only.
 *
 * - `each` counts price × quantity, a missing quantity counting as 1
 * - `lb` counts price × quantity in pounds, and is excluded with no quantity
 * - everything else is excluded, including per-oz items and items with no price
 * - the excluded ones are counted, for the header's "+N unpriced"
 */

export interface SubtotalItem {
  priceCents: number | null;
  priceUnit: PriceUnit;
  /** The `numeric` column's decimal string, so the multiplication stays in integers. */
  quantity: string | null;
}

export interface Subtotal {
  subtotalCents: number;
  unpricedCount: number;
}

function countsFor(item: SubtotalItem): number | null {
  if (item.priceCents === null) return null;
  if (item.priceUnit === 'each') return multiplyCents(item.priceCents, item.quantity ?? '1');
  if (item.priceUnit === 'lb' && item.quantity !== null) {
    return multiplyCents(item.priceCents, item.quantity);
  }
  return null;
}

export function subtotal(items: readonly SubtotalItem[]): Subtotal {
  let subtotalCents = 0;
  let unpricedCount = 0;
  for (const item of items) {
    const counted = countsFor(item);
    if (counted === null) unpricedCount += 1;
    else subtotalCents += counted;
  }
  return { subtotalCents, unpricedCount };
}
