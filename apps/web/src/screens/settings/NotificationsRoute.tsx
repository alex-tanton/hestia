import type { ReactElement } from 'react';
import { ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useScreenChrome } from '../../components/shell/screen-chrome.tsx';
import { useProfile } from '../../lib/api/hooks.ts';
import { ApiError } from '../../lib/api/problem.ts';
import { NotificationsSection } from './NotificationsSection.tsx';

/** Pushed sub-route: Notifications and alert preferences */
export function NotificationsScreen(): ReactElement {
  useScreenChrome({ title: 'Notifications', backTo: '/settings', backLabel: 'Settings' });
  const profile = useProfile();

  if (profile.isPending) return <SkeletonRows label="Loading notification settings" rows={4} />;

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

  return (
    <div className="flex flex-col gap-6">
      <NotificationsSection profile={profile.data} />
    </div>
  );
}

export function Component(): ReactElement {
  return <NotificationsScreen />;
}
