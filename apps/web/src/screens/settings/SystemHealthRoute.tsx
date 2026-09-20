import type { ReactElement } from 'react';
import { SystemHealthScreen } from './SystemHealthScreen.tsx';

/** Lazy route module: only the server owner ever loads it. */
export function Component(): ReactElement {
  return <SystemHealthScreen />;
}
