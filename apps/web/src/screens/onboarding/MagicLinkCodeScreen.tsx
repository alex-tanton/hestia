import { useEffect, useState, type ReactElement, type SyntheticEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { useAuthClient } from '../../lib/api/api-context.tsx';
import { OFFLINE_MESSAGE } from '../../lib/api/problem.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import {
  CODE_INVALID_MESSAGE,
  CODE_LENGTH,
  CODE_LENGTH_MESSAGE,
  MAGIC_LINK_PATH,
  RESEND_AFTER_SECONDS,
  SEND_FAILED_MESSAGE,
  codeScreenDescription,
  magicLinkMessage,
  normalizeCode,
  resendCountdown,
  resentConfirmation,
} from './magic-link.ts';
import { OnboardingLayout } from './OnboardingLayout.tsx';

/**
 * Design › Screens › 1: the check-your-email screen's 6-digit code field, with a resend action
 * that opens after 30 seconds. This is the path an installed iOS app has to take, since a home
 * screen app cannot receive the link's session (Requirements › Authentication).
 *
 * One input rather than six boxes: it is a single labelled field, so a paste of "123 456" lands
 * whole, the error attaches to the thing that is wrong, and nothing has to manage focus between
 * digits.
 */
export function MagicLinkCodeScreen(): ReactElement {
  const auth = useAuthClient();
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const { errors, setErrors, formRef } = useFieldErrors<'code'>();
  const [code, setCode] = useState('');
  const [formError, setFormError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [hasResent, setHasResent] = useState(false);
  // Counted from a deadline rather than by decrementing a number, so a backgrounded tab — where
  // the browser throttles timers — comes back with the right amount of time left, not less.
  const [resendAt, setResendAt] = useState(() => Date.now() + RESEND_AFTER_SECONDS * 1000);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const email = (location.state as { email?: string } | null)?.email;

  // The code field is the only thing this screen is for, so the caret starts in it.
  useEffect(() => {
    formRef.current?.querySelector('input')?.focus();
  }, [formRef]);

  useEffect(() => {
    if (secondsLeft === 0) return undefined;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => {
      clearInterval(timer);
    };
  }, [secondsLeft]);

  const handleSubmit = async (event: SyntheticEvent): Promise<void> => {
    event.preventDefault();
    setFormError(undefined);
    if (email === undefined) return;
    if (code.length !== CODE_LENGTH) {
      setErrors({ code: CODE_LENGTH_MESSAGE });
      return;
    }
    setErrors({});

    setIsSubmitting(true);
    try {
      await auth.verifySignInCode(email, code);
      await navigate('/', { replace: true });
    } catch (error) {
      setFormError(magicLinkMessage(error, CODE_INVALID_MESSAGE));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    if (email === undefined) return;
    setFormError(undefined);
    setHasResent(false);
    setIsResending(true);
    try {
      await auth.sendSignInLink(email);
      setHasResent(true);
      setResendAt(Date.now() + RESEND_AFTER_SECONDS * 1000);
      setNow(Date.now());
    } catch (error) {
      setFormError(magicLinkMessage(error, SEND_FAILED_MESSAGE));
    } finally {
      setIsResending(false);
    }
  };

  // Nothing was sent, so there is no code to enter: the request screen is where this starts.
  if (email === undefined) return <Navigate to={MAGIC_LINK_PATH} replace />;

  const resendUnavailable = isOnline ? undefined : OFFLINE_MESSAGE;

  return (
    <OnboardingLayout
      title="Enter your code"
      description={codeScreenDescription(email)}
      onBack={{
        label: 'Back to sign in',
        onBack: () => {
          void navigate('/sign-in');
        },
      }}
    >
      <form
        ref={formRef}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <TextField
          label="6-digit code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          spellCheck={false}
          hint="From the email we just sent"
          className="tracking-[0.3em] tabular-nums"
          value={code}
          error={errors.code}
          onChange={(event) => {
            setCode(normalizeCode(event.target.value));
          }}
        />
        <FormMessage message={formError} />
        <Button type="submit" isLoading={isSubmitting} disabledReason={resendUnavailable}>
          Sign in
        </Button>
      </form>
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          isLoading={isResending}
          disabledReason={
            resendUnavailable ?? (secondsLeft > 0 ? resendCountdown(secondsLeft) : undefined)
          }
          onClick={() => {
            void handleResend();
          }}
        >
          Send a new code
        </Button>
        <p role="status" className="text-body-sm text-secondary">
          {hasResent ? resentConfirmation(email) : ''}
        </p>
      </div>
    </OnboardingLayout>
  );
}

/** Lazy route module: the magic-link screens stay out of the app shell. */
export function Component(): ReactElement {
  return <MagicLinkCodeScreen />;
}
