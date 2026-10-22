import type { ReactElement } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router';
import { PillarScreen } from '../../screens/PillarScreen.tsx';
import { BillDetailScreen } from '../../screens/bills/BillDetailScreen.tsx';
import { BillsIndexScreen } from '../../screens/bills/BillsIndexScreen.tsx';
import { SubscriptionsScreen } from '../../screens/bills/SubscriptionsScreen.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useProfile } from '../../lib/api/hooks.ts';

/** A pushed detail screen reads its own id, so the route element stays a thin wrapper. */
function BillDetailRoute({ householdId }: { householdId: string }): ReactElement {
  const { billId } = useParams();
  if (billId === undefined) return <Navigate to="/bills" replace />;
  return <BillDetailScreen householdId={householdId} billId={billId} />;
}

/**
 * The Bills tab. The sub-tab roots — Bills, Subscriptions — sit inside `PillarScreen`, which draws
 * the segmented control; a bill's own detail renders without it, since the top bar has already
 * swapped the switcher for a back control (the same split `ListsRoute` and `MealsRoute` use for
 * their own detail screens).
 */
export function Component(): ReactElement {
  const profile = useProfile();
  const householdId = profile.data?.activeHouseholdId ?? undefined;

  if (householdId === undefined) {
    return (
      <PillarScreen pillar="bills">
        <SkeletonRows label="Loading your bills" />
      </PillarScreen>
    );
  }

  return (
    <Routes>
      <Route
        index
        element={
          <PillarScreen pillar="bills">
            <BillsIndexScreen householdId={householdId} />
          </PillarScreen>
        }
      />
      <Route
        path="subscriptions"
        element={
          <PillarScreen pillar="bills">
            <SubscriptionsScreen householdId={householdId} />
          </PillarScreen>
        }
      />
      <Route path=":billId" element={<BillDetailRoute householdId={householdId} />} />
      <Route path="*" element={<Navigate to="/bills" replace />} />
    </Routes>
  );
}
