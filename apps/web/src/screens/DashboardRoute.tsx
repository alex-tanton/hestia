import type { ReactElement } from 'react';
import type { Bill, Chore, MealPlanEntry, MealType, ShoppingList } from '@hearth/shared';
import { mealTypeLabel } from '../components/meals/meal-copy.ts';
import type { DashboardCardState } from '../components/dashboard/DashboardCard.tsx';
import { DASHBOARD_EMPTY_COPY } from '../components/dashboard/DashboardCards.tsx';
import { useBills } from '../lib/api/bills-hooks.ts';
import { useHousehold, useProfile } from '../lib/api/hooks.ts';
import { useChores } from '../lib/api/chore-hooks.ts';
import { useShoppingLists } from '../lib/api/list-hooks.ts';
import { useMealPlanWeek } from '../lib/api/meal-hooks.ts';
import { formatCents } from '../lib/format.ts';
import { addDays, todayInTimezone, weekStart } from '../lib/household-date.ts';
import { DashboardScreen } from './DashboardScreen.tsx';

const MEAL_ORDER: Readonly<Record<MealType, number>> = { breakfast: 0, lunch: 1, dinner: 2 };

function compareEntries(a: MealPlanEntry, b: MealPlanEntry): number {
  return a.plannedDate === b.plannedDate
    ? MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType]
    : a.plannedDate.localeCompare(b.plannedDate);
}

/**
 * The Meals card's data (PRD › This Week: "today's planned meals, then tomorrow's"). Both dates
 * are read from the household's own clock (Handoff non-negotiable 8), never the browser's.
 */
export function mealsCardState(
  plan: ReturnType<typeof useMealPlanWeek>,
  today: string,
  tomorrow: string,
): DashboardCardState {
  if (plan.isPending && plan.fetchStatus !== 'paused') return { status: 'loading' };
  if (plan.data === undefined) {
    if (plan.isError) {
      return {
        status: 'error',
        message: "Couldn't load meals. Try again.",
        onRetry: () => {
          void plan.refetch();
        },
      };
    }
    return { status: 'empty', message: DASHBOARD_EMPTY_COPY.meals };
  }

  const upcoming = plan.data.entries
    .filter((entry) => entry.plannedDate === today || entry.plannedDate === tomorrow)
    .sort(compareEntries);
  if (upcoming.length === 0) return { status: 'empty', message: DASHBOARD_EMPTY_COPY.meals };

  return {
    status: 'populated',
    total: upcoming.length,
    items: upcoming.map((entry) => ({
      id: entry.id,
      label: entry.recipeTitle,
      detail: `${entry.plannedDate === today ? 'Today' : 'Tomorrow'} · ${mealTypeLabel(entry.mealType)}`,
    })),
  };
}

/**
 * The Bills card's data (PRD › This Week: "Bills due this week (household bills plus the user's
 * personal bills), flagged if overdue"). `weekEnd` is this week's Saturday, so a bill is on the
 * card exactly when `BillsIndexScreen`'s own Overdue or This week group would show it — the same
 * `currentOccurrenceDate <= weekEnd` test, since an overdue occurrence's date is always in the
 * past and therefore already on or before it.
 */
export function billsCardState(
  bills: ReturnType<typeof useBills>,
  weekEnd: string,
): DashboardCardState {
  if (bills.isPending && bills.fetchStatus !== 'paused') return { status: 'loading' };
  if (bills.data === undefined) {
    if (bills.isError) {
      return {
        status: 'error',
        message: "Couldn't load bills. Try again.",
        onRetry: () => {
          void bills.refetch();
        },
      };
    }
    return { status: 'empty', message: DASHBOARD_EMPTY_COPY.bills };
  }

  const dueThisWeek = bills.data
    .filter((bill) => bill.currentOccurrenceDate <= weekEnd)
    .sort((a: Bill, b: Bill) =>
      a.isOverdue !== b.isOverdue
        ? Number(b.isOverdue) - Number(a.isOverdue)
        : a.currentOccurrenceDate.localeCompare(b.currentOccurrenceDate),
    );
  if (dueThisWeek.length === 0) return { status: 'empty', message: DASHBOARD_EMPTY_COPY.bills };

  return {
    status: 'populated',
    total: dueThisWeek.length,
    items: dueThisWeek.map((bill) => ({
      id: bill.id,
      label: bill.name,
      detail: formatCents(bill.amountCents),
      isOverdue: bill.isOverdue,
    })),
  };
}

/** "3 of 15 left" — the compact progress indicator Design gives the Shopping card. */
export function listProgress(list: ShoppingList): string {
  return `${String(list.outstandingCount)} of ${String(list.itemCount)} left`;
}

/**
 * The Shopping card's data (PRD › This Week: active shopping list status, items outstanding). The
 * service sorts the lists by last activity, so the most recently worked list leads. A list with
 * nothing outstanding is not news, so the card counts only the lists that still have something to
 * buy and reads as empty when none do.
 */
export function shoppingCardState(lists: ReturnType<typeof useShoppingLists>): DashboardCardState {
  if (lists.isPending && lists.fetchStatus !== 'paused') return { status: 'loading' };
  if (lists.data === undefined) {
    if (lists.isError) {
      return {
        status: 'error',
        message: "Couldn't load your lists. Try again.",
        onRetry: () => {
          void lists.refetch();
        },
      };
    }
    // Offline before this household ever synced: nothing to show and nothing failed.
    return { status: 'empty', message: DASHBOARD_EMPTY_COPY.lists };
  }

  const outstanding = lists.data.filter((list) => list.outstandingCount > 0);
  if (outstanding.length === 0) return { status: 'empty', message: DASHBOARD_EMPTY_COPY.lists };

  return {
    status: 'populated',
    total: outstanding.length,
    items: outstanding.map((list) => ({
      id: list.id,
      label: list.name,
      detail: listProgress(list),
    })),
  };
}

/**
 * The Chores card's data (PRD › This Week: "chores due, and any overdue"). Overdue chores lead,
 * both groups ordered by name; `isOverdue` carries the danger styling the row needs (Design ›
 * Accessibility: color is never the only signal — the card also sorts them to the front).
 */
export function choresCardState(
  chores: ReturnType<typeof useChores>,
  today: string,
): DashboardCardState {
  if (chores.isPending && chores.fetchStatus !== 'paused') return { status: 'loading' };
  if (chores.data === undefined) {
    if (chores.isError) {
      return {
        status: 'error',
        message: "Couldn't load chores. Try again.",
        onRetry: () => {
          void chores.refetch();
        },
      };
    }
    return { status: 'empty', message: DASHBOARD_EMPTY_COPY.chores };
  }

  const due = chores.data.filter((chore) => chore.isOverdue || chore.dueDate === today);
  if (due.length === 0) return { status: 'empty', message: DASHBOARD_EMPTY_COPY.chores };

  const sorted = [...due].sort((a: Chore, b: Chore) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return {
    status: 'populated',
    total: sorted.length,
    items: sorted.map((chore) => ({
      id: chore.id,
      label: chore.name,
      isOverdue: chore.isOverdue,
    })),
  };
}

/** The dashboard with its data. It ships in the shell, so it fetches only what its cards need. */
export function DashboardRoute(): ReactElement {
  const profile = useProfile();
  const householdId = profile.data?.activeHouseholdId ?? undefined;
  const household = useHousehold(householdId);
  // Every "today" on the dashboard is the household's (PRD, "Timezone"), so the browser's and the
  // profile's zones never date a card. Until the household is known, the date-dependent cards wait.
  const timezone = household.data?.timezone;
  const lists = useShoppingLists(householdId);
  const bills = useBills(householdId);

  const today = timezone !== undefined ? todayInTimezone(timezone) : undefined;
  const tomorrow = today !== undefined ? addDays(today, 1) : undefined;
  const week = today !== undefined ? weekStart(today) : undefined;
  const weekEnd = week !== undefined ? addDays(week, 6) : undefined;
  const plan = useMealPlanWeek(householdId, week);
  const chores = useChores(householdId);

  return (
    <DashboardScreen
      {...(weekEnd !== undefined ? { bills: billsCardState(bills, weekEnd) } : {})}
      shopping={shoppingCardState(lists)}
      {...(today !== undefined && tomorrow !== undefined
        ? { meals: mealsCardState(plan, today, tomorrow) }
        : {})}
      {...(today !== undefined ? { chores: choresCardState(chores, today) } : {})}
    />
  );
}
