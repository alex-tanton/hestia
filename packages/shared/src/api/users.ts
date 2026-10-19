import { z } from 'zod';
import { passwordShapeSchema } from '../password.js';
import {
  displayNameSchema,
  emailSchema,
  householdRoleSchema,
  idSchema,
  timeOfDaySchema,
  timestampSchema,
  timezoneSchema,
} from './common.js';

export const quietHoursSchema = z.object({ start: timeOfDaySchema, end: timeOfDaySchema });

export const membershipSchema = z.object({
  householdId: idSchema,
  name: z.string(),
  role: householdRoleSchema,
  joinedAt: timestampSchema,
  /** The switcher lists every household with its member count (Design › Screens › 3). */
  memberCount: z.number().int().min(1),
});
export type Membership = z.infer<typeof membershipSchema>;

/** GET /api/users/me */
export const profileResponseSchema = z.object({
  id: idSchema,
  email: z.string(),
  displayName: z.string(),
  timezone: z.string(),
  activeHouseholdId: idSchema.nullable(),
  quietHours: quietHoursSchema.nullable(),
  householdBillReminders: z.boolean(),
  isServerOwner: z.boolean(),
  memberships: z.array(membershipSchema),
});
export type ProfileResponse = z.infer<typeof profileResponseSchema>;

/** PATCH /api/users/me. `quietHours: null` clears the window. */
export const updateProfileRequestSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    timezone: timezoneSchema.optional(),
    quietHours: quietHoursSchema.nullable().optional(),
    householdBillReminders: z.boolean().optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Change at least one setting.',
  });
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

/** PUT /api/users/me/active-household */
export const setActiveHouseholdRequestSchema = z.object({ householdId: idSchema });

/**
 * POST /api/users/me/password. `currentPassword` may be left out only in a session that began
 * from a reset link. As with signup, the new password carries the shape rules here and the route
 * composes the common-password rule in.
 */
export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(200).optional(),
  newPassword: passwordShapeSchema,
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

/** POST /api/users/me/email */
export const changeEmailRequestSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newEmail: emailSchema,
});
export type ChangeEmailRequest = z.infer<typeof changeEmailRequestSchema>;
