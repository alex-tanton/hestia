import { Plus } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import type { ProfileResponse } from '@hestia/shared';
import { Button } from '../../components/ui/Button.tsx';
import { OFFLINE_MESSAGE } from '../../lib/api/problem.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { HouseholdCard } from './HouseholdCard.tsx';
import { SettingsSection } from './SettingsSection.tsx';

/** My Households: every household the member belongs to. */
export function HouseholdsSection({ profile }: { profile: ProfileResponse }): ReactElement {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  return (
    <SettingsSection title="My Households">
      <ul className="flex flex-col gap-3">
        {profile.memberships.map((membership) => (
          <HouseholdCard
            key={membership.householdId}
            membership={membership}
            currentUserId={profile.id}
            isActive={membership.householdId === profile.activeHouseholdId}
          />
        ))}
      </ul>
      <Button
        variant="secondary"
        className="self-start"
        disabledReason={isOnline ? undefined : OFFLINE_MESSAGE}
        onClick={() => {
          void navigate('/onboarding', { state: { addingAnother: true } });
        }}
      >
        <Plus aria-hidden size={20} strokeWidth={1.5} />
        Join or create a household
      </Button>
    </SettingsSection>
  );
}
