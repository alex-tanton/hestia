import type { ReactElement } from 'react';
import { ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useScreenChrome } from '../../components/shell/screen-chrome.tsx';
import { useProfile } from '../../lib/api/hooks.ts';
import { ApiError } from '../../lib/api/problem.ts';
import { AccountSection } from './AccountSection.tsx';

/** Pushed sub-route: Account management */
export function AccountScreen(): ReactElement {
  useScreenChrome({ title: 'Account', backTo: '/settings', backLabel: 'Settings' });
  const profile = useProfile();

  if (profile.isPending) return <SkeletonRows label="Loading account settings" rows={4} />;

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
      <AccountSection profile={profile.data} />
    </div>
  );
}

export function Component(): ReactElement {
  return <AccountScreen />;
}
