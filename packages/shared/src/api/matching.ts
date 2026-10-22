import { z } from 'zod';
import { idSchema, timestampSchema } from './common.js';
import { itemNameSchema } from './lists.js';

/**
 * Match overrides (stored in `ingredient_match_override`). A member corrects a wrong or missed
 * match from a recipe's breakdown; the correction applies household-wide until removed.
 */
export const matchTargetKindSchema = z.enum(['deal', 'pantry']);

export const matchDecisionSchema = z.enum(['force_match', 'force_no_match']);

export const matchOverrideSchema = z.object({
  id: idSchema,
  householdId: idSchema,
  ingredientNormalizedName: z.string(),
  targetKind: matchTargetKindSchema,
  targetNormalizedName: z.string(),
  decision: matchDecisionSchema,
  createdAt: timestampSchema,
});
export type MatchOverride = z.infer<typeof matchOverrideSchema>;

/**
 * POST /api/households/:id/match-overrides. Names, not pre-normalized strings — like every other
 * `normalized_name` in the system (a manual item's `normalized_name` is computed from its name by
 * `@hearth/matching`), the service normalizes both sides itself rather than trusting a
 * client-supplied normalized form. The recipe breakdown a correction is made from already shows
 * the ingredient's and the target's plain names.
 */
export const createMatchOverrideRequestSchema = z.object({
  ingredientName: itemNameSchema,
  targetKind: matchTargetKindSchema,
  targetName: itemNameSchema,
  decision: matchDecisionSchema,
});
export type CreateMatchOverrideRequest = z.infer<typeof createMatchOverrideRequestSchema>;

export const matchOverrideParamsSchema = z.object({ id: idSchema });
