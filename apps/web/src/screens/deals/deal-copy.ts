import type { ConditionalReason, Deal } from '@hestia/shared';
import { formatCalendarDate } from '../../lib/format.ts';
import { formatUnitPrice, speakUnitPrice } from '../../lib/money.ts';

/**
 * The words a deal is shown and announced with. Copy lives here rather than in the card so the
 * spoken sentence and the visible fragments can never drift apart.
 */

/** A conditional price names which one it is, never just "conditional". */
export const CONDITIONAL_LABEL: Readonly<Record<ConditionalReason, string>> = {
  coupon: 'Coupon',
  loyalty_card: 'Card',
};

export const CONDITIONAL_SENTENCE: Readonly<Record<ConditionalReason, string>> = {
  coupon: 'with a digital coupon',
  loyalty_card: 'with a loyalty card',
};

export function discountLabel(percent: number): string {
  return `${String(percent)}% off`;
}

export function validityLabel(deal: Pick<Deal, 'validFrom' | 'validTo'>): string {
  return `${formatCalendarDate(deal.validFrom)} – ${formatCalendarDate(deal.validTo)}`;
}

/**
 * Deal cards announce price and discount as a sentence, not as disconnected fragments. Flipp's
 * own copy ("2/$5.00") is kept alongside the computed unit
 * price, because the shelf tag reads the first way and the comparison reads the second.
 */
export function dealSentence(deal: Deal): string {
  const parts: string[] = [
    `${deal.name} at ${deal.merchantName}`,
    speakUnitPrice(deal.unitPrice, deal.priceUnit),
  ];
  if (
    deal.displayPrice.trim() !== '' &&
    deal.displayPrice !== formatUnitPrice(deal.unitPrice, deal.priceUnit)
  ) {
    parts.push(`marked ${deal.displayPrice}`);
  }
  if (deal.originalPrice !== null) {
    parts.push(`was ${speakUnitPrice(deal.originalPrice, deal.priceUnit)}`);
  }
  if (deal.discountPercent !== null) parts.push(discountLabel(deal.discountPercent));
  if (deal.conditionalPrice && deal.conditionalReason !== null) {
    parts.push(CONDITIONAL_SENTENCE[deal.conditionalReason]);
  }
  parts.push(`valid ${validityLabel(deal)}`);
  return `${parts.join(', ')}.`;
}
