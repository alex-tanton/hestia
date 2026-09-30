import type { ReactElement } from 'react';
import type { MatchOverride, RecipeDetail } from '@hearth/shared';
import { IngredientRow } from './IngredientRow.tsx';
import { readinessSentence } from './meal-copy.ts';
import { ReadinessRing } from './RecipeCard.tsx';

export interface ReadinessBreakdownProps {
  householdId: string;
  recipe: RecipeDetail;
  overrides: readonly MatchOverride[];
  offlineReason: string | undefined;
}

/**
 * Design › Composite components › `ReadinessBreakdown`: per-ingredient bucket, what it matched,
 * and the inline correction. The ring is decorative (`aria-hidden`); the sentence beside it is what
 * a screen reader hears (Accessibility › "Specific patterns").
 */
export function ReadinessBreakdown({
  householdId,
  recipe,
  overrides,
  offlineReason,
}: ReadinessBreakdownProps): ReactElement {
  const readiness = recipe.readiness;
  const total = recipe.ingredients.length;
  const ready = readiness ? readiness.onSaleCount + readiness.inPantryCount : 0;
  const entryFor = (ingredientId: string) =>
    readiness?.breakdown.find((entry) => entry.ingredientId === ingredientId);

  return (
    <section aria-labelledby="readiness-heading" className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <ReadinessRing percent={readiness?.readinessPercent ?? 0} />
        <div className="flex flex-col">
          <h2 id="readiness-heading" className="text-h2 text-primary">
            Readiness
          </h2>
          <p className="text-body text-secondary">{readinessSentence(ready, total)}</p>
        </div>
      </div>
      <ul className="flex flex-col rounded-md border border-border">
        {recipe.ingredients.map((ingredient) => (
          <IngredientRow
            key={ingredient.id}
            householdId={householdId}
            recipeId={recipe.id}
            ingredient={ingredient}
            entry={entryFor(ingredient.id)}
            overrides={overrides}
            offlineReason={offlineReason}
          />
        ))}
      </ul>
    </section>
  );
}
