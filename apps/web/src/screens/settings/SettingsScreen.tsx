import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { ListRow } from '../../components/ui/ListRow.tsx';
import { useProfile } from '../../lib/api/hooks.ts';
import { ApiError } from '../../lib/api/problem.ts';
import { AboutSection } from './AboutSection.tsx';

/**
 * Categorized Settings hub: renders list rows navigating to dedicated pushed sub-routes
 * (/settings/account, /settings/households, /settings/notifications, /settings/system-health).
 */
export function SettingsScreen(): ReactElement {
  const navigate = useNavigate();
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

  const isServerOwner = profile.data.isServerOwner;

  return (
    <div className="flex flex-col gap-6">
      <Card variant="flat" className="p-0 overflow-hidden">
        <ul className="flex flex-col divide-y divide-[var(--md-sys-color-outline-variant)]">
          <li className="px-4">
            <ListRow
              title="Account"
              description="Email, display name, and password"
              leading={<Icon name="person" size={24} />}
              onSelect={() => {
                void navigate('/settings/account');
              }}
            />
          </li>
          <li className="px-4">
            <ListRow
              title="Households & Invites"
              description="Active household, members, and pending invitations"
              leading={<Icon name="home" size={24} />}
              onSelect={() => {
                void navigate('/settings/households');
              }}
            />
          </li>
          <li className="px-4">
            <ListRow
              title="Notifications"
              description="Web push permissions and alert preferences"
              leading={<Icon name="notifications" size={24} />}
              onSelect={() => {
                void navigate('/settings/notifications');
              }}
            />
          </li>
          {isServerOwner && (
            <li className="px-4">
              <ListRow
                title="System health"
                description="Diagnostics, connectivity, and telemetry"
                leading={<Icon name="dns" size={24} />}
                onSelect={() => {
                  void navigate('/settings/system-health');
                }}
              />
            </li>
          )}
        </ul>
      </Card>

      <AboutSection isServerOwner={false} />
    </div>
  );
}
