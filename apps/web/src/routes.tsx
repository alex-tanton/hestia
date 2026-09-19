import type { ReactElement } from 'react';
import { Navigate, Outlet, type RouteObject } from 'react-router';
import { AppShell } from './components/shell/AppShell.tsx';
import type { HouseholdSwitcherProps } from './components/shell/HouseholdSwitcher.tsx';
import { UpdatePrompt } from './components/shell/UpdatePrompt.tsx';
import { ErrorState } from './components/states/StateBlocks.tsx';
import { DashboardScreen } from './screens/DashboardScreen.tsx';

/**
 * Until the identity work wires `GET /api/users/me`, the switcher has no data and shows its
 * loading state.
 */
const PENDING_SWITCHER: HouseholdSwitcherProps = {
  households: undefined,
  activeHouseholdId: undefined,
  onSelect: () => undefined,
  onJoinOrCreate: () => undefined,
};

function ShellLayout(): ReactElement {
  return (
    <AppShell switcher={PENDING_SWITCHER} updatePrompt={<UpdatePrompt />}>
      <Outlet />
    </AppShell>
  );
}

function RouteError(): ReactElement {
  return (
    <main className="mx-auto max-w-160 p-4">
      <ErrorState
        message="Something went wrong loading this screen. Try again, or reload."
        retryLabel="Reload"
        onRetry={() => {
          window.location.reload();
        }}
      />
    </main>
  );
}

/**
 * Route-level code splitting per pillar (Engineering Practices › Performance budget): each tab's
 * module loads on first visit. The dashboard is the landing screen, so it ships in the shell.
 */
export const routes: RouteObject[] = [
  {
    element: <ShellLayout />,
    errorElement: <RouteError />,
    HydrateFallback: () => null,
    children: [
      { index: true, element: <DashboardScreen /> },
      { path: 'lists/*', lazy: () => import('./pillars/lists/ListsRoute.tsx') },
      { path: 'meals/*', lazy: () => import('./pillars/meals/MealsRoute.tsx') },
      { path: 'bills/*', lazy: () => import('./pillars/bills/BillsRoute.tsx') },
      { path: 'chores/*', lazy: () => import('./pillars/chores/ChoresRoute.tsx') },
      { path: 'settings', lazy: () => import('./screens/SettingsRoute.tsx') },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
