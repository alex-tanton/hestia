import type { ReactElement } from 'react';
import { DepartureScreen } from './DepartureScreen.tsx';

/** Lazy route module for the pushed departure preview. */
export function Component(): ReactElement {
  return <DepartureScreen />;
}
