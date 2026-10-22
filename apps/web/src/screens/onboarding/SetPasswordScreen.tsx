import { useState, type SyntheticEvent, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { useAuthState } from '../../lib/api/api-context.tsx';
import { useChangePassword } from '../../lib/api/hooks.ts';
import { OFFLINE_MESSAGE, userMessage } from '../../lib/api/problem.ts';
import { PASSWORD_HINT, validateNewPassword } from '../../lib/password.ts';
import { hashHasAuthError, initialUrlHash } from '../../lib/url-hash.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { OnboardingLayout } from './OnboardingLayout.tsx';

export const RESET_LINK_EXPIRED_MESSAGE =
  'This reset link has expired. Ask your server owner for a new one.';

/**
 * Set new password: opened by the owner's reset link, which lands here
 * with a recovery session in the URL fragment. Only the new password is asked for — the service
 * waives the current-password re-entry for a recovery sign-in — and a used or expired link says so
 * instead.
 */
export function SetPasswordScreen(): ReactElement {
  const navigate = useNavigate();
  const authState = useAuthState();
  const isOnline = useOnlineStatus();
  const changePassword = useChangePassword();
  const { errors, setErrors, formRef } = useFieldErrors<'password'>();
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string>();
  const [isExpired, setIsExpired] = useState(() => hashHasAuthError(initialUrlHash()));

  const isLinkUnusable = isExpired || authState.status === 'signed-out';

  const handleSubmit = async (event: SyntheticEvent): Promise<void> => {
    event.preventDefault();
    setFormError(undefined);
    const problem = validateNewPassword(password);
    setErrors(problem === undefined ? {} : { password: problem });
    if (problem !== undefined) return;

    try {
      // No current password: the recovery session is the proof, and the service checks that.
      await changePassword.mutateAsync({ newPassword: password });
      await navigate('/', { replace: true });
    } catch (error) {
      // 400 here means the session is not a recovery one any more, which is an expired link.
      setFormError(
        userMessage(error, {
          byStatus: { 400: RESET_LINK_EXPIRED_MESSAGE, 401: RESET_LINK_EXPIRED_MESSAGE },
          fallback: 'Could not set the password. Try again.',
        }),
      );
      setIsExpired(true);
    }
  };

  if (authState.status === 'loading') {
    return (
      <OnboardingLayout title="Set a new password">
        <p role="status" className="text-body text-secondary">
          Checking your reset link…
        </p>
      </OnboardingLayout>
    );
  }

  if (isLinkUnusable) {
    return (
      <OnboardingLayout title="Set a new password">
        <FormMessage message={RESET_LINK_EXPIRED_MESSAGE} />
        <Link to="/sign-in" className="text-body-sm font-semibold text-section">
          Back to sign in
        </Link>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout title="Set a new password">
      <form
        ref={formRef}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <TextField
          label="New password"
          type="password"
          name="newPassword"
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
          isLoading={changePassword.isPending}
          disabledReason={isOnline ? undefined : OFFLINE_MESSAGE}
        >
          Set password
        </Button>
      </form>
    </OnboardingLayout>
  );
}

/** Lazy route module: this is one of the screens that loads the common-password list. */
export function Component(): ReactElement {
  return <SetPasswordScreen />;
}
