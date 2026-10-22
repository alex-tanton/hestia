import type { ReactElement } from 'react';
import {
  BillsCard,
  ChoresCard,
  MealsCard,
  ShoppingCard,
  type PillarCardProps,
} from '../components/dashboard/DashboardCards.tsx';
import { DashboardFirstRun } from '../components/dashboard/DashboardFirstRun.tsx';
import type { DashboardCardState } from '../components/dashboard/DashboardCard.tsx';
import { RELEASED_PILLARS, type PillarId } from '../lib/sections.ts';

export interface DashboardScreenProps {
  bills?: DashboardCardState;
  shopping?: DashboardCardState;
  meals?: DashboardCardState;
  chores?: DashboardCardState;
  releasedPillars?: ReadonlySet<PillarId>;
}

/** A fixed order the layout never reflows out of. */
const ORDER: readonly PillarId[] = ['bills', 'lists', 'meals', 'chores'];

const CARDS: Readonly<Record<PillarId, (props: PillarCardProps) => ReactElement>> = {
  bills: BillsCard,
  lists: ShoppingCard,
  meals: MealsCard,
  chores: ChoresCard,
};

/**
 * This Week: four cards in a fixed order — Bills, Shopping, Meals, Chores — each rendering on its
 * own as its data arrives. When every *shipped* pillar is empty, a single first-run panel replaces
 * those pillars' cards; the unshipped pillars' placeholders are unaffected and stay in place.
 */
export function DashboardScreen({
  bills,
  shopping,
  meals,
  chores,
  releasedPillars = RELEASED_PILLARS,
}: DashboardScreenProps): ReactElement {
  const states: Readonly<Record<PillarId, DashboardCardState | undefined>> = {
    bills,
    lists: shopping,
    meals,
    chores,
  };

  const shipped = ORDER.filter((pillar) => releasedPillars.has(pillar));
  const isFirstRun =
    shipped.length > 0 && shipped.every((pillar) => states[pillar]?.status === 'empty');

  return (
    <div className="flex flex-col gap-3">
      {ORDER.map((pillar) => {
        if (isFirstRun && releasedPillars.has(pillar)) {
          return pillar === shipped[0] ? <DashboardFirstRun key="first-run" /> : null;
        }
        const CardForPillar = CARDS[pillar];
        return (
          <CardForPillar key={pillar} state={states[pillar]} releasedPillars={releasedPillars} />
        );
      })}
    </div>
  );
}
