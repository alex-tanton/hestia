---
phase: 16-verification-real-world-test-hardening
plan: "03"
subsystem: test
tags:
  - playwright
  - e2e-testing
  - accessibility
  - axe-core
  - deal-card
  - barcode-scanner
  - flexible-meals
requires:
  - phase: 13-deal-pricing-engine-ingestion-performance
    provides: Deal pricing and display
  - phase: 14-barcode-scanning-grocery-list-integration
    provides: Barcode scanner sheet and check-off
  - phase: 15-flexible-meal-planning-custom-items-recipes
    provides: Custom item meal planning and list transfer
provides:
  - Pre-warmed queries and barcode data in e2e-seed.sql for zero-egress execution
  - Playwright E2E journey 22 testing deal pricing and discount badge display across themes
  - Playwright E2E journey 23 testing barcode scanner dialog, metadata resolution, add to list, and shop check-off
  - Playwright E2E journey 24 testing flexible meal planning custom item placement, suggestion chips, and list transfer
  - WCAG 2.1 AA automated accessibility verification across all new user flows in both light and dark themes
affects:
  - e2e
actuals:
  tokens: 45000
  tasks: 3
  commits: 1
tech-stack:
  added: []
  patterns:
    - Pre-warmed database cache seeds preventing outbound network calls
    - Multi-theme Playwright parameterized test fixtures with axe-core audits
key-files:
  created:
    - e2e/tests/22-deals-pricing-display.spec.ts
    - e2e/tests/23-barcode-scanning.spec.ts
    - e2e/tests/24-flexible-meal-planning.spec.ts
  modified:
    - e2e/fixtures/e2e-seed.sql
    - e2e/tests/17-accessibility-states.spec.ts
key-decisions:
  - "D-05: Pre-warm deal_query_cache in e2e-seed.sql for 'pure pumpkin' and 'stouffer' and barcode_products for '012345678905'"
  - "D-06: Journey 22 verifies deal sale price, strikethrough original price, and discount percentage badge across light and dark themes with expectAccessible"
  - "D-07: Journey 23 verifies barcode scanner sheet manual entry, metadata lookup, add to list, and shop check-off across themes"
  - "D-08: Journey 24 verifies Quick Item chip placement, grid display, and list transfer across themes"
requirements-completed:
  - TEST-03
duration: 15 min
completed: 2026-11-10
status: complete
---

# Phase 16 Plan 03: Playwright E2E Test Hardening Summary

**Implemented Playwright E2E test journeys for deal pricing presentation, barcode scanner sheet add and shop check-off, and flexible meal planning across light and dark themes with WCAG 2.1 AA accessibility audits.**

## Accomplishments

- Updated `e2e/fixtures/e2e-seed.sql` to pre-warm `deal_query_cache` for queries `'pure pumpkin'` and `'stouffer'`, and seeded `public.barcode_products` for barcode `'012345678905'` ('Organic Whole Milk', 'Horizon Organic', '1 gal') to guarantee zero outbound network calls (TEST-03, D-05).
- Created `e2e/tests/22-deals-pricing-display.spec.ts` (TEST-03, D-06):
  - Verified deal card presentation of primary sale price (`.text-section`), strikethrough original price (`.line-through`), and discount percentage badge (`-16%`, `-33%`) across light and dark themes.
  - Verified WCAG 2.1 AA accessibility via `expectAccessible(page, ...)` on all states.
- Created `e2e/tests/23-barcode-scanning.spec.ts` (TEST-03, D-07):
  - Verified opening barcode scanner dialog, switching to manual keypad entry, resolving product metadata for seeded barcode, and adding to shopping list.
  - Verified shop mode barcode entry finding the unbought item, executing check-off with toast confirmation, and moving the item to the Bought section.
  - Verified WCAG 2.1 AA accessibility on scanner dialog, keypad, ItemSheet, and shopping list in both themes.
- Created `e2e/tests/24-flexible-meal-planning.spec.ts` (TEST-03, D-08):
  - Verified opening MealPlacementSheet, switching to Quick Item tab, and placing 'Greek Yogurt' via suggestion chip.
  - Verified custom item rendering on the planner grid with primary styling and bullet indicator.
  - Verified overflow menu action 'Add to list', list picker confirmation, and transfer to 'This Week' shopping list.
  - Verified WCAG 2.1 AA accessibility on planner grid, placement sheet, overflow menu, and shopping list in both themes.

## Task Commits

1. **Task 16-03-01, 16-03-02, 16-03-03: Hardened deals, barcodes, and meal plan E2E tests (TEST-03, D-05, D-06, D-07, D-08)** - `test(e2e)` (Commit: `675c117`)

## Files Created / Modified

- `e2e/fixtures/e2e-seed.sql` - Pre-warmed deal search queries and barcode cache records
- `e2e/tests/22-deals-pricing-display.spec.ts` - Playwright E2E journey for deal pricing presentation
- `e2e/tests/23-barcode-scanning.spec.ts` - Playwright E2E journey for barcode scanner add and check-off
- `e2e/tests/24-flexible-meal-planning.spec.ts` - Playwright E2E journey for flexible meal planning custom items
- `e2e/tests/17-accessibility-states.spec.ts` - Updated placement dialog selector title to match current implementation
