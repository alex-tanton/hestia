import type { ReactElement } from 'react';
import type { ListItem } from '@hestia/shared';
import { formatCents, formatPrice, speakPrice } from '../../lib/format.ts';
import { Badge } from '../ui/Badge.tsx';

export const NO_PRICE_LABEL = 'No price';
export const REPRICED_LABEL = 'Repriced';

/** A repriced item keeps the sale price it was added at, in `originalSalePriceCents`. */
export function isRepriced(item: ListItem): boolean {
  return item.repricedAt !== null;
}

/**
 * The item's price as the list row writes it (`ShoppingListRow`): the current price with its unit, and
 * for a repriced item the old sale price struck through beside it, or "No price" when repricing
 * cleared it. A repriced row is marked as well as struck through, because a strikethrough alone
 * does not say why the number moved.
 */
export function ItemPrice({ item }: { item: ListItem }): ReactElement {
  const repriced = isRepriced(item);
  return (
    <span className="flex flex-wrap items-baseline justify-end gap-x-2 gap-y-1">
      {repriced && item.originalSalePriceCents !== null && (
        <s className="text-body-sm text-muted tabular-nums">
          {formatCents(item.originalSalePriceCents)}
        </s>
      )}
      <span className="text-body text-primary tabular-nums">
        {item.priceCents === null ? NO_PRICE_LABEL : formatPrice(item.priceCents, item.priceUnit)}
      </span>
      {repriced && <Badge variant="warning">{REPRICED_LABEL}</Badge>}
    </span>
  );
}

/** The same thing as a sentence, so a row is announced whole rather than as fragments. */
export function speakItemPrice(item: ListItem): string {
  const current =
    item.priceCents === null ? NO_PRICE_LABEL : speakPrice(item.priceCents, item.priceUnit);
  if (!isRepriced(item) || item.originalSalePriceCents === null) return current;
  return `${current}, repriced from ${formatCents(item.originalSalePriceCents)}`;
}
