import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { MatchOverride, ReadinessBreakdownEntry, RecipeIngredient } from '@hestia/shared';
import { useCreateMatchOverride, useDeleteMatchOverride } from '../../lib/api/meal-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';
import { Icon, type IconName } from '../ui/Icon.tsx';
import { useToast } from '../ui/Toast.tsx';
import { MatchToSheet } from './MatchToSheet.tsx';
import { BUCKET_LABEL } from './meal-copy.ts';

const BUCKET_ICON_NAME: Readonly<Record<ReadinessBreakdownEntry['bucket'], IconName>> = {
  on_sale: 'sell',
  in_pantry: 'inventory_2',
  to_buy: 'shopping_basket',
};

export interface IngredientRowProps {
  householdId: string;
  recipeId: string;
  ingredient: RecipeIngredient;
  entry: ReadinessBreakdownEntry | undefined;
  overrides: readonly MatchOverride[];
  offlineReason: string | undefined;
}

/**
 * One ingredient's bucket, what it matched, and its inline correction. "Not a match" and
 * "Match to…" give way to a "Corrected" label with a remove action once an override governs the
 * row — the same swapped-control idiom as `ChangePasswordForm` (focus moves into what replaced
 * the control, not the document).
 */
export function IngredientRow({
  householdId,
  recipeId,
  ingredient,
  entry,
  overrides,
  offlineReason,
}: IngredientRowProps): ReactElement {
  const toast = useToast();
  const createOverride = useCreateMatchOverride(householdId);
  const deleteOverride = useDeleteMatchOverride(householdId);
  const [isMatchSheetOpen, setIsMatchSheetOpen] = useState(false);

  const bucket = entry?.bucket ?? 'to_buy';
  const iconName = BUCKET_ICON_NAME[bucket];
  const governing = overrides.filter(
    (o) => o.ingredientNormalizedName === ingredient.normalizedName,
  );
  // An ingredient governed by an override shows a small 'Corrected' label — governed, not merely
  // "currently decided by one". A household can hold more than one override for the same
  // ingredient (a blocked deal it no longer sells, a newer correction), and the winning match can
  // still come from an ordinary (non-overridden) candidate even so — the seed data's own override
  // fixture is exactly this case ("cheese" forced away from "snack cheese" still matches Food
  // Lion's "chunk or cheese" normally). So this reads `governing.length > 0`,
  // not the breakdown's own `overridden` flag, which reflects only the specific match actually
  // chosen.
  const isOverridden = governing.length > 0;

  const notAMatchRef = useRef<HTMLElement>(null);
  const matchToRef = useRef<HTMLElement>(null);
  const removeRef = useRef<HTMLElement>(null);
  const wasOverridden = useRef(isOverridden);

  useEffect(() => {
    if (wasOverridden.current === isOverridden) return;
    wasOverridden.current = isOverridden;
    // "Not a match" only renders when there was a match to reject (bucket !== 'to_buy'); when the
    // correction's removal returns a `to_buy` ingredient to its uncorrected state, "Match to…" is
    // what replaced "Corrected", so focus goes there instead.
    if (isOverridden) removeRef.current?.focus();
    else (notAMatchRef.current ?? matchToRef.current)?.focus();
  }, [isOverridden]);

  const notAMatch = (): void => {
    if (entry?.matchedName === null || entry?.matchedName === undefined) return;
    createOverride.mutate(
      {
        recipeId,
        request: {
          ingredientName: ingredient.itemName,
          targetKind: bucket === 'in_pantry' ? 'pantry' : 'deal',
          targetName: entry.matchedName,
          decision: 'force_no_match',
        },
      },
      {
        onError: (error) => {
          toast({
            variant: 'error',
            message: userMessage(error, { fallback: "Couldn't save that correction. Try again." }),
          });
        },
      },
    );
  };

  const removeCorrection = (): void => {
    Promise.all(
      governing.map((override) =>
        deleteOverride.mutateAsync({ overrideId: override.id, recipeId }),
      ),
    ).catch((error: unknown) => {
      toast({
        variant: 'error',
        message: userMessage(error, { fallback: "Couldn't remove that correction. Try again." }),
      });
    });
  };

  return (
    <li className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <Icon name={iconName} size={20} className="shrink-0 text-section-accent" />
        <span className="text-body text-primary">{ingredient.itemName}</span>
        <Badge variant="section">{BUCKET_LABEL[bucket]}</Badge>
        {entry?.matchedName !== null && entry?.matchedName !== undefined && (
          <span className="text-body-sm text-secondary">matched {entry.matchedName}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {isOverridden ? (
          <>
            <Badge variant="neutral">Corrected</Badge>
            <Button
              ref={removeRef}
              variant="ghost"
              className="px-2"
              isLoading={deleteOverride.isPending}
              disabledReason={offlineReason}
              onClick={removeCorrection}
            >
              <Icon name="close" size={18} />
              Remove correction
            </Button>
          </>
        ) : (
          <>
            {bucket !== 'to_buy' && (
              <Button
                ref={notAMatchRef}
                variant="ghost"
                className="px-2"
                isLoading={createOverride.isPending}
                disabledReason={offlineReason}
                onClick={notAMatch}
              >
                Not a match
              </Button>
            )}
            <Button
              ref={matchToRef}
              variant="ghost"
              className="px-2"
              disabledReason={offlineReason}
              onClick={() => {
                setIsMatchSheetOpen(true);
              }}
            >
              Match to…
            </Button>
          </>
        )}
      </div>
      {isMatchSheetOpen && (
        <MatchToSheet
          householdId={householdId}
          recipeId={recipeId}
          ingredientName={ingredient.itemName}
          onOpenChange={setIsMatchSheetOpen}
        />
      )}
    </li>
  );
}
