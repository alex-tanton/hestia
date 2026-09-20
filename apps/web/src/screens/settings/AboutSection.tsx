import { Activity, LogOut } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { ListRow } from '../../components/ui/ListRow.tsx';
import { useAuthClient } from '../../lib/api/api-context.tsx';
import { ReadOnlyValue, SettingsSection } from './SettingsSection.tsx';

/**
 * Design › Screens › 4, "About": version and sign out, with System health for the server owner
 * only — `isServerOwner` comes from `GET /api/users/me`, and the endpoint behind the screen
 * checks the caller again.
 */
export function AboutSection({ isServerOwner }: { isServerOwner: boolean }): ReactElement {
  const auth = useAuthClient();
  const navigate = useNavigate();

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
            void auth.signOut();
          }}
        >
          <LogOut aria-hidden size={20} strokeWidth={1.5} />
          Sign out
        </Button>
      </Card>
    </SettingsSection>
  );
}
