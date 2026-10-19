import { z } from 'zod';
import { idSchema } from './common.js';

const ownedItemSchema = z.object({ id: idSchema, name: z.string() });

/** GET /api/households/:id/members/:userId/departure-preview */
export const departurePreviewSchema = z.object({
  householdId: idSchema,
  householdName: z.string(),
  userId: idSchema,
  isLastMember: z.boolean(),
  /** What deleting the household would lose, for the last member's typed-name confirmation. */
  deletionCounts: z.object({
    lists: z.number().int(),
    pantryItems: z.number().int(),
    recipes: z.number().int(),
    mealPlanEntries: z.number().int(),
    chores: z.number().int(),
    errands: z.number().int(),
    bills: z.number().int(),
  }),
  lists: z.array(ownedItemSchema),
  chores: z.array(ownedItemSchema),
  errands: z.array(ownedItemSchema),
  bills: z.array(ownedItemSchema),
  /** Rotations the member leaves, with who holds the turn afterwards; informational only. */
  rotations: z.array(
    z.object({ choreId: idSchema, choreName: z.string(), nextTurnUserId: idSchema.nullable() }),
  ),
});
export type DeparturePreview = z.infer<typeof departurePreviewSchema>;

/**
 * POST /api/households/:id/leave and /members/:userId/remove. `reassignments` maps each owned
 * list, chore, errand, and bill id to a remaining member's id. `confirmName` is the typed
 * household name, required when the last member leaves.
 */
export const departRequestSchema = z.object({
  reassignments: z.record(idSchema, idSchema).default({}),
  confirmName: z.string().max(200).optional(),
});
export type DepartRequest = z.infer<typeof departRequestSchema>;

export const departResultSchema = z.object({
  householdDeleted: z.boolean(),
  promotedUserId: idSchema.nullable(),
});
export type DepartResult = z.infer<typeof departResultSchema>;

/** POST /api/households/:id/transfer-admin */
export const transferAdminRequestSchema = z.object({ userId: idSchema });
