# Pitfalls Research

**Domain:** Grocery Deals, Barcode Scanning & Kitchen Management PWA
**Researched:** 2026-11-08
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Incomplete CSP and PWA Service Worker Whitelist for Images

**What goes wrong:**
Even when component code renders an image `<img src="...">`, the browser or service worker blocks it, resulting in broken image icons across all store and item cards.

**Why it happens:**
Content Security Policy (`img-src`) in Caddy and origin checks in `apps/web/src/screens/deals/DealImage.tsx` were hardcoded to only `https://f.wishabi.net` and `https://images.wishabi.net`. Modern Flipp infrastructure also serves assets from `*.flipp.com`, `flipp-image-retrieval.flipp.com`, and `*.wishabi.com`. Furthermore, the PWA service worker fetch handler only intercepts and caches the two original domains.

**How to avoid:**
1. Update Caddyfile `img-src` directive to include `https://*.wishabi.net`, `https://*.wishabi.com`, `https://*.flipp.com`, `https://flipp-image-retrieval.flipp.com`, and Open Food Facts image hosts (`https://*.openfoodfacts.org`).
2. Update `ALLOWED_IMAGE_ORIGINS` in `DealImage.tsx`.
3. Update service worker image caching rule in `apps/web/src/sw.ts`.

**Warning signs:**
`deal-image-placeholder` or browser console errors (`Refused to load the image ... because it violates the following Content Security Policy directive`).

**Phase to address:**
Phase 12 (Store & Deal Image Delivery).

---

### Pitfall 2: Sequential Rate-Limited HTTP Loops in Deal Ingestion

**What goes wrong:**
When a user registers or requests deals for a new postal code, the server attempts to fetch item details sequentially for hundreds of items with a 500ms delay per request. A flyer with 200 items takes over 100 seconds, and 8 store flyers take over 13 minutes. Meanwhile, the client poll times out after ~3 minutes, making deals appear completely broken or permanently stalled.

**Why it happens:**
`listFlyerItems` iterates over every item in the flyer roster and calls `/flipp/items/{id}` one by one through a serialized single-item queue.

**How to avoid:**
1. Leverage the flyer search endpoint or parse available roster pricing when sufficient.
2. Introduce controlled concurrency (e.g. 3-5 concurrent workers) within Flipp's rate limits instead of strict single-item sequential processing.
3. Cache flyer rosters and prioritize deals that users actually care about or search for.

**Warning signs:**
Background refresh jobs taking 15+ minutes, UI polling reaching `MAX_ATTEMPTS` (10) and displaying retry prompts.

**Phase to address:**
Phase 13 (Deal Pricing Math & Ingestion Performance).

---

### Pitfall 3: Blocking User Workflows on External Barcode API Availability

**What goes wrong:**
If Open Food Facts API is slow, experiencing downtime, or rate-limiting requests, barcode scanning hangs or fails to add the product to the grocery list.

**Why it happens:**
Treating the external barcode lookup as a mandatory blocking prerequisite for creating an item on the shopping list.

**How to avoid:**
1. Always implement a timeout (e.g. 3-4s) on the Open Food Facts lookup.
2. If the lookup times out or fails (or the barcode is unknown), prompt the user with a quick input: "Unknown barcode: enter item name" and immediately add it.
3. Cache all scanned barcodes locally in the Postgres database so repeat scans never query the external API.

**Warning signs:**
Spinning loader when scanning in a supermarket with poor cell signal.

**Phase to address:**
Phase 14 (Barcode Scanning & Grocery List Integration).

---

### Pitfall 4: Broken Database Foreign Key Constraints on Meal Plans

**What goes wrong:**
Adding an individual food item (banana, yogurt) fails with database constraint violations because the schema enforces `recipe_id UUID NOT NULL REFERENCES recipe(id)`.

**Why it happens:**
The initial schema assumed all meal plan entries come from full recipe records.

**How to avoid:**
1. Create an append-only forward migration making `recipe_id` nullable and adding a `custom_title VARCHAR(255)` column.
2. Add a check constraint: `CONSTRAINT meal_plan_entry_has_title_or_recipe CHECK ((recipe_id IS NOT NULL) OR (custom_title IS NOT NULL))`.
3. Update shared Zod schemas (`mealPlanEntrySchema`, `createMealPlanEntryRequestSchema`) to support both formats.

**Warning signs:**
Postgres 500 errors on `POST /api/households/:id/meal-plan` when omitting `recipeId`.

**Phase to address:**
Phase 15 (Flexible Meal Planning & Custom Items).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Calling Open Food Facts directly from frontend | Avoids writing backend proxy and migration | Leaks client IP, blocked by CORS/User-Agent, no shared household cache | Never |
| Generating 1-ingredient dummy recipes for bananas/yogurt | No database migration needed | Pollutes recipe library and messes up recipe recommendations | Never |
| Hardcoding external image CDNs without wildcard or domain patterns | Quick fix for one test image | Breaks as soon as Flipp adds another image bucket or CDN region | Never |

## "Looks Done But Isn't" Checklist

- [ ] **Barcode Scanner:** Works in desktop Chrome with webcam — verify it also works on mobile iOS Safari (requires camera permissions & HTTPS) and handles permission rejection gracefully.
- [ ] **Deal Images:** Works with seed data — verify against live Flipp image URLs across all supported store merchants.
- [ ] **Sale Price Calculation:** Displays "50% off" on clean inputs — verify strange flyer copy ("Buy 2 get $1 off", "Must buy 3", "2/$6") produces correct mathematical unit pricing and regular price display.
- [ ] **Barcode Mark as Bought:** Works when list item was created via barcode scan — verify it also correctly matches items added manually by name when scanned.

---
*Pitfalls research for: Grocery Deals, Barcode Scanning & Kitchen Management*
*Researched: 2026-11-08*
