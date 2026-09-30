import { useState, type ReactElement } from 'react';
import { useRecipes, useSuggestions } from '../../lib/api/meal-hooks.ts';
import { ErrorState } from '../states/StateBlocks.tsx';
import { ListRow } from '../ui/ListRow.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { SkeletonRows } from '../ui/Skeleton.tsx';
import { TextField } from '../ui/Field.tsx';
import { breakdownLine } from './meal-copy.ts';
import { mergeReadiness, sortSuggestions } from './recipe-sort.ts';

export interface RecipePickerSheetProps {
  householdId: string;
  onPick: (recipeId: string, recipeTitle: string) => void;
  onOpenChange: (open: boolean) => void;
}

/**
 * Design › Screens › 10: "Placing a recipe opens a picker defaulting to deal-matched suggestions,
 * with the full library searchable behind it." With nothing typed, the ranked suggestions lead;
 * typing a search switches to a title search of the whole library (Recipes has no `q` query
 * param, so this is a client-side filter of the already-fetched page, the same limitation the
 * library screen itself accepts — Design › Screens › 11).
 */
export function RecipePickerSheet({
  householdId,
  onPick,
  onOpenChange,
}: RecipePickerSheetProps): ReactElement {
  const [search, setSearch] = useState('');
  const suggestions = useSuggestions(householdId);
  const recipes = useRecipes(householdId, 1);
  const query = search.trim().toLowerCase();

  const rows: { recipeId: string; title: string; line: string }[] =
    query === ''
      ? sortSuggestions(suggestions.data?.recipes ?? []).map((suggestion) => ({
          recipeId: suggestion.recipeId,
          title: suggestion.title,
          line: breakdownLine(
            suggestion.onSaleCount,
            suggestion.inPantryCount,
            suggestion.toBuyCount,
          ),
        }))
      : mergeReadiness(recipes.data?.recipes ?? [], suggestions.data?.recipes ?? [])
          .filter((recipe) => recipe.title.toLowerCase().includes(query))
          .map((recipe) => ({
            recipeId: recipe.id,
            title: recipe.title,
            line: breakdownLine(recipe.onSaleCount, recipe.inPantryCount, recipe.toBuyCount),
          }));

  const isPending =
    query === '' ? suggestions.isPending : recipes.isPending || suggestions.isPending;
  const isError = query === '' ? suggestions.isError : recipes.isError;

  return (
    <Sheet open onOpenChange={onOpenChange} title="Place which recipe?">
      <div className="flex flex-col gap-3 px-4">
        <TextField
          label="Search recipes"
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />
        {isPending && <SkeletonRows label="Loading recipes" rows={3} />}
        {isError && (
          <ErrorState
            message="Couldn't load recipes. Try again."
            onRetry={() => {
              void suggestions.refetch();
              void recipes.refetch();
            }}
          />
        )}
        {!isPending && !isError && rows.length === 0 && (
          <p className="text-body-sm text-secondary">
            {query === '' ? 'No recipes yet.' : 'No recipes match that search.'}
          </p>
        )}
        {rows.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border">
            {rows.map((row) => (
              <li key={row.recipeId}>
                <ListRow
                  title={row.title}
                  description={row.line}
                  onSelect={() => {
                    onPick(row.recipeId, row.title);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
