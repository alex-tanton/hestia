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
export function createRoutes(): RouteObject[] {
  /*
   * Magic link is built but disabled (Requirements › Authentication). The flag is a build-time
   * constant, so with it off the bundler folds this away: neither screen's chunk is emitted and
   * neither path exists. A direct URL to one then falls through to the splat route below, which
   * sends a signed-out visitor to ordinary sign-in.
   */
  const magicLinkRoutes: RouteObject[] =
    import.meta.env.VITE_MAGIC_LINK_ENABLED === 'true'
      ? [
          {
            path: 'sign-in/link',
            lazy: () => import('./screens/onboarding/MagicLinkRequestScreen.tsx'),
          },
          {
            path: 'sign-in/code',
            lazy: () => import('./screens/onboarding/MagicLinkCodeScreen.tsx'),
          },
        ]
      : [];

  return [
    {
      errorElement: <RouteError />,
      HydrateFallback: () => null,
      children: [
        {
          element: <SignedOutOnly />,
          children: [
            { path: 'sign-in', lazy: () => import('./screens/onboarding/SignInScreen.tsx') },
            { path: 'sign-up', lazy: () => import('./screens/onboarding/SignUpScreen.tsx') },
            ...magicLinkRoutes,
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
                // Deals and flyers are lazy chunks of their own under the Lists tab, so opening
                // the tab does not pull in the deal screens and vice versa.
                { path: 'lists/deals', lazy: () => import('./screens/deals/DealSearchScreen.tsx') },
                { path: 'lists/flyers', lazy: () => import('./screens/deals/FlyersScreen.tsx') },
                {
                  path: 'lists/flyers/:flyerId',
                  lazy: () => import('./screens/deals/FlyerItemsScreen.tsx'),
                },
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
}

export const routes: RouteObject[] = createRoutes();
