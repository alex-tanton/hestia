import type { ReactElement } from 'react';
import { PillarScreen } from '../../screens/PillarScreen.tsx';

/** Lazy route module for the Meals tab; Phase 3 fills in its sub-tab screens. */
export function Component(): ReactElement {
  return <PillarScreen pillar="meals" />;
}
