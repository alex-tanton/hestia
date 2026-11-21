import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { Card } from '../ui/Card.tsx';
import { Icon } from '../ui/Icon.tsx';

export const FIRST_RUN_HEADING = 'Start with a list';
export const FIRST_RUN_COPY =
  'This Week shows what is due, planned, and left to buy. Nothing is here yet, so start with a shopping list.';

/**
 * When every *shipped* pillar is empty, one first-run hero panel replaces those
 * pillars' empty cards. Rendered as a warm tonal surfaceContainerLow hero card
 * spanning col-span-full with stepped quick-start pills per D-01 and D-03.
 */
export function DashboardFirstRun(): ReactElement {
  return (
    <Card
      as="section"
      variant="flat"
      className="col-span-full flex flex-col gap-4 p-6 bg-[var(--md-sys-color-surface-container-low)]"
      aria-label={FIRST_RUN_HEADING}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)]">
          <Icon name="home" size={24} />
        </div>
        <h2 className="text-title-lg font-semibold text-[var(--md-sys-color-on-surface)]">
          {FIRST_RUN_HEADING}
        </h2>
      </div>

      <p className="max-w-[70ch] text-body-md text-[var(--md-sys-color-on-surface-variant)]">
        {FIRST_RUN_COPY}
      </p>

      {/* Stepped quick-start action pills */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Link
          to="/lists"
          className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-label-md font-semibold bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] hover:opacity-90 transition-opacity"
        >
          <Icon name="shopping_cart" size={18} />
          <span>Create a shopping list</span>
        </Link>
        <Link
          to="/bills"
          className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-label-md font-semibold bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] hover:opacity-90 transition-opacity"
        >
          <Icon name="receipt_long" size={18} />
          <span>Add upcoming bill</span>
        </Link>
        <Link
          to="/meals"
          className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-label-md font-semibold bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] hover:opacity-90 transition-opacity"
        >
          <Icon name="restaurant" size={18} />
          <span>Plan first meal</span>
        </Link>
      </div>
    </Card>
  );
}
