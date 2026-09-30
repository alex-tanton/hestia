import { UtensilsCrossed } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { RecipeCard } from '../../components/meals/RecipeCard.tsx';
import {
  SUGGESTIONS_EMPTY_COPY,
  SUGGESTIONS_NO_DEALS_COPY,
} from '../../components/meals/meal-copy.ts';
import { sortSuggestions } from '../../components/meals/recipe-sort.ts';
import { EmptyState, ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useSuggestions } from '../../lib/api/meal-hooks.ts';
import { formatCalendarDate, formatDateTime } from '../../lib/format.ts';
import { weekStart } from '../../lib/household-date.ts';

/** Design › Screens › 13: ranked by readiness descending, ties by title. */
export function SuggestionsScreen({ householdId }: { householdId: string }): ReactElement {
  const navigate = useNavigate();
  const suggestions = useSuggestions(householdId);

  if (suggestions.isPending && suggestions.fetchStatus === 'paused') {
    return (
      <OfflineState message="Suggestions sync when you reconnect. What you have already opened stays readable." />
    );
  }
  if (suggestions.isPending) return <SkeletonRows label="Loading suggestions" />;
  if (suggestions.isError && suggestions.data === undefined) {
    return (
      <ErrorState
        message="Couldn't load suggestions. Try again."
        onRetry={() => {
          void suggestions.refetch();
        }}
      />
    );
  }

  const data = suggestions.data;

  if (data.recipes.length === 0) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        message={SUGGESTIONS_EMPTY_COPY}
        action={{ label: 'Add a recipe', onAction: () => void navigate('/meals/recipes') }}
      />
    );
  }

  if (data.dealsAsOf === null) {
    return (
      <ErrorState
        message={SUGGESTIONS_NO_DEALS_COPY}
        onRetry={() => {
          void suggestions.refetch();
        }}
      />
    );
  }

  const ranked = sortSuggestions(data.recipes);
  const dealWeek = weekStart(data.dealsAsOf.slice(0, 10));

  return (
    <section className="flex flex-col gap-4">
      {suggestions.isError && (
        <StaleNotice
          updatedAt={suggestions.dataUpdatedAt}
          onRetry={() => {
            void suggestions.refetch();
          }}
        />
      )}
      <p className="text-body-sm text-secondary">
        {`Based on deals for the week of ${formatCalendarDate(dealWeek)}, as of ${formatDateTime(data.dealsAsOf)}.`}
      </p>
      <ul className="flex flex-col gap-3">
        {ranked.map((suggestion) => (
          <li key={suggestion.recipeId}>
            <RecipeCard
              recipeId={suggestion.recipeId}
              title={suggestion.title}
              readinessPercent={suggestion.readinessPercent}
              onSaleCount={suggestion.onSaleCount}
              inPantryCount={suggestion.inPantryCount}
              toBuyCount={suggestion.toBuyCount}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
