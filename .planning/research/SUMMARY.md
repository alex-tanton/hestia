# Project Research Summary

**Project:** Hestia — Household Management PWA
**Domain:** Grocery Deals, Barcode Scanning & Kitchen Management PWA
**Researched:** 2026-11-08
**Confidence:** HIGH

## Executive Summary

Milestone v2.1 tackles core quality and functional enhancements across Hestia's grocery deals, shopping lists, and meal planning pillars. The previous milestone established high-availability ingress via Cloudflare Tunnel (`hestia.aberrance.app`), unified rebranding, and mobile Web Push. However, everyday household usage revealed three major friction points: missing store/item images caused by overly restrictive Content Security Policies and image origin checks; extreme deal parsing latencies (15+ minutes) caused by sequential single-item flyer fetching; and rigid meal planning that forced every meal to be a complete recipe.

In addition, users requested native barcode scanning directly within grocery shopping lists to streamline both adding items from the kitchen pantry and marking items as purchased in-store.

Based on our architectural and ecosystem research, these capabilities can be cleanly implemented within Hestia's existing Fastify/React/Postgres stack:
1. Modernizing image delivery across Caddy, the PWA Service Worker, and web components to support current Flipp image CDN hosts (`*.flipp.com`, `flipp-image-retrieval.flipp.com`, `*.wishabi.net`, `*.wishabi.com`).
2. Enhancing deal pricing algorithms to calculate and display prominent sale prices, percent-off badges, and secondary regular prices from complex flyer sale stories, while streamlining the background deal ingestion pipeline.
3. Integrating hardware-accelerated camera barcode scanning using the W3C `BarcodeDetector` API (with a WebAssembly ZXing fallback) paired with a server-cached Open Food Facts v3 integration.
4. Expanding meal planner schemas to natively support standalone food items (e.g., banana, yogurt) alongside existing recipes.
5. Solidifying test coverage with automated Playwright and integration suites testing real-world deal data and scan journeys.

## Key Findings

### Recommended Stack

- **Client Scanning:** Native `BarcodeDetector` API with `barcode-detector` (ZXing WASM) polyfill for universal cross-browser camera barcode scanning without heavy vendor lock-in.
- **Product Identification:** Open Food Facts API v3 queried server-side with a compliant custom `User-Agent` and cached locally in Postgres to avoid client rate-limiting.
- **Image Delivery:** Expanded CSP `img-src` in Caddy, Service Worker routing, and component allowlists covering modern Flipp and Open Food Facts CDNs.

### Expected Features

**Must have (table stakes):**
- Fix missing store logo and item deal images across all views.
- Display primary sale price, savings percentage badge, and secondary regular price on deals.
- Fast deal ingestion and refresh without 15-minute stalls.
- Camera barcode scanning to add items to grocery lists with Open Food Facts auto-naming.
- Barcode scanning to mark items as purchased in active grocery lists.
- Standalone custom items on the meal planner without requiring a recipe.
- End-to-end integration and verification tests reflecting real-world usage.

**Should have (competitive):**
- Smart mathematical deduction of regular price from complex flyer text (e.g. "Save $1.50 on 2").
- Household-level barcode memory so custom product renames persist for future scans.
- Manual barcode number entry modal fallback for low-light or damaged barcode situations.

### Architecture Approach

- **Gateway / Ingress:** Caddy Content-Security-Policy updated to allow image sources from Flipp and Open Food Facts.
- **Fastify Service:** Adds `/api/barcodes/:barcode` proxy endpoint with caching; optimizes `FlippDealSource` request queue.
- **Shared Schemas:** Updates `mealPlanEntrySchema` to make `recipeId` nullable and introduce `customTitle`. Adds barcode resolution contracts.
- **Web PWA:** Introduces reusable `BarcodeScannerModal` with video stream detection and manual input tabs.

### Critical Pitfalls

1. **Incomplete CSP / Service Worker Whitelisting:** Fixing the UI component without updating Caddy and the Service Worker still causes browser blocking. All three layers must be updated in sync.
2. **Sequential 500ms HTTP Loops in Flyer Processing:** Fetching 200 items individually through a serialized 500ms queue creates 15+ minute delays. The pipeline must leverage flyer roster data, batching, and targeted requests.
3. **Blocking on External Barcode APIs:** Never block the user if Open Food Facts is slow or offline; always provide immediate manual naming fallback.
4. **Database Constraints on Meal Plans:** Schema migrations must forward-only relax `recipe_id NOT NULL` to support custom items cleanly.

## Implications for Roadmap

Suggested phase structure for Milestone v2.1:

### Phase 12: Store & Deal Image Delivery
**Rationale:** Immediate, high-impact fix resolving user frustration with broken images across the application.
**Delivers:** Comprehensive updates to Caddy CSP, Service Worker image caching, and `DealImage.tsx` origin allowlists covering modern Flipp and Open Food Facts CDNs.
**Addresses:** Fix missing store and item images.

### Phase 13: Deal Pricing Engine & Ingestion Performance
**Rationale:** Fixes the 15+ minute deal parsing stalls and implements the requested original price, percent-off badges, and mathematical savings calculations.
**Delivers:** Deal pricing calculation engine (handling sale stories and set pricing), optimized Flipp request processing, and updated DealCard UI.
**Addresses:** Original price and percent-off display; deal ingestion speed.

### Phase 14: Barcode Scanning & Grocery List Integration
**Rationale:** Introduces the barcode scanning infrastructure (camera + WASM fallback + manual entry) and connects it to Open Food Facts and grocery lists.
**Delivers:** `BarcodeScannerModal`, Open Food Facts service proxy with Postgres caching, "Scan to Add to List", and "Scan to Mark Purchased".
**Addresses:** Barcode scanning features for shopping lists.

### Phase 15: Flexible Meal Planning (Custom Items & Recipes)
**Rationale:** Upgrades the meal planning schema and UI to treat standalone food items (banana, yogurt) as first-class citizens alongside recipes.
**Delivers:** Database migration for `meal_plan_entry` (`recipe_id` nullable, `custom_title`), updated API contracts, and new planner UI for placing individual items.
**Addresses:** Non-recipe meal planning.

### Phase 16: Verification & Real-World Test Hardening
**Rationale:** Verifies the complete milestone end-to-end under real-world conditions with automated tests.
**Delivers:** Playwright E2E tests for barcode scanning flows, deal pricing accuracy tests, and verification audit.
**Addresses:** Improving test coverage and real use-case testing.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Standard W3C `BarcodeDetector`, Open Food Facts v3 REST API, and established Fastify/React patterns. |
| Features | HIGH | Directly addresses all user requirements with clear functional boundaries. |
| Architecture | HIGH | Seamlessly integrates into existing monorepo structure with forward-only migrations. |
| Pitfalls | HIGH | Root causes of image blockage and deal ingestion delays are identified with exact file locations. |

**Overall confidence:** HIGH

### Sources

- Official W3C Barcode Detection API Specification
- Open Food Facts API v3 Documentation (`world.openfoodfacts.org`)
- Flipp CDN Network Analysis (`backflipp.wishabi.com`, `f.wishabi.net`, `flipp.com`)
- Hestia Monorepo Analysis (`apps/service`, `apps/web`, `docker/Caddyfile`)

---
*Research completed: 2026-11-08*
*Ready for roadmap: yes*
