import { Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import type { MealPlanEntry } from '@hearth/shared';
import { OverflowMenu } from '../ui/OverflowMenu.tsx';
import { DELETED_RECIPE_NOTE } from './meal-copy.ts';

export interface MealSlotEntryProps {
  entry: MealPlanEntry;
  isReadOnly: boolean;
  offlineReason: string | undefined;
  onAddMissing: (entry: MealPlanEntry) => void;
  onRemove: (entry: MealPlanEntry) => void;
}

/**
 * A placed meal shows title and readiness percentage. An entry whose recipe has since been
 * deleted shows its snapshot title in `text-secondary` with no readiness and no link. Its own
 * recipe gone, "Add missing to list" is never offered here either (the action 404s without a
 * recipe to compute from).
 */
export function MealSlotEntry({
  entry,
  isReadOnly,
  offlineReason,
  onAddMissing,
  onRemove,
}: MealSlotEntryProps): ReactElement {
  const isDeleted = entry.recipeId === null;

  const title = isDeleted ? (
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-body text-secondary">{entry.recipeTitle}</span>
      <span className="sr-only">{DELETED_RECIPE_NOTE}</span>
    </span>
  ) : (
    <Link
      to={`/meals/recipes/${String(entry.recipeId)}`}
      className="truncate text-body text-section underline"
    >
      {entry.recipeTitle}
      {entry.readinessPercent !== null && (
        <span className="ml-1 text-body-sm text-secondary">{entry.readinessPercent}%</span>
      )}
    </Link>
  );

  return (
    <li className="flex items-center gap-1">
      <span className="min-w-0 flex-1 py-1">{title}</span>
      {!isReadOnly && (
        <OverflowMenu
          label={`More actions for ${entry.recipeTitle}`}
          items={[
            ...(isDeleted
              ? []
              : [
                  {
                    label: 'Add missing to list',
                    disabledReason: offlineReason,
                    onSelect: () => {
                      onAddMissing(entry);
                    },
                  },
                ]),
            {
              label: 'Remove',
              icon: <Trash2 aria-hidden size={16} strokeWidth={1.5} />,
              isDestructive: true,
              disabledReason: offlineReason,
              onSelect: () => {
                onRemove(entry);
              },
            },
          ]}
        />
      )}
    </li>
  );
}
