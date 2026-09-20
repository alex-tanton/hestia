import { z } from 'zod';
import {
  householdNameSchema,
  householdRoleSchema,
  idSchema,
  postalCodeSchema,
  timestampSchema,
  timezoneSchema,
} from './common.js';

/** A household as its member sees it, with the caller's own role. */
export const householdSchema = z.object({
  id: idSchema,
  name: z.string(),
  postalCode: z.string(),
  timezone: z.string(),
  role: householdRoleSchema,
  joinedAt: timestampSchema,
  createdAt: timestampSchema,
});
export type Household = z.infer<typeof householdSchema>;

export const householdListSchema = z.array(householdSchema);

/** POST /api/households. The timezone comes from the creator's browser. */
export const createHouseholdRequestSchema = z.object({
  name: householdNameSchema,
  postalCode: postalCodeSchema,
  timezone: timezoneSchema,
});
export type CreateHouseholdRequest = z.infer<typeof createHouseholdRequestSchema>;

/** PATCH /api/households/:id (admin) */
export const updateHouseholdRequestSchema = z
  .object({
    name: householdNameSchema.optional(),
    postalCode: postalCodeSchema.optional(),
    timezone: timezoneSchema.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Change at least one setting.',
  });
export type UpdateHouseholdRequest = z.infer<typeof updateHouseholdRequestSchema>;

export const memberSchema = z.object({
  userId: idSchema,
  displayName: z.string(),
  role: householdRoleSchema,
  joinedAt: timestampSchema,
});
export type Member = z.infer<typeof memberSchema>;

export const memberListSchema = z.array(memberSchema);

/** POST /api/households/join: the link's token or the typed code. */
export const joinHouseholdRequestSchema = z.object({
  tokenOrCode: z.string().trim().min(1, 'Enter an invite code.').max(200),
});
export type JoinHouseholdRequest = z.infer<typeof joinHouseholdRequestSchema>;
