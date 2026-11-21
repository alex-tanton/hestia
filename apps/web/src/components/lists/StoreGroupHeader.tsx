import { useState, type ReactElement } from 'react';
import type { StoreGroup } from '@hestia/shared';
import { formatCents, pluralize } from '../../lib/format.ts';
import { Icon } from '../ui/Icon.tsx';
import { PENDING_SUBTOTAL_LABEL, PendingMark } from './PendingMark.tsx';

/** Items with no store group together, last. */
export const ANYWHERE_LABEL = 'Anywhere';

export interface StoreGroupHeaderProps {
  group: StoreGroup;
  /**
   * The list has writes waiting to sync, so this subtotal is the last one the server sent. The
   * client never recomputes money, so the figure is marked pending rather than guessed at.
   */
  isPending?: boolean;
  headingId: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

/**
 * `StoreGroupHeader`: sticky tonal surfaceContainer bar with merchant, item count badge,
 * running subtotal, "+N unpriced" when items are excluded from it, and chevron toggle.
 */
export function StoreGroupHeader({
  group,
  isPending = false,
  headingId,
  isCollapsed,
  onToggleCollapse,
}: StoreGroupHeaderProps): ReactElement {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = isCollapsed ?? internalCollapsed;
  const toggle =
    onToggleCollapse ??
    (() => {
      setInternalCollapsed((prev) => !prev);
    });
  const name = group.merchantName ?? ANYWHERE_LABEL;

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-[var(--md-sys-color-surface-container)] px-4 py-2.5 text-label-md font-semibold text-[var(--md-sys-color-on-surface)]">
      <div className="flex items-center gap-2">
        <h2
          id={headingId}
          className="text-title-sm font-semibold text-[var(--md-sys-color-on-surface)]"
        >
          {name}
        </h2>
        <span className="inline-flex items-center rounded-full bg-[var(--md-sys-color-surface-container-high)] px-2 py-0.5 text-label-sm font-medium text-[var(--md-sys-color-on-surface-variant)]">
          {group.items.length}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <p className="flex items-baseline gap-2 text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
          <span>{pluralize(group.items.length, 'item')}</span>
          {/* The clock and its text carry the pending state; the figure itself stays legible. */}
          <span className="inline-flex items-center gap-1 text-body font-semibold text-[var(--md-sys-color-on-surface)] tabular-nums">
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
        <button
          type="button"
          aria-label={collapsed ? `Expand ${name} group` : `Collapse ${name} group`}
          aria-expanded={!collapsed}
          onClick={toggle}
          className="inline-flex size-8 items-center justify-center rounded-full text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]"
        >
          <Icon name={collapsed ? 'expand_more' : 'expand_less'} size={20} />
        </button>
      </div>
    </div>
  );
}
