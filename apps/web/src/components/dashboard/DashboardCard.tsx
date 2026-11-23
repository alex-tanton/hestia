import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { PILLARS, type PillarId } from '../../lib/sections.ts';
import { ErrorBoundary } from '../states/ErrorBoundary.tsx';
import { ErrorState } from '../states/StateBlocks.tsx';
import { Card } from '../ui/Card.tsx';
import { Icon, type IconName } from '../ui/Icon.tsx';
import { SkeletonRows } from '../ui/Skeleton.tsx';

export interface DashboardItem {
  id: string;
  label: string;
  detail?: string;
  /** Overdue items get danger styling plus an icon and the word "Overdue". */
  isOverdue?: boolean;
}

export type DashboardCardState =
  | { status: 'placeholder' }
  | { status: 'loading' }
  | { status: 'error'; message: string; onRetry: () => void }
  | { status: 'empty'; message: string }
  | { status: 'populated'; items: readonly DashboardItem[]; total: number };

export interface DashboardCardProps {
  pillar: PillarId;
  title: string;
  state: DashboardCardState;
}

/** Up to three items plus a remainder count. */
export const DASHBOARD_ITEM_LIMIT = 3;

/** Sort items by urgency: overdue first, then preserving existing order. */
export function sortPillarItems(items: readonly DashboardItem[]): DashboardItem[] {
  return [...items].sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return 0;
  });
}

function pillarIcon(pillar: PillarId): IconName {
  switch (pillar) {
    case 'bills':
      return 'receipt_long';
    case 'lists':
      return 'shopping_cart';
    case 'meals':
      return 'restaurant';
    case 'chores':
      return 'checklist';
  }
}

function CardBody({
  title,
  pillar,
  state,
}: {
  title: string;
  pillar: PillarId;
  state: DashboardCardState;
}): ReactElement {
  const { path } = PILLARS[pillar];

  switch (state.status) {
    case 'placeholder':
      return (
        <p className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">Coming soon</p>
      );
    case 'loading':
      return <SkeletonRows label={`Loading ${title.toLowerCase()}`} />;
    case 'error':
      return (
        <div className="relative z-10">
          <ErrorState message={state.message} onRetry={state.onRetry} layout="card" />
        </div>
      );
    case 'empty':
      return (
        <p className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
          {state.message}
        </p>
      );
    case 'populated': {
      const sorted = sortPillarItems(state.items);
      const shown = sorted.slice(0, DASHBOARD_ITEM_LIMIT);
      const remainder = state.total - shown.length;
      return (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-2">
            {shown.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-body-sm">
                <span className="flex min-w-0 items-center gap-1.5">
                  {item.isOverdue && (
                    <Icon
                      name="error"
                      size={16}
                      className="shrink-0 text-[var(--md-sys-color-error)]"
                    />
                  )}
                  <span
                    className={
                      item.isOverdue
                        ? 'truncate font-semibold text-[var(--md-sys-color-error)]'
                        : 'truncate text-[var(--md-sys-color-on-surface)]'
                    }
                  >
                    {item.label}
                    {item.isOverdue && <span className="font-normal"> · Overdue</span>}
                  </span>
                </span>
                {item.detail && (
                  <span className="shrink-0 text-body-sm text-[var(--md-sys-color-on-surface-variant)] tabular-nums">
                    {item.detail}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {remainder > 0 && (
            <div className="pt-2 border-t border-[var(--md-sys-color-surface-container)]">
              <Link
                to={path}
                className="inline-block text-label-md font-medium text-[var(--md-sys-color-primary)] hover:underline"
              >
                +{remainder} more in {title}
              </Link>
            </div>
          )}
        </div>
      );
    }
  }
}

/**
 * One This Week card. Rendered as a borderless flat tonal card with variant="flat"
 * and surfaceContainerLow background token. Header title is a direct link to the pillar
 * path (preventing stretched-link collision with interactive footer links).
 */
export function DashboardCard({ pillar, title, state }: DashboardCardProps): ReactElement {
  const { path } = PILLARS[pillar];
  const isPlaceholder = state.status === 'placeholder';
  const headingId = `dashboard-card-${pillar}`;

  return (
    <Card
      as="section"
      variant="flat"
      aria-labelledby={headingId}
      className="flex flex-col gap-4 p-6 bg-[var(--md-sys-color-surface-container-low)]"
    >
      <h2
        id={headingId}
        className="text-title-md font-semibold text-[var(--md-sys-color-on-surface)]"
      >
        {isPlaceholder ? (
          <span className="flex items-center gap-2 text-[var(--md-sys-color-on-surface-variant)]">
            <Icon
              name={pillarIcon(pillar)}
              size={20}
              className="text-[var(--md-sys-color-on-surface-variant)]"
            />
            {title}
          </span>
        ) : (
          <Link
            to={path}
            className="flex items-center gap-2 text-[var(--md-sys-color-on-surface)] hover:text-[var(--md-sys-color-primary)]"
          >
            <Icon
              name={pillarIcon(pillar)}
              size={20}
              className="text-[var(--md-sys-color-primary)]"
            />
            <span className="flex-1">{title}</span>
          </Link>
        )}
      </h2>
      <ErrorBoundary
        fallback={(reset) => (
          <div className="relative z-10">
            <ErrorState
              message={`Something went wrong loading ${title.toLowerCase()}. Try again, or reload.`}
              onRetry={reset}
              layout="card"
            />
          </div>
        )}
      >
        <CardBody title={title} pillar={pillar} state={state} />
      </ErrorBoundary>
    </Card>
  );
}
