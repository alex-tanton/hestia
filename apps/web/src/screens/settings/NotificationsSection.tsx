import { useId, useState, type SyntheticEvent, type ReactElement } from 'react';
import { quietHoursSchema, type ProfileResponse } from '@hestia/shared';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { Checkbox } from '../../components/ui/Checkbox.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { useUpdateProfile } from '../../lib/api/hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { SettingsSection } from './SettingsSection.tsx';
import { NotificationTypes } from './NotificationTypes.tsx';
import { WRITE_NEEDS_CONNECTION } from './notification-copy.ts';

const DEFAULT_QUIET_HOURS = { start: '22:00', end: '07:00' };

type Field = 'start' | 'end';

/**
 * Notifications: the per-type toggles, the single household-bill reminder,
 * and the quiet-hours window. The profile settings save straight to the profile; the types save as
 * each is switched (see NotificationTypes).
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
  // Every write in this card says the same thing offline, so the card's own string is used rather
  // than the app-wide one other screens rely on.
  const offlineReason = isOnline ? undefined : WRITE_NEEDS_CONNECTION;

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
            disabled, with the reason beside it and in its description. */}
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
              {WRITE_NEEDS_CONNECTION}
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

        <NotificationTypes profile={profile} />
      </Card>
    </SettingsSection>
  );
}
