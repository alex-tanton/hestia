# Phase 16: Verification & Real-World Test Hardening - Context

**Gathered:** 2026-11-10
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous mode)

<domain>
## Phase Boundary

Validate all new grocery, deal, and meal planning features built across Milestone v2.1 with thorough unit tests, service integration tests, and Playwright E2E suites testing real-world data and user flows.

Requirements:
- **TEST-01**: Unit tests validate mathematical price and discount calculations across varied sale story scenarios and set pricing.
- **TEST-02**: Service integration tests validate Open Food Facts proxy caching, rate limit resilience, and custom meal plan entry persistence.
- **TEST-03**: Playwright E2E tests validate deal price/discount display, barcode scan to add/mark-bought flows (with mocked media/code input), and custom meal item placement.

Success Criteria:
1. Unit tests pass for deal pricing calculations across varied sale story patterns, discount badges, and edge cases.
2. Service integration tests verify Open Food Facts proxy caching, error resilience, and custom meal plan entry lifecycle.
3. Playwright E2E tests verify deal price/badge rendering, camera/manual barcode scanning flows (with mocked media stream and code injection), and custom meal item placement.

</domain>

<decisions>
## Implementation Decisions

### Mathematical Pricing & Discount Unit Tests (TEST-01)
- **D-01 (Pricing rule edge cases)**: Expand `apps/service/src/deals/price/parse-price.test.ts` to exhaustively test complex multi-buy cases (e.g. "Buy 2 Get 1 Free", "4 for $5.00"), minimum quantity thresholds, per-weight unit price rounding, negative discount guardrails, and boundary values for original prices.
- **D-02 (PWA pricing presentation tests)**: Verify in `apps/web/src/screens/deals/deal-card.test.tsx` that primary sale prices, secondary strikethrough original prices, and badge discount percentages (e.g. `-25%`) calculate and render consistently without layout shift or text clipping.

### Service Integration Testing (TEST-02)
- **D-03 (Barcode proxy integration)**: Create `apps/service/src/barcodes.integration.test.ts` against the real PostgreSQL test database:
  - Cache miss triggers mock Open Food Facts v3 upstream request and writes result to `barcode_product` table.
  - Subsequent requests for the same barcode resolve directly from database cache with 0 upstream calls.
  - Upstream 429 Too Many Requests or 503 Service Unavailable handles errors cleanly, returning 404 Problem Details without service crashes.
  - Malformed barcodes and lookup timeouts reject cleanly with RFC 9457 Problem Details.
- **D-04 (Meal plan integration coverage)**: Consolidate `apps/service/src/meal-plan.integration.test.ts` to ensure full coverage of custom meal plan entry creation, deleted recipe coexistence, and transactional week list addition with advisory locking.

### Playwright E2E Test Suite (TEST-03)
- **D-05 (Deals pricing display E2E)**: Create `e2e/tests/22-deals-pricing-display.spec.ts` testing deal card presentation of sale price, strikethrough regular price, and discount percent-off badge using seeded favorite-store groceries across light and dark themes.
- **D-06 (Barcode scanner E2E)**: Create `e2e/tests/23-barcode-scanning.spec.ts` testing the barcode scanning sheet in a shopping list:
  - Open scanner dialog from list screen.
  - Exercise manual barcode text entry tab with seeded test barcode.
  - Verify scanned item is added to the shopping list with resolved title and brand.
  - Verify scanning an item in shop mode marks it as `bought`.
- **D-07 (Flexible meal planning E2E)**: Create `e2e/tests/24-flexible-meal-planning.spec.ts`:
  - Open week planner screen.
  - Place a custom standalone item ("Greek Yogurt") using Quick Item tab and suggestion chips.
  - Verify custom item appears on planner grid in primary text with bullet indicator.
  - Use overflow menu "Add to list" to transfer custom item to "This Week" list.
  - Verify success toast and item presence in shopping list.

</decisions>

<code_context>
## Existing Code Insights

- `apps/service/src/deals/price/parse-price.ts` & `parsers.ts`: Deal price parsing engine.
- `apps/service/src/deals/price/parse-price.test.ts`: Pricing engine unit tests.
- `apps/service/src/services/barcodes.ts` & `routes/barcodes.ts`: Open Food Facts proxy service and routes.
- `apps/service/src/meal-plan.integration.test.ts`: Meal plan service integration test.
- `e2e/tests/09-search-deals-and-add-to-list.spec.ts`: Existing deals search E2E test.
- `e2e/tests/10-realtime-list-sync.spec.ts`: List item operations E2E test.
- `e2e/support/app.ts`: Playwright test helpers (`signIn`, `openList`, `expectDashboard`).
- `e2e/support/axe.ts`: Accessibility testing helper (`expectAccessible`).

</code_context>

