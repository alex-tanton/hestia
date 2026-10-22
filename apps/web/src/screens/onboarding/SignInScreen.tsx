import { useState, type SyntheticEvent, type ReactElement } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { useAuthClient } from '../../lib/api/api-context.tsx';
import { AuthError } from '../../lib/auth/auth-client.ts';
import { OFFLINE_MESSAGE, userMessage } from '../../lib/api/problem.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { OnboardingLayout } from './OnboardingLayout.tsx';

type Field = 'email' | 'password';

/** Sign in with email and password, with a "Forgot password?" link. */
export function SignInScreen(): ReactElement {
  const auth = useAuthClient();
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const { errors, setErrors, formRef } = useFieldErrors<Field>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // A protected route sends the user here with where they were heading.
  const destination = (location.state as { from?: string } | null)?.from ?? '/';

  const handleSubmit = async (event: SyntheticEvent): Promise<void> => {
    event.preventDefault();
    setFormError(undefined);
    const next: Partial<Record<Field, string>> = {};
    if (email.trim() === '') next.email = 'Enter your email address.';
    if (password === '') next.password = 'Enter your password.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setIsSubmitting(true);
    try {
      await auth.signIn(email.trim(), password);
      await navigate(destination, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof AuthError
          ? error.message
          : userMessage(error, { fallback: 'Could not sign in. Try again.' }),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <OnboardingLayout title="Sign in">
      <form
        ref={formRef}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
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
          autoComplete="current-password"
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
          Sign in
        </Button>
      </form>
      <div className="flex flex-col gap-2 text-body-sm">
        {/*
         * Magic link is built but disabled. The flag is a build-time constant, so with it off this
         * option — and the sentence naming it — is folded out of the build rather than hidden at
         * runtime.
         */}
        {import.meta.env.VITE_MAGIC_LINK_ENABLED === 'true' && (
          <Link to="/sign-in/link" className="font-semibold text-section">
            Email me a sign-in link
          </Link>
        )}
        <Link to="/forgot-password" className="font-semibold text-section">
          Forgot password?
        </Link>
        <p className="text-secondary">
          New here?{' '}
          <Link to="/sign-up" className="font-semibold text-section">
            Create an account
          </Link>
        </p>
      </div>
    </OnboardingLayout>
  );
}

/** Lazy route module: the signed-out screens stay out of the app shell. */
export function Component(): ReactElement {
  return <SignInScreen />;
}
