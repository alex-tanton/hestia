import type {
  Deal,
  DealSearchResponse,
  Flyer,
  FlyerItemsResponse,
  FlyersResponse,
  Merchant,
  MerchantsResponse,
  ShoppingList,
} from '@hearth/shared';
import { OAK_STREET_ID, ALEX_ID, oakStreetFixture, profileFixture } from './fixtures.ts';
import type { StubHandler } from './harness.tsx';

/**
 * The 27514 deals from Seed Data › Deal fixtures, quoted by their normalized values, so a
 * component test reads the same names and prices the seeded app shows. Prices are integer cents.
 */

/** Seed Data › Stores: merchant ids are stable week to week, so fixtures may rely on them. */
export const HARRIS_TEETER = '2431';
export const FOOD_LION = '2100';
export const PUBLIX = '2361';
export const LOWES_FOODS = '2469';
export const CVS = '2264';

export const HARRIS_TEETER_FLYER = '8132883';
export const FOOD_LION_FLYER = '8128502';

const VALID_FROM = '2026-09-23';
const VALID_TO = '2026-09-29';
const FETCHED_AT = '2026-09-26T08:00:00.000Z';

function deal(overrides: Partial<Deal> & Pick<Deal, 'id' | 'name' | 'unitPrice'>): Deal {
  return {
    externalId: `ext-${overrides.id}`,
    merchantId: HARRIS_TEETER,
    merchantName: 'Harris Teeter',
    normalizedName: overrides.name.toLowerCase(),
    priceUnit: 'each',
    originalPrice: null,
    discountPercent: null,
    displayPrice: '',
    conditionalPrice: false,
    conditionalReason: null,
    category: null,
    imageUrl: null,
    sourceUrl: null,
    flyerId: HARRIS_TEETER_FLYER,
    validFrom: VALID_FROM,
    validTo: VALID_TO,
    fetchedAt: FETCHED_AT,
    ...overrides,
  };
}

/** Multi-buy with a loyalty card: "2/$5.00" parses to $2.50 each. */
export const eggsDeal: Deal = deal({
  id: 'd0000001-0000-4000-8000-000000000001',
  name: "Egg-Land's Best Extra Large Eggs",
  unitPrice: 250,
  displayPrice: '2/$5.00',
  conditionalPrice: true,
  conditionalReason: 'loyalty_card',
  category: 'Dairy & Eggs',
  imageUrl: 'https://f.wishabi.net/items/eggs.jpg',
});

/** The half-up rounding case: 500 ÷ 3 = 167, 596 ÷ 3 = 199. */
export const pumpkinDeal: Deal = deal({
  id: 'd0000002-0000-4000-8000-000000000002',
  name: 'Harris Teeter 100% Pure Pumpkin',
  unitPrice: 167,
  originalPrice: 199,
  discountPercent: 16,
  displayPrice: '3/$5.00',
  conditionalPrice: true,
  conditionalReason: 'loyalty_card',
  category: 'Pantry',
});

/** A digital coupon rather than a card, so both conditional reasons are covered. */
export const stouffersDeal: Deal = deal({
  id: 'd0000003-0000-4000-8000-000000000003',
  name: "Stouffer's Entrees",
  merchantId: LOWES_FOODS,
  merchantName: 'Lowes Foods',
  unitPrice: 200,
  originalPrice: 300,
  discountPercent: 33,
  displayPrice: 'FINAL PRICE 2/$4.00',
  conditionalPrice: true,
  conditionalReason: 'coupon',
  category: 'Frozen',
  flyerId: '8132169',
});

/** Priced per pound. */
export const broccoliDeal: Deal = deal({
  id: 'd0000004-0000-4000-8000-000000000004',
  name: 'Broccoli Crowns',
  merchantId: FOOD_LION,
  merchantName: 'Food Lion',
  unitPrice: 199,
  priceUnit: 'lb',
  conditionalPrice: true,
  conditionalReason: 'loyalty_card',
  category: 'Produce',
  flyerId: FOOD_LION_FLYER,
});

/** The one unconditional grocery row, so badged and unbadged cards sit side by side. */
export const porkChopsDeal: Deal = deal({
  id: 'd0000005-0000-4000-8000-000000000005',
  name: 'Bone-In Pork Chops',
  unitPrice: 349,
  priceUnit: 'lb',
  category: 'Meat',
});

/** A clean price with an original and a discount, and no conditional wording. */
export const woodbridgeDeal: Deal = deal({
  id: 'd0000006-0000-4000-8000-000000000006',
  name: 'Woodbridge Cabernet or Chardonnay',
  unitPrice: 719,
  originalPrice: 899,
  discountPercent: 20,
  category: 'Beer & Wine',
});

export const dealFixtures: Deal[] = [
  eggsDeal,
  pumpkinDeal,
  stouffersDeal,
  broccoliDeal,
  porkChopsDeal,
  woodbridgeDeal,
];

export const FRESH = { asOf: FETCHED_AT, stale: false, refreshing: false } as const;

export function searchResponse(
  deals: Deal[] = dealFixtures,
  overrides: Partial<DealSearchResponse> = {},
): DealSearchResponse {
  return {
    deals,
    page: 1,
    pageSize: 50,
    total: deals.length,
    hasMore: false,
    ...FRESH,
    ...overrides,
  };
}

export function flyerItemsResponse(
  deals: Deal[] = [eggsDeal, pumpkinDeal],
  overrides: Partial<FlyerItemsResponse> = {},
): FlyerItemsResponse {
  return {
    deals,
    page: 1,
    pageSize: 50,
    total: deals.length,
    hasMore: false,
    ...FRESH,
    ...overrides,
  };
}

export const harrisTeeterFlyer: Flyer = {
  flyerId: HARRIS_TEETER_FLYER,
  merchantId: HARRIS_TEETER,
  merchantName: 'Harris Teeter',
  validFrom: VALID_FROM,
  validTo: VALID_TO,
  thumbnailUrl: 'https://f.wishabi.net/flyers/ht.jpg',
  logoUrl: 'https://images.wishabi.net/merchants/ht.png',
  isFavorite: true,
  itemCount: 42,
};

export const foodLionFlyer: Flyer = {
  flyerId: FOOD_LION_FLYER,
  merchantId: FOOD_LION,
  merchantName: 'Food Lion',
  validFrom: VALID_FROM,
  validTo: VALID_TO,
  thumbnailUrl: null,
  logoUrl: null,
  isFavorite: true,
  itemCount: 37,
};

export function flyersResponse(
  flyers: Flyer[] = [harrisTeeterFlyer, foodLionFlyer],
  overrides: Partial<FlyersResponse> = {},
): FlyersResponse {
  return { flyers, ...FRESH, ...overrides };
}

/** Seed Data: Oak Street favorites Harris Teeter, Food Lion, and CVS. */
export const merchantFixtures: Merchant[] = [
  { merchantId: HARRIS_TEETER, name: 'Harris Teeter', logoUrl: null, isFavorite: true },
  { merchantId: FOOD_LION, name: 'Food Lion', logoUrl: null, isFavorite: true },
  { merchantId: CVS, name: 'CVS Pharmacy', logoUrl: null, isFavorite: true },
  { merchantId: PUBLIX, name: 'Publix', logoUrl: null, isFavorite: false },
  { merchantId: LOWES_FOODS, name: 'Lowes Foods', logoUrl: null, isFavorite: false },
];

export function merchantsResponse(
  merchants: Merchant[] = merchantFixtures,
  overrides: Partial<MerchantsResponse> = {},
): MerchantsResponse {
  return { merchants, ...FRESH, ...overrides };
}

export const THIS_WEEK_LIST_ID = 'f0000001-0000-4000-8000-000000000001';
export const WEEKEND_LIST_ID = 'f0000002-0000-4000-8000-000000000002';

function list(id: string, name: string, outstandingCount: number): ShoppingList {
  return {
    id,
    householdId: OAK_STREET_ID,
    name,
    archivedAt: null,
    createdBy: ALEX_ID,
    createdAt: '2026-09-20T12:00:00.000Z',
    updatedAt: '2026-09-25T12:00:00.000Z',
    itemCount: outstandingCount,
    outstandingCount,
  };
}

/** Seed Data › E2E-only fixtures: Oak Street's two lists. */
export const thisWeekList = list(THIS_WEEK_LIST_ID, 'This Week', 15);
export const weekendCookoutList = list(WEEKEND_LIST_ID, 'Weekend Cookout', 6);

/** What every deals screen reads before its own endpoint: the session, the household, its merchants. */
export function dealScreenHandlers(
  extra: Readonly<Record<string, StubHandler>> = {},
): Record<string, StubHandler> {
  return {
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'GET /api/households/:id': () => ({ status: 200, body: oakStreetFixture }),
    'GET /api/households/:id/merchants': () => ({ status: 200, body: merchantsResponse() }),
    ...extra,
  };
}
