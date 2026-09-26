import { Newspaper } from 'lucide-react';
import { useCallback, useState, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router';
import type { DealScope, Flyer } from '@hearth/shared';
import { EmptyState, ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { SegmentedControl } from '../../components/ui/SegmentedControl.tsx';
import { useFlyers } from '../../lib/api/deals.ts';
import { pluralize } from '../../lib/format.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { DealSkeletons } from './DealResults.tsx';
import { DealFreshness } from './DealFreshness.tsx';
import { DealImage } from './DealImage.tsx';
import { DealsFrame, useActiveHousehold } from './deals-frame.tsx';
import { FavoritesPrompt, noStoresMessage } from './FavoriteStores.tsx';
import { validityLabel } from './deal-copy.ts';
import { useRefreshPoll } from './use-refresh-poll.ts';

export const FLYERS_OFFLINE_MESSAGE = 'Browsing flyers needs a connection. Your lists still work.';

const SCOPE_SEGMENTS = [
  { value: 'favorites', label: 'Favorite stores' },
  { value: 'all', label: 'All stores' },
];

export function flyerPath(flyer: Pick<Flyer, 'flyerId'>): string {
  return `/lists/flyers/${encodeURIComponent(flyer.flyerId)}`;
}

/**
 * Design › Screens › 6, Browse flyers: every active flyer near the household's postal code, with
 * merchant, validity dates, and item count. Tapping one opens its items.
 */
export function FlyersScreen(): ReactElement {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { householdId, postalCode } = useActiveHousehold();
  const [scope, setScope] = useState<DealScope>('favorites');
  const flyers = useFlyers(isOnline ? householdId : undefined, scope);
  // TanStack Query memoizes `refetch`, so the poll's wait is not restarted by every render.
  const { refetch: runRefetch } = flyers;
  const refetch = useCallback(() => {
    void runRefetch();
  }, [runRefetch]);
  const { hasGivenUp } = useRefreshPoll(flyers.data?.refreshing ?? false, refetch, isOnline);

  if (!isOnline) {
    return (
      <DealsFrame>
        <OfflineState message={FLYERS_OFFLINE_MESSAGE} />
      </DealsFrame>
    );
  }

  const rows = flyers.data?.flyers ?? [];
  const hasFavorites = rows.some((flyer) => flyer.isFavorite);

  return (
    <DealsFrame>
      <div className="flex flex-col gap-4">
        <SegmentedControl
          label="Store scope"
          segments={SCOPE_SEGMENTS}
          value={scope}
          onValueChange={(value) => {
            setScope(value as DealScope);
          }}
        />

        {scope === 'favorites' && flyers.data && !hasFavorites && householdId !== undefined && (
          <FavoritesPrompt householdId={householdId} postalCode={postalCode} />
        )}

        {flyers.isPending && <DealSkeletons label="Loading flyers" />}

        {flyers.isError && (
          <ErrorState
            message="Couldn't reach the store data, and there is nothing saved to show."
            onRetry={refetch}
            alternative={{
              label: 'Add items by hand',
              onAction: () => {
                void navigate('/lists');
              },
            }}
          />
        )}

        {flyers.data && (
          <>
            <DealFreshness
              asOf={flyers.data.asOf}
              stale={flyers.data.stale}
              refreshing={flyers.data.refreshing}
              hasGivenUp={hasGivenUp}
              onRetry={refetch}
            />

            {rows.length === 0 && flyers.data.refreshing && (
              <DealSkeletons label="Loading flyers" />
            )}

            {rows.length === 0 && !flyers.data.refreshing && (
              <EmptyState
                icon={Newspaper}
                message={
                  scope === 'favorites'
                    ? 'No active flyers at your favorite stores this week.'
                    : noStoresMessage(postalCode)
                }
                action={{
                  label: scope === 'favorites' ? 'Browse all stores' : 'Change the postal code',
                  onAction: () => {
                    if (scope === 'favorites') setScope('all');
                    else void navigate('/settings');
                  },
                }}
              />
            )}

            {rows.length > 0 && (
              <ul className="grid gap-3 sm:grid-cols-2">
                {rows.map((flyer) => (
                  <li key={flyer.flyerId}>
                    <Card className="h-full p-0">
                      <Link
                        to={flyerPath(flyer)}
                        state={{ merchantName: flyer.merchantName }}
                        className="flex min-h-11 items-center gap-3 rounded-md p-4 hover:bg-raised active:bg-section-tint"
                      >
                        <DealImage url={flyer.logoUrl ?? flyer.thumbnailUrl} className="size-12" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-h3 text-primary">
                            {flyer.merchantName}
                          </span>
                          <span className="text-body-sm text-secondary">
                            {validityLabel(flyer)}
                          </span>
                          <span className="text-caption tabular-nums text-muted">
                            {pluralize(flyer.itemCount, 'item')}
                          </span>
                        </span>
                      </Link>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </DealsFrame>
  );
}

/** Lazy route module for the Lists tab's Flyers sub-tab. */
export function Component(): ReactElement {
  return <FlyersScreen />;
}
