import type { ReactElement } from 'react';
import {
  BillsCard,
  ChoresCard,
  MealsCard,
  ShoppingCard,
} from '../components/dashboard/DashboardCards.tsx';
import type { DashboardCardState } from '../components/dashboard/DashboardCard.tsx';
import type { PillarId } from '../lib/sections.ts';

export interface DashboardScreenProps {
  bills?: DashboardCardState;
  shopping?: DashboardCardState;
  meals?: DashboardCardState;
  chores?: DashboardCardState;
  releasedPillars?: ReadonlySet<PillarId>;
}

/**
 * This Week (Design › Screens › 2): four cards in a fixed order — Bills, Shopping, Meals,
 * Chores — each rendering on its own as its data arrives.
 */
export function DashboardScreen({
  bills,
  shopping,
  meals,
  chores,
  releasedPillars,
}: DashboardScreenProps): ReactElement {
  const shared = releasedPillars ? { releasedPillars } : {};
  return (
    <div className="flex flex-col gap-3">
      <BillsCard state={bills} {...shared} />
      <ShoppingCard state={shopping} {...shared} />
      <MealsCard state={meals} {...shared} />
      <ChoresCard state={chores} {...shared} />
    </div>
  );
}
