import { Search } from 'lucide-react';
import { useMemo, useState, type ReactElement, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';
import type { DealScope, DealSort } from '@hestia/shared';
import { Button } from '../../components/ui/Button.tsx';
import { OfflineState } from '../../components/states/StateBlocks.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { SegmentedControl } from '../../components/ui/SegmentedControl.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { useDealSearch, useMerchants, type DealSearchParams } from '../../lib/api/deals.ts';
import { parsePriceInput } from '../../lib/money.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
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

/**
 * Deal search: keyword search across the stores near the household's postal
 * code, scoped to favorites by default with browse-all one tap away. Results are `DealCard`s, 50 to
 * a page.
 */
export function DealSearchScreen(): ReactElement {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { householdId, postalCode } = useActiveHousehold();

  const [draftQuery, setDraftQuery] = useState('');
  const [minInput, setMinInput] = useState('');
  const [maxInput, setMaxInput] = useState('');
  const [priceError, setPriceError] = useState<string>();
  const [applied, setApplied] = useState<DealSearchParams>(INITIAL);

  const merchants = useMerchants(isOnline ? householdId : undefined);
  const results = useDealSearch(isOnline ? householdId : undefined, applied);

  const storeOptions = useMemo(() => {
    const rows = merchants.data?.merchants ?? [];
    const inScope = applied.scope === 'favorites' ? rows.filter((row) => row.isFavorite) : rows;
    const listed = inScope.length > 0 ? inScope : rows;
    return [
      { value: ANY_STORE, label: 'Any store' },
      ...listed.map((row) => ({ value: row.merchantId, label: row.name })),
    ];
  }, [merchants.data, applied.scope]);

  /*
   * A deal's category is Flipp's own `_L2`, and the service has no catalogue of them to offer, so
   * the filter lists the categories present in the results the search returned, plus whichever
   * one is applied.
   */
  const categoryOptions = useMemo(() => {
    const found = new Set((results.data?.deals ?? []).map((deal) => deal.category ?? ''));
    found.delete('');
    if (applied.category !== undefined) found.add(applied.category);
    return [
      { value: ANY_CATEGORY, label: 'Any category' },
      ...[...found].sort().map((category) => ({ value: category, label: category })),
    ];
  }, [results.data, applied.category]);

  const hasFavorites = (merchants.data?.merchants ?? []).some((row) => row.isFavorite);
  const isFiltered =
    applied.stores.length > 0 ||
    applied.category !== undefined ||
    applied.minPriceCents !== undefined ||
    applied.maxPriceCents !== undefined;

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
          <Button type="submit" className="self-start">
            <Search aria-hidden size={20} strokeWidth={1.5} />
            Search
          </Button>

          <SegmentedControl
            label="Store scope"
            segments={SCOPE_SEGMENTS}
            value={applied.scope}
            onValueChange={(value) => {
              change({ scope: value as DealScope, stores: [] });
            }}
          />

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
            />
          )
        )}
      </div>
    </DealsFrame>
  );
}

/** Lazy route module: Deals loads on first visit to the Lists tab's Deals sub-tab. */
export function Component(): ReactElement {
  return <DealSearchScreen />;
}
