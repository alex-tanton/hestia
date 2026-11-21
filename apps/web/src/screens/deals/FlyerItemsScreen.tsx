import { useMemo, useState, type ReactElement } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import type { Deal, DealSort } from '@hestia/shared';
import { OfflineState } from '../../components/states/StateBlocks.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { useScreenChrome } from '../../components/shell/screen-chrome.tsx';
import {
  useAddDealToList,
  useFlyerItems,
  useShoppingLists,
  type FlyerItemsParams,
} from '../../lib/api/deals.ts';
import { useDeleteListItem } from '../../lib/api/list-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { AddToListSheet } from './AddToListSheet.tsx';
import { DealResults } from './DealResults.tsx';
import { DealsFrame, useActiveHousehold } from './deals-frame.tsx';
import { FLYERS_OFFLINE_MESSAGE } from './FlyersScreen.tsx';

const ANY_CATEGORY = 'any';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price', label: 'Price' },
];

/**
 * One flyer's items, in the same `DealCard` list with category filtering.
 * It is a pushed screen, so the top bar carries a back control to the flyer list it came from.
 * Shares the screen-level lifted AddToListSheet with smart 1-list addition (D-20, DEAL-07).
 */
const FLYER_CATEGORY_CACHE = new Map<string, Set<string>>();

export function FlyerItemsScreen(): ReactElement {
  const navigate = useNavigate();
  const toast = useToast();
  const isOnline = useOnlineStatus();
  const { flyerId } = useParams<{ flyerId: string }>();
  const { householdId } = useActiveHousehold();
  const [category, setCategory] = useState<string>();
  const [sort, setSort] = useState<DealSort>('relevance');
  const [page, setPage] = useState(1);

  // Lifted AddToListSheet state
  const [dealToAdd, setDealToAdd] = useState<Deal | null>(null);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const lists = useShoppingLists(isOnline ? householdId : undefined);
  const addToList = useAddDealToList(householdId ?? '');
  const deleteItem = useDeleteListItem(householdId ?? '');

  // The flyer list hands its merchant name along, so the pushed screen can name itself without a
  // request of its own; a direct visit falls back to the neutral title.
  const merchantName =
    (useLocation().state as { merchantName?: string } | null)?.merchantName ?? 'Flyer';

  useScreenChrome({ title: merchantName, backTo: '/lists/flyers', backLabel: 'Flyers' });

  const params: FlyerItemsParams = { category, sort, page };
  const items = useFlyerItems(isOnline ? householdId : undefined, flyerId, params);

  const categoryOptions = useMemo(() => {
    const flyerKey = flyerId ?? 'default';
    let cached = FLYER_CATEGORY_CACHE.get(flyerKey);
    if (!cached) {
      cached = new Set<string>();
      FLYER_CATEGORY_CACHE.set(flyerKey, cached);
    }
    for (const deal of items.data?.deals ?? []) {
      if (deal.category) cached.add(deal.category);
    }
    const found = new Set(cached);
    if (category !== undefined) found.add(category);
    return [
      { value: ANY_CATEGORY, label: 'Any category' },
      ...[...found].sort().map((val) => ({ value: val, label: val })),
    ];
  }, [flyerId, items.data, category]);

  const handleAddDeal = (deal: Deal): void => {
    const activeLists = (lists.data ?? []).filter((l) => l.archivedAt === null);
    const list = activeLists[0];
    if (activeLists.length === 1 && list !== undefined) {
      addToList.mutate(
        { listId: list.id, dealId: deal.id },
        {
          onSuccess: (data) => {
            toast({
              variant: 'success',
              message: `Added '${deal.name}' to ${list.name}`,
              action: {
                label: 'Undo',
                onAction: () => {
                  if (data.id) {
                    deleteItem.mutate({ listId: list.id, itemId: data.id });
                  }
                },
              },
            });
          },
          onError: (error) => {
            toast({
              variant: 'error',
              message: userMessage(error, { fallback: `Could not add ${deal.name}. Try again.` }),
            });
          },
        },
      );
    } else {
      setDealToAdd(deal);
      setIsAddSheetOpen(true);
    }
  };

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
            onAddDeal={handleAddDeal}
          />
        )}
      </div>

      {/* Lifted screen-level AddToListSheet */}
      {householdId !== undefined && (
        <AddToListSheet
          open={isAddSheetOpen}
          onOpenChange={(open) => {
            setIsAddSheetOpen(open);
            if (!open) setDealToAdd(null);
          }}
          deal={dealToAdd}
          householdId={householdId}
        />
      )}
    </DealsFrame>
  );
}

/** Lazy route module: one flyer's items, pushed from Browse flyers. */
export function Component(): ReactElement {
  return <FlyerItemsScreen />;
}
