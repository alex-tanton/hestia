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
 * This Week: responsive 1-2 column grid (1 col on mobile <600px, 2 col on md: >=600px).
 * When every *shipped* pillar is empty, a single first-run hero panel replaces those
 * pillars' cards spanning col-span-full; the unshipped pillars' placeholders are unaffected
 * and stay in place.
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
