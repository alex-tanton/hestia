import type { ReactElement } from 'react';
import { ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useScreenChrome } from '../../components/shell/screen-chrome.tsx';
import { useProfile } from '../../lib/api/hooks.ts';
import { ApiError } from '../../lib/api/problem.ts';
import { HouseholdSettingsSection } from './HouseholdSettingsSection.tsx';
import { HouseholdsSection } from './HouseholdsSection.tsx';
import { InvitesSection } from './InvitesSection.tsx';

/** Pushed sub-route: Households and invites */
export function HouseholdsScreen(): ReactElement {
  useScreenChrome({ title: 'Households', backTo: '/settings', backLabel: 'Settings' });
  const profile = useProfile();

  if (profile.isPending) return <SkeletonRows label="Loading household settings" rows={4} />;

  if (profile.isError) {
    const isOffline = profile.error instanceof ApiError && profile.error.isOffline;
    return isOffline ? (
      <OfflineState message="Settings need a connection. Your household still works offline." />
    ) : (
      <ErrorState
        message="Couldn't load your settings. Try again."
        onRetry={() => {
          void profile.refetch();
        }}
      />
    );
  }

  const activeHouseholdId = profile.data.activeHouseholdId;
  const active = profile.data.memberships.find(
    (membership) => membership.householdId === activeHouseholdId,
  );

  return (
    <div className="flex flex-col gap-6">
      <HouseholdsSection profile={profile.data} />
      {activeHouseholdId !== null && active?.role === 'admin' && (
        <InvitesSection householdId={activeHouseholdId} />
      )}
      {activeHouseholdId !== null && active !== undefined && (
        <HouseholdSettingsSection
          householdId={activeHouseholdId}
          isAdmin={active.role === 'admin'}
        />
      )}
    </div>
  );
}

export function Component(): ReactElement {
  return <HouseholdsScreen />;
}
