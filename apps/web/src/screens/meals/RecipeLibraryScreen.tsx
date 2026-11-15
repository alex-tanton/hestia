import { useState, type ReactElement } from 'react';
import { useSearchParams } from 'react-router';
import type { RecipeDetail } from '@hestia/shared';
import { MdFab } from '../../components/md/MdFab.tsx';
import { MdFilterChip } from '../../components/md/MdFilterChip.tsx';
import { RecipeCard } from '../../components/meals/RecipeCard.tsx';
import {
  RECIPE_LIBRARY_EMPTY_COPY,
  RECIPE_LIBRARY_NO_MATCH_COPY,
} from '../../components/meals/meal-copy.ts';
import {
  mergeReadiness,
  sortRecipes,
  type LibrarySort,
} from '../../components/meals/recipe-sort.ts';
import { EmptyState, ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { useRecipes, useSuggestions } from '../../lib/api/meal-hooks.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { Pagination } from '../deals/Pagination.tsx';
import { RecipeForm } from './RecipeForm.tsx';

export const OFFLINE_ACTION_REASON = 'Needs a connection.';

const SORT_OPTIONS: { value: LibrarySort; label: string }[] = [
  { value: 'recent', label: 'Recently added' },
  { value: 'title', label: 'Title' },
  { value: 'readiness', label: 'Readiness' },
];

/** Searchable recipe library with MD3 search bar, filter chips, tonal RecipeCards, and floating FAB. */
export function RecipeLibraryScreen({ householdId }: { householdId: string }): ReactElement {
  const isOnline = useOnlineStatus();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const recipes = useRecipes(householdId, page);
  const suggestions = useSuggestions(householdId);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<LibrarySort>('recent');
  const [isAdding, setIsAdding] = useState(false);

  const filterParam = searchParams.get('filter');
  const filterReady = filterParam === 'ready';
  const filterOnSale = filterParam === 'sale';

  const handleToggleFilterReady = (): void => {
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (filterReady) {
      next.delete('filter');
    } else {
      next.set('filter', 'ready');
    }
    setSearchParams(next, { replace: true });
  };

  const handleToggleFilterSale = (): void => {
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (filterOnSale) {
      next.delete('filter');
    } else {
      next.set('filter', 'sale');
    }
    setSearchParams(next, { replace: true });
  };

  const handleClearFilters = (): void => {
    setSearch('');
    const next = new URLSearchParams(searchParams);
    next.delete('filter');
    setSearchParams(next, { replace: true });
  };

  const offlineReason = isOnline ? undefined : OFFLINE_ACTION_REASON;
  const isPending = recipes.isPending || suggestions.isPending;
  const isError =
    (recipes.isError && recipes.data === undefined) ||
    (suggestions.isError && suggestions.data === undefined);

  const merged = mergeReadiness(recipes.data?.recipes ?? [], suggestions.data?.recipes ?? []);
  const query = search.trim().toLowerCase();
  const matches =
    query === '' ? merged : merged.filter((recipe) => recipe.title.toLowerCase().includes(query));

  let filtered = matches;
  if (filterReady) {
    filtered = filtered.filter((r) => r.inPantryCount > 0 || r.onSaleCount > 0);
  } else if (filterOnSale) {
    filtered = filtered.filter((r) => r.onSaleCount > 0);
  }
  const sorted = sortRecipes(filtered, sort);

  function body(): ReactElement {
    if (recipes.isPending && recipes.fetchStatus === 'paused') {
      return (
        <OfflineState message="The recipe library syncs when you reconnect. What you have already opened stays readable." />
      );
    }
    if (isPending) return <SkeletonRows label="Loading recipes" />;
    if (isError) {
      return (
        <ErrorState
          message="Couldn't load your recipes. Try again."
          onRetry={() => {
            void recipes.refetch();
            void suggestions.refetch();
          }}
        />
      );
    }
    if (merged.length === 0) {
      return !offlineReason ? (
        <EmptyState
          icon="restaurant"
          heading="No recipes yet"
          message={RECIPE_LIBRARY_EMPTY_COPY}
          action={{
            label: 'Add recipe',
            onAction: () => {
              setIsAdding(true);
            },
          }}
        />
      ) : (
        <EmptyState
          icon="restaurant"
          heading="No recipes yet"
          message={RECIPE_LIBRARY_EMPTY_COPY}
        />
      );
    }
    if (sorted.length === 0) {
      return (
        <EmptyState
          icon="restaurant"
          heading="No matching recipes"
          message={RECIPE_LIBRARY_NO_MATCH_COPY}
          action={{
            label: 'Clear recipe filter',
            onAction: handleClearFilters,
          }}
        />
      );
    }
    return (
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {sorted.map((recipe) => (
          <li key={recipe.id}>
            <RecipeCard
              recipeId={recipe.id}
              title={recipe.title}
              readinessPercent={recipe.readinessPercent}
              onSaleCount={recipe.onSaleCount}
              inPantryCount={recipe.inPantryCount}
              toBuyCount={recipe.toBuyCount}
              servings={recipe.servings}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {/* Search and filters bar per MEAL-06 and UI-SPEC */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            label="Search recipes"
            type="search"
            className="min-w-60"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Sort by"
            options={SORT_OPTIONS}
            value={sort}
            onValueChange={(value) => {
              setSort(value as LibrarySort);
            }}
          />
          <div className="flex items-center gap-2">
            <MdFilterChip selected={filterReady} onClick={handleToggleFilterReady}>
              Ready now
            </MdFilterChip>
            <MdFilterChip selected={filterOnSale} onClick={handleToggleFilterSale}>
              On sale
            </MdFilterChip>
          </div>
        </div>
        <Button
          disabledReason={offlineReason}
          onClick={() => {
            setIsAdding(true);
          }}
        >
          Add recipe
        </Button>
      </div>

      {recipes.isError && recipes.data !== undefined && (
        <StaleNotice
          updatedAt={recipes.dataUpdatedAt}
          onRetry={() => {
            void recipes.refetch();
          }}
        />
      )}

      {body()}

      {recipes.data && (
        <Pagination
          page={recipes.data.page}
          pageSize={recipes.data.pageSize}
          total={recipes.data.total}
          hasMore={recipes.data.hasMore}
          onPageChange={setPage}
        />
      )}

      {/* Floating Action Button for mobile & desktop fast create per MEAL-06 */}
      {!offlineReason && (
        <div className="fixed right-6 bottom-6 z-20">
          <MdFab
            aria-label="Add recipe"
            onClick={() => {
              setIsAdding(true);
            }}
          >
            <span slot="icon">
              <Icon name="add" size={24} />
            </span>
          </MdFab>
        </div>
      )}

      {isAdding && (
        <RecipeForm
          householdId={householdId}
          onOpenChange={setIsAdding}
          onSaved={(saved: RecipeDetail) => {
            toast({ variant: 'success', message: `Added ${saved.title}.` });
          }}
        />
      )}
    </section>
  );
}
