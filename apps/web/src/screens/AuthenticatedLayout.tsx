import { useEffect, type ReactElement } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { AppShell } from '../components/shell/AppShell.tsx';
import type { HouseholdSwitcherProps } from '../components/shell/HouseholdSwitcher.tsx';
import { UpdatePrompt } from '../components/shell/UpdatePrompt.tsx';
import { ErrorState, OfflineState } from '../components/states/StateBlocks.tsx';
import { SkeletonRows } from '../components/ui/Skeleton.tsx';
import { useAuthState } from '../lib/api/api-context.tsx';
import { useProfile, useSwitchHousehold } from '../lib/api/hooks.ts';
import { ApiError } from '../lib/api/problem.ts';
import { useNotificationTarget } from '../lib/push/notification-target.ts';
import { useTimezoneSync } from '../lib/use-timezone-sync.ts';

/** A session is required below this point; without one the sign-in screen is the destination. */
export function RequireSession(): ReactElement {
  const { status } = useAuthState();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <main className="mx-auto flex max-w-160 flex-col gap-3 p-4">
        <p role="status" className="sr-only">
          Opening Hearth
        </p>
        <SkeletonRows label="Opening Hearth" />
      </main>
    );
  }
  if (status === 'signed-out') {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/** Sign-in and sign-up have nothing to offer a signed-in user. */
export function SignedOutOnly(): ReactElement {
  const { status } = useAuthState();
  if (status === 'signed-in') return <Navigate to="/" replace />;
  return <Outlet />;
}

/**
 * The app shell, once the profile is known. `GET /api/users/me` is the only source of the
 * memberships, the active household, and `isServerOwner` (Engineering Practices › Frontend
 * patterns), so every screen below reads it from the cache rather than being handed a copy.
 */
export function AuthenticatedLayout(): ReactElement {
  const navigate = useNavigate();
  const profile = useProfile();
  const switchHousehold = useSwitchHousehold();
  useTimezoneSync(profile.data);
  useNotificationTarget(profile.data);

  const switchTo = switchHousehold.mutate;
  const isRefused = profile.error instanceof ApiError && profile.error.status === 401;

  useEffect(() => {
    // The session outlived its usefulness (the API client already dropped it); start over.
    if (isRefused) void navigate('/sign-in', { replace: true });
  }, [isRefused, navigate]);

  const switcher: HouseholdSwitcherProps = {
    households: profile.data?.memberships.map((membership) => ({
      id: membership.householdId,
      name: membership.name,
      memberCount: membership.memberCount,
    })),
    activeHouseholdId: profile.data?.activeHouseholdId ?? undefined,
    onSelect: (householdId) => {
      switchTo(householdId, {
        onSuccess: () => {
          // Design › Navigation rules: a switch returns every tab to its root.
          void navigate('/', { replace: true });
        },
      });
    },
    onJoinOrCreate: () => {
      void navigate('/onboarding', { state: { addingAnother: true } });
    },
  };

  if (profile.isPending) {
    return (
      <AppShell switcher={switcher} updatePrompt={<UpdatePrompt />}>
        <SkeletonRows label="Loading your household" />
      </AppShell>
    );
  }

  if (profile.isError) {
    const isOffline = profile.error instanceof ApiError && profile.error.isOffline;
    return (
      <AppShell switcher={switcher} updatePrompt={<UpdatePrompt />}>
        {isOffline ? (
          <OfflineState message="Hearth needs a connection to open. Your installed app will work offline once your household has loaded." />
        ) : (
          <ErrorState
            message="Couldn't load your household. Try again."
            onRetry={() => {
              void profile.refetch();
            }}
          />
        )}
      </AppShell>
    );
  }

  // No membership means there is nothing to show: onboarding's create-or-join step is the screen.
  if (profile.data.memberships.length === 0) return <Navigate to="/onboarding" replace />;

  return (
    <AppShell switcher={switcher} updatePrompt={<UpdatePrompt />}>
      <Outlet />
    </AppShell>
  );
}
