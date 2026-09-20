import { z } from 'zod';
import { idSchema, timestampSchema } from './common.js';

/** An outstanding invite: not revoked and not expired. Its credentials are never shown again. */
export const inviteSchema = z.object({
  id: idSchema,
  createdBy: idSchema,
  createdAt: timestampSchema,
  expiresAt: timestampSchema,
});
export type Invite = z.infer<typeof inviteSchema>;

export const inviteListSchema = z.array(inviteSchema);

/** POST /api/households/:id/invites: the only response that carries the link and the code. */
export const createdInviteSchema = z.object({
  invite: inviteSchema,
  link: z.url(),
  code: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{8}$/),
});
export type CreatedInvite = z.infer<typeof createdInviteSchema>;
