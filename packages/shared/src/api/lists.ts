import { z } from 'zod';
import { barcodeSchema } from './barcodes.js';
import { calendarDateSchema, centsSchema, idSchema, timestampSchema } from './common.js';

export const listItemStatusSchema = z.enum(['needed', 'in_cart', 'bought']);
export type ListItemStatus = z.infer<typeof listItemStatusSchema>;

export const listItemSourceSchema = z.enum(['manual', 'from_deal', 'from_recipe']);
export type ListItemSource = z.infer<typeof listItemSourceSchema>;

export const priceUnitSchema = z.enum(['each', 'lb', 'oz']);
export type PriceUnit = z.infer<typeof priceUnitSchema>;

export const listNameSchema = z.string().trim().min(1, 'Enter a name.').max(100);
export const itemNameSchema = z.string().trim().min(1, 'Enter a name.').max(200);
/** A count or a weight, so fractions are allowed; it is never money. */
export const quantitySchema = z.number().positive().max(100_000);
export const quantityNoteSchema = z.string().trim().min(1).max(200);
export const merchantIdSchema = z.string().trim().min(1).max(64);
export const merchantNameSchema = z.string().trim().min(1).max(200);

/**
 * One row of a list. The deal fields are a snapshot taken when the item was added, never a live
 * reference: Flipp's item ids change every week.
 */
export const listItemSchema = z.object({
  id: idSchema,
  listId: idSchema,
  itemName: z.string(),
  normalizedName: z.string(),
  quantity: z.number().nullable(),
  quantityNote: z.string().nullable(),
  status: listItemStatusSchema,
  barcode: z.string().nullable().optional(),
  addedBy: idSchema,
  source: listItemSourceSchema,
  merchantId: z.string().nullable(),
  merchantName: z.string().nullable(),
  dealExternalId: z.string().nullable(),
  salePriceCents: centsSchema.nullable(),
  regularPriceCents: centsSchema.nullable(),
  dealValidTo: calendarDateSchema.nullable(),
  priceUnit: priceUnitSchema,
  conditionalPrice: z.boolean(),
  /** What the item counts at now: the sale price, or the repriced value. */
  priceCents: centsSchema.nullable(),
  originalSalePriceCents: centsSchema.nullable(),
  repricedAt: timestampSchema.nullable(),
  contributingRecipeIds: z.array(idSchema),
  createdAt: timestampSchema,
});
export type ListItem = z.infer<typeof listItemSchema>;

/**
 * A store group with its subtotal already computed, so the UI never does money arithmetic.
 * `merchantId` null is the "Anywhere" group, which sorts last.
 */
export const storeGroupSchema = z.object({
  merchantId: z.string().nullable(),
  merchantName: z.string().nullable(),
  subtotalCents: z.int().min(0),
  /** Items in the group left out of the subtotal, shown as "+N unpriced". */
  unpricedCount: z.int().min(0),
  items: z.array(listItemSchema),
});
export type StoreGroup = z.infer<typeof storeGroupSchema>;

/** A list as the index shows it: name, counts, and last activity. */
export const shoppingListSchema = z.object({
  id: idSchema,
  householdId: idSchema,
  name: z.string(),
  archivedAt: timestampSchema.nullable(),
  createdBy: idSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  itemCount: z.int().min(0),
  /** Items not yet bought; the delete confirmation names `itemCount` instead. */
  outstandingCount: z.int().min(0),
});
export type ShoppingList = z.infer<typeof shoppingListSchema>;

export const shoppingListListSchema = z.array(shoppingListSchema);

/** Bought items stay on the list, in their own group. */
export const shoppingListDetailSchema = shoppingListSchema.extend({
  storeGroups: z.array(storeGroupSchema),
  bought: z.array(listItemSchema),
});
export type ShoppingListDetail = z.infer<typeof shoppingListDetailSchema>;

/** GET /api/households/:id/lists?archived=true */
export const listsQuerySchema = z.object({ archived: z.enum(['true', 'false']).optional() });

export const createListRequestSchema = z.object({ name: listNameSchema });

export const updateListRequestSchema = z.object({ name: listNameSchema });

/** A store is its id and its name together; the snapshot is useless with one of them missing. */
function storePair(body: {
  merchantId?: string | null | undefined;
  merchantName?: string | null | undefined;
}): boolean {
  const hasId = (body.merchantId ?? null) !== null;
  const hasName = (body.merchantName ?? null) !== null;
  return hasId === hasName;
}

const STORE_PAIR_MESSAGE = 'Give a store id and name together, or neither.';

/**
 * A manually typed item. It may carry a hand-entered price and unit, and a store or none.
 */
const manualListItemRequestSchema = z
  .object({
    source: z.literal('manual'),
    /** Client-generated, so a replayed offline add is a no-op. */
    id: idSchema.optional(),
    itemName: itemNameSchema,
    quantity: quantitySchema.nullish(),
    quantityNote: quantityNoteSchema.nullish(),
    priceCents: centsSchema.nullish(),
    priceUnit: priceUnitSchema.optional(),
    merchantId: merchantIdSchema.nullish(),
    merchantName: merchantNameSchema.nullish(),
    barcode: barcodeSchema.nullish(),
  })
  .refine(storePair, { message: STORE_PAIR_MESSAGE, path: ['merchantName'] });

/**
 * An item added from a deal result. Only the deal's id travels: the service takes the snapshot
 * from the `deal` row itself, so a client can never invent a price.
 */
const dealListItemRequestSchema = z.object({
  source: z.literal('from_deal'),
  id: idSchema.optional(),
  dealId: idSchema,
  quantity: quantitySchema.nullish(),
  quantityNote: quantityNoteSchema.nullish(),
});

/** POST /api/lists/:id/items. Recipe-sourced items arrive through the recipe routes. */
export const createListItemRequestSchema = z.discriminatedUnion('source', [
  manualListItemRequestSchema,
  dealListItemRequestSchema,
]);
export type CreateListItemRequest = z.infer<typeof createListItemRequestSchema>;

/**
 * PATCH /api/lists/:id/items/:itemId. Every field is an absolute value, never a toggle or an
 * increment, so a queued write replays safely in any order. Null clears the field.
 */
export const updateListItemRequestSchema = z
  .object({
    itemName: itemNameSchema.optional(),
    quantity: quantitySchema.nullable().optional(),
    quantityNote: quantityNoteSchema.nullable().optional(),
    status: listItemStatusSchema.optional(),
    priceCents: centsSchema.nullable().optional(),
    priceUnit: priceUnitSchema.optional(),
    merchantId: merchantIdSchema.nullable().optional(),
    merchantName: merchantNameSchema.nullable().optional(),
    barcode: barcodeSchema.nullable().optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Change at least one field.',
  })
  .refine(
    (body) =>
      (body.merchantId === undefined) === (body.merchantName === undefined) && storePair(body),
    { message: STORE_PAIR_MESSAGE, path: ['merchantName'] },
  );
export type UpdateListItemRequest = z.infer<typeof updateListItemRequestSchema>;
