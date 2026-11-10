import { z } from 'zod';
import { calendarDateSchema, idSchema, timestampSchema } from './common.js';

/**
 * The week planner. A week is identified by its Sunday's calendar date, always in the household's
 * own timezone: `GET` without a `week` query defaults to the current week, and any `week` given
 * must actually be a Sunday or the request is rejected with 400.
 */

export const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner']);
export type MealType = z.infer<typeof mealTypeSchema>;

/**
 * `readinessPercent` is null when `recipeId` is null (the recipe was deleted, so there is nothing
 * left to score) or, defensively, when the recipe's readiness has never been computed.
 */
export const mealPlanEntrySchema = z.object({
  id: idSchema,
  householdId: idSchema,
  recipeId: idSchema.nullable(),
  recipeTitle: z.string().nullable(),
  customTitle: z.string().nullable(),
  readinessPercent: z.int().min(0).max(100).nullable(),
  plannedDate: calendarDateSchema,
  mealType: mealTypeSchema,
  addedBy: idSchema,
  createdAt: timestampSchema,
});
export type MealPlanEntry = z.infer<typeof mealPlanEntrySchema>;

export const mealPlanWeekResponseSchema = z.object({
  week: calendarDateSchema,
  entries: z.array(mealPlanEntrySchema),
});
export type MealPlanWeekResponse = z.infer<typeof mealPlanWeekResponseSchema>;

/** GET /households/:id/meal-plan?week=YYYY-MM-DD */
export const mealPlanQuerySchema = z.object({ week: calendarDateSchema.optional() });

export const createRecipeEntrySchema = z.object({
  recipeId: idSchema,
  plannedDate: calendarDateSchema,
  mealType: mealTypeSchema,
});

export const createCustomItemEntrySchema = z.object({
  customTitle: z
    .string()
    .trim()
    .min(1, 'Enter an item name.')
    .max(200, 'Item name must not exceed 200 characters.'),
  plannedDate: calendarDateSchema,
  mealType: mealTypeSchema,
});

/** POST /households/:id/meal-plan */
export const createMealPlanEntryRequestSchema = z.union([
  createRecipeEntrySchema,
  createCustomItemEntrySchema,
]);
export type CreateMealPlanEntryRequest = z.infer<typeof createMealPlanEntryRequestSchema>;

/**
 * "Add missing to list". The same request body targets a single recipe, a single planned meal, or a
 * whole planned week; only the route differs.
 */
export const addToListRequestSchema = z.object({ listId: idSchema });

export const weekAddToListRequestSchema = z.object({
  week: calendarDateSchema,
  listId: idSchema,
});
