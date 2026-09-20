import type { ReactElement } from 'react';
import { SettingsScreen } from './SettingsScreen.tsx';

/** Lazy route module behind the top bar's Settings entry. */
export function Component(): ReactElement {
  return <SettingsScreen />;
}
