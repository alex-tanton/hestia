import { ChevronRight, TriangleAlert } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { PILLARS, type PillarId } from '../../lib/sections.ts';
import { SectionProvider } from '../../lib/section-context.tsx';
import { ErrorBoundary } from '../states/ErrorBoundary.tsx';
import { ErrorState } from '../states/StateBlocks.tsx';
import { Card } from '../ui/Card.tsx';
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

/** Design › Composite components: up to three items plus a remainder count. */
export const DASHBOARD_ITEM_LIMIT = 3;

function CardBody({ title, state }: { title: string; state: DashboardCardState }): ReactElement {
  switch (state.status) {
    case 'placeholder':
      return <p className="text-body-sm text-muted">Coming soon</p>;
    case 'loading':
      return <SkeletonRows label={`Loading ${title.toLowerCase()}`} />;
    case 'error':
      return (
        <div className="relative z-10">
          <ErrorState message={state.message} onRetry={state.onRetry} />
        </div>
      );
    case 'empty':
      return <p className="text-body-sm text-secondary">{state.message}</p>;
    case 'populated': {
      const shown = state.items.slice(0, DASHBOARD_ITEM_LIMIT);
      const remainder = state.total - shown.length;
      return (
        <>
          <ul className="flex flex-col gap-2">
            {shown.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-3 text-body">
                <span className="flex min-w-0 items-center gap-1.5">
                  {item.isOverdue && (
                    <TriangleAlert
                      aria-hidden
                      size={16}
                      strokeWidth={2}
                      className="shrink-0 self-center text-danger-accent"
                    />
                  )}
                  <span
                    className={item.isOverdue ? 'truncate text-danger' : 'truncate text-primary'}
                  >
                    {item.label}
                    {item.isOverdue && <span className="text-body-sm"> · Overdue</span>}
                  </span>
                </span>
                {item.detail && (
                  <span className="shrink-0 text-body-sm text-secondary tabular-nums">
                    {item.detail}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {remainder > 0 && <p className="mt-2 text-body-sm text-secondary">+{remainder} more</p>}
        </>
      );
    }
  }
}

/**
 * One This Week card. It carries its own section context, so its header takes its pillar's
 * color, and its own error boundary, so a failure stays inside the card (Design › Error rules).
 * A placeholder is muted and not a link: an unshipped pillar offers nothing to tap.
 */
export function DashboardCard({ pillar, title, state }: DashboardCardProps): ReactElement {
  const { icon: Icon, path } = PILLARS[pillar];
  const isPlaceholder = state.status === 'placeholder';
  const headingId = `dashboard-card-${pillar}`;

  return (
    <SectionProvider section={pillar}>
      <Card
        as="section"
        variant={isPlaceholder ? 'flat' : 'raised'}
        aria-labelledby={headingId}
        className={
          isPlaceholder
            ? 'bg-raised'
            : 'relative transition-colors duration-150 ease-out hover:border-input'
        }
      >
        <h2 id={headingId} className="mb-3 text-h3 text-section">
          {isPlaceholder ? (
            <span className="flex items-center gap-2">
              <Icon aria-hidden size={20} strokeWidth={1.5} className="text-section-accent" />
              {title}
            </span>
          ) : (
            // The stretched link makes the whole card the tap target for its section.
            <Link
              to={path}
              className="flex items-center gap-2 after:absolute after:inset-0 after:rounded-md"
            >
              <Icon aria-hidden size={20} strokeWidth={1.5} className="text-section-accent" />
              <span className="flex-1">{title}</span>
              <ChevronRight aria-hidden size={20} strokeWidth={1.5} className="text-muted" />
            </Link>
          )}
        </h2>
        <ErrorBoundary
          fallback={(reset) => (
            <div className="relative z-10">
              <ErrorState
                message={`Something went wrong loading ${title.toLowerCase()}. Try again, or reload.`}
                onRetry={reset}
              />
            </div>
          )}
        >
          <CardBody title={title} state={state} />
        </ErrorBoundary>
      </Card>
    </SectionProvider>
  );
}
