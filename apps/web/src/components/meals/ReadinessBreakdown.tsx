import type { ReactElement } from 'react';
import type { MatchOverride, RecipeDetail } from '@hestia/shared';
import { Card } from '../ui/Card.tsx';
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
 * ReadinessBreakdown tonal card displaying pantry/deal readiness and per-ingredient matches per D-06.
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
    <Card variant="flat" className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <ReadinessRing percent={readiness?.readinessPercent ?? 0} />
        <div className="flex flex-col">
          <h2 id="readiness-heading" className="text-title-medium font-semibold text-primary">
            Readiness
          </h2>
          <p className="text-body text-secondary">{readinessSentence(ready, total)}</p>
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-[var(--md-sys-color-outline-variant)] rounded-md border border-[var(--md-sys-color-outline-variant)]">
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
    </Card>
  );
}
