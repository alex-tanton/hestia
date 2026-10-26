import { useState, type SyntheticEvent, type ReactElement } from 'react';
import { displayNameSchema } from '@hestia/shared';
import { Button } from '../../../components/ui/Button.tsx';
import { TextField } from '../../../components/ui/Field.tsx';
import { FormMessage } from '../../../components/ui/FormMessage.tsx';
import { useToast } from '../../../components/ui/Toast.tsx';
import { useUpdateProfile } from '../../../lib/api/hooks.ts';
import { OFFLINE_MESSAGE, userMessage } from '../../../lib/api/problem.ts';
import { firstIssue } from '../../../lib/validation.ts';
import { useFieldErrors } from '../../../lib/use-field-errors.ts';
import { useOnlineStatus } from '../../../lib/use-online-status.ts';

export function DisplayNameForm({ displayName }: { displayName: string }): ReactElement {
  const isOnline = useOnlineStatus();
  const updateProfile = useUpdateProfile();
  const toast = useToast();
  const { errors, setErrors, formRef } = useFieldErrors<'displayName'>();
  const [value, setValue] = useState(displayName);
  const [formError, setFormError] = useState<string>();

  const handleSubmit = async (event: SyntheticEvent): Promise<void> => {
    event.preventDefault();
    setFormError(undefined);
    const parsed = displayNameSchema.safeParse(value);
    if (!parsed.success) {
      setErrors({ displayName: firstIssue(parsed.error, 'Enter a name.') });
      return;
    }
    setErrors({});
    try {
      await updateProfile.mutateAsync({ displayName: parsed.data });
      toast({ variant: 'success', message: 'Display name saved.' });
    } catch (error) {
      setFormError(userMessage(error, { fallback: 'Could not save your name. Try again.' }));
    }
  };

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
        label="Display name"
        name="displayName"
        autoComplete="name"
        value={value}
        error={errors.displayName}
        onChange={(event) => {
          setValue(event.target.value);
        }}
      />
      <FormMessage message={formError} />
      <Button
        type="submit"
        variant="secondary"
        className="self-start"
        isLoading={updateProfile.isPending}
        disabled={value.trim() === displayName}
        disabledReason={isOnline ? undefined : OFFLINE_MESSAGE}
      >
        Save name
      </Button>
    </form>
  );
}
