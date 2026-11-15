import { Plus } from 'lucide-react';
import type { ReactElement } from 'react';
import type { MealPlanEntry, MealType } from '@hestia/shared';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/Card.tsx';
import { mealTypeLabel } from './meal-copy.ts';
import { MealSlotEntry } from './MealSlotEntry.tsx';

const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner'];

export interface PlannerDayProps {
  date: string;
  label: string;
  entries: readonly MealPlanEntry[];
  isReadOnly: boolean;
  offlineReason: string | undefined;
  isDesktop?: boolean;
  onAdd: (date: string, mealType: MealType) => void;
  onAddMissing: (entry: MealPlanEntry) => void;
  onRemove: (entry: MealPlanEntry) => void;
}

/**
 * PlannerDay adapts between mobile scheduled-only agenda rows and desktop 7-column board columns.
 * - Mobile (<840px): empty days render a subtle single-row indicator with "+ Plan meal"; days with meals
 *   render scheduled-only entries with "+ Plan meal".
 * - Desktop (>=840px): renders a tonal Card column with Breakfast, Lunch, Dinner slot sections and add affordances.
 */
export function PlannerDay({
  date,
  label,
  entries,
  isReadOnly,
  offlineReason,
  isDesktop = false,
  onAdd,
  onAddMissing,
  onRemove,
}: PlannerDayProps): ReactElement {
  if (isDesktop) {
    return (
      <Card
        variant="flat"
        className="flex min-h-[360px] flex-col gap-3 p-3"
        id={`planner-day-${date}`}
      >
        <h2 className="border-b border-[var(--md-sys-color-outline-variant)] pb-2 text-title-small font-semibold text-[var(--md-sys-color-on-surface)]">
          {label}
        </h2>
        {MEAL_TYPES.map((mealType) => {
          const slotEntries = entries.filter((entry) => entry.mealType === mealType);
          return (
            <div
              key={mealType}
              className="flex flex-col gap-1 rounded-md bg-[var(--md-sys-color-surface-container)] p-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-caption font-semibold uppercase text-secondary">
                  {mealTypeLabel(mealType)}
                </span>
                {!isReadOnly && (
                  <Button
                    variant="ghost"
                    className="h-7 px-2 text-caption"
                    disabledReason={offlineReason}
                    onClick={() => {
                      onAdd(date, mealType);
                    }}
                  >
                    <Plus aria-hidden size={14} strokeWidth={1.5} />
                    {`Add to ${mealTypeLabel(mealType).toLowerCase()}`}
                  </Button>
                )}
              </div>
              {slotEntries.length > 0 ? (
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
              ) : (
                <span className="py-1 text-caption italic text-secondary/60">Empty</span>
              )}
            </div>
          );
        })}
      </Card>
    );
  }

  // Mobile layout: uncluttered single-row for empty days, scheduled-only group for planned days
  if (entries.length === 0) {
    return (
      <div
        id={`planner-day-${date}`}
        className="flex items-center justify-between rounded-lg bg-[var(--md-sys-color-surface-container-low)] px-4 py-2.5"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-body font-medium text-[var(--md-sys-color-on-surface)]">{label}</h3>
          <span className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
            No meals planned
          </span>
        </div>
        {!isReadOnly && (
          <Button
            variant="ghost"
            className="px-2"
            disabledReason={offlineReason}
            onClick={() => {
              onAdd(date, 'dinner');
            }}
            aria-label={`Plan meal for ${label}`}
          >
            <Plus aria-hidden size={16} strokeWidth={1.5} />
            Plan meal
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      id={`planner-day-${date}`}
      className="flex flex-col gap-2 rounded-lg bg-[var(--md-sys-color-surface-container-low)] p-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-title-small font-semibold text-[var(--md-sys-color-on-surface)]">
          {label}
        </h2>
        {!isReadOnly && (
          <Button
            variant="ghost"
            className="px-2"
            disabledReason={offlineReason}
            onClick={() => {
              onAdd(date, 'dinner');
            }}
            aria-label={`Plan meal for ${label}`}
          >
            <Plus aria-hidden size={16} strokeWidth={1.5} />
            Plan meal
          </Button>
        )}
      </div>
      <ul className="flex flex-col gap-1">
        {entries.map((entry) => (
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
    </div>
  );
}
