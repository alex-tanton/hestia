# Phase 16: Verification & Real-World Test Hardening - Research

**Researched:** 2026-11-10
**Domain:** Unit, Integration, and Playwright E2E Test Hardening (Pricing Math, OFF Proxy, Meal Planning)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (Pricing rule edge cases)**: Expand `apps/service/src/deals/price/parse-price.test.ts` to exhaustively test complex multi-buy cases (e.g. "Buy 2 Get 1 Free", "4 for $5.00"), minimum quantity thresholds, per-weight unit price rounding, negative discount guardrails, and boundary values for original prices.
- **D-02 (PWA pricing presentation tests)**: Verify in `apps/web/src/screens/deals/deal-card.test.tsx` that primary sale prices, secondary strikethrough original prices, and badge discount percentages (e.g. `-25%`) calculate and render consistently without layout shift or text clipping.
- **D-03 (Barcode proxy integration)**: Create `apps/service/src/barcodes.integration.test.ts` against the real PostgreSQL test database:
  - Cache miss triggers mock Open Food Facts v3 upstream request and writes result to `barcode_product` table.
  - Subsequent requests for the same barcode resolve directly from database cache with 0 upstream calls.
  - Upstream 429 Too Many Requests or 503 Service Unavailable handles errors cleanly, returning 404 Problem Details without service crashes.
  - Malformed barcodes and lookup timeouts reject cleanly with RFC 9457 Problem Details.
- **D-04 (Meal plan integration coverage)**: Consolidate `apps/service/src/meal-plan.integration.test.ts` to ensure full coverage of custom meal plan entry creation, deleted recipe coexistence, and transactional week list addition with advisory locking.
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

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **TEST-01** | Unit tests validate mathematical price and discount calculations across varied sale story scenarios and set pricing. | Detailed test suites designed for `apps/service/src/deals/price/parse-price.test.ts` and `apps/web/src/screens/deals/deal-card.test.tsx` verifying multi-buy bundles, Buy-N-Get-M promotions, minimum quantities, negative discount guardrails, 10x case price drops, and visual presentation of strikethrough original prices and discount badges. |
| **TEST-02** | Service integration tests validate Open Food Facts proxy caching, rate limit resilience, and custom meal plan entry persistence. | Full integration test architecture for `apps/service/src/barcodes.integration.test.ts` (Postgres cache read/write, upstream 429/503 fallback, 404 Problem Details, and timeout resilience) and consolidated suites in `apps/service/src/meal-plan.integration.test.ts` (custom item lifecycle, deleted recipe snapshot coexistence, and advisory-locked concurrent week addition). |
| **TEST-03** | Playwright E2E tests validate deal price/discount display, barcode scan to add/mark-bought flows (with mocked media/code input), and custom meal item placement. | End-to-end specifications for `e2e/tests/22-deals-pricing-display.spec.ts`, `e2e/tests/23-barcode-scanning.spec.ts`, and `e2e/tests/24-flexible-meal-planning.spec.ts` using seed data, light/dark theme matrices, `signIn`, `expectDashboard`, and `expectAccessible` WCAG 2.1 AA audits. |
</phase_requirements>

---

## Architecture Patterns

### Pattern 1: Service Integration Testing with Mock Upstream Egress
Integration tests in `apps/service/src/*.integration.test.ts` run against a live PostgreSQL database running under `supabase start`. Upstream external HTTP services (Flipp, Open Food Facts) are mocked to ensure tests never make external network calls, run deterministically in < 5 seconds, and cleanly test error cases.
- Use `registerStackHooks()` from `./test/stack-hooks.js`.
- Intercept global `fetch` using `vi.stubGlobal('fetch', mockFetch)`.
- Use `as(app, user, 'GET', '/api/barcodes/...')` to execute requests through the entire Fastify routing, parsing, RLS, and error handling pipeline.

### Pattern 2: PWA Screen Unit Testing with Stubs
PWA tests in `apps/web/src/screens/**/*.test.tsx` use jsdom, React Testing Library, and Hestia's `stubFetch` harness.
- Render component using `renderScreen(<DealCard householdId={...} deal={...} />)`.
- Assert DOM structure using `@testing-library/jest-dom` matchers (`toBeInTheDocument()`, `toHaveClass()`, `toHaveAccessibleName()`).

### Pattern 3: Playwright E2E Journeys with Zero-Egress Caching
E2E tests run against the Compose stack through Caddy with real user authentication, seeded database records, and theme parameterization (`light` and `dark`).
- Parameterize over `for (const theme of ['light', 'dark'] as const)`.
- Pre-warm `deal_query_cache` in `e2e/fixtures/e2e-seed.sql` to avoid external Flipp calls.
- Use `signIn(page, SEED.alex.email)` and `expectDashboard(page, SEED.oakStreet.name)`.
- Settle animations and run `expectAccessible(page, ...)` on all visited screens.

---

## Validation Architecture

### Test Framework
- Framework: Vitest 5.0.1 (Service & Web) / Playwright 1.58.2 (E2E)
- Config file: `apps/service/vitest.config.ts`, `apps/service/vitest.integration.config.ts`, `apps/web/vite.config.ts`, `e2e/playwright.config.ts`
- Quick run command: `pnpm --filter @hestia/service test && pnpm --filter @hestia/web test`
- Full suite command: `pnpm test && pnpm --filter @hestia/service test:integration && pnpm test:e2e`

### Phase Requirements -> Test Map
- TEST-01: Mathematical pricing calculations & deal card presentation -> `apps/service/src/deals/price/parse-price.test.ts`, `apps/web/src/screens/deals/deal-card.test.tsx`
- TEST-02: Open Food Facts proxy caching & custom meal plan persistence -> `apps/service/src/barcodes.integration.test.ts`, `apps/service/src/meal-plan.integration.test.ts`
- TEST-03: E2E deal pricing display, barcode scanning, flexible meal planning -> `e2e/tests/22-deals-pricing-display.spec.ts`, `e2e/tests/23-barcode-scanning.spec.ts`, `e2e/tests/24-flexible-meal-planning.spec.ts`

