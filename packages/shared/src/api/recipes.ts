import { z } from 'zod';
import { idSchema, timestampSchema } from './common.js';
import { pageSchema } from './deals.js';

/**
 * Recipes (Requirements, "Recipe library"; Technical Architecture, "Recipe fetching"). A
 * household's recipe is title, source URL, instructions, servings, and an ordered ingredient
 * list. `rawText` survives on a parsed ingredient so the original line is never lost; a manually
 * entered one has none. Servings are recorded as published and never scaled.
 */

export const recipeTitleSchema = z.string().trim().min(1, 'Enter a title.').max(200);
export const recipeInstructionsSchema = z.string().trim().min(1).max(20_000);
export const recipeServingsSchema = z.int().positive().max(1_000);
export const ingredientItemNameSchema = z.string().trim().min(1, 'Enter an ingredient.').max(200);
/** A count or a weight, never money; matches the quantity a list item or pantry note carries. */
export const ingredientQuantitySchema = z.number().positive().max(100_000);
export const ingredientUnitSchema = z.string().trim().min(1).max(50);
export const ingredientRawTextSchema = z.string().trim().min(1).max(500);

export const recipeIdParamsSchema = z.object({ id: idSchema });

export const recipeIngredientSchema = z.object({
  id: idSchema,
  position: z.int().min(0),
  rawText: z.string().nullable(),
  itemName: z.string(),
  normalizedName: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
});
export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;

export const recipeSchema = z.object({
  id: idSchema,
  householdId: idSchema,
  title: z.string(),
  sourceUrl: z.url().nullable(),
  instructions: z.string().nullable(),
  servings: z.int().nullable(),
  createdBy: idSchema,
  createdAt: timestampSchema,
});
export type Recipe = z.infer<typeof recipeSchema>;

export const recipeDetailSchema = recipeSchema.extend({
  ingredients: z.array(recipeIngredientSchema),
});
export type RecipeDetail = z.infer<typeof recipeDetailSchema>;

/** Requirements, "Scale and pagination": recipe libraries paginate at the same size as deals. */
export const RECIPE_PAGE_SIZE = 50;

const pageNumber = z.coerce.number().int().min(1).max(1_000);

/** GET /api/households/:id/recipes */
export const recipesQuerySchema = z.object({ page: pageNumber.default(1) });
export type RecipesQuery = z.infer<typeof recipesQuerySchema>;

export const recipeListResponseSchema = z.object({
  recipes: z.array(recipeSchema),
  ...pageSchema.shape,
});
export type RecipeListResponse = z.infer<typeof recipeListResponseSchema>;

/**
 * One ingredient as either a manual entry or a parsed-and-edited line contributes it. `rawText`
 * missing (or null) is what makes a manual ingredient distinguishable from a parsed one that
 * happens to keep the same values (Requirements, "Recipe sources").
 */
export const ingredientInputSchema = z.object({
  itemName: ingredientItemNameSchema,
  quantity: ingredientQuantitySchema.nullish(),
  unit: ingredientUnitSchema.nullish(),
  rawText: ingredientRawTextSchema.nullish(),
});
export type IngredientInput = z.infer<typeof ingredientInputSchema>;

/**
 * POST /api/households/:id/recipes. Manual entry and the parse-then-save flow share this shape:
 * the client always sends what it wants saved, whether typed by hand or edited from a preview.
 */
export const createRecipeRequestSchema = z.object({
  title: recipeTitleSchema,
  sourceUrl: z.url().nullish(),
  instructions: recipeInstructionsSchema.nullish(),
  servings: recipeServingsSchema.nullish(),
  ingredients: z.array(ingredientInputSchema).max(200),
});
export type CreateRecipeRequest = z.infer<typeof createRecipeRequestSchema>;

/**
 * PATCH /api/recipes/:id. `ingredients`, if given, replaces the recipe's ingredient list
 * wholesale rather than merging, so the client always sends the full edited set (mirrors the
 * create shape; Technical Architecture does not specify a partial-ingredient PATCH, and a partial
 * merge would need a merge key this resource has no stable one for prior to saving).
 */
export const updateRecipeRequestSchema = z
  .object({
    title: recipeTitleSchema.optional(),
    sourceUrl: z.url().nullable().optional(),
    instructions: recipeInstructionsSchema.nullable().optional(),
    servings: recipeServingsSchema.nullable().optional(),
    ingredients: z.array(ingredientInputSchema).max(200).optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Change at least one field.',
  });
export type UpdateRecipeRequest = z.infer<typeof updateRecipeRequestSchema>;

/** POST /api/households/:id/recipes/parse. Never saves; the client reviews and edits the result. */
export const parseRecipeRequestSchema = z.object({ url: z.url('Enter a valid URL.') });
export type ParseRecipeRequest = z.infer<typeof parseRecipeRequestSchema>;

export const parsedIngredientSchema = z.object({
  rawText: z.string(),
  itemName: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
});
export type ParsedIngredient = z.infer<typeof parsedIngredientSchema>;

/**
 * The parse-and-preview result. `needsManualEntry` is true only when the page carried no usable
 * schema.org/JSON-LD `Recipe` markup at all (Technical Architecture, "Recipe fetching"); a page
 * with partial markup (say, ingredients but no instructions) still comes back with
 * `needsManualEntry: false` and the gaps left null, for the same editable preview to fill in.
 */
export const parseRecipeResponseSchema = z.object({
  needsManualEntry: z.boolean(),
  sourceUrl: z.url(),
  title: z.string().nullable(),
  instructions: z.string().nullable(),
  servings: z.int().nullable(),
  ingredients: z.array(parsedIngredientSchema),
});
export type ParseRecipeResponse = z.infer<typeof parseRecipeResponseSchema>;
