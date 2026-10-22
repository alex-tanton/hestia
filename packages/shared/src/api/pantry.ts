import { z } from 'zod';
import { idSchema, timestampSchema } from './common.js';
import { itemNameSchema, quantityNoteSchema } from './lists.js';

/**
 * The pantry is a lightweight inventory: it does not track quantities precisely. One row per
 * normalized name, so adding something already there updates it.
 */
export const pantryItemSchema = z.object({
  id: idSchema,
  householdId: idSchema,
  itemName: z.string(),
  normalizedName: z.string(),
  quantityNote: z.string().nullable(),
  lastUpdated: timestampSchema,
});
export type PantryItem = z.infer<typeof pantryItemSchema>;

export const pantryListSchema = z.array(pantryItemSchema);

export const createPantryItemRequestSchema = z.object({
  itemName: itemNameSchema,
  quantityNote: quantityNoteSchema.nullish(),
});
export type CreatePantryItemRequest = z.infer<typeof createPantryItemRequestSchema>;

export const updatePantryItemRequestSchema = z
  .object({
    itemName: itemNameSchema.optional(),
    quantityNote: quantityNoteSchema.nullable().optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Change at least one field.',
  });
export type UpdatePantryItemRequest = z.infer<typeof updatePantryItemRequestSchema>;
