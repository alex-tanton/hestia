import { useState, type ReactElement } from 'react';
import { useRecipes, useSuggestions } from '../../lib/api/meal-hooks.ts';
import { ErrorState } from '../states/StateBlocks.tsx';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/Field.tsx';
import { ListRow } from '../ui/ListRow.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { SkeletonRows } from '../ui/Skeleton.tsx';
import { Tabs } from '../ui/Tabs.tsx';
import { breakdownLine } from './meal-copy.ts';
import { mergeReadiness, sortSuggestions } from './recipe-sort.ts';

export const QUICK_SUGGESTIONS = [
  'Banana',
  'Greek Yogurt',
  'Apple',
  'Oatmeal',
  'Protein Shake',
  'Leftovers',
  'Salad',
  'Sandwich',
] as const;

export interface MealPlacementSheetProps {
  householdId: string;
  onPickRecipe: (recipeId: string, recipeTitle: string) => void;
  onPickCustom: (customTitle: string) => void;
  onOpenChange: (open: boolean) => void;
}

export function MealPlacementSheet({
  householdId,
  onPickRecipe,
  onPickCustom,
  onOpenChange,
}: MealPlacementSheetProps): ReactElement {
  const [tab, setTab] = useState<'recipe' | 'custom'>('recipe');
  const [customTitle, setCustomTitle] = useState('');
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

  const handleCustomSubmit = (): void => {
    const trimmed = customTitle.trim();
    if (trimmed !== '') {
      onPickCustom(trimmed);
    }
  };

  const recipeContent = (
    <div className="flex flex-col gap-3">
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
                  onPickRecipe(row.recipeId, row.title);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const customContent = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <TextField
          label="Item name"
          placeholder="Banana, yogurt, leftovers..."
          value={customTitle}
          onChange={(event) => {
            setCustomTitle(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleCustomSubmit();
            }
          }}
        />
        <Button
          type="button"
          variant="primary"
          disabled={customTitle.trim() === ''}
          onClick={handleCustomSubmit}
        >
          Place item
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-caption font-semibold uppercase text-secondary">
          Quick Suggestions
        </span>
        <div className="flex flex-wrap gap-2">
          {QUICK_SUGGESTIONS.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="secondary"
              className="px-3"
              onClick={() => {
                onPickCustom(suggestion);
              }}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <Sheet open onOpenChange={onOpenChange} title="Place meal">
      <div className="px-4">
        <Tabs
          label="Placement mode"
          value={tab}
          onValueChange={(val) => {
            setTab(val as 'recipe' | 'custom');
          }}
          items={[
            {
              value: 'recipe',
              label: 'Recipe',
              content: recipeContent,
            },
            {
              value: 'custom',
              label: 'Quick Item',
              content: customContent,
            },
          ]}
        />
      </div>
    </Sheet>
  );
}
