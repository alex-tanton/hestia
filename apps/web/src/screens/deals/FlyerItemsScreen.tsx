import { useMemo, useState, type ReactElement } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import type { DealSort } from '@hearth/shared';
import { OfflineState } from '../../components/states/StateBlocks.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { useScreenChrome } from '../../components/shell/screen-chrome.tsx';
import { useFlyerItems, type FlyerItemsParams } from '../../lib/api/deals.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { DealResults } from './DealResults.tsx';
import { DealsFrame, useActiveHousehold } from './deals-frame.tsx';
import { FLYERS_OFFLINE_MESSAGE } from './FlyersScreen.tsx';

const ANY_CATEGORY = 'any';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price', label: 'Price' },
];

/**
 * Design › Screens › 6: one flyer's items, in the same `DealCard` list with category filtering.
 * It is a pushed screen, so the top bar carries a back control to the flyer list it came from.
 *
 * A flyer-items request never fetches from Flipp inline (Technical Architecture, "Dormant postal
 * codes"), so an empty answer with `refreshing` is the no-cache state, and the results appear when
 * the queued background refresh finishes.
 */
export function FlyerItemsScreen(): ReactElement {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { flyerId } = useParams<{ flyerId: string }>();
  const { householdId } = useActiveHousehold();
  const [category, setCategory] = useState<string>();
  const [sort, setSort] = useState<DealSort>('relevance');
  const [page, setPage] = useState(1);

  // The flyer list hands its merchant name along, so the pushed screen can name itself without a
  // request of its own; a direct visit falls back to the neutral title.
  const merchantName =
    (useLocation().state as { merchantName?: string } | null)?.merchantName ?? 'Flyer';

  useScreenChrome({ title: merchantName, backTo: '/lists/flyers', backLabel: 'Flyers' });

  const params: FlyerItemsParams = { category, sort, page };
  const items = useFlyerItems(isOnline ? householdId : undefined, flyerId, params);

  const categoryOptions = useMemo(() => {
    const found = new Set((items.data?.deals ?? []).map((deal) => deal.category ?? ''));
    found.delete('');
    if (category !== undefined) found.add(category);
    return [
      { value: ANY_CATEGORY, label: 'Any category' },
      ...[...found].sort().map((value) => ({ value, label: value })),
    ];
  }, [items.data, category]);

  if (!isOnline) {
    return (
      <DealsFrame>
        <OfflineState message={FLYERS_OFFLINE_MESSAGE} />
      </DealsFrame>
    );
  }

  return (
    <DealsFrame>
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Category"
            options={categoryOptions}
            value={category ?? ANY_CATEGORY}
            onValueChange={(value) => {
              setCategory(value === ANY_CATEGORY ? undefined : value);
              setPage(1);
            }}
          />
          <Select
            label="Sort by"
            options={SORT_OPTIONS}
            value={sort}
            onValueChange={(value) => {
              setSort(value as DealSort);
              setPage(1);
            }}
          />
        </div>

        {householdId !== undefined && (
          <DealResults
            householdId={householdId}
            query={items}
            loadingLabel="Loading flyer items"
            emptyMessage={
              category === undefined
                ? 'No items in this flyer yet.'
                : 'No deals match these filters.'
            }
            {...(category === undefined
              ? {}
              : {
                  emptyAction: {
                    label: 'Clear filters',
                    onAction: () => {
                      setCategory(undefined);
                      setPage(1);
                    },
                  },
                })}
            errorMessage="Couldn't load this flyer's items, and there is nothing saved to show."
            manualAlternative={{
              label: 'Add items by hand',
              onAction: () => {
                void navigate('/lists');
              },
            }}
            onPageChange={setPage}
          />
        )}
      </div>
    </DealsFrame>
  );
}

/** Lazy route module: one flyer's items, pushed from Browse flyers. */
export function Component(): ReactElement {
  return <FlyerItemsScreen />;
}
