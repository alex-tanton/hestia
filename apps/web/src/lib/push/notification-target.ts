import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { ProfileResponse } from '@hestia/shared';
import { useSwitchHousehold } from '../api/hooks.ts';
import { HOUSEHOLD_PARAM, parseClickMessage } from './push-message.ts';

interface PendingTarget {
  householdId: string | undefined;
  url: string;
  replace: boolean;
}

/*
 * A tapped notification opens the screen it is about, in its household. The household switch comes
 * first, so the screen is never shown with the wrong household's data. Two arrivals, one behaviour:
 *   - an open window gets the target by message from the service worker;
 *   - a window the tap had to open gets it as a `?household=` parameter, read once and removed.
 */
export function useNotificationTarget(profile: ProfileResponse | undefined): void {
  const navigate = useNavigate();
  const location = useLocation();
  const { mutate: switchTo } = useSwitchHousehold();
  // A tap can arrive before the profile has loaded; it waits for it rather than being dropped.
  const waiting = useRef<PendingTarget | undefined>(undefined);

  const goTo = useCallback(
    (householdId: string | undefined, url: string, replace: boolean): void => {
      const route = (): void => {
        void navigate(url, { replace });
      };
      if (profile === undefined) {
        waiting.current = { householdId, url, replace };
        return;
      }
      if (householdId === undefined || householdId === profile.activeHouseholdId) {
        route();
        return;
      }
      // A household the caller has left is not one they may be shown: the dashboard is the
      // safe place to land.
      if (!profile.memberships.some((membership) => membership.householdId === householdId)) {
        void navigate('/', { replace: true });
        return;
      }
      switchTo(householdId, { onSuccess: route });
    },
    [navigate, profile, switchTo],
  );

  useEffect(() => {
    const pending = waiting.current;
    if (profile === undefined || pending === undefined) return;
    waiting.current = undefined;
    goTo(pending.householdId, pending.url, pending.replace);
  }, [goTo, profile]);

  // Each location carries its target at most once: the profile arriving re-runs this effect, and
  // that must not switch a second time.
  const handledLocation = useRef<string | undefined>(undefined);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const householdId = params.get(HOUSEHOLD_PARAM);
    if (householdId === null || handledLocation.current === location.key) return;
    handledLocation.current = location.key;
    params.delete(HOUSEHOLD_PARAM);
    const rest = params.toString();
    goTo(householdId, `${location.pathname}${rest === '' ? '' : `?${rest}`}`, true);
  }, [goTo, location.key, location.pathname, location.search]);

  useEffect(() => {
    const container = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker;
    if (container === undefined) return;
    const onMessage = (event: MessageEvent): void => {
      const click = parseClickMessage(event.data);
      if (click === undefined) return;
      goTo(click.householdId, click.url, false);
    };
    container.addEventListener('message', onMessage);
    return () => {
      container.removeEventListener('message', onMessage);
    };
  }, [goTo]);
}
