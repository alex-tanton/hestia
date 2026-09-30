import { useState, type ReactElement } from 'react';
import type { MealType } from '@hearth/shared';
import { useCreateMealPlanEntry } from '../../lib/api/meal-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { todayInTimezone } from '../../lib/household-date.ts';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/Field.tsx';
import { FormMessage } from '../ui/FormMessage.tsx';
import { Select } from '../ui/Select.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { useToast } from '../ui/Toast.tsx';
import { mealTypeLabel } from './meal-copy.ts';

const MEAL_TYPE_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: mealTypeLabel('breakfast') },
  { value: 'lunch', label: mealTypeLabel('lunch') },
  { value: 'dinner', label: mealTypeLabel('dinner') },
];

export interface PlaceOnPlannerSheetProps {
  householdId: string;
  timezone: string;
  recipeId: string;
  recipeTitle: string;
  onOpenChange: (open: boolean) => void;
}

/** Design › Screens › 12: recipe detail's secondary action, "place on the week planner". */
export function PlaceOnPlannerSheet({
  householdId,
  timezone,
  recipeId,
  recipeTitle,
  onOpenChange,
}: PlaceOnPlannerSheetProps): ReactElement {
  const toast = useToast();
  const createEntry = useCreateMealPlanEntry(householdId);
  const [plannedDate, setPlannedDate] = useState(() => todayInTimezone(timezone));
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
    <Sheet
      open
      onOpenChange={onOpenChange}
      title="Place on the week planner"
      description={recipeTitle}
    >
      <div className="flex flex-col gap-3 px-4">
        <TextField
          label="Date"
          type="date"
          value={plannedDate}
          onChange={(event) => {
            setPlannedDate(event.target.value);
          }}
        />
        <Select
          label="Meal"
          options={MEAL_TYPE_OPTIONS}
          value={mealType}
          onValueChange={(value) => {
            setMealType(value as MealType);
          }}
        />
        <FormMessage message={formError} />
        <Button isLoading={createEntry.isPending} onClick={handleSubmit}>
          Place meal
        </Button>
      </div>
    </Sheet>
  );
}
