import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
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
      <p className="max-w-[70ch] text-body text-secondary">
        Ask your server owner for a reset link. They can create one for you.
      </p>
    </OnboardingLayout>
  );
}

/** Lazy route module: the signed-out screens stay out of the app shell. */
export function Component(): ReactElement {
  return <ForgotPasswordScreen />;
}
