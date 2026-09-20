import type { ReactElement } from 'react';
import { ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useProfile } from '../../lib/api/hooks.ts';
import { ApiError } from '../../lib/api/problem.ts';
import { AboutSection } from './AboutSection.tsx';
import { AccountSection } from './AccountSection.tsx';
import { HouseholdSettingsSection } from './HouseholdSettingsSection.tsx';
import { HouseholdsSection } from './HouseholdsSection.tsx';
import { InvitesSection } from './InvitesSection.tsx';
import { NotificationsSection } from './NotificationsSection.tsx';

/** Design › Screens › 4: Account, My Households, Invites, Household settings, Notifications, About. */
export function SettingsScreen(): ReactElement {
  const profile = useProfile();

  if (profile.isPending) return <SkeletonRows label="Loading settings" rows={4} />;

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
      <AccountSection profile={profile.data} />
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
      <NotificationsSection profile={profile.data} />
      <AboutSection isServerOwner={profile.data.isServerOwner} />
    </div>
  );
}
