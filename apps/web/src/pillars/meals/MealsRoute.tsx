import type { ReactElement } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router';
import { useProfile } from '../../lib/api/hooks.ts';
import { PillarScreen } from '../../screens/PillarScreen.tsx';
import { PlannerScreen } from '../../screens/meals/PlannerScreen.tsx';
import { RecipeDetailScreen } from '../../screens/meals/RecipeDetailScreen.tsx';
import { RecipeLibraryScreen } from '../../screens/meals/RecipeLibraryScreen.tsx';
import { SuggestionsScreen } from '../../screens/meals/SuggestionsScreen.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';

/** A pushed detail screen reads its own id, so the route element stays a thin wrapper. */
function RecipeDetailRoute({ householdId }: { householdId: string }): ReactElement {
  const { recipeId } = useParams();
  if (recipeId === undefined) return <Navigate to="/meals/recipes" replace />;
  return <RecipeDetailScreen householdId={householdId} recipeId={recipeId} />;
}

/**
 * The Meals tab (Design › Screens › 10, 11, 12, 13). The sub-tab roots — Planner, Recipes,
 * Suggestions — sit inside `PillarScreen`, which draws the segmented control; a recipe's detail
 * renders without it, since the top bar has already swapped the switcher for a back control (the
 * same split `ListsRoute` uses for a list's own detail).
 */
export function Component(): ReactElement {
  const profile = useProfile();
  const householdId = profile.data?.activeHouseholdId ?? undefined;

  if (householdId === undefined) {
    return (
      <PillarScreen pillar="meals">
        <SkeletonRows label="Loading the week planner" />
      </PillarScreen>
    );
  }

  return (
    <Routes>
      <Route
        index
        element={
          <PillarScreen pillar="meals">
            <PlannerScreen householdId={householdId} />
          </PillarScreen>
        }
      />
      <Route
        path="recipes"
        element={
          <PillarScreen pillar="meals">
            <RecipeLibraryScreen householdId={householdId} />
          </PillarScreen>
        }
      />
      <Route
        path="suggestions"
        element={
          <PillarScreen pillar="meals">
            <SuggestionsScreen householdId={householdId} />
          </PillarScreen>
        }
      />
      <Route path="recipes/:recipeId" element={<RecipeDetailRoute householdId={householdId} />} />
      <Route path="*" element={<Navigate to="/meals" replace />} />
    </Routes>
  );
}
