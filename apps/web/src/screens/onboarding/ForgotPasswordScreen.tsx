import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/Card.tsx';
import { OnboardingLayout } from './OnboardingLayout.tsx';

/**
 * A single screen with no form. There is no email-based reset — nothing is
 * ever emailed — so the only route back in is a link the server owner generates with
 * `hestia-admin reset-password`.
 */
export function ForgotPasswordScreen(): ReactElement {
  const navigate = useNavigate();
  return (
    <OnboardingLayout
      title="Forgot password"
      onBack={{
        label: 'Back to sign in',
        onBack: () => {
          void navigate('/sign-in');
        },
      }}
    >
      <Card
        variant="flat"
        className="w-full max-w-[440px] mx-auto p-6 bg-[var(--md-sys-color-surface-container)] flex flex-col gap-6"
      >
        <p className="max-w-[70ch] text-body-md text-body text-[var(--md-sys-color-on-surface-variant)]">
          Ask your server owner for a reset link. They can create one for you.
        </p>
      </Card>
    </OnboardingLayout>
  );
}

/** Lazy route module: the signed-out screens stay out of the app shell. */
export function Component(): ReactElement {
  return <ForgotPasswordScreen />;
}
