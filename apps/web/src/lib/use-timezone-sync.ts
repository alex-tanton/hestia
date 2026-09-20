import { useEffect, useRef } from 'react';
import type { ProfileResponse } from '@hearth/shared';
import { useUpdateProfile } from './api/hooks.ts';

/** The browser's current timezone. */
export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Each time the app opens it compares the browser's timezone with `profile.timezone` and sends
 * `PATCH /api/users/me` when they differ (Engineering Practices › Frontend patterns). Personal
 * dates — personal bills, quiet hours, personal send times — are evaluated in the stored value,
 * so a move must reach the server; a match must not, or every open would write.
 */
export function useTimezoneSync(profile: ProfileResponse | undefined): void {
  const updateProfile = useUpdateProfile();
  const hasReconciled = useRef(false);
  const mutate = updateProfile.mutate;

  useEffect(() => {
    if (profile === undefined || hasReconciled.current) return;
    hasReconciled.current = true;
    const timezone = browserTimezone();
    if (timezone === '' || timezone === profile.timezone) return;
    mutate({ timezone });
  }, [profile, mutate]);
}
