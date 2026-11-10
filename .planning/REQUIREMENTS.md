# Requirements: Milestone v2.1 — Grocery & Deals Intelligence

**Defined:** 2026-11-08
**Core Value:** Overhaul the grocery and deals experience with reliable image delivery, intelligent pricing & discount computation, high-performance deal syncing, barcode scanning for grocery list management, flexible meal planning with standalone items, and robust real-world test coverage.

## v2.1 Requirements

### Image Delivery

- [x] **IMG-01**: Caddy Content-Security-Policy `img-src` allows modern Flipp (`*.flipp.com`, `flipp-image-retrieval.flipp.com`, `*.wishabi.com`, `*.wishabi.net`) and Open Food Facts CDNs.
- [x] **IMG-02**: PWA Service Worker intercepts and caches deal images and merchant logos across all allowed Flipp and Open Food Facts domains.
- [x] **IMG-03**: `DealImage` component and merchant logo views permit modern Flipp and Open Food Facts origins, preventing broken placeholder fallbacks for valid images.

### Deal Pricing & Ingestion Performance

- [x] **DEAL-01**: Deal cards display sale price as primary, discount percent-off badge (e.g. "-25%"), and strikethrough original/regular price as secondary.
- [x] **DEAL-02**: Deal pricing engine parses complex flyer sale stories and pre/post price text (e.g., "save at least 98¢ on 2", "$1.50 off", "2/$6.00") to mathematically derive unit prices, original prices, and percent-off when not directly provided.
- [x] **DEAL-03**: Deal ingestion pipeline optimizes flyer processing (batching/concurrency and roster caching) to eliminate 15+ minute stalls for new accounts and active postal codes.

### Barcode Scanning & Grocery List Management

- [x] **SCAN-01**: PWA provides a camera barcode scanner modal using the standard `BarcodeDetector` API with WASM polyfill fallback, plus a manual barcode text entry tab.
- [x] **SCAN-02**: Fastify service proxies and caches barcode lookups against Open Food Facts API v3 using compliant User-Agent headers, falling back gracefully to manual item naming on misses or timeouts.
- [x] **SCAN-03**: User can scan a barcode from a shopping list to automatically populate the item name and add it to the list.
- [x] **SCAN-04**: User can scan a barcode from an active shopping list to automatically match the item and mark it as `bought`.

### Flexible Meal Planning

- [x] **MEAL-01**: Database migration relaxes `meal_plan_entry.recipe_id NOT NULL` to allow standalone custom items with `custom_title`.
- [x] **MEAL-02**: PWA meal planner provides a quick entry action to place standalone food items (e.g., banana, yogurt, snack) into any meal slot (breakfast, lunch, dinner).
- [x] **MEAL-03**: Standalone custom meal items can be added directly to shopping lists via existing "Add to list" actions.

### Test & Verification Hardening

- [x] **TEST-01**: Unit tests validate mathematical price and discount calculations across varied sale story scenarios and set pricing.
- [x] **TEST-02**: Service integration tests validate Open Food Facts proxy caching, rate limit resilience, and custom meal plan entry persistence.
- [x] **TEST-03**: Playwright E2E tests validate deal price/discount display, barcode scan to add/mark-bought flows (with mocked media/code input), and custom meal item placement.

## Future Requirements (Deferred)

### Advanced Barcode & Pantry Features

- **SCAN-05**: Barcode scanning directly to household pantry inventory with expiration date tracking.
- **SCAN-06**: Continuous multi-barcode scanning mode for rapid pantry auditing.

### Advanced Deal Features

- **DEAL-04**: Automated deal price history tracking to identify "all-time low" prices.
- **DEAL-05**: Cross-store deal price comparison for identical UPC/barcodes.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Commercial Barcode Database Subscriptions | Open Food Facts v3 provides a free, open-source dataset with over 3 million products; commercial databases (e.g. UPCItemDB premium) incur recurring operational costs. |
| Continuous Camera Feed in Background | Excessive battery drain and thermal throttling on mobile devices; camera feed is strictly scoped to the active scanner sheet modal. |
| Auto-generating dummy recipes for standalone meals | Pollutes recipe search, recommendation engine, and readiness algorithms; standalone meals are modeled directly in the meal plan schema. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| IMG-01 | Phase 12 | Complete |
| IMG-02 | Phase 12 | Complete |
| IMG-03 | Phase 12 | Complete |
| DEAL-01 | Phase 13 | Complete |
| DEAL-02 | Phase 13 | Complete |
| DEAL-03 | Phase 13 | Complete |
| SCAN-01 | Phase 14 | Complete |
| SCAN-02 | Phase 14 | Complete |
| SCAN-03 | Phase 14 | Complete |
| SCAN-04 | Phase 14 | Complete |
| MEAL-01 | Phase 15 | Complete |
| MEAL-02 | Phase 15 | Complete |
| MEAL-03 | Phase 15 | Complete |
| TEST-01 | Phase 16 | Complete |
| TEST-02 | Phase 16 | Complete |
| TEST-03 | Phase 16 | Complete |

**Coverage:**
- v2.1 requirements: 16 total
- Mapped to phases: 16
- Complete: 16/16 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-11-08*
*Last updated: 2026-11-10 after Phase 16 verification*
