import { useId, type ReactElement } from 'react';
import type { Deal } from '@hearth/shared';
import { Badge } from '../../components/ui/Badge.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { formatUnitPrice } from '../../lib/money.ts';
import { AddToList } from './AddToList.tsx';
import { CONDITIONAL_LABEL, dealSentence, discountLabel, validityLabel } from './deal-copy.ts';
import { DealImage } from './DealImage.tsx';

export interface DealCardProps {
  householdId: string;
  deal: Deal;
}

/**
 * Design › Composite components › `DealCard`. Every figure here was computed by the service and
 * arrives as integer cents; the card only formats it.
 *
 * The priced cluster is `aria-hidden` and a single sentence carries it instead, because a screen
 * reader hearing "$2.50", "$2.99", "16%" as separate fragments learns less than one hearing the
 * sentence (Design › Accessibility, "Deal cards announce price and discount as a sentence").
 */
export function DealCard({ householdId, deal }: DealCardProps): ReactElement {
  const nameId = useId();
  const sentenceId = useId();
  const unitPrice = formatUnitPrice(deal.unitPrice, deal.priceUnit);
  // Flipp's own copy, kept beside the computed unit price when it says something different:
  // the shelf tag reads "2/$5.00" and the comparison reads "$2.50".
  const displayPrice = deal.displayPrice.trim();
  const hasDisplayPrice = displayPrice !== '' && displayPrice !== unitPrice;

  return (
    <Card as="article" aria-labelledby={`${nameId} ${sentenceId}`} className="flex flex-col gap-3">
      <p id={sentenceId} className="sr-only">
        {dealSentence(deal)}
      </p>
      <div className="flex items-start gap-3">
        <DealImage url={deal.imageUrl} className="size-16" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 id={nameId} className="text-h3 text-primary">
            {deal.name}
          </h3>
          <p className="text-body-sm text-secondary">{deal.merchantName}</p>
          <p aria-hidden className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-h3 tabular-nums text-section">{unitPrice}</span>
            {deal.originalPrice !== null && (
              <span className="text-body-sm tabular-nums text-muted line-through">
                {formatUnitPrice(deal.originalPrice, deal.priceUnit)}
              </span>
            )}
            {hasDisplayPrice && <span className="text-body-sm text-secondary">{displayPrice}</span>}
          </p>
        </div>
      </div>

      <div aria-hidden className="flex flex-wrap items-center gap-2">
        {deal.discountPercent !== null && (
          <Badge variant="section">{discountLabel(deal.discountPercent)}</Badge>
        )}
        {deal.conditionalPrice && deal.conditionalReason !== null && (
          <Badge variant="warning">{CONDITIONAL_LABEL[deal.conditionalReason]}</Badge>
        )}
        {deal.category !== null && <Badge variant="neutral">{deal.category}</Badge>}
        <span className="text-caption text-muted">{validityLabel(deal)}</span>
      </div>

      <AddToList householdId={householdId} deal={deal} />
    </Card>
  );
}
