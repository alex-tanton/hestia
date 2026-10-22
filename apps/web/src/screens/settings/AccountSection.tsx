import type { ReactElement } from 'react';
import type { ProfileResponse } from '@hearth/shared';
import { Card } from '../../components/ui/Card.tsx';
import { formatTimezone } from '../../lib/format.ts';
import { ReadOnlyValue, SettingsSection } from './SettingsSection.tsx';
import { ChangeEmailForm } from './account/ChangeEmailForm.tsx';
import { ChangePasswordForm } from './account/ChangePasswordForm.tsx';
import { DisplayNameForm } from './account/DisplayNameForm.tsx';

/**
 * Account: email, display name, and password, each editable; the
 * timezone is shown as detected and is read-only, because it follows the browser on every open.
 */
export function AccountSection({ profile }: { profile: ProfileResponse }): ReactElement {
  return (
    <SettingsSection title="Account">
      <Card className="flex flex-col gap-6">
        <DisplayNameForm displayName={profile.displayName} />
        <ChangeEmailForm email={profile.email} />
        <ChangePasswordForm />
        <ReadOnlyValue
          label="Timezone"
          value={`${formatTimezone(profile.timezone)} · detected from this device`}
        />
      </Card>
    </SettingsSection>
  );
}
