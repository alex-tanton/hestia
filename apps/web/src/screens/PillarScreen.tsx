import type { ReactElement, ReactNode } from 'react';
import { ComingSoon } from '../components/states/ComingSoon.tsx';
import { SubTabs } from '../components/shell/SubTabs.tsx';
import { PILLARS, RELEASED_PILLARS, type PillarId } from '../lib/sections.ts';

export interface PillarScreenProps {
  pillar: PillarId;
  releasedPillars?: ReadonlySet<PillarId>;
  /** The active sub-tab's screen, once the pillar ships. */
  children?: ReactNode;
}

/** A pillar's frame: coming-soon until it ships, then its sub-tabs above the active screen. */
export function PillarScreen({
  pillar,
  releasedPillars = RELEASED_PILLARS,
  children,
}: PillarScreenProps): ReactElement {
  const config = PILLARS[pillar];
  if (!releasedPillars.has(pillar)) return <ComingSoon pillar={config} />;
  return (
    <div className="flex flex-col gap-4">
      <SubTabs pillar={config} />
      {children}
    </div>
  );
}
