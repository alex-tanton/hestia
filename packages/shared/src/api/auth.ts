import { z } from 'zod';
import { passwordShapeSchema } from '../password.js';
import { emailSchema, timezoneSchema } from './common.js';

/**
 * POST /api/signup. A blank display name becomes the part of the email before the @.
 *
 * The password carries the shape rules only; the route composes the common-password rule in from
 * `@hestia/shared/common-passwords`, which is what keeps the list out of the PWA's app shell.
 */
export const signupRequestSchema = z.object({
  email: emailSchema,
  password: passwordShapeSchema,
  displayName: z.string().trim().max(100).optional(),
  timezone: timezoneSchema.optional(),
});
export type SignupRequest = z.infer<typeof signupRequestSchema>;

/**
 * GoTrue's session, returned unchanged so supabase-js can adopt it (`setSession`). It is the one
 * response that keeps GoTrue's snake_case.
 */
export const sessionResponseSchema = z.looseObject({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  expires_at: z.number().optional(),
  refresh_token: z.string(),
  user: z.looseObject({ id: z.string() }),
});
