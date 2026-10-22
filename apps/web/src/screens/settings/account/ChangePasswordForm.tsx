import { useEffect, useRef, useState, type SyntheticEvent, type ReactElement } from 'react';
import { Button } from '../../../components/ui/Button.tsx';
import { TextField } from '../../../components/ui/Field.tsx';
import { FormMessage } from '../../../components/ui/FormMessage.tsx';
import { useToast } from '../../../components/ui/Toast.tsx';
import { useChangePassword } from '../../../lib/api/hooks.ts';
import { OFFLINE_MESSAGE, userMessage } from '../../../lib/api/problem.ts';
import { PASSWORD_HINT, validateNewPassword } from '../../../lib/password.ts';
import { useFieldErrors } from '../../../lib/use-field-errors.ts';
import { useOnlineStatus } from '../../../lib/use-online-status.ts';

type Field = 'currentPassword' | 'newPassword';

/**
 * Changing the password re-enters the current one and applies the common-password list, both
 * here and again in the service.
 */
export function ChangePasswordForm(): ReactElement {
  const isOnline = useOnlineStatus();
  const changePassword = useChangePassword();
  const toast = useToast();
  const { errors, setErrors, formRef } = useFieldErrors<Field>();
  const [isOpen, setIsOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [formError, setFormError] = useState<string>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(isOpen);

  // Opening swaps the trigger for the form, and closing swaps it back. Where a member's action
  // replaces the control they used, focus moves into what replaced it rather than falling back to
  // the document.
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
    if (currentPassword === '') next.currentPassword = 'Enter your current password.';
    const problem = validateNewPassword(newPassword);
    if (problem !== undefined) next.newPassword = problem;
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      toast({ variant: 'success', message: 'Password changed.' });
      setIsOpen(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (error) {
      setFormError(
        userMessage(error, {
          byStatus: { 403: 'The current password is incorrect.' },
          fallback: 'Could not change the password. Try again.',
        }),
      );
    }
  };

  if (!isOpen) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-body-sm font-semibold text-primary">Password</span>
        <Button
          ref={triggerRef}
          variant="secondary"
          className="self-start"
          onClick={() => {
            setIsOpen(true);
          }}
        >
          Change password
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
        label="Current password"
        type="password"
        name="currentPassword"
        autoComplete="current-password"
        value={currentPassword}
        error={errors.currentPassword}
        onChange={(event) => {
          setCurrentPassword(event.target.value);
        }}
      />
      <TextField
        label="New password"
        type="password"
        name="newPassword"
        autoComplete="new-password"
        hint={PASSWORD_HINT}
        value={newPassword}
        error={errors.newPassword}
        onChange={(event) => {
          setNewPassword(event.target.value);
        }}
      />
      <FormMessage message={formError} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          isLoading={changePassword.isPending}
          disabledReason={isOnline ? undefined : OFFLINE_MESSAGE}
        >
          Save password
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
