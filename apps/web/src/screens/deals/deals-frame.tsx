import type { ReactElement, ReactNode } from 'react';
import { useHousehold, useProfile } from '../../lib/api/hooks.ts';
import { RELEASED_PILLARS, type PillarId } from '../../lib/sections.ts';
import { PillarScreen } from '../PillarScreen.tsx';

/**
 * These screens *are* the Lists pillar shipping, so they frame themselves with its sub-tabs
 * whatever else has shipped (Design › Staged releases).
 */
const WITH_LISTS: ReadonlySet<PillarId> = new Set<PillarId>([...RELEASED_PILLARS, 'lists']);

export function DealsFrame({ children }: { children: ReactNode }): ReactElement {
  return (
    <PillarScreen pillar="lists" releasedPillars={WITH_LISTS}>
      {children}
    </PillarScreen>
  );
}

export interface ActiveHousehold {
  householdId: string | undefined;
  /** Named by the "no stores found near \[ZIP\]" states; undefined until the household loads. */
  postalCode: string | undefined;
}

/**
 * The active household, read from the profile like every other screen (Engineering Practices ›
 * Frontend patterns): `GET /api/users/me` is the only source of which household is active.
 */
export function useActiveHousehold(): ActiveHousehold {
  const householdId = useProfile().data?.activeHouseholdId ?? undefined;
  const household = useHousehold(householdId);
  return { householdId, postalCode: household.data?.postalCode };
}
