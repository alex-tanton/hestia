import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import {
  householdNotificationType,
  type NotificationPreference,
  type ProfileResponse,
  type UpdateNotificationPreferenceRequest,
} from '@hestia/shared';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import {
  useNotificationPreferences,
  useSetNotificationPreference,
} from '../../lib/api/notification-hooks.ts';
import { ApiError } from '../../lib/api/problem.ts';
import { usePushDevice } from '../../lib/push/use-push-device.tsx';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import {
  DeviceNoteLine,
  IosInstallLine,
  PreferenceList,
  UnsupportedLine,
  type DeviceNote,
} from './NotificationTypeRows.tsx';
import {
  NOTIFICATION_TYPES_HEADING,
  NOTIFICATION_TYPES_LOADING,
  NOTIFICATION_TYPES_LOAD_ERROR,
  NOTIFICATION_TYPES_OFFLINE,
  SAVE_ERROR_MESSAGE,
  SAVED_MESSAGE,
  SAVING_MESSAGE,
} from './notification-copy.ts';

/** The request a toggle sends: the weekly nudge names its household, nothing else does. */
function requestFor(
  preference: NotificationPreference,
  enabled: boolean,
): UpdateNotificationPreferenceRequest {
  if (preference.type === householdNotificationType && preference.householdId !== null) {
    return { type: preference.type, enabled, householdId: preference.householdId };
  }
  return { type: preference.type, enabled };
}

/**
 * What this device's permission says about the types the caller has on.
 */
function deviceNoteFor(
  permission: NotificationPermission | undefined,
  anyEnabled: boolean,
): DeviceNote | undefined {
  if (!anyEnabled) return undefined;
  if (permission === 'denied') return 'denied';
  if (permission === 'default') return 'dismissed';
  return undefined;
}

/**
 * Settings › Notifications, per type with top device guidance card and grouped switch rows.
 */
export function NotificationTypes({ profile }: { profile: ProfileResponse }): ReactElement {
  const headingId = useId();
  const isOnline = useOnlineStatus();
  const toast = useToast();
  const device = usePushDevice();
  const isSupported = device.support === 'supported';
  const preferences = useNotificationPreferences(isSupported);
  const save = useSetNotificationPreference();
  const [status, setStatus] = useState('');
  const [registrationFailed, setRegistrationFailed] = useState(false);
  const [isEnablingPush, setIsEnablingPush] = useState(false);

  const { enable, permission } = device;
  const anyEnabled = preferences.data?.some((preference) => preference.enabled) ?? false;
  const deviceNote: DeviceNote | undefined = registrationFailed
    ? 'failed'
    : deviceNoteFor(permission, anyEnabled);

  const openChecked = useRef(false);
  useEffect(() => {
    if (openChecked.current || preferences.data === undefined) return;
    openChecked.current = true;
    if (isSupported && permission === 'granted' && anyEnabled) {
      enable().catch(() => undefined);
    }
  }, [preferences.data, isSupported, permission, anyEnabled, enable]);

  const handleToggle = async (
    preference: NotificationPreference,
    enabled: boolean,
  ): Promise<void> => {
    if (save.isPending) return;
    setStatus(SAVING_MESSAGE);
    try {
      await save.mutateAsync(requestFor(preference, enabled));
    } catch {
      setStatus(SAVE_ERROR_MESSAGE);
      return;
    }
    if (enabled) {
      try {
        await enable();
        setRegistrationFailed(false);
      } catch {
        setRegistrationFailed(true);
      }
    }
    setStatus(SAVED_MESSAGE);
  };

  const handleEnablePush = async (): Promise<void> => {
    setIsEnablingPush(true);
    try {
      await enable();
      setRegistrationFailed(false);
      toast({
        variant: 'success',
        message: 'Push notifications enabled.',
      });
    } catch {
      setRegistrationFailed(true);
    } finally {
      setIsEnablingPush(false);
    }
  };

  const heading = (
    <h3 id={headingId} className="text-h3 text-primary">
      {NOTIFICATION_TYPES_HEADING}
    </h3>
  );

  let body: ReactElement;
  if (device.support === 'ios-not-installed') {
    body = <IosInstallLine />;
  } else if (device.support === 'unsupported') {
    body = <UnsupportedLine />;
  } else if (preferences.data === undefined && preferences.isPending) {
    body = <SkeletonRows label={NOTIFICATION_TYPES_LOADING} rows={4} />;
  } else if (preferences.data === undefined) {
    const isOffline = preferences.error instanceof ApiError && preferences.error.isOffline;
    body = isOffline ? (
      <OfflineState message={NOTIFICATION_TYPES_OFFLINE} />
    ) : (
      <ErrorState
        message={NOTIFICATION_TYPES_LOAD_ERROR}
        onRetry={() => {
          void preferences.refetch();
        }}
      />
    );
  } else {
    body = (
      <>
        {deviceNote !== undefined && <DeviceNoteLine note={deviceNote} />}
        <PreferenceList
          preferences={preferences.data}
          profile={profile}
          isOnline={isOnline}
          onToggle={(preference, enabled) => {
            void handleToggle(preference, enabled);
          }}
        />
      </>
    );
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      {heading}

      {/* Top tonal device guidance card */}
      {isSupported && (
        <Card
          variant="flat"
          className="bg-[var(--md-sys-color-surface-container-low)] rounded-2xl p-4 flex flex-col gap-2"
        >
          <div className="flex flex-col gap-1">
            <span className="text-title-sm font-semibold text-[var(--md-sys-color-on-surface)]">
              Device push status
            </span>
            <span className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
              {permission === 'granted'
                ? 'Web Push notifications are active on this device.'
                : 'Web Push is supported on this browser. Enable push to receive real-time alerts.'}
            </span>
          </div>
          {permission !== 'granted' && (
            <Button
              variant="primary"
              className="self-start mt-1"
              isLoading={isEnablingPush}
              onClick={() => {
                void handleEnablePush();
              }}
            >
              Enable push notifications
            </Button>
          )}
        </Card>
      )}

      {body}

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <Button
          variant="primary"
          onClick={() => {
            toast({
              variant: 'success',
              message: 'Saved notification preferences',
            });
          }}
        >
          Save notification preferences
        </Button>
        <p role="status" className="text-body-sm text-secondary">
          {status}
        </p>
      </div>
    </section>
  );
}
