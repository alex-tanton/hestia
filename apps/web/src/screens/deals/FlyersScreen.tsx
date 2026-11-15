import { useCallback, useState, type ComponentType, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router';
import type { DealScope, Flyer } from '@hestia/shared';
import { EmptyState, ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
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

function NewspaperIcon({ className }: { className?: string | undefined }): ReactElement {
  return <Icon name="newspaper" size={48} className={className} />;
}

/**
 * Browse flyers: presents store catalogs in a 2-4 column elevated MD3 card grid
 * with merchant logo, cover preview thumbnail, valid dates, and item count badge (D-20, DEAL-07).
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
                icon={NewspaperIcon as ComponentType<{ className?: string }>}
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
              <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {rows.map((flyer) => (
                  <li key={flyer.flyerId}>
                    <Card
                      as="article"
                      variant="raised"
                      className="flex h-full cursor-pointer flex-col overflow-hidden bg-[var(--md-sys-color-surface-container)] p-0 transition-shadow hover:shadow-md"
                    >
                      <Link
                        to={flyerPath(flyer)}
                        state={{ merchantName: flyer.merchantName }}
                        className="flex h-full flex-col focus:outline-none"
                      >
                        <div className="aspect-[4/3] w-full overflow-hidden bg-[var(--md-sys-color-surface-container-highest)]">
                          <DealImage
                            url={flyer.thumbnailUrl ?? flyer.logoUrl}
                            className="size-full object-cover"
                          />
                        </div>
                        <div className="flex flex-1 flex-col gap-1 p-3">
                          <span className="truncate text-title-md font-semibold text-on-surface">
                            {flyer.merchantName}
                          </span>
                          <span className="text-label-sm text-on-surface-variant">
                            {validityLabel(flyer)}
                          </span>
                          <div className="mt-auto pt-1">
                            <Badge variant="neutral">{pluralize(flyer.itemCount, 'item')}</Badge>
                          </div>
                        </div>
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
