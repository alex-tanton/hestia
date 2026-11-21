import { useEffect, useRef, useState, type SyntheticEvent, type ReactElement } from 'react';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { useJoinHousehold } from '../../lib/api/hooks.ts';
import { OFFLINE_MESSAGE, userMessage } from '../../lib/api/problem.ts';
import {
  INVITE_CODE_LENGTH,
  INVITE_CODE_MISMATCH_MESSAGE,
  normalizeInviteCode,
} from '../../lib/invite-code.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';

/** The message shown for each failed redemption status. */
export const INVITE_PROBLEMS: Readonly<Record<number, string>> = {
  404: INVITE_CODE_MISMATCH_MESSAGE,
  410: 'This invite has expired. Ask for a new link or code.',
  429: 'Too many attempts. Try again in a minute.',
};

export interface JoinHouseholdStepProps {
  /** The token from an invite link, redeemed as soon as the screen opens. */
  autoToken?: string | undefined;
  onJoined: () => void;
  onCreateNew?: () => void;
}

/**
 * Joining by link or by the 8-character code. The code field accepts what people actually type:
 * lowercase, spaces, hyphens, and the letters Crockford Base32 reads as digits.
 */
export function JoinHouseholdStep({
  autoToken,
  onJoined,
  onCreateNew,
}: JoinHouseholdStepProps): ReactElement {
  const isOnline = useOnlineStatus();
  const joinHousehold = useJoinHousehold();
  const { errors, setErrors, formRef } = useFieldErrors<'code'>();
  const [code, setCode] = useState('');
  const [formError, setFormError] = useState<string>();
  const [isRedeemingLink, setIsRedeemingLink] = useState(autoToken !== undefined);
  const hasTriedLink = useRef(false);
  const wasRedeeming = useRef(isRedeemingLink);
  const join = joinHousehold.mutateAsync;

  // A failed redemption swaps the status message back to the code form. Focus follows into what
  // replaced it rather than falling back to the document; an ordinary visit starts on the form
  // already and is left alone.
  useEffect(() => {
    if (wasRedeeming.current === isRedeemingLink) return;
    wasRedeeming.current = isRedeemingLink;
    if (!isRedeemingLink) {
      formRef.current
        ?.querySelector<HTMLElement>('md-outlined-text-field, input, textarea')
        ?.focus();
    }
  }, [isRedeemingLink, formRef]);

  useEffect(() => {
    if (autoToken === undefined || hasTriedLink.current) return;
    hasTriedLink.current = true;
    void (async () => {
      try {
        await join(autoToken);
        onJoined();
      } catch (error) {
        setFormError(
          userMessage(error, {
            byStatus: INVITE_PROBLEMS,
            fallback: 'Could not use that invite link. Enter the code instead.',
          }),
        );
      } finally {
        setIsRedeemingLink(false);
      }
    })();
  }, [autoToken, join, onJoined]);

  const handleSubmit = async (event: SyntheticEvent): Promise<void> => {
    event.preventDefault();
    setFormError(undefined);
    const normalized = normalizeInviteCode(code);
    if (normalized.error !== undefined) {
      setErrors({ code: normalized.error });
      return;
    }
    setErrors({});
    try {
      await join(normalized.code);
      onJoined();
    } catch (error) {
      setFormError(
        userMessage(error, {
          byStatus: INVITE_PROBLEMS,
          fallback: 'Could not join with that code. Try again.',
        }),
      );
    }
  };

  if (isRedeemingLink) {
    return (
      <Card
        variant="flat"
        className="w-full max-w-[440px] mx-auto p-6 bg-[var(--md-sys-color-surface-container)] flex flex-col gap-4"
      >
        <p
          role="status"
          className="text-body-md text-body text-[var(--md-sys-color-on-surface-variant)]"
        >
          Opening your invite…
        </p>
      </Card>
    );
  }

  return (
    <Card
      variant="flat"
      className="w-full max-w-[440px] mx-auto p-6 bg-[var(--md-sys-color-surface-container)] flex flex-col gap-6"
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
          label="Invite code"
          name="inviteCode"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={INVITE_CODE_LENGTH * 2}
          hint="8 characters, from the person who invited you"
          className="tracking-[0.12em] tabular-nums"
          value={code}
          error={errors.code}
          onChange={(event) => {
            setCode(event.target.value);
          }}
        />
        <FormMessage message={formError} />
        <Button
          type="submit"
          variant="primary"
          isLoading={joinHousehold.isPending}
          disabledReason={isOnline ? undefined : OFFLINE_MESSAGE}
        >
          Join household group
        </Button>
      </form>
      {onCreateNew && (
        <Button
          variant="ghost"
          type="button"
          onClick={onCreateNew}
          className="self-start text-body-sm"
        >
          Create a new household instead
        </Button>
      )}
    </Card>
  );
}
