# Roadmap: Hestia

## Milestones

- ✅ **[v1.0 Hearth — Cleanup and Hardening](milestones/v1.0/ROADMAP.md)** — Phases 1-6 (shipped 2026-10-25)
- ✅ **[v2.0 Hestia — Domain Migration and Rebrand](milestones/v2.0-ROADMAP.md)** — Phases 7-11 (shipped 2026-11-02)
- 🚧 **v2.1 Grocery & Deals Intelligence** — Phases 12-16 (in progress)

## Phases

<details>
<summary>✅ v1.0 Hearth — Cleanup and Hardening (Phases 1-6) — SHIPPED 2026-10-25</summary>

- [x] Phase 1: Published History & Branch Policy (5/5 plans) — completed 2026-10-24
- [x] Phase 2: Test Suite Determinism & Lint Fencing (8/8 plans) — completed 2026-10-24
- [x] Phase 3: Dead Code & Redundancy Reduction (12/12 plans) — completed 2026-10-24
- [x] Phase 4: Bug Fixes & Security Hardening (10/10 plans) — completed 2026-10-25
- [x] Phase 5: CI/CD Pipeline & Tooling Consolidation (8/8 plans) — completed 2026-10-25
- [x] Phase 6: Code Quality Gates & Ratchet Enforcement (17/17 plans) — completed 2026-10-25

</details>

<details>
<summary>✅ v2.0 Hestia — Domain Migration and Rebrand (Phases 7-11) — SHIPPED 2026-11-02</summary>

- [x] Phase 7: Planning Cleanup & Documentation Restructure (4/4 plans) — completed 2026-10-25
- [x] Phase 8: Full Rebrand to Hestia (7/7 plans) — completed 2026-10-26
- [x] Phase 9: Domain & Network Migration (Cloudflare Tunnel & Ingress) (5/5 plans) — completed 2026-11-01
- [x] Phase 10: Magic Links & Transactional Email (3/3 plans) — completed 2026-11-01
- [x] Phase 11: Web Push & Edge Hardening (4/4 plans) — completed 2026-11-02

</details>

### 🚧 v2.1 Grocery & Deals Intelligence (In Progress)

**Milestone Goal:** Overhaul the grocery and deals experience with reliable image delivery, intelligent pricing & discount computation, high-performance deal syncing, barcode scanning for grocery list management, flexible meal planning with standalone items, and robust real-world test coverage.

- [ ] **Phase 12: Store & Deal Image Delivery** - Unblock modern Flipp CDNs and Open Food Facts images across Caddy CSP, Service Worker, and PWA components.
- [ ] **Phase 13: Deal Pricing Engine & Ingestion Performance** - Display prominent sale prices, % off badges, and original prices while eliminating 15+ minute deal sync delays.
- [ ] **Phase 14: Barcode Scanning & Grocery List Integration** - Camera-based scanner with Open Food Facts lookup to add and mark items bought in grocery lists.
- [ ] **Phase 15: Flexible Meal Planning (Custom Items & Recipes)** - Support standalone food items (banana, yogurt) directly on the meal planner alongside recipes.
- [ ] **Phase 16: Verification & Real-World Test Hardening** - Comprehensive unit, integration, and Playwright E2E verification of real-world grocery workflows.

## Phase Details

### Phase 12: Store & Deal Image Delivery

**Goal**: Allow modern Flipp image CDNs and Open Food Facts image hosts across Caddy ingress, PWA Service Worker caching, and React components so store logos and deal product images render reliably without broken placeholders.
**Depends on**: Phase 11 (previous milestone)
**Requirements**: IMG-01, IMG-02, IMG-03
**Success Criteria** (what must be TRUE):
  1. Caddy `Content-Security-Policy` `img-src` header permits `*.flipp.com`, `flipp-image-retrieval.flipp.com`, `*.wishabi.com`, `*.wishabi.net`, and Open Food Facts image hosts without browser violations.
  2. PWA Service Worker intercepts and caches images from all permitted image origins cache-first with quota management.
  3. `DealImage` component and store logo views accept URLs from all allowed origins without falling back to placeholder icons.

**Plans**: TBD
- [x] 12-01-PLAN.md
- [ ] 12-02-PLAN.md

### Phase 13: Deal Pricing Engine & Ingestion Performance

**Goal**: Calculate and display primary sale price, savings percentage badges, and secondary regular prices from complex flyer text, and accelerate the deal ingestion pipeline to prevent 15+ minute stalls.
**Depends on**: Phase 12
**Requirements**: DEAL-01, DEAL-02, DEAL-03
**Success Criteria** (what must be TRUE):
  1. Deal cards show primary sale price, a discount badge (e.g. "-25%"), and strikethrough original/regular price secondary.
  2. Pricing engine mathematically parses complex flyer sale stories (e.g. "save $1.50 on 2", "2/$6.00") into correct unit price, regular price, and discount percentage when not explicitly provided.
  3. Background deal ingestion for active postal codes completes within 2 minutes instead of 15+ minutes, and new accounts see deals populate without polling timeouts.

**Plans**: TBD

### Phase 14: Barcode Scanning & Grocery List Integration

**Goal**: Provide a responsive camera barcode scanner with manual fallback in grocery lists, resolving products via Open Food Facts to add items and mark existing list items as purchased.
**Depends on**: Phase 13
**Requirements**: SCAN-01, SCAN-02, SCAN-03, SCAN-04
**Success Criteria** (what must be TRUE):
  1. User can open a camera barcode scanner modal within a shopping list (using standard `BarcodeDetector` API with WASM polyfill fallback) or type a barcode manually.
  2. Service resolves scanned barcodes via Open Food Facts v3 API with compliant User-Agent headers, caching results in Postgres and prompting for manual item name on cache/lookup miss.
  3. Scanning an item's barcode in a list automatically creates a new grocery item with the resolved name and brand.
  4. Scanning an item's barcode while shopping marks the corresponding item in the active list as `bought`.

**Plans**: TBD

### Phase 15: Flexible Meal Planning (Custom Items & Recipes)

**Goal**: Support standalone food items (e.g. banana, yogurt, snack) directly on the meal planner alongside existing recipes without requiring fake 1-ingredient recipe creation.
**Depends on**: Phase 14
**Requirements**: MEAL-01, MEAL-02, MEAL-03
**Success Criteria** (what must be TRUE):
  1. Database migration relaxes `meal_plan_entry.recipe_id NOT NULL` to allow standalone custom items with `custom_title`.
  2. User can add standalone custom food items to breakfast, lunch, or dinner slots on the meal planner via a dedicated quick-entry sheet.
  3. Placed custom food items appear cleanly on the planner grid alongside recipes and can be added directly to shopping lists via "Add to list".

**Plans**: TBD

### Phase 16: Verification & Real-World Test Hardening

**Goal**: Validate all new grocery, deal, and meal planning features with thorough unit tests, service integration tests, and Playwright E2E suites testing real-world data and user flows.
**Depends on**: Phase 15
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. Unit tests pass for deal pricing calculations across varied sale story patterns, discount badges, and edge cases.
  2. Service integration tests verify Open Food Facts proxy caching, error resilience, and custom meal plan entry lifecycle.
  3. Playwright E2E tests verify deal price/badge rendering, camera/manual barcode scanning flows (with mocked media stream and code injection), and custom meal item placement.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 12 → 13 → 14 → 15 → 16

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 12. Store & Deal Image Delivery | v2.1 | 1/2 | In Progress | - |
| 13. Deal Pricing Engine & Ingestion Performance | v2.1 | 0/TBD | Not started | - |
| 14. Barcode Scanning & Grocery List Integration | v2.1 | 0/TBD | Not started | - |
| 15. Flexible Meal Planning (Custom Items & Recipes) | v2.1 | 0/TBD | Not started | - |
| 16. Verification & Real-World Test Hardening | v2.1 | 0/TBD | Not started | - |
