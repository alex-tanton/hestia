import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  notificationPreferenceSchema,
  notificationPreferencesResponseSchema,
  type NotificationPreference,
  type NotificationPreferencesResponse,
  type UpdateNotificationPreferenceRequest,
} from '@hearth/shared';
import { useApi } from './api-context.tsx';
import { queryKeys } from './keys.ts';

/*
 * Notification preferences (Technical Architecture, "API surface" › "Notifications"). One row per
 * type, and one per household for the weekly meal nudge. Neither write is queueable offline, so
 * the screen disables the toggles without a connection rather than queueing them (Design › Offline
 * rules).
 */

/**
 * `enabled` is `undefined` while the query is switched off, which is how the screen keeps the
 * request from leaving until the device can take push at all.
 */
export function useNotificationPreferences(
  enabled: boolean,
): UseQueryResult<NotificationPreference[]> {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.notificationPreferences,
    enabled,
    queryFn: ({ signal }) =>
      api.request({
        method: 'GET',
        path: '/api/users/me/notification-preferences',
        schema: notificationPreferencesResponseSchema,
        signal,
      }),
    select: (response) => response.preferences,
  });
}

export function useSetNotificationPreference(): UseMutationResult<
  NotificationPreference,
  Error,
  UpdateNotificationPreferenceRequest
> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateNotificationPreferenceRequest) =>
      api.request({
        method: 'PATCH',
        path: '/api/users/me/notification-preferences',
        body,
        schema: notificationPreferenceSchema,
      }),
    onSuccess: (saved) => {
      // Replace the one row the server answered for, so the toggle reflects what was stored. The
      // cache holds the whole response; `select` above is what hands the list to the screen.
      queryClient.setQueryData<NotificationPreferencesResponse>(
        queryKeys.notificationPreferences,
        (current) =>
          current === undefined
            ? current
            : {
                preferences: current.preferences.map((row) =>
                  row.type === saved.type && row.householdId === saved.householdId ? saved : row,
                ),
              },
      );
    },
  });
}
