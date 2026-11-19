import type { ReactElement, ReactNode } from 'react';
import { SubTabs } from '../components/shell/SubTabs.tsx';
import { PILLARS, type PillarId } from '../lib/sections.ts';

export interface PillarScreenProps {
  pillar: PillarId;
  releasedPillars?: ReadonlySet<PillarId> | undefined;
  /** The active sub-tab's screen. */
  children?: ReactNode;
}

/** A pillar's frame: its sub-tabs above the active screen. */
export function PillarScreen({ pillar, children }: PillarScreenProps): ReactElement {
  const config = PILLARS[pillar];
  return (
    <div className="flex flex-col gap-4">
      <SubTabs pillar={config} />
      {children}
    </div>
  );
}
