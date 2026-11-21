import { useState, type ReactElement } from 'react';
import { useRecipes, useSuggestions } from '../../lib/api/meal-hooks.ts';
import { MdSuggestionChip } from '../md/MdSuggestionChip.tsx';
import { ErrorState } from '../states/StateBlocks.tsx';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/Field.tsx';
import { ListRow } from '../ui/ListRow.tsx';
import { ModalBottomSheet } from '../ui/ModalBottomSheet.tsx';
import { SegmentedControl } from '../ui/SegmentedControl.tsx';
import { SkeletonRows } from '../ui/Skeleton.tsx';
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
  'Takeout',
  'Pizza',
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
    <div className="flex flex-col gap-3 pt-3">
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
    <div className="flex flex-col gap-4 pt-3">
      {/* Quick suggestions strip above custom dish input per D-07 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-caption font-semibold uppercase text-secondary">
          Quick Suggestions
        </span>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {QUICK_SUGGESTIONS.map((suggestion) => (
            <MdSuggestionChip
              key={suggestion}
              onClick={() => {
                setCustomTitle(suggestion);
                onPickCustom(suggestion);
              }}
            >
              {suggestion}
            </MdSuggestionChip>
          ))}
        </div>
      </div>

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

      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="ghost"
          onClick={() => {
            onOpenChange(false);
          }}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={customTitle.trim() === ''}
          onClick={handleCustomSubmit}
        >
          Save meal placement
        </Button>
      </div>
    </div>
  );

  return (
    <ModalBottomSheet open onOpenChange={onOpenChange} title="Plan meal">
      <div className="flex flex-col gap-3 px-4 pb-6">
        <SegmentedControl
          label="Placement mode"
          value={tab}
          onValueChange={(val) => {
            setTab(val as 'recipe' | 'custom');
          }}
          segments={[
            {
              value: 'recipe',
              label: 'Recipe',
            },
            {
              value: 'custom',
              label: 'Quick Item',
            },
          ]}
        />
        {tab === 'recipe' ? recipeContent : customContent}
      </div>
    </ModalBottomSheet>
  );
}
