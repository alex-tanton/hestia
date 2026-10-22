import { Tag } from 'lucide-react';
import { useCallback, type ReactElement } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Deal, Freshness } from '@hearth/shared';
import { EmptyState, ErrorState } from '../../components/states/StateBlocks.tsx';
import { Skeleton } from '../../components/ui/Skeleton.tsx';
import { useDelayedVisible } from '../../lib/use-delayed-visible.ts';
import { pluralize } from '../../lib/format.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { DealCard } from './DealCard.tsx';
import { DealFreshness } from './DealFreshness.tsx';
import { Pagination } from './Pagination.tsx';
import { useRefreshPoll } from './use-refresh-poll.ts';

export interface DealPage extends Freshness {
  deals: Deal[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

/** A skeleton mirrors the real layout, here the deal card's own shape. */
export function DealSkeletons({
  label,
  count = 3,
}: {
  label: string;
  count?: number;
}): ReactElement {
  const isVisible = useDelayedVisible();
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      {isVisible &&
        Array.from({ length: count }, (_, index) => (
          <span
            key={index}
            data-testid="deal-skeleton"
            className="flex gap-3 rounded-md border border-border p-4"
          >
            <Skeleton className="size-16 shrink-0" />
            <span className="flex flex-1 flex-col gap-2 py-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </span>
          </span>
        ))}
    </div>
  );
}

export interface DealResultsProps {
  householdId: string;
  query: UseQueryResult<DealPage>;
  /** What is loading, for assistive tech ("Loading deals"). */
  loadingLabel: string;
  /** Filtered-empty copy differs from first-run copy. */
  emptyMessage: string;
  emptyAction?: { label: string; onAction: () => void } | undefined;
  errorMessage: string;
  /** A failed fetch with no cache offers a route forward. */
  manualAlternative: { label: string; onAction: () => void };
  onPageChange: (page: number) => void;
}

/**
 * The results region shared by deal search and a flyer's items: the same `DealCard` list, the
 * same pagination, and the same deals-specific freshness states.
 */
export function DealResults({
  householdId,
  query,
  loadingLabel,
  emptyMessage,
  emptyAction,
  errorMessage,
  manualAlternative,
  onPageChange,
}: DealResultsProps): ReactElement {
  const isOnline = useOnlineStatus();
  const data = query.data;
  // TanStack Query memoizes `refetch`, so the poll's wait is not restarted by every render.
  const { refetch: runRefetch } = query;
  const refetch = useCallback(() => {
    void runRefetch();
  }, [runRefetch]);
  const { hasGivenUp } = useRefreshPoll(data?.refreshing ?? false, refetch, isOnline);

  if (query.isPending) return <DealSkeletons label={loadingLabel} />;

  if (query.isError || data === undefined) {
    // A 503 is the "fetch failed, nothing cached" answer; with any cache the service sends 200
    // and `stale`, so reaching here means there is genuinely nothing to show.
    return <ErrorState message={errorMessage} onRetry={refetch} alternative={manualAlternative} />;
  }

  const isEmpty = data.deals.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <DealFreshness
        asOf={data.asOf}
        stale={data.stale}
        refreshing={data.refreshing}
        hasGivenUp={hasGivenUp}
        onRetry={refetch}
      />

      {isEmpty && data.refreshing && <DealSkeletons label={loadingLabel} />}
      {isEmpty && !data.refreshing && (
        <EmptyState
          icon={Tag}
          message={emptyMessage}
          {...(emptyAction ? { action: emptyAction } : {})}
        />
      )}

      {!isEmpty && (
        <>
          <p className="text-body-sm tabular-nums text-secondary">
            {pluralize(data.total, 'deal')}
          </p>
          <ul className="flex flex-col gap-3">
            {data.deals.map((deal) => (
              <li key={deal.id}>
                <DealCard householdId={householdId} deal={deal} />
              </li>
            ))}
          </ul>
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            hasMore={data.hasMore}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  );
}
