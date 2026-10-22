import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import {
  householdNotificationType,
  type NotificationPreference,
  type ProfileResponse,
  type UpdateNotificationPreferenceRequest,
} from '@hearth/shared';
import { ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
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
 * What this device's permission says about the types the caller has on. A denied permission is
 * final, so it is explained. A dismissed prompt leaves the permission at 'default' while a type is
 * on, which is the same device state, so it is explained and asked again on the next type-on.
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
 * Settings › Notifications, per type. Push is asked for only once a type is turned on, never on
 * load. A denied browser is explained and never prompted again; a dismissed prompt is asked again
 * on the next type-on. Toggles save as they are switched and cannot be queued, so offline they are
 * disabled with the reason beside them.
 */
export function NotificationTypes({ profile }: { profile: ProfileResponse }): ReactElement {
  const headingId = useId();
  const isOnline = useOnlineStatus();
  const device = usePushDevice();
  const isSupported = device.support === 'supported';
  const preferences = useNotificationPreferences(isSupported);
  const save = useSetNotificationPreference();
  const [status, setStatus] = useState('');
  const [registrationFailed, setRegistrationFailed] = useState(false);

  const { enable, permission } = device;
  const anyEnabled = preferences.data?.some((preference) => preference.enabled) ?? false;
  // Derived from the browser on every render, so a denied or dismissed explanation is shown again
  // whenever Settings reopens, not only straight after the toggle that caused it.
  const deviceNote: DeviceNote | undefined = registrationFailed
    ? 'failed'
    : deviceNoteFor(permission, anyEnabled);

  /*
   * A device that already has permission and a type on re-registers when Settings opens, so a
   * subscription removed at sign-out comes back. It never prompts: permission is already granted.
   * Decided once, when the preferences first arrive: a toggle that turns a type on later is its
   * own registration, and must not also trigger this one.
   */
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
    // The prompt comes only now, after the preference is saved.
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
      {body}
      {/*
        The save result is announced politely. It is mounted empty and stays in the tree, because a
        region that arrives already populated is announced unreliably.
      */}
      <p role="status" className="text-body-sm text-secondary">
        {status}
      </p>
    </section>
  );
}
