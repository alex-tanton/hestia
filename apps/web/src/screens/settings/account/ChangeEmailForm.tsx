import { useEffect, useRef, useState, type SyntheticEvent, type ReactElement } from 'react';
import { emailSchema } from '@hearth/shared';
import { Button } from '../../../components/ui/Button.tsx';
import { TextField } from '../../../components/ui/Field.tsx';
import { FormMessage } from '../../../components/ui/FormMessage.tsx';
import { useToast } from '../../../components/ui/Toast.tsx';
import { useChangeEmail } from '../../../lib/api/hooks.ts';
import { OFFLINE_MESSAGE, userMessage } from '../../../lib/api/problem.ts';
import { firstIssue } from '../../../lib/validation.ts';
import { useFieldErrors } from '../../../lib/use-field-errors.ts';
import { useOnlineStatus } from '../../../lib/use-online-status.ts';

type Field = 'newEmail' | 'currentPassword';

/**
 * Changing the email re-verifies the current password (Requirements, "Authentication"). The
 * service does the verifying; asking for it here is what makes the request answerable.
 */
export function ChangeEmailForm({ email }: { email: string }): ReactElement {
  const isOnline = useOnlineStatus();
  const changeEmail = useChangeEmail();
  const toast = useToast();
  const { errors, setErrors, formRef } = useFieldErrors<Field>();
  const [isOpen, setIsOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [formError, setFormError] = useState<string>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(isOpen);

  // Opening swaps the trigger for the form, and closing swaps it back. Where a member's action
  // replaces the control they used, focus moves into what replaced it rather than falling back to
  // the document (Design › Accessibility › Focus management).
  useEffect(() => {
    if (wasOpen.current === isOpen) return;
    wasOpen.current = isOpen;
    if (isOpen) formRef.current?.querySelector('input')?.focus();
    else triggerRef.current?.focus();
  }, [isOpen, formRef]);

  const handleSubmit = async (event: SyntheticEvent): Promise<void> => {
    event.preventDefault();
    setFormError(undefined);
    const next: Partial<Record<Field, string>> = {};
    const parsed = emailSchema.safeParse(newEmail.trim());
    if (!parsed.success) next.newEmail = firstIssue(parsed.error);
    if (currentPassword === '') next.currentPassword = 'Enter your current password.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      await changeEmail.mutateAsync({ newEmail: newEmail.trim(), currentPassword });
      toast({ variant: 'success', message: 'Email changed.' });
      setIsOpen(false);
      setNewEmail('');
      setCurrentPassword('');
    } catch (error) {
      setFormError(
        userMessage(error, {
          byStatus: {
            403: 'The current password is incorrect.',
            409: 'An account already uses that email.',
          },
          fallback: 'Could not change the email. Try again.',
        }),
      );
    }
  };

  if (!isOpen) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-body-sm font-semibold text-primary">Email</span>
        <span className="text-body text-secondary">{email}</span>
        <Button
          ref={triggerRef}
          variant="secondary"
          className="self-start"
          onClick={() => {
            setIsOpen(true);
          }}
        >
          Change email
        </Button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <TextField
        label="New email"
        type="email"
        name="newEmail"
        autoComplete="email"
        value={newEmail}
        error={errors.newEmail}
        onChange={(event) => {
          setNewEmail(event.target.value);
        }}
      />
      <TextField
        label="Current password"
        type="password"
        name="currentPasswordForEmail"
        autoComplete="current-password"
        value={currentPassword}
        error={errors.currentPassword}
        onChange={(event) => {
          setCurrentPassword(event.target.value);
        }}
      />
      <FormMessage message={formError} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          isLoading={changeEmail.isPending}
          disabledReason={isOnline ? undefined : OFFLINE_MESSAGE}
        >
          Save email
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setIsOpen(false);
            setFormError(undefined);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
