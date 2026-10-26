import { useState, type SyntheticEvent, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router';
import { displayNameSchema, emailSchema } from '@hestia/shared';
import { Button } from '../../components/ui/Button.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { useAuthClient } from '../../lib/api/api-context.tsx';
import { OFFLINE_MESSAGE, userMessage } from '../../lib/api/problem.ts';
import { PASSWORD_HINT, validateNewPassword } from '../../lib/password.ts';
import { browserTimezone } from '../../lib/use-timezone-sync.ts';
import { firstIssue } from '../../lib/validation.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { OnboardingLayout } from './OnboardingLayout.tsx';

type Field = 'displayName' | 'email' | 'password';

/**
 * Display name, email, and password. Signup goes to `POST /api/signup`,
 * never to GoTrue, because that is where the common-password check runs — and the check runs
 * here too, with the same list and the same sentence, so a bad password is refused before the
 * request.
 */
export function SignUpScreen(): ReactElement {
  const auth = useAuthClient();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { errors, setErrors, formRef } = useFieldErrors<Field>();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: SyntheticEvent): Promise<void> => {
    event.preventDefault();
    setFormError(undefined);

    const next: Partial<Record<Field, string>> = {};
    const name = displayNameSchema.safeParse(displayName);
    if (!name.success) next.displayName = firstIssue(name.error, 'Enter a name.');
    const address = emailSchema.safeParse(email.trim());
    if (!address.success) next.email = firstIssue(address.error);
    const passwordProblem = validateNewPassword(password);
    if (passwordProblem !== undefined) next.password = passwordProblem;
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setIsSubmitting(true);
    try {
      await auth.signUp({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        timezone: browserTimezone(),
      });
      await navigate('/onboarding', { replace: true });
    } catch (error) {
      setFormError(
        userMessage(error, {
          byStatus: { 409: 'An account already uses that email. Sign in instead.' },
          fallback: 'Could not create the account. Try again.',
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <OnboardingLayout title="Create your account">
      <form
        ref={formRef}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <TextField
          label="Display name"
          name="displayName"
          autoComplete="name"
          value={displayName}
          error={errors.displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
          }}
        />
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          error={errors.email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
        <TextField
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          hint={PASSWORD_HINT}
          value={password}
          error={errors.password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
        <FormMessage message={formError} />
        <Button
          type="submit"
          isLoading={isSubmitting}
          disabledReason={isOnline ? undefined : OFFLINE_MESSAGE}
        >
          Create account
        </Button>
      </form>
      <p className="text-body-sm text-secondary">
        Already have an account?{' '}
        <Link to="/sign-in" className="font-semibold text-section">
          Sign in
        </Link>
      </p>
    </OnboardingLayout>
  );
}

/** Lazy route module: this is one of the screens that loads the common-password list. */
export function Component(): ReactElement {
  return <SignUpScreen />;
}
