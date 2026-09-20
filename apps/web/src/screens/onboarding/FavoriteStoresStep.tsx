import type { ReactElement } from 'react';
import { Button } from '../../components/ui/Button.tsx';
import { ComingSoonPanel } from '../../components/states/ComingSoon.tsx';
import { SectionProvider } from '../../lib/section-context.tsx';
import { PILLARS } from '../../lib/sections.ts';

export const FAVORITE_STORES_COMING_SOON =
  'Picking favorite stores opens when Lists ships. You can choose them in Settings then.';

/**
 * Household setup's third part (Design › Screens › 1). The merchants near a postal code come
 * from the deals pipeline, which ships with Lists, so this step takes the same coming-soon state
 * an unshipped pillar's tab takes, in the Lists section color — the step stays in the flow
 * rather than disappearing and reappearing between releases.
 */
export function FavoriteStoresStep({ onDone }: { onDone: () => void }): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <SectionProvider section="lists">
        <ComingSoonPanel icon={PILLARS.lists.icon} message={FAVORITE_STORES_COMING_SOON} />
      </SectionProvider>
      <Button onClick={onDone}>Continue</Button>
    </div>
  );
}
