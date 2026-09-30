import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import type { MealPlanEntry, MealType } from '@hearth/shared';
import { ListPickerSheet } from '../../components/meals/ListPickerSheet.tsx';
import { PLANNER_PAST_WEEK_COPY } from '../../components/meals/meal-copy.ts';
import { PlannerDay } from '../../components/meals/PlannerDay.tsx';
import { RecipePickerSheet } from '../../components/meals/RecipePickerSheet.tsx';
import { ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { Tabs } from '../../components/ui/Tabs.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { useProfile } from '../../lib/api/hooks.ts';
import {
  useAddMealToList,
  useAddWeekToList,
  useCreateMealPlanEntry,
  useDeleteMealPlanEntry,
  useMealPlanWeek,
} from '../../lib/api/meal-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import {
  addDays,
  todayInTimezone,
  weekDates,
  weekStart,
  WEEKDAY_LABELS,
} from '../../lib/household-date.ts';
import { DESKTOP_QUERY, useMediaQuery } from '../../lib/use-media-query.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';

const OFFLINE_ACTION_REASON = 'Needs a connection.';

function dayLabel(date: string): string {
  const [, month = '01', day = '01'] = date.split('-');
  const weekday = WEEKDAY_LABELS[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? '';
  return `${weekday} ${month}/${day}`;
}

/** Design › Screens › 10: Sunday-to-Saturday, mobile day tabs, desktop full grid. */
export function PlannerScreen({ householdId }: { householdId: string }): ReactElement {
  const isOnline = useOnlineStatus();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const toast = useToast();
  const profile = useProfile();
  const timezone = profile.data?.timezone ?? 'America/New_York';
  const currentWeek = weekStart(todayInTimezone(timezone));

  const [week, setWeek] = useState(currentWeek);
  const dates = weekDates(week);
  const [selectedDate, setSelectedDate] = useState(() => todayInTimezone(timezone));
  // Switching weeks can leave the selected day outside the new week entirely; falling back to
  // that week's Sunday keeps a day tab always selected, rather than the Tabs value matching
  // nothing and rendering no day at all.
  const activeDate = dates.includes(selectedDate) ? selectedDate : (dates[0] ?? selectedDate);

  const plan = useMealPlanWeek(householdId, week);
  const createEntry = useCreateMealPlanEntry(householdId);
  const deleteEntry = useDeleteMealPlanEntry(householdId);
  const addMealToList = useAddMealToList(householdId);
  const addWeekToList = useAddWeekToList(householdId);

  const [placing, setPlacing] = useState<{ date: string; mealType: MealType }>();
  const [addingMissingFor, setAddingMissingFor] = useState<MealPlanEntry>();
  const [isWeekPickerOpen, setIsWeekPickerOpen] = useState(false);

  const offlineReason = isOnline ? undefined : OFFLINE_ACTION_REASON;
  // A past week hides its write controls entirely, the same as the archived-lists screen
  // (Design › Screens › 10: "Past weeks remain reachable as read-only history"). Offline is a
  // different state — its controls stay visible but disabled with a reason (Design › Offline
  // rules: "A control is never hidden, and never fails silently").
  const isPastWeek = week < currentWeek;
  const isReadOnly = isPastWeek;

  const entriesFor = (date: string): MealPlanEntry[] =>
    (plan.data?.entries ?? []).filter((entry) => entry.plannedDate === date);

  const place = (recipeId: string, recipeTitle: string): void => {
    if (placing === undefined) return;
    createEntry.mutate(
      { recipeId, plannedDate: placing.date, mealType: placing.mealType },
      {
        onSuccess: () => {
          setPlacing(undefined);
          toast({ variant: 'success', message: `Placed ${recipeTitle}.` });
        },
        onError: (error) => {
          toast({
            variant: 'error',
            message: userMessage(error, { fallback: "Couldn't place that meal. Try again." }),
          });
        },
      },
    );
  };

  const remove = (entry: MealPlanEntry): void => {
    deleteEntry.mutate(entry.id, {
      onSuccess: () => {
        toast({ variant: 'success', message: `Removed ${entry.recipeTitle}.` });
      },
      onError: (error) => {
        toast({
          variant: 'error',
          message: userMessage(error, {
            fallback: `Couldn't remove ${entry.recipeTitle}. Try again.`,
          }),
        });
      },
    });
  };

  const addMissing = (listId: string, listName: string): void => {
    if (addingMissingFor === undefined) return;
    addMealToList.mutate(
      { entryId: addingMissingFor.id, listId },
      {
        onSuccess: () => {
          setAddingMissingFor(undefined);
          toast({ variant: 'success', message: `Added to ${listName}.` });
        },
        onError: (error) => {
          toast({
            variant: 'error',
            message: userMessage(error, { fallback: "Couldn't add those ingredients. Try again." }),
          });
        },
      },
    );
  };

  const addWeekMissing = (listId: string, listName: string): void => {
    addWeekToList.mutate(
      { week, listId },
      {
        onSuccess: () => {
          setIsWeekPickerOpen(false);
          toast({ variant: 'success', message: `Added to ${listName}.` });
        },
        onError: (error) => {
          toast({
            variant: 'error',
            message: userMessage(error, {
              fallback: "Couldn't add this week's ingredients. Try again.",
            }),
          });
        },
      },
    );
  };

  function body(): ReactElement {
    if (plan.isPending && plan.fetchStatus === 'paused') {
      return (
        <OfflineState message="The week planner syncs when you reconnect. What you have already opened stays readable." />
      );
    }
    if (plan.isPending) return <SkeletonRows label="Loading the week planner" />;
    if (plan.isError && plan.data === undefined) {
      return (
        <ErrorState
          message="Couldn't load the week planner. Try again."
          onRetry={() => {
            void plan.refetch();
          }}
        />
      );
    }

    const dayProps = (date: string) => ({
      date,
      label: dayLabel(date),
      entries: entriesFor(date),
      isReadOnly,
      offlineReason,
      onAdd: (addDate: string, mealType: MealType) => {
        setPlacing({ date: addDate, mealType });
      },
      onAddMissing: setAddingMissingFor,
      onRemove: remove,
    });

    if (isDesktop) {
      return (
        <div className="grid grid-cols-7 gap-3">
          {dates.map((date) => (
            <PlannerDay key={date} {...dayProps(date)} />
          ))}
        </div>
      );
    }

    return (
      <Tabs
        label="Day of the week"
        value={activeDate}
        onValueChange={setSelectedDate}
        items={dates.map((date) => ({
          value: date,
          label: dayLabel(date),
          content: <PlannerDay {...dayProps(date)} />,
        }))}
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Week" className="flex items-center gap-2">
          <Button
            variant="secondary"
            isIconOnly
            aria-label="Previous week"
            onClick={() => {
              setWeek((current) => addDays(current, -7));
            }}
          >
            <ChevronLeft aria-hidden size={20} strokeWidth={1.5} />
          </Button>
          <span className="text-body-sm text-secondary">
            Week of {dayLabel(week)}
            {week === currentWeek && ' (this week)'}
          </span>
          <Button
            variant="secondary"
            isIconOnly
            aria-label="Next week"
            onClick={() => {
              setWeek((current) => addDays(current, 7));
            }}
          >
            <ChevronRight aria-hidden size={20} strokeWidth={1.5} />
          </Button>
        </nav>
        {!isReadOnly && (
          <Button
            variant="secondary"
            disabledReason={offlineReason}
            onClick={() => {
              setIsWeekPickerOpen(true);
            }}
          >
            Add week's missing to list
          </Button>
        )}
      </div>

      {isPastWeek && <p className="text-body-sm text-secondary">{PLANNER_PAST_WEEK_COPY}</p>}

      {plan.isError && plan.data !== undefined && (
        <StaleNotice
          updatedAt={plan.dataUpdatedAt}
          onRetry={() => {
            void plan.refetch();
          }}
        />
      )}

      {body()}

      {placing !== undefined && (
        <RecipePickerSheet
          householdId={householdId}
          onPick={place}
          onOpenChange={(open) => {
            if (!open) setPlacing(undefined);
          }}
        />
      )}

      {addingMissingFor !== undefined && (
        <ListPickerSheet
          householdId={householdId}
          title="Add missing to which list?"
          description={addingMissingFor.recipeTitle}
          isPicking={addMealToList.isPending}
          onPick={addMissing}
          onOpenChange={(open) => {
            if (!open) setAddingMissingFor(undefined);
          }}
        />
      )}

      {isWeekPickerOpen && (
        <ListPickerSheet
          householdId={householdId}
          title="Add this week's missing to which list?"
          isPicking={addWeekToList.isPending}
          onPick={addWeekMissing}
          onOpenChange={setIsWeekPickerOpen}
        />
      )}
    </section>
  );
}
