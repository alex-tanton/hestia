import type { ReactElement } from 'react';
import { useActiveHousehold } from '../deals/deals-frame.tsx';
import { FavoriteStoresPanel } from '../deals/FavoriteStores.tsx';

/**
 * Household setup's third part: the favorite stores, chosen from the merchants with an active flyer
 * near the postal code the previous step set. They scope the deal search, the flyer list, and the
 * daily refresh from here on, and any member may change them later in Settings — which is also
 * where the postal code is corrected, so this step does not offer that itself.
 */
export function FavoriteStoresStep({ onDone }: { onDone: () => void }): ReactElement {
  const { householdId, postalCode } = useActiveHousehold();

  return (
    <FavoriteStoresPanel
      householdId={householdId}
      postalCode={postalCode}
      showPostalCodeAction={false}
      onDone={onDone}
    />
  );
}
