import { z } from 'zod';
import { calendarDateSchema, centsSchema, idSchema, timestampSchema } from './common.js';
import { merchantIdSchema, merchantNameSchema, priceUnitSchema } from './lists.js';

/**
 * Deals, flyers, merchants, and favorite stores (Technical Architecture, "API surface";
 * Requirements, "Deal search and browse").
 *
 * Money crosses this boundary as integer cents, like everywhere above the database boundary
 * (Engineering Practices, "Code conventions"). `displayPrice` keeps Flipp's original copy, so the
 * UI can show "2 for $5" beside the computed $2.50.
 */

/** Set exactly when `conditionalPrice` is true, so the UI can name which one it is. */
export const conditionalReasonSchema = z.enum(['coupon', 'loyalty_card']);
export type ConditionalReason = z.infer<typeof conditionalReasonSchema>;

export const dealSchema = z.object({
  id: idSchema,
  externalId: z.string(),
  merchantId: merchantIdSchema,
  merchantName: merchantNameSchema,
  name: z.string(),
  normalizedName: z.string(),
  unitPrice: centsSchema,
  priceUnit: priceUnitSchema,
  originalPrice: centsSchema.nullable(),
  discountPercent: z.int().min(0).max(100).nullable(),
  displayPrice: z.string(),
  conditionalPrice: z.boolean(),
  conditionalReason: conditionalReasonSchema.nullable(),
  category: z.string().nullable(),
  imageUrl: z.url().nullable(),
  sourceUrl: z.url().nullable(),
  flyerId: z.string(),
  validFrom: calendarDateSchema,
  validTo: calendarDateSchema,
  fetchedAt: timestampSchema,
});
export type Deal = z.infer<typeof dealSchema>;

/**
 * What every deals response carries so the UI can render the deals-specific states (Design,
 * "Deals-specific states"): the "as of" label, the stale-cache banner, and the refreshing
 * skeleton a dormant postal code shows while its background refresh runs.
 */
export const freshnessSchema = z.object({
  /** When the data being returned was fetched; null when nothing has ever been fetched. */
  asOf: timestampSchema.nullable(),
  /** True when a live fetch failed or the cache is past its TTL and could not be replaced. */
  stale: z.boolean(),
  /** True while a background refresh for this postal code is queued or running. */
  refreshing: z.boolean(),
});
export type Freshness = z.infer<typeof freshnessSchema>;

export const pageSchema = z.object({
  page: z.int().min(1),
  pageSize: z.int().min(1),
  total: z.int().min(0),
  hasMore: z.boolean(),
});

/** Requirements, "Scale and pagination": deal results paginate at 50 per page. */
export const DEAL_PAGE_SIZE = 50;

// Query strings arrive as text, so these coerce; the response schemas above do not.
const pageNumber = z.coerce.number().int().min(1).max(1_000);
const queryCents = z.coerce.number().int().min(0).max(99_999_999);

/** Favorites scope the default search and flyer list; browsing every merchant stays available. */
export const dealScopeSchema = z.enum(['favorites', 'all']);
export type DealScope = z.infer<typeof dealScopeSchema>;

export const dealSortSchema = z.enum(['relevance', 'price']);
export type DealSort = z.infer<typeof dealSortSchema>;

/** GET /api/households/:id/deals/search */
export const dealSearchQuerySchema = z
  .object({
    q: z.string().trim().min(1, 'Enter something to search for.').max(100),
    scope: dealScopeSchema.default('favorites'),
    /** Merchant ids, comma-separated; narrows within the scope. */
    stores: z
      .string()
      .max(500)
      .optional()
      .transform((value) =>
        value === undefined
          ? []
          : value
              .split(',')
              .map((entry) => entry.trim())
              .filter((entry) => entry !== ''),
      ),
    category: z.string().trim().min(1).max(100).optional(),
    minPrice: queryCents.optional(),
    maxPrice: queryCents.optional(),
    sort: dealSortSchema.default('relevance'),
    page: pageNumber.default(1),
  })
  .refine(
    (query) =>
      query.minPrice === undefined ||
      query.maxPrice === undefined ||
      query.minPrice <= query.maxPrice,
    { message: 'The lowest price must not be above the highest.' },
  );
export type DealSearchQuery = z.infer<typeof dealSearchQuerySchema>;

export const dealSearchResponseSchema = z.object({
  deals: z.array(dealSchema),
  ...pageSchema.shape,
  ...freshnessSchema.shape,
});
export type DealSearchResponse = z.infer<typeof dealSearchResponseSchema>;

export const flyerSchema = z.object({
  flyerId: z.string(),
  merchantId: merchantIdSchema,
  merchantName: merchantNameSchema,
  validFrom: calendarDateSchema,
  validTo: calendarDateSchema,
  thumbnailUrl: z.url().nullable(),
  logoUrl: z.url().nullable(),
  isFavorite: z.boolean(),
  /** Deals stored for this flyer at the household's postal code; 0 until it is fetched. */
  itemCount: z.int().min(0),
});
export type Flyer = z.infer<typeof flyerSchema>;

/** GET /api/households/:id/flyers */
export const flyersQuerySchema = z.object({ scope: dealScopeSchema.default('favorites') });
export type FlyersQuery = z.infer<typeof flyersQuerySchema>;

export const flyersResponseSchema = z.object({
  flyers: z.array(flyerSchema),
  ...freshnessSchema.shape,
});
export type FlyersResponse = z.infer<typeof flyersResponseSchema>;

export const flyerParamsSchema = z.object({ id: idSchema, flyerId: z.string().min(1).max(64) });

/** GET /api/households/:id/flyers/:flyerId/items */
export const flyerItemsQuerySchema = z.object({
  category: z.string().trim().min(1).max(100).optional(),
  sort: dealSortSchema.default('relevance'),
  page: pageNumber.default(1),
});
export type FlyerItemsQuery = z.infer<typeof flyerItemsQuerySchema>;

export const flyerItemsResponseSchema = z.object({
  deals: z.array(dealSchema),
  ...pageSchema.shape,
  ...freshnessSchema.shape,
});
export type FlyerItemsResponse = z.infer<typeof flyerItemsResponseSchema>;

export const merchantSchema = z.object({
  merchantId: merchantIdSchema,
  name: merchantNameSchema,
  logoUrl: z.url().nullable(),
  isFavorite: z.boolean(),
});
export type Merchant = z.infer<typeof merchantSchema>;

/** GET /api/households/:id/merchants */
export const merchantsResponseSchema = z.object({
  merchants: z.array(merchantSchema),
  ...freshnessSchema.shape,
});
export type MerchantsResponse = z.infer<typeof merchantsResponseSchema>;

export const favoriteStoreSchema = z.object({
  id: idSchema,
  merchantId: merchantIdSchema,
  merchantName: merchantNameSchema,
});
export type FavoriteStore = z.infer<typeof favoriteStoreSchema>;

export const favoriteStoreListSchema = z.array(favoriteStoreSchema);

/** POST /api/households/:id/favorite-stores */
export const addFavoriteStoreRequestSchema = z.object({
  // Flipp's merchant ids are opaque text and stable week to week, which is why favorites are
  // stored by merchant id rather than by name.
  merchantId: merchantIdSchema,
  merchantName: merchantNameSchema,
});
export type AddFavoriteStoreRequest = z.infer<typeof addFavoriteStoreRequestSchema>;

export const favoriteStoreParamsSchema = z.object({ id: idSchema, storeId: merchantIdSchema });
