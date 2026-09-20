import type { ReactElement } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { ErrorState } from './components/states/StateBlocks.tsx';
import {
  AuthenticatedLayout,
  RequireSession,
  SignedOutOnly,
} from './screens/AuthenticatedLayout.tsx';
import { DashboardScreen } from './screens/DashboardScreen.tsx';

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
 * Route-level code splitting (Engineering Practices › Performance budget): each pillar's tab,
 * Settings, and the onboarding screens load on first visit. The dashboard is the landing screen,
 * so it ships in the shell. Sign-up, set-password, and Settings' change-password form are the
 * only screens that pull in the common-password list, and all three are behind a lazy route,
 * which is what keeps the list out of the shell.
 */
export const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    HydrateFallback: () => null,
    children: [
      {
        element: <SignedOutOnly />,
        children: [
          { path: 'sign-in', lazy: () => import('./screens/onboarding/SignInScreen.tsx') },
          { path: 'sign-up', lazy: () => import('./screens/onboarding/SignUpScreen.tsx') },
        ],
      },
      {
        path: 'forgot-password',
        lazy: () => import('./screens/onboarding/ForgotPasswordScreen.tsx'),
      },
      // Not gated: the reset link lands here carrying a recovery session, which is a session.
      { path: 'set-password', lazy: () => import('./screens/onboarding/SetPasswordScreen.tsx') },
      {
        element: <RequireSession />,
        children: [
          { path: 'onboarding', lazy: () => import('./screens/onboarding/OnboardingScreen.tsx') },
          { path: 'join', lazy: () => import('./screens/onboarding/JoinRoute.tsx') },
          {
            element: <AuthenticatedLayout />,
            children: [
              { index: true, element: <DashboardScreen /> },
              { path: 'lists/*', lazy: () => import('./pillars/lists/ListsRoute.tsx') },
              { path: 'meals/*', lazy: () => import('./pillars/meals/MealsRoute.tsx') },
              { path: 'bills/*', lazy: () => import('./pillars/bills/BillsRoute.tsx') },
              { path: 'chores/*', lazy: () => import('./pillars/chores/ChoresRoute.tsx') },
              { path: 'settings', lazy: () => import('./screens/settings/SettingsRoute.tsx') },
              {
                path: 'settings/system-health',
                lazy: () => import('./screens/settings/SystemHealthRoute.tsx'),
              },
              {
                path: 'settings/households/:householdId/members/:userId/depart',
                lazy: () => import('./screens/settings/DepartRoute.tsx'),
              },
              { path: '*', element: <Navigate to="/" replace /> },
            ],
          },
        ],
      },
    ],
  },
];
