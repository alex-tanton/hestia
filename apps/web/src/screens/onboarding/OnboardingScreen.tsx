import { Plus, Ticket } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button.tsx';
import { ListRow } from '../../components/ui/ListRow.tsx';
import { useAuthClient } from '../../lib/api/api-context.tsx';
import { CreateHouseholdStep } from './CreateHouseholdStep.tsx';
import { FavoriteStoresStep } from './FavoriteStoresStep.tsx';
import { InstallStep } from './InstallStep.tsx';
import { JoinHouseholdStep } from './JoinHouseholdStep.tsx';
import { OnboardingLayout } from './OnboardingLayout.tsx';

export type OnboardingStep = 'choose' | 'create' | 'stores' | 'join' | 'install';

export interface OnboardingScreenProps {
  initialStep?: OnboardingStep;
  /** An invite token from a link, redeemed as soon as the join step opens. */
  autoToken?: string | undefined;
}

const HEADINGS: Record<OnboardingStep, { title: string; description?: string }> = {
  choose: {
    title: 'Set up your household',
    description: 'Start one for your home, or join a household someone has invited you to.',
  },
  create: { title: 'Name your household' },
  stores: { title: 'Favorite stores' },
  join: {
    title: 'Join a household',
    description: 'Enter the 8-character code from your invite.',
  },
  install: { title: 'Add Hestia to your home screen' },
};

/**
 * Onboarding after sign-in: create a household and set it up, or join one by link or code, which
 * skips setup. The install prompt closes either path, because it is about the app rather than the
 * household.
 */
export function OnboardingScreen({
  initialStep = 'choose',
  autoToken,
}: OnboardingScreenProps): ReactElement {
  const navigate = useNavigate();
  const auth = useAuthClient();
  const [step, setStep] = useState<OnboardingStep>(initialStep);

  // Adding a second household from the switcher is not onboarding, so it skips the install step.
  // Whoever opened this screen knows which it is, and says so in the navigation state.
  const isAddingAnother =
    (useLocation().state as { addingAnother?: boolean } | null)?.addingAnother === true;

  const finish = (): void => {
    void navigate('/', { replace: true });
  };

  const afterHousehold = (): void => {
    if (isAddingAnother) finish();
    else setStep('install');
  };

  const heading = HEADINGS[step];
  const backToChoose =
    step === 'create' || step === 'join'
      ? {
          label: 'Back',
          onBack: () => {
            setStep('choose');
          },
        }
      : undefined;

  return (
    <OnboardingLayout
      title={heading.title}
      {...(heading.description === undefined ? {} : { description: heading.description })}
      {...(backToChoose ? { onBack: backToChoose } : {})}
    >
      {step === 'choose' && (
        <>
          <ul className="divide-y divide-border rounded-md border border-border">
            <li>
              <ListRow
                title="Create a household"
                description="You become its admin"
                leading={<Plus aria-hidden size={20} strokeWidth={1.5} />}
                onSelect={() => {
                  setStep('create');
                }}
              />
            </li>
            <li>
              <ListRow
                title="Join with a code"
                description="Use the 8-character code from your invite"
                leading={<Ticket aria-hidden size={20} strokeWidth={1.5} />}
                onSelect={() => {
                  setStep('join');
                }}
              />
            </li>
          </ul>
          <Button
            variant="ghost"
            className="self-start"
            onClick={() => {
              void auth.signOut();
            }}
          >
            Sign out
          </Button>
        </>
      )}

      {step === 'create' && (
        <CreateHouseholdStep
          onCreated={() => {
            setStep('stores');
          }}
        />
      )}

      {step === 'stores' && <FavoriteStoresStep onDone={afterHousehold} />}

      {step === 'join' && <JoinHouseholdStep autoToken={autoToken} onJoined={afterHousehold} />}

      {step === 'install' && <InstallStep onDone={finish} />}
    </OnboardingLayout>
  );
}

/** Lazy route module: onboarding is visited once, so it loads then rather than with the shell. */
export function Component(): ReactElement {
  return <OnboardingScreen />;
}
