import type { ReactElement } from 'react';
import { PillarScreen } from '../../screens/PillarScreen.tsx';

/** Lazy route module for the Chores tab; Phase 4 fills in its sub-tab screens. */
export function Component(): ReactElement {
  return <PillarScreen pillar="chores" />;
}
