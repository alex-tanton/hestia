import { useState, type ReactElement } from 'react';
import type { MealType } from '@hestia/shared';
import { useCreateMealPlanEntry } from '../../lib/api/meal-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { todayInTimezone, weekDates, weekStart, WEEKDAY_LABELS } from '../../lib/household-date.ts';
import { Button } from '../ui/Button.tsx';
import { FormMessage } from '../ui/FormMessage.tsx';
import { ModalBottomSheet } from '../ui/ModalBottomSheet.tsx';
import { SegmentedControl } from '../ui/SegmentedControl.tsx';
import { useToast } from '../ui/Toast.tsx';

export interface PlaceOnPlannerSheetProps {
  householdId: string;
  timezone: string;
  recipeId: string;
  recipeTitle: string;
  onOpenChange: (open: boolean) => void;
}

function dayPillLabel(date: string, today: string): string {
  const weekday = WEEKDAY_LABELS[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? '';
  if (date === today) return `${weekday} (Today)`;
  return weekday;
}

/**
 * Recipe detail's secondary action sheet to place a recipe onto the week planner.
 * Renders inside ModalBottomSheet with day pills (Mon-Sun) and segmented meal slot selector per D-05.
 */
export function PlaceOnPlannerSheet({
  householdId,
  timezone,
  recipeId,
  recipeTitle,
  onOpenChange,
}: PlaceOnPlannerSheetProps): ReactElement {
  const toast = useToast();
  const createEntry = useCreateMealPlanEntry(householdId);
  const today = todayInTimezone(timezone);
  const dates = weekDates(weekStart(today));

  const [plannedDate, setPlannedDate] = useState(() => today);
  const [mealType, setMealType] = useState<MealType>('dinner');
  const [formError, setFormError] = useState<string>();

  const handleSubmit = (): void => {
    setFormError(undefined);
    createEntry.mutate(
      { recipeId, plannedDate, mealType },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast({ variant: 'success', message: `Placed ${recipeTitle} on the week planner.` });
        },
        onError: (error) => {
          setFormError(userMessage(error, { fallback: "Couldn't place that meal. Try again." }));
        },
      },
    );
  };

  return (
    <ModalBottomSheet
      open
      onOpenChange={onOpenChange}
      title="Place recipe on planner"
      description={`Choose a day and slot for ${recipeTitle}.`}
    >
      <div className="flex flex-col gap-4 px-4 pb-6">
        {/* Day selection pills per D-05 */}
        <div className="flex flex-col gap-1.5">
          <span className="text-caption font-semibold uppercase text-secondary">Day</span>
          <input type="text" className="sr-only" aria-label="Date" value={plannedDate} readOnly />
          <SegmentedControl
            label="Day of the week"
            value={plannedDate}
            onValueChange={setPlannedDate}
            segments={dates.map((date) => ({
              value: date,
              label: dayPillLabel(date, today),
            }))}
          />
        </div>

        {/* Meal slot selection via SegmentedControl per D-05 */}
        <div className="flex flex-col gap-1.5">
          <span className="text-caption font-semibold uppercase text-secondary">Meal slot</span>
          <SegmentedControl
            label="Meal slot"
            value={mealType}
            onValueChange={(value) => {
              setMealType(value as MealType);
            }}
            segments={[
              { value: 'breakfast', label: 'Breakfast' },
              { value: 'lunch', label: 'Lunch' },
              { value: 'dinner', label: 'Dinner' },
            ]}
          />
        </div>

        <FormMessage message={formError} />

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button variant="primary" isLoading={createEntry.isPending} onClick={handleSubmit}>
            Place recipe on planner
          </Button>
        </div>
      </div>
    </ModalBottomSheet>
  );
}
