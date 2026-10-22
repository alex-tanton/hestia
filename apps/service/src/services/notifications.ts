import type { Kysely } from 'kysely';
import {
  householdNotificationType,
  notificationTypes,
  type NotificationPreference,
  type NotificationPreferencesResponse,
  type NotificationType,
  type PushSubscriptionRequest,
  type UpdateNotificationPreferenceRequest,
} from '@hearth/shared';
import type { Database } from '../db.js';
import { fail } from '../problem.js';

/**
 * What a type is when no `notification_preference` row says otherwise. A missing row means this
 * default, so the table is the only source of it. Bill reminders and the rest of the on-by-default
 * types reach their recipients unless the user turned them off; the rest wait to be asked for.
 */
export const notificationDefaults: Readonly<Record<NotificationType, boolean>> = {
  bill_due: true,
  chore_due: true,
  chore_rotation: true,
  list_activity: true,
  meal_reminder: false,
  weekly_meal_nudge: false,
  flyer_refresh: false,
};

export interface StoredPreference {
  type: NotificationType;
  householdId: string | null;
  enabled: boolean;
}

function keyOf(type: NotificationType, householdId: string | null): string {
  return `${type}:${householdId ?? ''}`;
}

/**
 * Every type with its effective value. Per-user types appear once; the weekly meal
 * nudge appears once for each household the caller belongs to, in the order given. A stored row
 * for a household the caller has since left is ignored, since it names no current membership.
 */
export function effectivePreferences(
  stored: readonly StoredPreference[],
  householdIds: readonly string[],
): NotificationPreference[] {
  const explicit = new Map(stored.map((row) => [keyOf(row.type, row.householdId), row.enabled]));
  const effective = (type: NotificationType, householdId: string | null): boolean =>
    explicit.get(keyOf(type, householdId)) ?? notificationDefaults[type];

  return notificationTypes.flatMap((type): NotificationPreference[] => {
    if (type !== householdNotificationType) {
      return [{ type, householdId: null, enabled: effective(type, null) }];
    }
    return householdIds.map((householdId) => ({
      type,
      householdId,
      enabled: effective(type, householdId),
    }));
  });
}

/** GET /api/users/me/notification-preferences */
export async function listNotificationPreferences(
  db: Kysely<Database>,
  userId: string,
): Promise<NotificationPreferencesResponse> {
  const rows = await db
    .selectFrom('notification_preference')
    .where('user_id', '=', userId)
    .select(['notification_type', 'household_id', 'enabled'])
    .execute();
  const memberships = await db
    .selectFrom('household_member')
    .where('user_id', '=', userId)
    .select('household_id')
    .orderBy('joined_at')
    .orderBy('household_id')
    .execute();

  const stored = rows.map((row) => ({
    type: row.notification_type,
    householdId: row.household_id,
    enabled: row.enabled,
  }));
  return {
    preferences: effectivePreferences(
      stored,
      memberships.map((row) => row.household_id),
    ),
  };
}

/**
 * PATCH /api/users/me/notification-preferences. Idempotent: the row is upserted on its unique key
 * (user, type, household, with nulls equal), so repeating a request leaves one row. The weekly
 * meal nudge needs a household the caller belongs to; RLS would refuse another, but the explicit
 * check answers 404 the way the other household routes do.
 */
export async function updateNotificationPreference(
  db: Kysely<Database>,
  userId: string,
  input: UpdateNotificationPreferenceRequest,
): Promise<NotificationPreference> {
  const householdId = input.type === householdNotificationType ? (input.householdId ?? null) : null;

  if (householdId !== null) {
    const membership = await db
      .selectFrom('household_member')
      .where('household_id', '=', householdId)
      .where('user_id', '=', userId)
      .select('household_id')
      .executeTakeFirst();
    if (membership === undefined) throw fail(404, 'Household not found.');
  }

  await db
    .insertInto('notification_preference')
    .values({
      user_id: userId,
      notification_type: input.type,
      household_id: householdId,
      enabled: input.enabled,
    })
    .onConflict((conflict) =>
      conflict
        .columns(['user_id', 'notification_type', 'household_id'])
        .doUpdateSet({ enabled: input.enabled }),
    )
    .execute();

  return { type: input.type, householdId, enabled: input.enabled };
}

/**
 * POST /api/users/me/push-subscriptions. A subscription is unique on (user, endpoint), so a
 * repeat post updates the keys and writes no second row.
 */
export async function savePushSubscription(
  db: Kysely<Database>,
  userId: string,
  input: PushSubscriptionRequest,
): Promise<void> {
  await db
    .insertInto('push_subscription')
    .values({
      user_id: userId,
      endpoint: input.endpoint,
      keys: JSON.stringify(input.keys),
    })
    .onConflict((conflict) =>
      conflict.columns(['user_id', 'endpoint']).doUpdateSet({ keys: JSON.stringify(input.keys) }),
    )
    .execute();
}

/**
 * DELETE /api/users/me/push-subscriptions. Removing an endpoint that is not there is not an
 * error: the device is already unsubscribed, which is the state the caller asked for.
 */
export async function deletePushSubscription(
  db: Kysely<Database>,
  userId: string,
  endpoint: string,
): Promise<void> {
  await db
    .deleteFrom('push_subscription')
    .where('user_id', '=', userId)
    .where('endpoint', '=', endpoint)
    .execute();
}
