import { useState, type SyntheticEvent, type ReactElement } from 'react';
import { householdNameSchema, postalCodeSchema } from '@hearth/shared';
import { Button } from '../../components/ui/Button.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { useCreateHousehold } from '../../lib/api/hooks.ts';
import { OFFLINE_MESSAGE, userMessage } from '../../lib/api/problem.ts';
import { formatTimezone } from '../../lib/format.ts';
import { browserTimezone } from '../../lib/use-timezone-sync.ts';
import { firstIssue } from '../../lib/validation.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';

type Field = 'name' | 'postalCode';

/**
 * Design › Screens › 1: name and postal code. The timezone is taken from the browser without
 * asking (Requirements, "Household timezone"), so it is stated rather than offered.
 */
export function CreateHouseholdStep({ onCreated }: { onCreated: () => void }): ReactElement {
  const isOnline = useOnlineStatus();
  const createHousehold = useCreateHousehold();
  const { errors, setErrors, formRef } = useFieldErrors<Field>();
  const [name, setName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [formError, setFormError] = useState<string>();
  const timezone = browserTimezone();

  const handleSubmit = async (event: SyntheticEvent): Promise<void> => {
    event.preventDefault();
    setFormError(undefined);
    const next: Partial<Record<Field, string>> = {};
    const parsedName = householdNameSchema.safeParse(name);
    if (!parsedName.success) next.name = firstIssue(parsedName.error);
    const parsedCode = postalCodeSchema.safeParse(postalCode.trim());
    if (!parsedCode.success) next.postalCode = firstIssue(parsedCode.error);
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      await createHousehold.mutateAsync({
        name: name.trim(),
        postalCode: postalCode.trim(),
        timezone,
      });
      onCreated();
    } catch (error) {
      setFormError(userMessage(error, { fallback: 'Could not create the household. Try again.' }));
    }
  };

  return (
    <form
      ref={formRef}
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <TextField
        label="Household name"
        name="householdName"
        autoComplete="off"
        value={name}
        error={errors.name}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <TextField
        label="ZIP code"
        name="postalCode"
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={5}
        hint="Used to find the weekly ads near you"
        value={postalCode}
        error={errors.postalCode}
        onChange={(event) => {
          setPostalCode(event.target.value);
        }}
      />
      <p className="text-body-sm text-secondary">
        Dates and times for this household use {formatTimezone(timezone)}, detected from this
        device. The admin can change it in Settings.
      </p>
      <FormMessage message={formError} />
      <Button
        type="submit"
        isLoading={createHousehold.isPending}
        disabledReason={isOnline ? undefined : OFFLINE_MESSAGE}
      >
        Create household
      </Button>
    </form>
  );
}
