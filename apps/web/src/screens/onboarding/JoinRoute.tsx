import type { ReactElement } from 'react';
import { tokenFromHash } from '../../lib/invite-code.ts';
import { initialUrlHash } from '../../lib/url-hash.ts';
import { OnboardingScreen } from './OnboardingScreen.tsx';

/** The invite link opens `/join#token=…`; the fragment is read before anything can drop it. */
export function Component(): ReactElement {
  return <OnboardingScreen initialStep="join" autoToken={tokenFromHash(initialUrlHash())} />;
}
