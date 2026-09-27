import type { ReactElement } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router';
import { SubSectionComingSoon } from '../../components/states/SubSectionComingSoon.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useProfile } from '../../lib/api/hooks.ts';
import { PillarScreen } from '../../screens/PillarScreen.tsx';
import { ArchivedListsScreen } from '../../screens/lists/ArchivedListsScreen.tsx';
import { ListDetailScreen } from '../../screens/lists/ListDetailScreen.tsx';
import { ListsIndexScreen } from '../../screens/lists/ListsIndexScreen.tsx';
import { PantryScreen } from '../../screens/lists/PantryScreen.tsx';

/** A pushed detail screen reads its own id, so the route element stays a thin wrapper. */
function ListDetailRoute({
  householdId,
  userId,
}: {
  householdId: string;
  userId: string;
}): ReactElement {
  const { listId } = useParams();
  if (listId === undefined) return <Navigate to="/lists" replace />;
  return <ListDetailScreen householdId={householdId} listId={listId} userId={userId} />;
}

/**
 * The Lists tab (Design › Screens › 7, 8, 9). The sub-tab roots sit inside `PillarScreen`, which
 * draws the segmented control; the pushed screens — a list's detail and the archived view —
 * render without it, because the top bar has already swapped the switcher for a back control.
 */
export function Component(): ReactElement {
  const profile = useProfile();
  const householdId = profile.data?.activeHouseholdId ?? undefined;
  const userId = profile.data?.id;

  if (householdId === undefined || userId === undefined) {
    return (
      <PillarScreen pillar="lists">
        <SkeletonRows label="Loading your lists" />
      </PillarScreen>
    );
  }

  return (
    <Routes>
      <Route
        index
        element={
          <PillarScreen pillar="lists">
            <ListsIndexScreen householdId={householdId} />
          </PillarScreen>
        }
      />
      <Route
        path="deals"
        element={
          <PillarScreen pillar="lists">
            <SubSectionComingSoon section="Deal search" />
          </PillarScreen>
        }
      />
      <Route
        path="flyers"
        element={
          <PillarScreen pillar="lists">
            <SubSectionComingSoon section="Flyer browsing" />
          </PillarScreen>
        }
      />
      <Route
        path="pantry"
        element={
          <PillarScreen pillar="lists">
            <PantryScreen householdId={householdId} />
          </PillarScreen>
        }
      />
      <Route path="archived" element={<ArchivedListsScreen householdId={householdId} />} />
      <Route
        path=":listId"
        element={<ListDetailRoute householdId={householdId} userId={userId} />}
      />
      <Route path="*" element={<Navigate to="/lists" replace />} />
    </Routes>
  );
}
