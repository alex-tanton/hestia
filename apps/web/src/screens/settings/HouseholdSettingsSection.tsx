import { useState, type SyntheticEvent, type ReactElement } from 'react';
import { householdNameSchema, postalCodeSchema, type Household } from '@hearth/shared';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { ErrorState } from '../../components/states/StateBlocks.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { useHousehold, useUpdateHousehold } from '../../lib/api/hooks.ts';
import { OFFLINE_MESSAGE, userMessage } from '../../lib/api/problem.ts';
import { formatTimezone } from '../../lib/format.ts';
import { SectionProvider } from '../../lib/section-context.tsx';
import { firstIssue } from '../../lib/validation.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { FavoriteStores } from '../deals/FavoriteStores.tsx';
import { ReadOnlyValue, SettingsSection } from './SettingsSection.tsx';

/** US zones only, which is what v1 assumes (Requirements, "Locale"). */
const US_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
];

type Field = 'name' | 'postalCode';

function HouseholdForm({ household }: { household: Household }): ReactElement {
  const isOnline = useOnlineStatus();
  const toast = useToast();
  const updateHousehold = useUpdateHousehold(household.id);
  const { errors, setErrors, formRef } = useFieldErrors<Field>();
  const [name, setName] = useState(household.name);
  const [postalCode, setPostalCode] = useState(household.postalCode);
  const [timezone, setTimezone] = useState(household.timezone);
  const [formError, setFormError] = useState<string>();

  const zones = US_TIMEZONES.includes(household.timezone)
    ? US_TIMEZONES
    : [household.timezone, ...US_TIMEZONES];

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
      await updateHousehold.mutateAsync({
        name: name.trim(),
        postalCode: postalCode.trim(),
        timezone,
      });
      toast({ variant: 'success', message: 'Household settings saved.' });
    } catch (error) {
      setFormError(userMessage(error, { fallback: 'Could not save the household. Try again.' }));
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
        label="Household name"
        name="householdName"
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
        maxLength={5}
        value={postalCode}
        error={errors.postalCode}
        onChange={(event) => {
          setPostalCode(event.target.value);
        }}
      />
      <Select
        label="Timezone"
        name="timezone"
        hint="Chore, bill, and meal dates for this household are read in this timezone."
        options={zones.map((zone) => ({ value: zone, label: formatTimezone(zone) }))}
        value={timezone}
        onValueChange={setTimezone}
      />
      <FormMessage message={formError} />
      <Button
        type="submit"
        variant="secondary"
        className="self-start"
        isLoading={updateHousehold.isPending}
        disabledReason={isOnline ? undefined : OFFLINE_MESSAGE}
      >
        Save household
      </Button>
    </form>
  );
}

export interface HouseholdSettingsSectionProps {
  householdId: string;
  isAdmin: boolean;
}

/**
 * Design › Screens › 4, "Household settings" for the active household. Name, postal code, and
 * timezone are the admin's to change and read-only for everyone else (Requirements,
 * "Permissions"); the favorite stores below are editable by any member.
 */
export function HouseholdSettingsSection({
  householdId,
  isAdmin,
}: HouseholdSettingsSectionProps): ReactElement {
  const household = useHousehold(householdId);

  return (
    <SettingsSection title="Household settings">
      <Card className="flex flex-col gap-6">
        {household.isPending && <SkeletonRows label="Loading household settings" rows={3} />}
        {household.isError && (
          <ErrorState
            message="Couldn't load this household's settings. Try again."
            onRetry={() => {
              void household.refetch();
            }}
          />
        )}
        {household.data &&
          (isAdmin ? (
            <HouseholdForm household={household.data} />
          ) : (
            <>
              <ReadOnlyValue label="Household name" value={household.data.name} />
              <ReadOnlyValue label="ZIP code" value={household.data.postalCode} />
              <ReadOnlyValue label="Timezone" value={formatTimezone(household.data.timezone)} />
              <p className="text-body-sm text-secondary">
                Only the household admin can change these.
              </p>
            </>
          ))}
        {/* Favorite stores are editable by any member, not only the admin (Design › Screens › 4). */}
        <SectionProvider section="lists" className="flex flex-col gap-3">
          <h3 className="text-h3 text-primary">Favorite stores</h3>
          <FavoriteStores
            householdId={householdId}
            postalCode={household.data?.postalCode}
            showPostalCodeAction={false}
          />
        </SectionProvider>
      </Card>
    </SettingsSection>
  );
}
