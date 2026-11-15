import { useMemo, useState, type ReactElement, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';
import type { Deal, DealScope, DealSort } from '@hestia/shared';
import { Button } from '../../components/ui/Button.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { ModalBottomSheet } from '../../components/ui/ModalBottomSheet.tsx';
import { OfflineState } from '../../components/states/StateBlocks.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { MdFilterChip } from '../../components/md/MdFilterChip.tsx';
import { SegmentedControl } from '../../components/ui/SegmentedControl.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import {
  useAddDealToList,
  useDealSearch,
  useMerchants,
  useShoppingLists,
  type DealSearchParams,
} from '../../lib/api/deals.ts';
import { useDeleteListItem } from '../../lib/api/list-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { parsePriceInput } from '../../lib/money.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { AddToListSheet } from './AddToListSheet.tsx';
import { DealResults } from './DealResults.tsx';
import { DealsFrame, useActiveHousehold } from './deals-frame.tsx';
import { FavoritesPrompt } from './FavoriteStores.tsx';

/** The dedicated state for a screen that cannot work from a cache. */
export const SEARCH_OFFLINE_MESSAGE = 'Deal search needs a connection. Your lists still work.';

const ANY_STORE = 'any';
const ANY_CATEGORY = 'any';

const SCOPE_SEGMENTS = [
  { value: 'favorites', label: 'Favorite stores' },
  { value: 'all', label: 'All stores' },
];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price', label: 'Price' },
];

const INITIAL: DealSearchParams = {
  q: '',
  scope: 'favorites',
  stores: [],
  category: undefined,
  minPriceCents: undefined,
  maxPriceCents: undefined,
  sort: 'relevance',
  page: 1,
};

const ALL_DEAL_CATEGORIES = new Set<string>();

/**
 * Deal search: keyword search across the stores near the household's postal
 * code, scoped to favorites by default with browse-all one tap away. Results are `DealCard`s, 50 to
 * a page. Features MD3 Search Bar, SegmentedControl, quick filter chips, FilterModalBottomSheet,
 * and a single lifted AddToListSheet with smart 1-list addition.
 */
export function DealSearchScreen(): ReactElement {
  const navigate = useNavigate();
  const toast = useToast();
  const isOnline = useOnlineStatus();
  const { householdId, postalCode } = useActiveHousehold();

  const [draftQuery, setDraftQuery] = useState('');
  const [minInput, setMinInput] = useState('');
  const [maxInput, setMaxInput] = useState('');
  const [priceError, setPriceError] = useState<string>();
  const [applied, setApplied] = useState<DealSearchParams>(INITIAL);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Lifted AddToListSheet state
  const [dealToAdd, setDealToAdd] = useState<Deal | null>(null);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const merchants = useMerchants(isOnline ? householdId : undefined);
  const results = useDealSearch(isOnline ? householdId : undefined, applied);
  const lists = useShoppingLists(isOnline ? householdId : undefined);
  const addToList = useAddDealToList(householdId ?? '');
  const deleteItem = useDeleteListItem(householdId ?? '');

  const storeOptions = useMemo(() => {
    const rows = merchants.data?.merchants ?? [];
    const inScope = applied.scope === 'favorites' ? rows.filter((row) => row.isFavorite) : rows;
    const listed = inScope.length > 0 ? inScope : rows;
    return [
      { value: ANY_STORE, label: 'Any store' },
      ...listed.map((row) => ({ value: row.merchantId, label: row.name })),
    ];
  }, [merchants.data, applied.scope]);

  const categoryOptions = useMemo(() => {
    for (const deal of results.data?.deals ?? []) {
      if (deal.category) ALL_DEAL_CATEGORIES.add(deal.category);
    }
    const found = new Set(ALL_DEAL_CATEGORIES);
    if (applied.category !== undefined) found.add(applied.category);
    return [
      { value: ANY_CATEGORY, label: 'Any category' },
      ...[...found].sort().map((cat) => ({ value: cat, label: cat })),
    ];
  }, [results.data, applied.category]);

  const hasFavorites = (merchants.data?.merchants ?? []).some((row) => row.isFavorite);
  const isFiltered =
    applied.stores.length > 0 ||
    applied.category !== undefined ||
    applied.minPriceCents !== undefined ||
    applied.maxPriceCents !== undefined;

  const activeFilterCount =
    (applied.stores.length > 0 ? 1 : 0) +
    (applied.category !== undefined ? 1 : 0) +
    (applied.minPriceCents !== undefined || applied.maxPriceCents !== undefined ? 1 : 0);

  const change = (patch: Partial<DealSearchParams>): void => {
    setApplied((current) => ({ ...current, ...patch, page: 1 }));
  };

  const handleSubmit = (event: SyntheticEvent): void => {
    event.preventDefault();
    const minPriceCents = parsePriceInput(minInput);
    const maxPriceCents = parsePriceInput(maxInput);
    if (
      (minInput.trim() !== '' && minPriceCents === undefined) ||
      (maxInput.trim() !== '' && maxPriceCents === undefined)
    ) {
      setPriceError('Enter a price like 4.99.');
      return;
    }
    if (
      minPriceCents !== undefined &&
      maxPriceCents !== undefined &&
      minPriceCents > maxPriceCents
    ) {
      setPriceError('The lowest price must not be above the highest.');
      return;
    }
    setPriceError(undefined);
    change({ q: draftQuery.trim(), minPriceCents, maxPriceCents });
  };

  const clearFilters = (): void => {
    setMinInput('');
    setMaxInput('');
    setPriceError(undefined);
    change({
      stores: [],
      category: undefined,
      minPriceCents: undefined,
      maxPriceCents: undefined,
      scope: applied.scope,
    });
  };

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
        <OfflineState message={SEARCH_OFFLINE_MESSAGE} />
      </DealsFrame>
    );
  }

  return (
    <DealsFrame>
      <div className="flex flex-col gap-4">
        <form role="search" noValidate className="flex flex-col gap-3" onSubmit={handleSubmit}>
          {/* MD3 Search Bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <TextField
                label="Search deals"
                type="search"
                name="q"
                enterKeyHint="search"
                placeholder="chicken, milk, cereal"
                value={draftQuery}
                onChange={(event) => {
                  setDraftQuery(event.target.value);
                }}
              />
            </div>
            <Button type="submit" className="shrink-0">
              <Icon name="search" size={20} />
              Search
            </Button>
          </div>

          {/* Scope SegmentedControl */}
          <SegmentedControl
            label="Store scope"
            segments={SCOPE_SEGMENTS}
            value={applied.scope}
            onValueChange={(value) => {
              change({ scope: value as DealScope, stores: [] });
            }}
          />

          {/* Quick filter chips row */}
          <div
            className="flex items-center gap-2 overflow-x-auto pb-1"
            aria-label="Quick deal filter chips"
          >
            <MdFilterChip
              selected={activeFilterCount > 0}
              onClick={() => {
                setIsFilterSheetOpen(true);
              }}
            >
              {`All filters${activeFilterCount > 0 ? ` (${String(activeFilterCount)})` : ''}`}
            </MdFilterChip>
            {categoryOptions.slice(1, 4).map((cat) => (
              <MdFilterChip
                key={cat.value}
                selected={applied.category === cat.value}
                onClick={() => {
                  change({ category: applied.category === cat.value ? undefined : cat.value });
                }}
              >
                {cat.label}
              </MdFilterChip>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Store"
              options={storeOptions}
              value={applied.stores[0] ?? ANY_STORE}
              onValueChange={(value) => {
                change({ stores: value === ANY_STORE ? [] : [value] });
              }}
            />
            <Select
              label="Category"
              options={categoryOptions}
              value={applied.category ?? ANY_CATEGORY}
              onValueChange={(value) => {
                change({ category: value === ANY_CATEGORY ? undefined : value });
              }}
            />
            <TextField
              label="Lowest price"
              inputMode="decimal"
              placeholder="$0.00"
              value={minInput}
              error={priceError}
              onChange={(event) => {
                setMinInput(event.target.value);
              }}
            />
            <TextField
              label="Highest price"
              inputMode="decimal"
              placeholder="$9.99"
              value={maxInput}
              onChange={(event) => {
                setMaxInput(event.target.value);
              }}
            />
            <Select
              label="Sort by"
              options={SORT_OPTIONS}
              value={applied.sort}
              onValueChange={(value) => {
                change({ sort: value as DealSort });
              }}
            />
          </div>
          {isFiltered && (
            <Button variant="ghost" className="self-start" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </form>

        {/* FilterModalBottomSheet for rich mobile filtering */}
        <ModalBottomSheet
          open={isFilterSheetOpen}
          onOpenChange={setIsFilterSheetOpen}
          title="Filter deals"
          description="Narrow deals by store, category, and price range"
        >
          <div className="flex flex-col gap-4 px-4 pb-4">
            <Select
              label="Modal Store"
              options={storeOptions}
              value={applied.stores[0] ?? ANY_STORE}
              onValueChange={(value) => {
                change({ stores: value === ANY_STORE ? [] : [value] });
              }}
            />
            <Select
              label="Modal Category"
              options={categoryOptions}
              value={applied.category ?? ANY_CATEGORY}
              onValueChange={(value) => {
                change({ category: value === ANY_CATEGORY ? undefined : value });
              }}
            />
            <div className="flex justify-between gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  clearFilters();
                  setIsFilterSheetOpen(false);
                }}
              >
                Clear deal filters
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setIsFilterSheetOpen(false);
                }}
              >
                Apply filters
              </Button>
            </div>
          </div>
        </ModalBottomSheet>

        {merchants.data && !hasFavorites && householdId !== undefined && (
          <FavoritesPrompt householdId={householdId} postalCode={postalCode} />
        )}

        {applied.q === '' ? (
          <section className="flex flex-col gap-3">
            <p className="max-w-[70ch] text-body text-secondary">
              Search this week&rsquo;s deals at the stores near you.
            </p>
            {hasFavorites && (
              <div className="flex flex-col gap-2">
                <h2 className="text-h3 text-primary">Your stores</h2>
                <ul aria-label="Your favorite stores" className="flex flex-wrap gap-2">
                  {(merchants.data?.merchants ?? [])
                    .filter((row) => row.isFavorite)
                    .map((row) => (
                      <li key={row.merchantId}>
                        <Button
                          variant="secondary"
                          aria-pressed={applied.stores[0] === row.merchantId}
                          onClick={() => {
                            change({
                              stores: applied.stores[0] === row.merchantId ? [] : [row.merchantId],
                            });
                          }}
                        >
                          {row.name}
                        </Button>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </section>
        ) : (
          householdId !== undefined && (
            <DealResults
              householdId={householdId}
              query={results}
              loadingLabel="Loading deals"
              emptyMessage={
                isFiltered
                  ? 'No deals match these filters.'
                  : `No deals match “${applied.q}” at these stores.`
              }
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onAction: clearFilters }
                  : applied.scope === 'favorites'
                    ? {
                        label: 'Search all stores',
                        onAction: () => {
                          change({ scope: 'all' });
                        },
                      }
                    : undefined
              }
              errorMessage="Couldn't reach the store data, and there is nothing saved to show."
              manualAlternative={{
                label: 'Add items by hand',
                onAction: () => {
                  void navigate('/lists');
                },
              }}
              onPageChange={(page) => {
                setApplied((current) => ({ ...current, page }));
              }}
              onAddDeal={handleAddDeal}
            />
          )
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

/** Lazy route module: Deals loads on first visit to the Lists tab's Deals sub-tab. */
export function Component(): ReactElement {
  return <DealSearchScreen />;
}
