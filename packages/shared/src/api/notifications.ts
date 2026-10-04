import { z } from 'zod';
import { idSchema } from './common.js';

/**
 * Notifications (Requirements, "Notifications"; Technical Architecture, "API surface" ›
 * "Notifications"). The type list is the database enum `notification_type`, in its order.
 */
export const notificationTypes = [
  'bill_due',
  'chore_due',
  'chore_rotation',
  'list_activity',
  'meal_reminder',
  'weekly_meal_nudge',
  'flyer_refresh',
] as const;
export const notificationTypeSchema = z.enum(notificationTypes);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

/**
 * The one type opted into separately for each household (Requirements, "Notifications" › "Types
 * and defaults"). Every other type is a single setting per user.
 */
export const householdNotificationType = 'weekly_meal_nudge' satisfies NotificationType;

/** One effective preference: a type's value, with the household it applies to when it has one. */
export const notificationPreferenceSchema = z.object({
  type: notificationTypeSchema,
  householdId: idSchema.nullable(),
  enabled: z.boolean(),
});
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;

/** GET /api/users/me/notification-preferences */
export const notificationPreferencesResponseSchema = z.object({
  preferences: z.array(notificationPreferenceSchema),
});
export type NotificationPreferencesResponse = z.infer<typeof notificationPreferencesResponseSchema>;

/**
 * PATCH /api/users/me/notification-preferences. `householdId` is required for the weekly meal
 * nudge and refused for every other type. The service answers `404` for a household the caller
 * does not belong to, the same as the other household routes.
 */
export const updateNotificationPreferenceRequestSchema = z
  .object({
    type: notificationTypeSchema,
    enabled: z.boolean(),
    householdId: idSchema.nullable().optional(),
  })
  .superRefine((body, ctx) => {
    const scoped = body.type === householdNotificationType;
    const named = body.householdId !== undefined && body.householdId !== null;
    if (scoped && !named) {
      ctx.addIssue({
        code: 'custom',
        path: ['householdId'],
        message: 'Name the household this setting applies to.',
      });
    }
    if (!scoped && named) {
      ctx.addIssue({
        code: 'custom',
        path: ['householdId'],
        message: 'Only the weekly meal nudge is set per household.',
      });
    }
  });
export type UpdateNotificationPreferenceRequest = z.infer<
  typeof updateNotificationPreferenceRequestSchema
>;

/**
 * A push endpoint is an https URL the browser's push service issued (Web Push). The length cap
 * is generous: real push services issue URLs of a few hundred characters.
 */
export const pushEndpointSchema = z
  .url({ protocol: /^https$/, error: 'Use an https push endpoint.' })
  .max(2048, 'Use an https push endpoint.');

/** Web Push key material is base64url, with optional padding. */
const pushKeySchema = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .regex(/^[A-Za-z0-9_-]+={0,2}$/, 'Use base64url key material.');

/** The browser's `PushSubscription.toJSON()` keys: p256dh is 65 bytes and auth is 16 bytes. */
export const pushKeysSchema = z.object({
  p256dh: pushKeySchema(200),
  auth: pushKeySchema(64),
});

/** POST /api/users/me/push-subscriptions. Posting the same endpoint again updates its keys. */
export const pushSubscriptionRequestSchema = z.object({
  endpoint: pushEndpointSchema,
  keys: pushKeysSchema,
});
export type PushSubscriptionRequest = z.infer<typeof pushSubscriptionRequestSchema>;

/** DELETE /api/users/me/push-subscriptions */
export const deletePushSubscriptionRequestSchema = z.object({ endpoint: pushEndpointSchema });
export type DeletePushSubscriptionRequest = z.infer<typeof deletePushSubscriptionRequestSchema>;

/**
 * A notification's title and body (Branding, "Notification copy"). Every producer
 * validates its copy against this, so an overlong line fails in the producer rather than on the
 * device.
 */
export const notificationCopySchema = z.object({
  title: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1).max(60),
});
export type NotificationCopy = z.infer<typeof notificationCopySchema>;
