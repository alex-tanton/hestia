import { Activity, LogOut } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { ListRow } from '../../components/ui/ListRow.tsx';
import { useApi, useAuthClient } from '../../lib/api/api-context.tsx';
import { removeDeviceSubscription } from '../../lib/push/device-subscription.ts';
import { usePushPort } from '../../lib/push/use-push-device.tsx';
import { ReadOnlyValue, SettingsSection } from './SettingsSection.tsx';

/**
 * About: version and sign out, with System health for the server owner
 * only — `isServerOwner` comes from `GET /api/users/me`, and the endpoint behind the screen
 * checks the caller again.
 */
export function AboutSection({ isServerOwner }: { isServerOwner: boolean }): ReactElement {
  const auth = useAuthClient();
  const api = useApi();
  const port = usePushPort();
  const navigate = useNavigate();

  // Signing out removes this device's push subscription first, while the token that deletes it
  // is still valid. A failure here must not keep the user signed in.
  const signOut = async (): Promise<void> => {
    try {
      await removeDeviceSubscription(port, api, navigator.onLine);
    } catch {
      // Nothing to report: the server prunes the row on the next refused push.
    }
    await auth.signOut();
  };

  return (
    <SettingsSection title="About">
      <Card className="flex flex-col gap-4">
        <ReadOnlyValue label="Version" value={__APP_VERSION__} />
        {isServerOwner && (
          <ul className="border-y border-border">
            <li>
              <ListRow
                title="System health"
                description="Job freshness, recent errors, and the newest backup"
                leading={<Activity aria-hidden size={20} strokeWidth={1.5} />}
                onSelect={() => {
                  void navigate('/settings/system-health');
                }}
              />
            </li>
          </ul>
        )}
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => {
            void signOut();
          }}
        >
          <LogOut aria-hidden size={20} strokeWidth={1.5} />
          Sign out
        </Button>
      </Card>
    </SettingsSection>
  );
}
