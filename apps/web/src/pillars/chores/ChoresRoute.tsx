import type { ReactElement } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router';
import { useProfile } from '../../lib/api/hooks.ts';
import { PillarScreen } from '../../screens/PillarScreen.tsx';
import { ChoreDetailScreen } from '../../screens/chores/ChoreDetailScreen.tsx';
import { ChoreFormScreen } from '../../screens/chores/ChoreFormScreen.tsx';
import { ChoresListScreen } from '../../screens/chores/ChoresListScreen.tsx';
import { ErrandsListScreen } from '../../screens/chores/ErrandsListScreen.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';

/** A pushed detail or edit screen reads its own id, so the route element stays a thin wrapper. */
function ChoreDetailRoute({ householdId }: { householdId: string }): ReactElement {
  const { choreId } = useParams();
  if (choreId === undefined) return <Navigate to="/chores" replace />;
  return <ChoreDetailScreen householdId={householdId} choreId={choreId} />;
}

function ChoreEditRoute({ householdId }: { householdId: string }): ReactElement {
  const { choreId } = useParams();
  if (choreId === undefined) return <Navigate to="/chores" replace />;
  return <ChoreFormScreen householdId={householdId} choreId={choreId} />;
}

/**
 * The Chores tab. The sub-tab roots — Chores and Errands — sit inside `PillarScreen`, which draws
 * the segmented control; a chore's own create/edit and detail screens render without it, since the
 * top bar has already swapped the switcher for a back control (the same split `MealsRoute` uses for
 * a recipe's own detail).
 */
export function Component(): ReactElement {
  const profile = useProfile();
  const householdId = profile.data?.activeHouseholdId ?? undefined;

  if (householdId === undefined) {
    return (
      <PillarScreen pillar="chores">
        <SkeletonRows label="Loading chores" />
      </PillarScreen>
    );
  }

  return (
    <Routes>
      <Route
        index
        element={
          <PillarScreen pillar="chores">
            <ChoresListScreen householdId={householdId} />
          </PillarScreen>
        }
      />
      <Route
        path="errands"
        element={
          <PillarScreen pillar="chores">
            <ErrandsListScreen householdId={householdId} />
          </PillarScreen>
        }
      />
      <Route path="new" element={<ChoreFormScreen householdId={householdId} />} />
      <Route path=":choreId" element={<ChoreDetailRoute householdId={householdId} />} />
      <Route path=":choreId/edit" element={<ChoreEditRoute householdId={householdId} />} />
      <Route path="*" element={<Navigate to="/chores" replace />} />
    </Routes>
  );
}
