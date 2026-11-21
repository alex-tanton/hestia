import { useId, type ReactElement } from 'react';
import type { Deal } from '@hestia/shared';
import { Badge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { formatUnitPrice } from '../../lib/money.ts';
import { CONDITIONAL_LABEL, dealSentence, validityLabel } from './deal-copy.ts';
import { DealImage } from './DealImage.tsx';

export interface DealCardProps {
  householdId?: string | undefined;
  deal: Deal;
  onAdd?: ((deal: Deal) => void) | undefined;
}

/**
 * DealCard renders a compact single-column horizontal card on mobile (<600px):
 * 72x72 photo on left, title/store/validity in middle, bold price with single tonal
 * -X% badge and + Add icon button on right (D-17, DEAL-07).
 */
export function DealCard({ deal, onAdd }: DealCardProps): ReactElement {
  const nameId = useId();
  const sentenceId = useId();
  const unitPrice = formatUnitPrice(deal.unitPrice, deal.priceUnit);
  // Flipp's own copy, kept beside the computed unit price when it says something different:
  const displayPrice = deal.displayPrice.trim();
  const hasDisplayPrice = displayPrice !== '' && displayPrice !== unitPrice;

  return (
    <Card
      as="article"
      variant="flat"
      aria-labelledby={`${nameId} ${sentenceId}`}
      className="flex items-center gap-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3"
    >
      <p id={sentenceId} className="sr-only">
        {dealSentence(deal)}
      </p>

      {/* Left column: 72x72 thumbnail */}
      <DealImage url={deal.imageUrl} className="size-[72px] shrink-0 rounded-lg object-cover" />

      {/* Middle column: Title, store, validity */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 id={nameId} className="truncate text-body-md font-semibold text-on-surface">
          {deal.name}
        </h3>
        <p className="text-label-md text-on-surface-variant">{deal.merchantName}</p>
        <div aria-hidden className="flex flex-wrap items-center gap-1.5">
          {deal.conditionalPrice && deal.conditionalReason !== null && (
            <Badge variant="warning">{CONDITIONAL_LABEL[deal.conditionalReason]}</Badge>
          )}
          {deal.category !== null && <Badge variant="neutral">{deal.category}</Badge>}
          <span className="text-label-sm text-on-surface-variant">{validityLabel(deal)}</span>
        </div>
      </div>

      {/* Right column: Price, discount badge, + Add button */}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <p aria-hidden className="flex flex-col items-end">
          <span className="text-title-md font-semibold tabular-nums text-primary text-section">
            {unitPrice}
          </span>
          {deal.originalPrice !== null && (
            <span className="text-label-sm tabular-nums text-muted line-through">
              {formatUnitPrice(deal.originalPrice, deal.priceUnit)}
            </span>
          )}
          {hasDisplayPrice && (
            <span className="text-label-sm text-on-surface-variant">{displayPrice}</span>
          )}
        </p>

        {deal.discountPercent !== null && <Badge variant="section">-{deal.discountPercent}%</Badge>}

        <Button
          variant="primary"
          isIconOnly
          aria-label={`Add ${deal.name} to shopping list`}
          onClick={() => {
            onAdd?.(deal);
          }}
          className="size-9 rounded-full"
        >
          <Icon name="add" size={20} />
        </Button>
      </div>
    </Card>
  );
}
