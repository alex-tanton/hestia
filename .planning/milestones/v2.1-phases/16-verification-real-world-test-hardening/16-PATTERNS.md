# Phase 16: Verification & Real-World Test Hardening - Pattern Map

**Mapped:** 2026-11-10
**Files analyzed:** 8
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/service/src/deals/price/parse-price.test.ts` | test | transform | `apps/service/src/deals/price/parse-price.test.ts` | exact |
| `apps/web/src/screens/deals/deal-card.test.tsx` | test | request-response | `apps/web/src/screens/deals/deal-card.test.tsx` | exact |
| `apps/service/src/barcodes.integration.test.ts` | test | CRUD / request-response | `apps/service/src/deals.integration.test.ts` & `apps/service/src/meal-plan.integration.test.ts` | exact |
| `apps/service/src/meal-plan.integration.test.ts` | test | CRUD / batch / transform | `apps/service/src/meal-plan.integration.test.ts` | exact |
| `e2e/fixtures/e2e-seed.sql` | config / migration | batch | `e2e/fixtures/e2e-seed.sql` | exact |
| `e2e/tests/22-deals-pricing-display.spec.ts` | test | request-response | `e2e/tests/09-search-deals-and-add-to-list.spec.ts` | exact |
| `e2e/tests/23-barcode-scanning.spec.ts` | test | event-driven / request-response | `e2e/tests/09-search-deals-and-add-to-list.spec.ts` & `apps/web/src/components/lists/BarcodeScannerDialog.test.tsx` | exact |
| `e2e/tests/24-flexible-meal-planning.spec.ts` | test | CRUD / request-response | `e2e/tests/09-search-deals-and-add-to-list.spec.ts` & `apps/web/src/screens/meals/planner.test.tsx` | exact |

---

## Pattern Assignments

### `apps/service/src/deals/price/parse-price.test.ts` (test, transform)

**Analog:** `apps/service/src/deals/price/parse-price.test.ts` (lines 1-17, 24-33, 530-589, 641-760)

**Imports pattern** (lines 1-17):
```typescript
import { describe, expect, it } from 'vitest';
import { discountPercent } from '../money.js';
import { parsePrice, withoutImplausibleOriginal } from './parse-price.js';
import { buildCopy, detectQualifier, formatDisplayPrice, type PriceCopy } from './price-copy.js';
import {
  parseAmountOff,
  parseBogo,
  parseBuyNGetM,
  parseDirectPrice,
  parseMinimumQuantity,
  parseMixAndMatchLimit,
  parseMultiBuy,
  parsePackagePricedByWeight,
  parsePerWeight,
  parsePercentOffNoBase,
  parseRebate,
} from './parsers.js';
```

**Fixture constructor helper** (lines 24-33):
```typescript
function copy(fields: Partial<PriceCopy>): PriceCopy {
  return {
    currentPrice: null,
    originalPrice: null,
    prePriceText: null,
    postPriceText: null,
    saleStory: null,
    ...fields,
  };
}
```

**Core Pricing Math pattern (D-01: multi-buy bundles, Buy-N-Get-M, minimum quantity)** (lines 641-760):
```typescript
describe('derived pricing math for bundles and promotions (D-01, D-02)', () => {
  it('derives bundle savings with dollar discount ("2/$6.00 with $1.50 off on 2")', () => {
    expect(
      parsePrice(
        copy({
          currentPrice: 600,
          prePriceText: '2/',
          saleStory: 'with $1.50 off on 2',
        }),
      ),
    ).toMatchObject({
      parsed: {
        unitPrice: 300,
        originalPrice: 375,
        discountPercent: 20,
        displayPrice: '2/$6.00',
      },
    });
  });

  it('derives BUY 2 GET 1 FREE at $1.99 each', () => {
    expect(
      parsePrice(
        copy({
          currentPrice: 199,
          saleStory: 'BUY 2 GET 1 FREE',
        }),
      ),
    ).toMatchObject({
      parsed: {
        unitPrice: 133,
        originalPrice: 199,
        discountPercent: 33,
        priceUnit: 'each',
      },
    });
  });

  it('divides 2/$6.00 MUST BUY 2 via multi-buy bundle division rather than returning un-divided 600', () => {
    expect(
      parsePrice(
        copy({
          currentPrice: 600,
          prePriceText: '2/',
          postPriceText: 'MUST BUY 2',
        }),
      ),
    ).toMatchObject({
      parsed: {
        unitPrice: 300,
        priceUnit: 'each',
        displayPrice: '2/$6.00 MUST BUY 2',
      },
    });
  });
});
```

**Boundary & Guardrail pattern (negative discounts, OCR errors, 95% caps)** (lines 530-589):
```typescript
it('drops original price when equal to or less than unit price', () => {
  expect(discountPercent(100, 100)).toBeNull();
  expect(discountPercent(150, 100)).toBeNull();
  expect(discountPercent(100, null)).toBeNull();

  expect(
    withoutImplausibleOriginal({ unitPrice: 100, priceUnit: 'each', originalPrice: 100 }),
  ).toEqual({
    unitPrice: 100,
    priceUnit: 'each',
    originalPrice: null,
    discountPercent: undefined,
  });
});

it('drops original price for case pricing OCR mismatch (original >= 10x unit price)', () => {
  expect(
    withoutImplausibleOriginal({ unitPrice: 239, priceUnit: 'lb', originalPrice: 2390 }),
  ).toEqual({
    unitPrice: 239,
    priceUnit: 'lb',
    originalPrice: null,
    discountPercent: undefined,
  });
});

it('drops original price when discount exceeds 95%', () => {
  expect(discountPercent(4, 100)).toBeNull();
  expect(
    withoutImplausibleOriginal({ unitPrice: 4, priceUnit: 'each', originalPrice: 100 }),
  ).toEqual({
    unitPrice: 4,
    priceUnit: 'each',
    originalPrice: null,
    discountPercent: undefined,
  });
});
```

---

### `apps/web/src/screens/deals/deal-card.test.tsx` (test, request-response)

**Analog:** `apps/web/src/screens/deals/deal-card.test.tsx` (lines 1-17, 37-57, 87-95)

**Imports pattern** (lines 1-16):
```typescript
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OFFLINE_MESSAGE } from '../../lib/api/problem.ts';
import { createFetchStub, renderScreen, type StubHandler, stubFetch } from '../../test/harness.tsx';
import { OAK_STREET_ID, SAM_ID } from '../../test/fixtures.ts';
import {
  broccoliDeal,
  eggsDeal,
  porkChopsDeal,
  stouffersDeal,
  thisWeekList,
  weekendCookoutList,
} from '../../test/deal-fixtures.ts';
import { DealCard } from './DealCard.tsx';
import { isAllowedImageUrl } from './DealImage.tsx';
```

**Cleanup hook** (lines 18-20):
```typescript
afterEach(() => {
  vi.unstubAllGlobals();
});
```

**Presentation & Badge Verification pattern (D-02)** (lines 37-57):
```typescript
it('strikes the original price, shows the inline discount badge, and names the validity dates', () => {
  stubFetch({});
  renderScreen(<DealCard householdId={OAK_STREET_ID} deal={stouffersDeal} />);

  const salePrice = screen.getByText('$2.00');
  expect(salePrice).toBeInTheDocument();
  expect(salePrice).toHaveClass('text-section');
  expect(screen.getByText('$3.00')).toHaveClass('line-through');
  expect(screen.getByText('-33%')).toBeInTheDocument();
  expect(screen.getByText('09/23/2026 – 09/29/2026')).toBeInTheDocument();
});

it('renders clean unit price with no strikethrough or discount badge when regular price is missing', () => {
  stubFetch({});
  const { container } = renderScreen(<DealCard householdId={OAK_STREET_ID} deal={eggsDeal} />);

  const unitPrice = screen.getByText('$2.50');
  expect(unitPrice).toHaveClass('text-section');
  expect(screen.queryByText(/%/)).toBeNull();
  expect(container.querySelector('.line-through')).toBeNull();
});
```

**Accessibility Accessible Name pattern** (lines 87-95):
```typescript
it('announces the price and discount as one sentence', () => {
  stubFetch({});
  renderScreen(<DealCard householdId={OAK_STREET_ID} deal={stouffersDeal} />);

  const card = screen.getByRole('article');
  expect(card).toHaveAccessibleName(
    "Stouffer's Entrees Stouffer's Entrees at Lowes Foods, $2.00 each, marked FINAL PRICE 2/$4.00, was $3.00 each, 33% off, with a digital coupon, valid 09/23/2026 – 09/29/2026.",
  );
});
```

---

### `apps/service/src/barcodes.integration.test.ts` (test, CRUD / request-response)

**Analog:** `apps/service/src/deals.integration.test.ts` (lines 1-25, 47-75) & `apps/service/src/meal-plan.integration.test.ts` (lines 12-21, 698-750)

**Imports pattern**:
```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BarcodeProduct } from '@hestia/shared';
import { adminPool, as, household } from './test/service-stack.js';
import { app, expectStatus, registerStackHooks } from './test/stack-hooks.js';
```

**Lifecycle & Stack Registration**:
```typescript
registerStackHooks();

const TEST_BARCODE = '012345678905';

afterEach(async () => {
  vi.unstubAllGlobals();
  await adminPool.query('delete from public.barcode_products where barcode = $1', [TEST_BARCODE]);
});
```

**Core Caching Pattern (D-03: Cache miss -> Upstream OFF fetch -> Write cache -> Cache hit with 0 calls)**:
```typescript
it('fetches Open Food Facts on cache miss, caches product in database, and serves subsequent requests from cache', async () => {
  const home = await household(app);

  const mockOffPayload = {
    status: 'success',
    product: {
      product_name: 'Organic Whole Milk',
      brands: 'Horizon Organic',
      quantity: '1 gal',
      image_front_url: 'https://images.openfoodfacts.org/milk.jpg',
    },
  };

  const fetchSpy = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const userAgent = (init?.headers as Record<string, string> | undefined)?.['User-Agent'];
    expect(userAgent).toContain('Hestia/2.1');
    return Promise.resolve(
      new Response(JSON.stringify(mockOffPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  vi.stubGlobal('fetch', fetchSpy);

  // 1. Initial request: cache miss triggers outbound fetch and inserts row
  const firstRes = await as(app, home.user, 'GET', `/api/barcodes/${TEST_BARCODE}`);
  expectStatus(firstRes, 200);
  expect(firstRes.json<BarcodeProduct>()).toEqual({
    barcode: TEST_BARCODE,
    productName: 'Organic Whole Milk',
    brands: 'Horizon Organic',
    quantity: '1 gal',
    imageUrl: 'https://images.openfoodfacts.org/milk.jpg',
  });
  expect(fetchSpy).toHaveBeenCalledTimes(1);

  // 2. Direct database verification
  const { rows } = await adminPool.query<{ barcode: string; product_name: string }>(
    'select barcode, product_name from public.barcode_products where barcode = $1',
    [TEST_BARCODE],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]?.product_name).toBe('Organic Whole Milk');

  // 3. Subsequent request: cache hit served directly with zero upstream calls
  const secondRes = await as(app, home.user, 'GET', `/api/barcodes/${TEST_BARCODE}`);
  expectStatus(secondRes, 200);
  expect(secondRes.json<BarcodeProduct>()).toEqual(firstRes.json<BarcodeProduct>());
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});
```

**Resilience & Error Handling Pattern (429, 503, Malformed Barcodes, Timeouts -> RFC 9457 Problem Details)**:
```typescript
it('returns 404 Problem Details on upstream 429 Too Many Requests without service crash', async () => {
  const home = await household(app);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('Rate limited', { status: 429 })),
  );

  const res = await as(app, home.user, 'GET', `/api/barcodes/${TEST_BARCODE}`);
  expectStatus(res, 404);
  expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
  expect(res.json()).toMatchObject({
    status: 404,
    title: 'Not Found',
    detail: 'Product not found for scanned barcode.',
  });
});

it('rejects malformed barcodes with 400 Problem Details', async () => {
  const home = await household(app);
  const res = await as(app, home.user, 'GET', '/api/barcodes/invalid!@#');
  expectStatus(res, 400);
  expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
  expect(res.json()).toMatchObject({
    status: 400,
    title: 'Bad Request',
  });
});
```

---

### `apps/service/src/meal-plan.integration.test.ts` (test, CRUD / batch / transform)

**Analog:** `apps/service/src/meal-plan.integration.test.ts` (lines 1-22, 147-163, 609-696)

**Imports & Stack Hooks pattern** (lines 1-22):
```typescript
import { randomUUID } from 'node:crypto';
import type { LightMyRequestResponse } from 'fastify';
import { describe, expect, it } from 'vitest';
import type {
  ListItem,
  MealPlanEntry,
  MealPlanWeekResponse,
  RecipeDetail,
  ShoppingListDetail,
  SuggestionsResponse,
} from '@hestia/shared';
import { adminPool, as, household, type HouseholdFixture } from './test/service-stack.js';
import { app, expectStatus, registerStackHooks } from './test/stack-hooks.js';
import { currentInstant } from './test/zone-dates.js';

registerStackHooks();
```

**Custom item creation helper** (lines 147-163):
```typescript
async function planCustomItem(
  home: HouseholdFixture,
  customTitle: string,
  plannedDate: string,
  mealType: 'breakfast' | 'lunch' | 'dinner' = 'breakfast',
): Promise<MealPlanEntry> {
  const response = await as(
    app,
    home.user,
    'POST',
    `/api/households/${home.household.id}/meal-plan`,
    { customTitle, plannedDate, mealType },
  );
  expectStatus(response, 201);
  return response.json<MealPlanEntry>();
}
```

**Deleted recipe coexistence pattern** (lines 310-331):
```typescript
it('a deleted recipe keeps its snapshot title and shows a null readiness percent', async () => {
  const home = await household(app);
  const recipe = await createRecipe(home, 'Mushroom Stroganoff', [{ itemName: 'Mushrooms' }]);
  const sunday = await currentSunday(home);
  await planMeal(home, recipe.id, sunday, 'dinner');

  expectStatus(await as(app, home.user, 'DELETE', `/api/recipes/${recipe.id}`), 204);

  const week = await as(
    app,
    home.user,
    'GET',
    `/api/households/${home.household.id}/meal-plan?week=${sunday}`,
  );
  const entry = week
    .json<MealPlanWeekResponse>()
    .entries.find((one) => one.recipeTitle === 'Mushroom Stroganoff');
  expect(entry).toBeDefined();
  expect(entry?.recipeId).toBeNull();
  expect(entry?.readinessPercent).toBeNull();
});
```

**Week add-to-list with advisory locking and custom items (D-04)** (lines 661-696):
```typescript
it('aggregates recipe ingredients and standalone custom items on week add-to-list with duplicate avoidance', async () => {
  const home = await household(app);
  const sunday = await currentSunday(home);
  const recipe = await createRecipe(home, 'Oatmeal', [{ itemName: 'Rolled Oats' }]);
  await planMeal(home, recipe.id, sunday, 'breakfast');
  await planCustomItem(home, 'Honey', sunday, 'breakfast');

  const list = await createList(home, 'Weekly Groceries');

  // First week add-to-list
  const response = await as(
    app,
    home.user,
    'POST',
    `/api/households/${home.household.id}/meal-plan/add-to-list`,
    { week: sunday, listId: list.id },
  );
  expectStatus(response, 200);
  const firstDetail = response.json<ShoppingListDetail>();
  expect(itemNamed(firstDetail, 'Rolled Oats')).toBeDefined();
  expect(itemNamed(firstDetail, 'Honey')).toBeDefined();

  // Second week add-to-list: idempotent duplicate avoidance
  const secondResponse = await as(
    app,
    home.user,
    'POST',
    `/api/households/${home.household.id}/meal-plan/add-to-list`,
    { week: sunday, listId: list.id },
  );
  expectStatus(secondResponse, 200);
  const secondDetail = secondResponse.json<ShoppingListDetail>();
  const honeyItems = allItems(secondDetail).filter((i) => i.itemName === 'Honey');
  expect(honeyItems.length).toBe(1);
});
```

---

### `e2e/fixtures/e2e-seed.sql` (config / migration, batch)

**Analog:** `e2e/fixtures/e2e-seed.sql` (lines 15-35, 65-74)

**Core Seeding Pattern**:
```sql
begin;

do $$
declare
  -- Existing declarations...
begin
  -- Search cache for Journey 22 (Deals pricing and discount display)
  -- Uses pre-seeded 27514 favorite store deals: Harris Teeter 100% Pure Pumpkin & Stouffer's Entrees
  insert into public.deal_query_cache (postal_code, normalized_query, deal_ids, cached_at) values
    ('27514', 'pure pumpkin',
      array(select id from public.deal where postal_code = '27514' and external_id = '1040206686'),
      now()),
    ('27514', 'stouffer',
      array(select id from public.deal where postal_code = '27514' and external_id = '1039937762'),
      now())
  on conflict (postal_code, normalized_query) do update set deal_ids = excluded.deal_ids, cached_at = now();

  -- Seed barcode product cache for Journey 23 (Barcode scanning)
  insert into public.barcode_products (barcode, product_name, brands, quantity, image_url) values
    ('012345678905', 'Organic Whole Milk', 'Horizon Organic', '1 gal', null)
  on conflict (barcode) do nothing;
end
$$;

commit;
```

---

### `e2e/tests/22-deals-pricing-display.spec.ts` (test, request-response)

**Analog:** `e2e/tests/09-search-deals-and-add-to-list.spec.ts` (lines 1-42)

**Imports & Helpers pattern** (lines 1-5):
```typescript
import { expect, test } from '@playwright/test';
import { expectDashboard, signIn } from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { SEED } from '../support/env.ts';
```

**Theme Parameterization & Assertions pattern (D-05)**:
```typescript
const TARGETS = {
  light: {
    query: 'pure pumpkin',
    name: 'Harris Teeter 100% Pure Pumpkin',
    store: 'Harris Teeter',
    salePrice: '$1.67',
    originalPrice: '$1.99',
    discountBadge: '-16%',
  },
  dark: {
    query: 'stouffer',
    name: "Stouffer's Entrees",
    store: 'Lowes Foods',
    salePrice: '$2.00',
    originalPrice: '$3.00',
    discountBadge: '-33%',
  },
} as const;

for (const theme of ['light', 'dark'] as const) {
  test.describe(`journey 22 — deals pricing and discount badge display (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('renders sale price, strikethrough original price, and percentage badge without layout shift', async ({
      page,
    }) => {
      const target = TARGETS[theme];

      await signIn(page, SEED.alex.email);
      await expectDashboard(page, SEED.oakStreet.name);

      await page.goto('/lists/deals');
      await expect(page.getByRole('heading', { name: 'Deals', level: 1 })).toBeVisible();

      await page.getByLabel('Search deals').fill(target.query);
      await page.getByRole('button', { name: 'Search' }).click();

      const card = page.getByRole('article', { name: new RegExp(target.name) });
      await expect(card).toBeVisible();

      // Primary sale price in prominent font
      const saleText = card.getByText(target.salePrice);
      await expect(saleText).toBeVisible();

      // Secondary original price with strikethrough styling
      const originalText = card.getByText(target.originalPrice);
      await expect(originalText).toBeVisible();
      await expect(originalText).toHaveClass(/line-through/);

      // Percentage off badge
      const badge = card.getByText(target.discountBadge);
      await expect(badge).toBeVisible();

      // WCAG 2.1 AA accessibility audit across both themes
      await expectAccessible(page, `deal pricing display (${theme})`);
    });
  });
}
```

---

### `e2e/tests/23-barcode-scanning.spec.ts` (test, event-driven / request-response)

**Analog:** `e2e/tests/09-search-deals-and-add-to-list.spec.ts` (lines 22-78) & `apps/web/src/components/lists/BarcodeScannerDialog.tsx` (lines 350-420)

**Imports & Setup**:
```typescript
import { expect, test } from '@playwright/test';
import { expectDashboard, openList, signIn } from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { SEED } from '../support/env.ts';
```

**Core Scanning Journey Pattern (D-06: Dialog open -> Manual barcode entry -> Add item -> Shop mode check-off)**:
```typescript
const TEST_BARCODE = '012345678905';
const EXPECTED_NAME = 'Organic Whole Milk';

for (const theme of ['light', 'dark'] as const) {
  test.describe(`journey 23 — barcode scanner sheet add and mark bought (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('scans barcode via manual input, resolves metadata, adds to list, and marks bought in shop mode', async ({
      page,
    }) => {
      await signIn(page, SEED.alex.email);
      await expectDashboard(page, SEED.oakStreet.name);

      await openList(page, 'This Week');

      // 1. Open scanner dialog from list screen toolbar
      const scanButton = page.getByRole('button', { name: /scan barcode/i });
      await expect(scanButton).toBeVisible();
      await scanButton.click();

      const dialog = page.getByRole('dialog', { name: 'Barcode Scanner' });
      await expect(dialog).toBeVisible();

      // 2. Switch to manual entry tab
      await page.getByRole('button', { name: 'Switch to manual entry' }).click();
      const barcodeInput = page.getByLabel('Enter Barcode (UPC / EAN)');
      await expect(barcodeInput).toBeVisible();

      // Set mode to "Add"
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await barcodeInput.fill(TEST_BARCODE);
      await page.getByRole('button', { name: 'Add to List' }).click();

      // 3. Verify ItemSheet is pre-populated with OFF product title
      const nameInput = page.getByLabel('Item name');
      await expect(nameInput).toHaveValue(new RegExp(EXPECTED_NAME));
      await page.getByRole('button', { name: 'Add item' }).click();

      // Verify item presence in unbought list
      await expect(page.getByText(EXPECTED_NAME)).toBeVisible();
      await expectAccessible(page, `shopping list after barcode add (${theme})`);

      // 4. Shop mode: scan barcode to mark item bought
      await scanButton.click();
      await page.getByRole('button', { name: 'Switch to manual entry' }).click();
      await page.getByRole('button', { name: 'Shop', exact: true }).click();
      await barcodeInput.fill(TEST_BARCODE);
      await page.getByRole('button', { name: 'Find & Mark Bought' }).click();

      // Toast confirms item marked bought
      await expect(page.getByText(new RegExp(`Marked ${EXPECTED_NAME} bought`)).first()).toBeVisible();

      // Verify item moved to Bought section
      const boughtToggle = page.getByRole('button', { name: /^Bought \(\d+\)$/ });
      await boughtToggle.click();
      const boughtRow = page.locator('li').filter({ hasText: EXPECTED_NAME });
      await expect(boughtRow.getByRole('checkbox', { name: new RegExp(EXPECTED_NAME) })).toBeChecked();

      await expectAccessible(page, `shopping list after barcode mark bought (${theme})`);
    });
  });
}
```

---

### `e2e/tests/24-flexible-meal-planning.spec.ts` (test, CRUD / request-response)

**Analog:** `e2e/tests/09-search-deals-and-add-to-list.spec.ts` (lines 42-65) & `apps/web/src/screens/meals/planner.test.tsx` (lines 299-368)

**Imports & Setup**:
```typescript
import { expect, test } from '@playwright/test';
import { expectDashboard, openList, signIn } from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { SEED } from '../support/env.ts';
```

**Core Journey Pattern (D-07: Week planner -> Quick item placement -> Planner grid verification -> Add to list -> List presence)**:
```typescript
for (const theme of ['light', 'dark'] as const) {
  test.describe(`journey 24 — flexible meal planning custom items (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('places custom standalone item on planner and transfers to shopping list', async ({
      page,
    }) => {
      await signIn(page, SEED.alex.email);
      await expectDashboard(page, SEED.oakStreet.name);

      // 1. Navigate to Week Planner
      await page.goto('/meals');
      await expect(page.getByRole('heading', { name: 'Meal Planner', level: 1 })).toBeVisible();

      // Select Wednesday tab
      const dayTabs = page.getByRole('tablist', { name: 'Day of the week' });
      await dayTabs.getByRole('tab', { name: /Wed/ }).click();

      // Open Add Meal sheet for breakfast
      await page.getByRole('button', { name: 'Add to breakfast' }).click();

      // Switch to Quick Item tab
      await page.getByRole('tab', { name: 'Quick Item' }).click();

      // Click "Greek Yogurt" suggestion chip
      const chip = page.getByRole('button', { name: 'Greek Yogurt' });
      await expect(chip).toBeVisible();
      await chip.click();

      // 2. Verify custom item renders on planner grid with primary text and bullet indicator
      const customItem = page.getByText('Greek Yogurt');
      await expect(customItem).toBeVisible();
      await expectAccessible(page, `meal planner with custom item (${theme})`);

      // 3. Open item overflow menu and click "Add to list"
      const overflowBtn = page.getByRole('button', { name: 'More actions for Greek Yogurt' });
      await overflowBtn.click();

      const addToListMenuItem = page.getByRole('menuitem', { name: 'Add to list' });
      await expect(addToListMenuItem).toBeVisible();
      await addToListMenuItem.click();

      // Oak Street has two active lists -> select "This Week"
      const picker = page.getByRole('dialog', { name: 'Add to which list?' });
      await expect(picker).toBeVisible();
      await picker.getByRole('button', { name: /^This Week/ }).click();
      await expect(picker).toBeHidden();

      await expect(page.getByText('Added Greek Yogurt to This Week.').first()).toBeVisible();

      // 4. Verify item presence on shopping list
      await openList(page, 'This Week');
      await expect(page.getByRole('checkbox', { name: 'Greek Yogurt' })).toBeVisible();
      await expectAccessible(page, `shopping list with meal plan item (${theme})`);
    });
  });
}
```

---

## Shared Patterns

### Playwright E2E Multi-Theme Journey Structure
**Source:** `e2e/tests/09-search-deals-and-add-to-list.spec.ts` (lines 22-26)
**Apply to:** All E2E test files (`22-deals-pricing-display.spec.ts`, `23-barcode-scanning.spec.ts`, `24-flexible-meal-planning.spec.ts`)
```typescript
for (const theme of ['light', 'dark'] as const) {
  test.describe(`journey name (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('journey description', async ({ page }) => {
      await signIn(page, SEED.alex.email);
      await expectDashboard(page, SEED.oakStreet.name);
      // Journey steps...
      await expectAccessible(page, `screen description (${theme})`);
    });
  });
}
```

### WCAG 2.1 Level AA Accessibility Audits
**Source:** `e2e/support/axe.ts` (lines 46-57)
**Apply to:** Every screen visited during Playwright E2E journeys
```typescript
// Settle all in-flight animations, then run axe-core with WCAG 2.1 AA rules
await expectAccessible(page, `screen context (${theme})`);
```

### Fastify Integration Testing with Live Postgres & Zero-Egress Mocking
**Source:** `apps/service/src/test/stack-hooks.ts` (lines 14-34) & `apps/service/src/deals.integration.test.ts` (lines 30-79)
**Apply to:** `apps/service/src/barcodes.integration.test.ts` and `apps/service/src/meal-plan.integration.test.ts`
```typescript
registerStackHooks();

afterEach(async () => {
  vi.unstubAllGlobals();
});

// Execute request through Fastify pipeline as authenticated user:
const response = await as(app, user, 'GET', '/api/path');
expectStatus(response, 200);
```

### RFC 9457 Problem Details Error Formatting
**Source:** `apps/service/src/routes/barcodes.test.ts` (lines 22-28, 37-43, 52-59)
**Apply to:** All API route integration error assertions
```typescript
expect(response.statusCode).toBe(404);
expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
expect(response.json()).toMatchObject({
  status: 404,
  title: 'Not Found',
  detail: 'Product not found for scanned barcode.',
});
```

---

## No Analog Found

None. All files have exact or role-matched git-tracked analogs in the repository.

---

## Metadata

**Analog search scope:**
- `apps/service/src/deals/price/`
- `apps/service/src/services/`
- `apps/service/src/routes/`
- `apps/service/src/*.integration.test.ts`
- `apps/web/src/screens/deals/`
- `apps/web/src/screens/meals/`
- `apps/web/src/components/lists/`
- `e2e/tests/`
- `e2e/support/`
- `e2e/fixtures/`

**Files scanned:** 18
**Pattern extraction date:** 2026-11-10
