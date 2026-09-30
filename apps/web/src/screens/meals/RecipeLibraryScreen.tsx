import { UtensilsCrossed } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import type { RecipeDetail } from '@hearth/shared';
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

/** Design › Screens › 11: searchable list, readiness on each card, sort by recent/title/readiness. */
export function RecipeLibraryScreen({ householdId }: { householdId: string }): ReactElement {
  const isOnline = useOnlineStatus();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const recipes = useRecipes(householdId, page);
  const suggestions = useSuggestions(householdId);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<LibrarySort>('recent');
  const [isAdding, setIsAdding] = useState(false);

  const offlineReason = isOnline ? undefined : OFFLINE_ACTION_REASON;
  const isPending = recipes.isPending || suggestions.isPending;
  const isError =
    (recipes.isError && recipes.data === undefined) ||
    (suggestions.isError && suggestions.data === undefined);

  const merged = mergeReadiness(recipes.data?.recipes ?? [], suggestions.data?.recipes ?? []);
  const query = search.trim().toLowerCase();
  const matches =
    query === '' ? merged : merged.filter((recipe) => recipe.title.toLowerCase().includes(query));
  const sorted = sortRecipes(matches, sort);

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
      return (
        <EmptyState
          icon={UtensilsCrossed}
          message={RECIPE_LIBRARY_EMPTY_COPY}
          action={{
            label: 'Add a recipe',
            onAction: () => {
              setIsAdding(true);
            },
          }}
        />
      );
    }
    if (sorted.length === 0) {
      return (
        <EmptyState
          icon={UtensilsCrossed}
          message={RECIPE_LIBRARY_NO_MATCH_COPY}
          action={{
            label: 'Clear search',
            onAction: () => {
              setSearch('');
            },
          }}
        />
      );
    }
    return (
      <ul className="flex flex-col gap-3">
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <TextField
          label="Search recipes"
          type="search"
          className="min-w-60"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            // Search filters only the loaded page (Requirements › "Scale and pagination": the
            // recipes endpoint has no search of its own to filter server-side), so a new search
            // always starts back at page 1 rather than silently searching wherever the reader
            // happened to have paged to.
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
        <Button
          disabledReason={offlineReason}
          onClick={() => {
            setIsAdding(true);
          }}
        >
          Add a recipe
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

      {/* Requirements › "Scale and pagination": recipe libraries paginate at 50, the same as
          deals and flyer items — so a household past the first page can still reach every recipe,
          not just search within whichever 50 happened to load first. Null below the page-1 seed
          data's single page, same as deal search. */}
      {recipes.data && (
        <Pagination
          page={recipes.data.page}
          pageSize={recipes.data.pageSize}
          total={recipes.data.total}
          hasMore={recipes.data.hasMore}
          onPageChange={setPage}
        />
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
