import { Bell } from 'lucide-react';
import { useId, useState, type SyntheticEvent, type ReactElement } from 'react';
import { quietHoursSchema, type ProfileResponse } from '@hearth/shared';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { Checkbox } from '../../components/ui/Checkbox.tsx';
import { ComingSoonPanel } from '../../components/states/ComingSoon.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { useUpdateProfile } from '../../lib/api/hooks.ts';
import { OFFLINE_MESSAGE, userMessage } from '../../lib/api/problem.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { SettingsSection } from './SettingsSection.tsx';

export const NOTIFICATION_TYPES_COMING_SOON =
  'Per-type notifications turn on when push notifications ship. Quiet hours and the bill reminder are saved now and apply as soon as they do.';

const DEFAULT_QUIET_HOURS = { start: '22:00', end: '07:00' };

type Field = 'start' | 'end';

/**
 * Design › Screens › 4, "Notifications". The quiet-hours window and the single household-bill
 * reminder are stored on the profile and can be set now; the per-type toggles arrive with push
 * itself, so they take the coming-soon state rather than offering a switch that does nothing.
 */
export function NotificationsSection({ profile }: { profile: ProfileResponse }): ReactElement {
  const isOnline = useOnlineStatus();
  const toast = useToast();
  const updateProfile = useUpdateProfile();
  const { errors, setErrors, formRef } = useFieldErrors<Field>();
  const billRemindersReasonId = useId();
  const [hasQuietHours, setHasQuietHours] = useState(profile.quietHours !== null);
  const [start, setStart] = useState(profile.quietHours?.start ?? DEFAULT_QUIET_HOURS.start);
  const [end, setEnd] = useState(profile.quietHours?.end ?? DEFAULT_QUIET_HOURS.end);
  const [formError, setFormError] = useState<string>();
  const offlineReason = isOnline ? undefined : OFFLINE_MESSAGE;

  const handleSubmit = async (event: SyntheticEvent): Promise<void> => {
    event.preventDefault();
    setFormError(undefined);
    if (hasQuietHours) {
      const parsed = quietHoursSchema.safeParse({ start, end });
      if (!parsed.success) {
        const next: Partial<Record<Field, string>> = {};
        for (const issue of parsed.error.issues) {
          if (issue.path[0] === 'start') next.start = issue.message;
          if (issue.path[0] === 'end') next.end = issue.message;
        }
        setErrors(next);
        return;
      }
    }
    setErrors({});
    try {
      await updateProfile.mutateAsync({ quietHours: hasQuietHours ? { start, end } : null });
      toast({ variant: 'success', message: 'Quiet hours saved.' });
    } catch (error) {
      setFormError(userMessage(error, { fallback: 'Could not save quiet hours. Try again.' }));
    }
  };

  const toggleBillReminders = (isOn: boolean): void => {
    updateProfile.mutate(
      { householdBillReminders: isOn },
      {
        onError: (error) => {
          toast({ variant: 'error', message: userMessage(error) });
        },
      },
    );
  };

  return (
    <SettingsSection title="Notifications">
      <Card className="flex flex-col gap-6">
        {/* This one saves as it is toggled, so offline it is a write control like any other:
            disabled, with the reason beside it and in its description (Design › Offline rules). */}
        <div className="flex flex-col gap-1">
          <Checkbox
            label="Remind me about all household bills"
            checked={profile.householdBillReminders}
            disabled={!isOnline}
            {...(isOnline ? {} : { 'aria-describedby': billRemindersReasonId })}
            onChange={(event) => {
              toggleBillReminders(event.target.checked);
            }}
          />
          {!isOnline && (
            <p id={billRemindersReasonId} className="text-body-sm text-secondary">
              {OFFLINE_MESSAGE}
            </p>
          )}
        </div>

        <form
          ref={formRef}
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <Checkbox
            label="Hold notifications during quiet hours"
            checked={hasQuietHours}
            onChange={(event) => {
              setHasQuietHours(event.target.checked);
            }}
          />
          {hasQuietHours && (
            <div className="flex flex-wrap gap-3">
              <TextField
                label="From"
                type="time"
                name="quietHoursStart"
                className="w-40"
                value={start}
                error={errors.start}
                onChange={(event) => {
                  setStart(event.target.value);
                }}
              />
              <TextField
                label="Until"
                type="time"
                name="quietHoursEnd"
                className="w-40"
                value={end}
                error={errors.end}
                onChange={(event) => {
                  setEnd(event.target.value);
                }}
              />
            </div>
          )}
          <FormMessage message={formError} />
          <Button
            type="submit"
            variant="secondary"
            className="self-start"
            isLoading={updateProfile.isPending}
            disabledReason={offlineReason}
          >
            Save quiet hours
          </Button>
        </form>

        <ComingSoonPanel
          icon={Bell}
          heading="Notification types"
          headingLevel={3}
          message={NOTIFICATION_TYPES_COMING_SOON}
        />
      </Card>
    </SettingsSection>
  );
}
