import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import type { MealPlanEntry, MealType } from '@hestia/shared';
import { householdFallback } from '../../components/chores/household-date-fallback.tsx';
import { ListPickerSheet } from '../../components/meals/ListPickerSheet.tsx';
import { PLANNER_PAST_WEEK_COPY } from '../../components/meals/meal-copy.ts';
import { PlannerDay } from '../../components/meals/PlannerDay.tsx';
import { MealPlacementSheet } from '../../components/meals/MealPlacementSheet.tsx';
import { EmptyState, ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { MdPrimaryTab, MdTabs } from '../../components/md/MdTabs.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { useHousehold } from '../../lib/api/hooks.ts';
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
import { useMediaQuery } from '../../lib/use-media-query.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';

const OFFLINE_ACTION_REASON = 'Needs a connection.';
const EXPANDED_PLANNER_QUERY = '(min-width: 840px)';

function dayLabel(date: string): string {
  const [, month = '01', day = '01'] = date.split('-');
  const weekday = WEEKDAY_LABELS[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? '';
  return `${weekday} ${month}/${day}`;
}

/**
 * Sunday-to-Saturday weekly planner.
 * Adapts between compact scheduled-only mobile agenda (<840px) and 7-column desktop board (>=840px)
 * per MEAL-04, D-01, D-08.
 */
export function PlannerScreen({ householdId }: { householdId: string }): ReactElement {
  const household = useHousehold(householdId);
  const timezone = household.data?.timezone;
  if (timezone === undefined) return householdFallback(household, 'Loading the week planner');
  return <PlannerWeek householdId={householdId} timezone={timezone} />;
}

function PlannerWeek({
  householdId,
  timezone,
}: {
  householdId: string;
  timezone: string;
}): ReactElement {
  const isOnline = useOnlineStatus();
  const isDesktop = useMediaQuery(EXPANDED_PLANNER_QUERY);
  const toast = useToast();
  const currentWeek = weekStart(todayInTimezone(timezone));

  const [week, setWeek] = useState(currentWeek);
  const dates = weekDates(week);
  const [selectedDate, setSelectedDate] = useState(() => todayInTimezone(timezone));
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
  const isPastWeek = week < currentWeek;
  const isReadOnly = isPastWeek;

  const entriesFor = (date: string): MealPlanEntry[] =>
    (plan.data?.entries ?? []).filter((entry) => entry.plannedDate === date);

  const placeRecipe = (recipeId: string, recipeTitle: string): void => {
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

  const placeCustom = (customTitle: string): void => {
    if (placing === undefined) return;
    createEntry.mutate(
      { customTitle, plannedDate: placing.date, mealType: placing.mealType },
      {
        onSuccess: () => {
          setPlacing(undefined);
          toast({ variant: 'success', message: `Placed ${customTitle}.` });
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
        toast({
          variant: 'success',
          message: 'Removed meal from planner',
          action: {
            label: 'Undo',
            onAction: () => {
              if (entry.recipeId !== null) {
                createEntry.mutate({
                  recipeId: entry.recipeId,
                  plannedDate: entry.plannedDate,
                  mealType: entry.mealType,
                });
              } else if (entry.customTitle !== null) {
                createEntry.mutate({
                  customTitle: entry.customTitle,
                  plannedDate: entry.plannedDate,
                  mealType: entry.mealType,
                });
              }
            },
          },
        });
      },
      onError: (error) => {
        const itemTitle = entry.customTitle ?? entry.recipeTitle ?? 'meal';
        toast({
          variant: 'error',
          message: userMessage(error, {
            fallback: `Couldn't remove ${itemTitle}. Try again.`,
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
        <div className="grid grid-cols-7 items-start gap-3">
          {dates.map((date) => (
            <PlannerDay key={date} {...dayProps(date)} isDesktop />
          ))}
        </div>
      );
    }

    const totalWeekEntries = plan.data.entries.length;
    const isWeekEmpty = totalWeekEntries === 0;

    return (
      <div className="flex flex-col gap-4">
        {/* Horizontal Day Anchor Pills */}
        <div className="overflow-x-auto pb-1">
          <MdTabs
            aria-label="Day of the week"
            activeTabIndex={Math.max(0, dates.indexOf(activeDate))}
            onChange={(event) => {
              const idx = (event.target as { activeTabIndex?: number }).activeTabIndex;
              if (idx !== undefined && dates[idx]) {
                const targetDate = dates[idx];
                setSelectedDate(targetDate);
                const target = document.getElementById(`planner-day-${targetDate}`);
                target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }}
          >
            {dates.map((date) => (
              <MdPrimaryTab key={date} id={`tab-${date}`}>
                {dayLabel(date)}
              </MdPrimaryTab>
            ))}
          </MdTabs>
        </div>

        {/* 7-day scheduled-only vertical agenda */}
        {isWeekEmpty ? (
          !isReadOnly ? (
            <EmptyState
              icon="restaurant"
              heading="No meals planned this week"
              message="Plan upcoming meals, reuse favorites, or generate ideas based on pantry inventory and store deals."
              action={{
                label: 'Plan meal',
                onAction: () => {
                  setPlacing({ date: activeDate, mealType: 'dinner' });
                },
              }}
            />
          ) : (
            <EmptyState
              icon="restaurant"
              heading="No meals planned this week"
              message="Plan upcoming meals, reuse favorites, or generate ideas based on pantry inventory and store deals."
            />
          )
        ) : (
          <div className="flex flex-col gap-3">
            {dates.map((date) => (
              <PlannerDay key={date} {...dayProps(date)} isDesktop={false} />
            ))}
          </div>
        )}
      </div>
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
          {week !== currentWeek && (
            <Button
              variant="ghost"
              className="px-2"
              onClick={() => {
                setWeek(currentWeek);
              }}
            >
              This week
            </Button>
          )}
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
        <MealPlacementSheet
          householdId={householdId}
          onPickRecipe={placeRecipe}
          onPickCustom={placeCustom}
          onOpenChange={(open) => {
            if (!open) setPlacing(undefined);
          }}
        />
      )}

      {addingMissingFor !== undefined && (
        <ListPickerSheet
          householdId={householdId}
          title={
            addingMissingFor.customTitle !== null
              ? 'Add to which list?'
              : 'Add missing to which list?'
          }
          description={addingMissingFor.customTitle ?? addingMissingFor.recipeTitle}
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
