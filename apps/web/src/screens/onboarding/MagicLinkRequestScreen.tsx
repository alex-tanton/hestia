import { useEffect, useRef, useState, type ReactElement, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { useAuthClient } from '../../lib/api/api-context.tsx';
import { OFFLINE_MESSAGE } from '../../lib/api/problem.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import {
  EMAIL_REQUIRED_MESSAGE,
  MAGIC_CODE_PATH,
  SEND_FAILED_MESSAGE,
  magicLinkMessage,
  sentConfirmation,
} from './magic-link.ts';
import { OnboardingLayout } from './OnboardingLayout.tsx';

/**
 * Design › Screens › 1: the "Email me a sign-in link" option asks for an address, and sending
 * leads to the check-your-email state. The code is the path that always works — an iOS
 * home-screen app cannot receive a session through the link — so entering it is the primary
 * action from here (Requirements › Authentication).
 */
export function MagicLinkRequestScreen(): ReactElement {
  const auth = useAuthClient();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { errors, setErrors, formRef } = useFieldErrors<'email'>();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);

  // Sending swaps the form out for the confirmation, which would leave focus on the document
  // and a keyboard user with no place in the screen (Design › Accessibility › Focus management).
  useEffect(() => {
    if (sentTo !== undefined) confirmationRef.current?.focus();
  }, [sentTo]);

  const backToSignIn = {
    label: 'Back to sign in',
    onBack: () => {
      void navigate('/sign-in');
    },
  };

  const handleSubmit = async (event: SyntheticEvent): Promise<void> => {
    event.preventDefault();
    setFormError(undefined);
    const address = email.trim();
    if (address === '') {
      setErrors({ email: EMAIL_REQUIRED_MESSAGE });
      return;
    }
    setErrors({});

    setIsSubmitting(true);
    try {
      await auth.sendSignInLink(address);
      setSentTo(address);
    } catch (error) {
      setFormError(magicLinkMessage(error, SEND_FAILED_MESSAGE));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <OnboardingLayout
      title={sentTo === undefined ? 'Email sign-in' : 'Check your email'}
      description={
        sentTo === undefined
          ? 'We send a sign-in link and a 6-digit code to your email address.'
          : undefined
      }
      onBack={backToSignIn}
    >
      {/*
       * The live region outlives the swap, so it is in the tree before it has anything to say:
       * a status region that arrives already populated is announced unreliably
       * (Design › Accessibility › Specific patterns). While empty it hides the way `sr-only`
       * does rather than with `display: none`, which would take it out of the accessibility
       * tree and leave the announcement nothing to land in.
       */}
      <p role="status" className="max-w-[70ch] text-body text-secondary empty:sr-only">
        {sentTo === undefined ? '' : sentConfirmation(sentTo)}
      </p>
      {sentTo === undefined ? (
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
          <FormMessage message={formError} />
          <Button
            type="submit"
            isLoading={isSubmitting}
            disabledReason={isOnline ? undefined : OFFLINE_MESSAGE}
          >
            Send sign-in link
          </Button>
        </form>
      ) : (
        <div
          ref={confirmationRef}
          tabIndex={-1}
          className="flex flex-col items-stretch gap-3 outline-none"
        >
          <Button
            onClick={() => {
              void navigate(MAGIC_CODE_PATH, { state: { email: sentTo } });
            }}
          >
            Enter the code
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSentTo(undefined);
            }}
          >
            Use a different email
          </Button>
        </div>
      )}
    </OnboardingLayout>
  );
}

/** Lazy route module: the magic-link screens stay out of the app shell. */
export function Component(): ReactElement {
  return <MagicLinkRequestScreen />;
}
