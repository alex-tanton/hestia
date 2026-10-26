import type { ListItem, PantryItem, ShoppingList, ShoppingListDetail } from '@hestia/shared';
import { ALEX_ID, OAK_STREET_ID, SAM_ID } from './fixtures.ts';

/*
 * The seed data's "This Week" list, used as the oracle it is meant to be: 15 items, 7 from deals, 4
 * from recipes, 4 manual; 3 bought, 1 in cart, 11 needed, and the three repricing outcomes. The
 * store headers below are the ones the seed data expects.
 */

export const THIS_WEEK_ID = 'f1111111-1111-4111-8111-111111111111';
export const WEEKEND_COOKOUT_ID = 'f2222222-2222-4222-8222-222222222222';
export const PARTY_SUPPLIES_ID = 'f3333333-3333-4333-8333-333333333333';

const FOOD_LION = { merchantId: '1204', merchantName: 'Food Lion' };
const HARRIS_TEETER = { merchantId: '1301', merchantName: 'Harris Teeter' };
const CVS = { merchantId: '1450', merchantName: 'CVS Pharmacy' };

const BASE: Omit<ListItem, 'id' | 'itemName'> = {
  listId: THIS_WEEK_ID,
  normalizedName: '',
  quantity: null,
  quantityNote: null,
  status: 'needed',
  addedBy: ALEX_ID,
  source: 'manual',
  merchantId: null,
  merchantName: null,
  dealExternalId: null,
  salePriceCents: null,
  regularPriceCents: null,
  dealValidTo: null,
  priceUnit: 'each',
  conditionalPrice: false,
  priceCents: null,
  originalSalePriceCents: null,
  repricedAt: null,
  contributingRecipeIds: [],
  createdAt: '2026-09-20T12:00:00.000Z',
};

export function listItem(
  overrides: Partial<ListItem> & Pick<ListItem, 'id' | 'itemName'>,
): ListItem {
  return { ...BASE, ...overrides };
}

/** Re-matched to the current Food Lion deal: $1.99/lb, showing $1.49 struck through. */
export const broccoli = listItem({
  id: 'a0000001-0000-4000-8000-000000000001',
  itemName: 'Broccoli',
  source: 'from_deal',
  ...FOOD_LION,
  quantity: 2,
  priceUnit: 'lb',
  priceCents: 199,
  salePriceCents: 199,
  originalSalePriceCents: 149,
  repricedAt: '2026-09-25T09:00:00.000Z',
  conditionalPrice: true,
  addedBy: SAM_ID,
});

export const groundBeef = listItem({
  id: 'a0000001-0000-4000-8000-000000000002',
  itemName: '93% Lean Fresh Ground Beef',
  source: 'from_deal',
  ...FOOD_LION,
  quantity: 1,
  priceUnit: 'lb',
  priceCents: 729,
  salePriceCents: 729,
  status: 'in_cart',
  conditionalPrice: true,
});

/** No current deal: falls back to its regular price, $6.99, from a $5.99 sale. */
export const bacon = listItem({
  id: 'a0000001-0000-4000-8000-000000000003',
  itemName: 'Oscar Mayer Sliced Bacon',
  source: 'from_deal',
  ...FOOD_LION,
  quantity: 1,
  priceCents: 699,
  regularPriceCents: 699,
  salePriceCents: 599,
  originalSalePriceCents: 599,
  repricedAt: '2026-09-25T09:00:00.000Z',
  conditionalPrice: true,
});

export const apples = listItem({
  id: 'a0000001-0000-4000-8000-000000000004',
  itemName: 'Apples',
  ...FOOD_LION,
  quantityNote: '3 lb',
  addedBy: SAM_ID,
});

export const bread = listItem({
  id: 'a0000001-0000-4000-8000-000000000005',
  itemName: 'Artesano Bakery Bread',
  source: 'from_deal',
  ...HARRIS_TEETER,
  quantity: 2,
  priceCents: 350,
  salePriceCents: 350,
  conditionalPrice: true,
});

export const trashBags = listItem({
  id: 'a0000001-0000-4000-8000-000000000006',
  itemName: 'Trash bags',
  ...HARRIS_TEETER,
  quantity: 1,
});

export const colgate = listItem({
  id: 'a0000001-0000-4000-8000-000000000007',
  itemName: 'Colgate Optic White',
  source: 'from_deal',
  ...CVS,
  quantity: 1,
  priceCents: 479,
  salePriceCents: 479,
  conditionalPrice: true,
});

/** No current deal and no regular price: the price is cleared, showing $4.49 struck through. */
export const shampoo = listItem({
  id: 'a0000001-0000-4000-8000-000000000008',
  itemName: 'GARNIER Fructis shampoo',
  source: 'from_deal',
  ...CVS,
  quantity: 1,
  priceCents: null,
  salePriceCents: 449,
  originalSalePriceCents: 449,
  repricedAt: '2026-09-25T09:00:00.000Z',
});

export const paperTowels = listItem({
  id: 'a0000001-0000-4000-8000-000000000009',
  itemName: 'Paper towels',
  ...CVS,
  quantity: 1,
  priceCents: 599,
});

export const redOnion = listItem({
  id: 'a0000001-0000-4000-8000-000000000010',
  itemName: 'Red onion',
  source: 'from_recipe',
  quantity: 2,
});

export const salsa = listItem({
  id: 'a0000001-0000-4000-8000-000000000011',
  itemName: 'Salsa',
  source: 'from_recipe',
  quantityNote: '1 cup + 16 oz',
});

export const celery = listItem({
  id: 'a0000001-0000-4000-8000-000000000012',
  itemName: 'Celery',
  source: 'from_recipe',
  quantity: 1,
});

export const shreddedCheese = listItem({
  id: 'a0000001-0000-4000-8000-000000000013',
  itemName: 'Shredded cheese',
  source: 'from_deal',
  ...FOOD_LION,
  quantity: 2,
  priceCents: 349,
  salePriceCents: 349,
  status: 'bought',
  conditionalPrice: true,
});

export const lemon = listItem({
  id: 'a0000001-0000-4000-8000-000000000014',
  itemName: 'Lemon',
  source: 'from_recipe',
  quantity: 1,
  status: 'bought',
});

export const dishSoap = listItem({
  id: 'a0000001-0000-4000-8000-000000000015',
  itemName: 'Dish soap',
  quantity: 1,
  status: 'bought',
  addedBy: SAM_ID,
});

export const thisWeekFixture: ShoppingList = {
  id: THIS_WEEK_ID,
  householdId: OAK_STREET_ID,
  name: 'This Week',
  archivedAt: null,
  createdBy: SAM_ID,
  createdAt: '2026-09-20T12:00:00.000Z',
  updatedAt: '2026-09-25T09:00:00.000Z',
  itemCount: 15,
  outstandingCount: 12,
};

/** The store headers the seed data expects, computed by the service and never by the client. */
export const thisWeekDetailFixture: ShoppingListDetail = {
  ...thisWeekFixture,
  storeGroups: [
    {
      ...CVS,
      subtotalCents: 1078,
      unpricedCount: 1,
      items: [colgate, shampoo, paperTowels],
    },
    {
      ...FOOD_LION,
      subtotalCents: 1826,
      unpricedCount: 1,
      items: [broccoli, groundBeef, bacon, apples],
    },
    {
      ...HARRIS_TEETER,
      subtotalCents: 700,
      unpricedCount: 1,
      items: [bread, trashBags],
    },
    {
      merchantId: null,
      merchantName: null,
      subtotalCents: 0,
      unpricedCount: 3,
      items: [redOnion, salsa, celery],
    },
  ],
  bought: [shreddedCheese, lemon, dishSoap],
};

/** Seed data: active, four items, all bought — the all-bought summary and add-to-pantry state. */
export const weekendCookoutFixture: ShoppingList = {
  id: WEEKEND_COOKOUT_ID,
  householdId: OAK_STREET_ID,
  name: 'Weekend Cookout',
  archivedAt: null,
  createdBy: ALEX_ID,
  createdAt: '2026-09-18T12:00:00.000Z',
  updatedAt: '2026-09-22T12:00:00.000Z',
  itemCount: 4,
  outstandingCount: 0,
};

export const weekendCookoutDetailFixture: ShoppingListDetail = {
  ...weekendCookoutFixture,
  storeGroups: [],
  bought: ['Hot dogs', 'Buns', 'Charcoal', 'Ketchup'].map((itemName, index) =>
    listItem({
      id: `a0000002-0000-4000-8000-00000000000${String(index + 1)}`,
      itemName,
      listId: WEEKEND_COOKOUT_ID,
      status: 'bought',
      quantity: 1,
    }),
  ),
};

/** Seed data: archived, eight items all bought — the archived, read-only view. */
export const partySuppliesFixture: ShoppingList = {
  id: PARTY_SUPPLIES_ID,
  householdId: OAK_STREET_ID,
  name: 'Party Supplies',
  archivedAt: '2026-09-10T12:00:00.000Z',
  createdBy: ALEX_ID,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-10T12:00:00.000Z',
  itemCount: 8,
  outstandingCount: 0,
};

export const partySuppliesDetailFixture: ShoppingListDetail = {
  ...partySuppliesFixture,
  storeGroups: [],
  bought: [
    listItem({
      id: 'a0000003-0000-4000-8000-000000000001',
      itemName: 'Paper plates',
      listId: PARTY_SUPPLIES_ID,
      status: 'bought',
      quantity: 1,
    }),
  ],
};

export const emptyListFixture: ShoppingListDetail = {
  id: 'f4444444-4444-4444-8444-444444444444',
  householdId: OAK_STREET_ID,
  name: 'Next Week',
  archivedAt: null,
  createdBy: ALEX_ID,
  createdAt: '2026-09-25T12:00:00.000Z',
  updatedAt: '2026-09-25T12:00:00.000Z',
  itemCount: 0,
  outstandingCount: 0,
  storeGroups: [],
  bought: [],
};

export const pantryFixture: PantryItem[] = [
  {
    id: 'b0000001-0000-4000-8000-000000000001',
    householdId: OAK_STREET_ID,
    itemName: 'Olive oil',
    normalizedName: 'olive oil',
    quantityNote: 'half a bottle',
    lastUpdated: '2026-09-20T12:00:00.000Z',
  },
  {
    id: 'b0000001-0000-4000-8000-000000000002',
    householdId: OAK_STREET_ID,
    itemName: 'Garlic',
    normalizedName: 'garlic',
    quantityNote: null,
    lastUpdated: '2026-09-20T12:00:00.000Z',
  },
];
