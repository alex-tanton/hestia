import type { ReactElement } from 'react';
import type { StoreGroup } from '@hearth/shared';
import { formatCents, pluralize } from '../../lib/format.ts';
import { PENDING_SUBTOTAL_LABEL, PendingMark } from './PendingMark.tsx';

/** Items with no store group together, last (Design › Screens › 8). */
export const ANYWHERE_LABEL = 'Anywhere';

export interface StoreGroupHeaderProps {
  group: StoreGroup;
  /**
   * The list has writes waiting to sync, so this subtotal is the last one the server sent. The
   * client never recomputes money (Technical Architecture, "API surface"), so the figure is
   * marked pending rather than guessed at.
   */
  isPending?: boolean;
  headingId: string;
}

/**
 * Design › Composite components › `StoreGroupHeader`: merchant, item count, running subtotal, and
 * "+N unpriced" when items are excluded from it (Requirements, "Subtotals").
 */
export function StoreGroupHeader({
  group,
  isPending = false,
  headingId,
}: StoreGroupHeaderProps): ReactElement {
  const name = group.merchantName ?? ANYWHERE_LABEL;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 bg-raised px-4 py-2">
      {/*
       * The page title (`TopBar`) is the screen's only `h1`, so a store group is the next level
       * down, not a third: `h3` here skipped `h2` entirely and failed axe's heading-order check
       * (found live, against the real stack). `text-h3` is a type-scale token, not a heading
       * level, so the visual size is unchanged.
       */}
      <h2 id={headingId} className="text-h3 text-section">
        {name}
      </h2>
      <p className="flex items-baseline gap-2 text-body-sm text-secondary">
        <span>{pluralize(group.items.length, 'item')}</span>
        {/* The clock and its text carry the pending state; the figure itself stays legible. */}
        <span className="inline-flex items-center gap-1 text-body font-semibold text-primary tabular-nums">
          {isPending && <PendingMark label={PENDING_SUBTOTAL_LABEL} />}
          {formatCents(group.subtotalCents)}
        </span>
        {group.unpricedCount > 0 && (
          <span className="tabular-nums">
            +{String(group.unpricedCount)} unpriced
            <span className="sr-only">
              {` ${pluralize(group.unpricedCount, 'item')} not counted in the subtotal`}
            </span>
          </span>
        )}
      </p>
    </div>
  );
}
