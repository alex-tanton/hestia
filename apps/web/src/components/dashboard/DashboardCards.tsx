import type { ReactElement } from 'react';
import { RELEASED_PILLARS, type PillarId } from '../../lib/sections.ts';
import { DashboardCard, type DashboardCardState } from './DashboardCard.tsx';

export interface PillarCardProps {
  /** The card's data state; defaults to loading. Ignored while the pillar is unshipped. */
  state?: DashboardCardState | undefined;
  releasedPillars?: ReadonlySet<PillarId>;
}

/** Design › Screens › 2: an empty card keeps its place with one line of copy. */
export const DASHBOARD_EMPTY_COPY: Readonly<Record<PillarId, string>> = {
  bills: 'Nothing due this week',
  lists: 'Nothing left to buy',
  meals: 'Nothing planned for today or tomorrow',
  chores: 'Nothing due today',
};

function cardState(pillar: PillarId, props: PillarCardProps): DashboardCardState {
  const released = props.releasedPillars ?? RELEASED_PILLARS;
  if (!released.has(pillar)) return { status: 'placeholder' };
  return props.state ?? { status: 'loading' };
}

/** Bills due this week, overdue first. */
export function BillsCard(props: PillarCardProps): ReactElement {
  return <DashboardCard pillar="bills" title="Bills" state={cardState('bills', props)} />;
}

/** The active list's outstanding items. */
export function ShoppingCard(props: PillarCardProps): ReactElement {
  return <DashboardCard pillar="lists" title="Shopping" state={cardState('lists', props)} />;
}

/** Today's planned meals, then tomorrow's. */
export function MealsCard(props: PillarCardProps): ReactElement {
  return <DashboardCard pillar="meals" title="Meals" state={cardState('meals', props)} />;
}

/** Chores due today and overdue. */
export function ChoresCard(props: PillarCardProps): ReactElement {
  return <DashboardCard pillar="chores" title="Chores" state={cardState('chores', props)} />;
}
