# Feature Research

**Domain:** Grocery Deals, Barcode Scanning & Kitchen Management PWA
**Researched:** 2026-11-08
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Store & Deal Image Display | Broken image icons make deals look unappealing, broken, or suspect | LOW | Update Caddy CSP, PWA Service Worker caching, and `DealImage.tsx` allowlists to support `*.wishabi.net`, `*.wishabi.com`, and `*.flipp.com` / `flipp-image-retrieval.flipp.com`. |
| Original Price & Discount Display | Shoppers want to know how good a deal is and how much they are saving | MEDIUM | Display sale price primary, percent-off badge (e.g. "-25%"), and strikethrough original/regular price secondary. Calculate missing original price from savings clauses (e.g. "save $1.50 on 2"). |
| Responsive Deal Ingestion | Deal lists must show up quickly after account creation and location setup | HIGH | Optimize the deal refresh pipeline so users do not experience 15+ minute waits or dropped refresh polls. |
| Barcode Scan to Add to List | Fast pantry restocking by scanning empty cereal boxes, milk cartons, etc. | MEDIUM | Camera viewfinder + manual code entry fallback. Resolves product title and brand via Open Food Facts API and adds to the active grocery list. |
| Barcode Scan to Mark Purchased | In-store shopping check-off by scanning items as they go into the physical cart | MEDIUM | Matches barcode or product title against items currently in the list and transitions status to `bought` (or `in_cart`). |
| Non-Recipe Meal Planning | Real households eat quick foods (e.g. bananas, yogurt, oatmeal, leftovers) that are not 10-step recipes | LOW | Support custom text/food items on the meal planner alongside existing recipe links, without forcing users to create fake recipes. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Intelligent Sale Story Math | Deciphers tricky flyer copy ("Buy 2 Get 1 Free", "Save $2.00 on 3", "2 for $5.00 with card") into clear unit prices and savings percentages | MEDIUM | Pure parsing rules in `@hestia/shared` or `@hestia/service` price calculation engine. |
| Instant Household Barcode Memory | When a barcode has been scanned once and named or edited by a household member, future scans use the household's custom name instantly | LOW | Store barcode-to-product mapping in household database table before falling back to Open Food Facts. |
| Hybrid Camera + Manual Barcode Input | Ensures scanning always succeeds even in low light, damaged barcode, or desktop browser | LOW | Simple modal sheet with camera stream view and quick numeric keypad / barcode text input. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Continuous Auto-Focus Camera Loop Without Manual Fallback | Seems frictionless | Drains battery, overheats mobile devices, and frustrates users when a barcode is crumpled or unreadable | Scans with camera and provides an immediate manual entry button or quick barcode number input. |
| Full Commercial Barcode Database Scraping | Wants offline barcode lookup for every product in the world | Gigabytes of data, rapidly stale, heavy storage requirements | On-demand service-side lookup to Open Food Facts with local caching of scanned items. |
| Forcing Standalone Meals to Create Dummy Recipes | Reuses recipe schema without database migration | Clutters recipe book with "Banana" and "Glass of Milk", degrading recipe search and recommendations | Make `recipeId` optional on `MealPlanEntry` with a direct `customTitle` field. |

## Feature Dependencies

```
[Store/Item Image CSP & Origin Fix] (Independent)
[Fast Deal Ingestion & Queue Optimization] (Independent)
[Deal Original Price Math & Badges] ──uses──> [Fast Deal Ingestion]

[Open Food Facts Service Proxy & Cache]
    └──requires──> [Household Barcode Memory DB]
                       └──requires──> [Barcode Scanner UI Component]
                                          ├──powers──> [Scan to Add to List]
                                          └──powers──> [Scan to Mark Bought]

[Non-Recipe Meal Planner Entries] (Independent schema & UI upgrade)
```

### Dependency Notes

- **Scan to Add and Scan to Mark Bought require Barcode Scanner Component & Service:** Both list scanning actions share the same camera scanner sheet, permission handling, and Open Food Facts resolution flow.
- **Deal Original Price Math benefits from Fast Ingestion:** Displaying rich pricing across all deals requires the refresh job to complete reliably and store complete deal records without timeouts.

## MVP Definition

### Launch With (v2.1)

- [x] Fix broken image display across deals and store flyers by allowing modern Flipp CDNs in Caddy CSP, Service Worker, and PWA components.
- [x] Compute and display regular price and percent-off badges alongside primary sale price on deal cards.
- [x] Accelerate deal synchronization and refresh jobs to eliminate the 15+ minute delay.
- [x] Camera barcode scanner with manual barcode fallback in grocery lists.
- [x] Open Food Facts lookup to auto-populate item name when scanning unknown barcodes.
- [x] Barcode scanning to automatically mark items as purchased in shopping lists.
- [x] Standalone non-recipe items on the meal planner (e.g., banana, yogurt).
- [x] Thorough unit, integration, and Playwright E2E tests covering barcode scanning, deal pricing, and meal items.

## Sources

- User feedback and feature request analysis (November 2026)
- Household grocery workflows (AnyList, OurGroceries, Flipp mobile app benchmarks)
- Open Food Facts database integration standards

---
*Feature research for: Grocery Deals, Barcode Scanning & Kitchen Management*
*Researched: 2026-11-08*

