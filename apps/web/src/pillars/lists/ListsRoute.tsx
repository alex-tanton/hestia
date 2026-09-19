import type { ReactElement } from 'react';
import { PillarScreen } from '../../screens/PillarScreen.tsx';

/** Lazy route module for the Lists tab; Phase 2 fills in its sub-tab screens. */
export function Component(): ReactElement {
  return <PillarScreen pillar="lists" />;
}
