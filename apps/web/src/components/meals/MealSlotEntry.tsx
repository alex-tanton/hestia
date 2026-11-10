import { Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import type { MealPlanEntry } from '@hestia/shared';
import { OverflowMenu } from '../ui/OverflowMenu.tsx';
import { CUSTOM_ITEM_ADD_TO_LIST, DELETED_RECIPE_NOTE } from './meal-copy.ts';

export interface MealSlotEntryProps {
  entry: MealPlanEntry;
  isReadOnly: boolean;
  offlineReason: string | undefined;
  onAddMissing: (entry: MealPlanEntry) => void;
  onRemove: (entry: MealPlanEntry) => void;
}

/**
 * A placed meal shows either:
 * - An active recipe: link to recipe page, title, and readiness percentage.
 * - A custom item: primary body text with bullet indicator, no link, no readiness.
 * - A deleted recipe snapshot: snapshot title in `text-secondary`, no readiness, no link,
 *   with an sr-only note and no add-to-list action.
 */
export function MealSlotEntry({
  entry,
  isReadOnly,
  offlineReason,
  onAddMissing,
  onRemove,
}: MealSlotEntryProps): ReactElement {
  const isCustom = entry.customTitle !== null;
  const isDeleted = entry.recipeId === null && !isCustom;
  const displayTitle = entry.customTitle ?? entry.recipeTitle ?? '';

  let content: ReactElement;
  if (isCustom) {
    content = (
      <span className="flex items-center gap-1.5 truncate text-body font-medium text-primary">
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-secondary"
          aria-hidden="true"
        />
        <span className="truncate">{entry.customTitle}</span>
      </span>
    );
  } else if (isDeleted) {
    content = (
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body text-secondary">{entry.recipeTitle}</span>
        <span className="sr-only">{DELETED_RECIPE_NOTE}</span>
      </span>
    );
  } else {
    content = (
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
  }

  const addAction = isDeleted
    ? []
    : [
        {
          label: isCustom ? CUSTOM_ITEM_ADD_TO_LIST : 'Add missing to list',
          disabledReason: offlineReason,
          onSelect: () => {
            onAddMissing(entry);
          },
        },
      ];

  return (
    <li className="flex items-center gap-1">
      <span className="min-w-0 flex-1 py-1">{content}</span>
      {!isReadOnly && (
        <OverflowMenu
          label={`More actions for ${displayTitle}`}
          items={[
            ...addAction,
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
