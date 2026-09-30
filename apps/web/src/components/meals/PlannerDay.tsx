import { Plus } from 'lucide-react';
import type { ReactElement } from 'react';
import type { MealPlanEntry, MealType } from '@hearth/shared';
import { Button } from '../ui/Button.tsx';
import { mealTypeLabel } from './meal-copy.ts';
import { MealSlotEntry } from './MealSlotEntry.tsx';

const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner'];

export interface PlannerDayProps {
  date: string;
  label: string;
  entries: readonly MealPlanEntry[];
  isReadOnly: boolean;
  offlineReason: string | undefined;
  onAdd: (date: string, mealType: MealType) => void;
  onAddMissing: (entry: MealPlanEntry) => void;
  onRemove: (entry: MealPlanEntry) => void;
}

/** Design › Screens › 10: one day's three slots, each listing its placed recipes then an add affordance. */
export function PlannerDay({
  date,
  label,
  entries,
  isReadOnly,
  offlineReason,
  onAdd,
  onAddMissing,
  onRemove,
}: PlannerDayProps): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      {/* The planner has no section heading above the day grid, so this is the page's next
          heading after its h1 — axe's heading-order check wants no level skipped. */}
      <h2 className="text-h3 text-primary">{label}</h2>
      {MEAL_TYPES.map((mealType) => {
        const slotEntries = entries.filter((entry) => entry.mealType === mealType);
        return (
          <div key={mealType} className="flex flex-col gap-1 rounded-md border border-border p-3">
            <span className="text-caption font-semibold text-secondary uppercase">
              {mealTypeLabel(mealType)}
            </span>
            {slotEntries.length > 0 && (
              <ul className="flex flex-col gap-1">
                {slotEntries.map((entry) => (
                  <MealSlotEntry
                    key={entry.id}
                    entry={entry}
                    isReadOnly={isReadOnly}
                    offlineReason={offlineReason}
                    onAddMissing={onAddMissing}
                    onRemove={onRemove}
                  />
                ))}
              </ul>
            )}
            {!isReadOnly && (
              <Button
                variant="ghost"
                className="self-start px-2"
                disabledReason={offlineReason}
                onClick={() => {
                  onAdd(date, mealType);
                }}
              >
                <Plus aria-hidden size={16} strokeWidth={1.5} />
                {`Add to ${mealTypeLabel(mealType).toLowerCase()}`}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
