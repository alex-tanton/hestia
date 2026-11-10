---
phase: 13-deal-pricing-engine-ingestion-performance
plan: "01"
subsystem: deals
tags:
  - pricing
  - flipp
  - math
  - discount
  - bundles
requirements-completed:
  - DEAL-02
status: complete
plan_head_before: b3efd54fbefcbedd1b4bae59d250a0f856d23e73
plan_head_after: f23e46e21e4dbac36430de9680bd4ba4e5a07af0
commits: 2
actuals:
  tokens: 6008
  tasks: 2
  commits: 2
---

# Phase 13 Plan 01: Pricing Engine Mathematical Derivation & Sanity Thresholds Summary

Derived unit and original prices with half-up discount rounding for multi-buy bundle savings, Buy-N-Get-M promotions, and minimum-quantity offers, backed by liberal 1%–95% sanity bounds.

## What Was Done

### Task 13-01-01: Half-Up Discount Percent & Liberal Sanity Filter (D-03, D-04)
- Updated `discountPercent` in `apps/service/src/deals/money.ts` to compute percentage discounts using standard half-up rounding (`Math.round`) and clamped valid discounts to the 1%–95% range.
- Updated `withoutImplausibleOriginal` in `apps/service/src/deals/price/parse-price.ts` to reject implausible original prices where `originalPrice <= unitPrice`, `originalPrice >= unitPrice * 10`, or discount > 95%, setting `originalPrice: null` and clearing `discountPercent`.
- Ensured `parsePrice` in `apps/service/src/deals/price/parse-price.ts` strictly outputs `null` for `discountPercent` whenever `originalPrice` is `null`.
- Added unit tests in `apps/service/src/deals/price/parse-price.test.ts` verifying half-up discount rounding (e.g. 475 against 949 yields 50%), OCR case price rejections, and edge boundaries.
- **Commit:** `47da1e3` (`feat(service): half-up discount percent and sanity bounds`)

### Task 13-01-02: Derive Pricing Math for Bundle Savings, Buy-N-Get-M, and Minimum Quantity (D-01, D-02)
- Upgraded `parseMultiBuy` in `apps/service/src/deals/price/parsers.ts` to inspect marketing text for dollar and cent savings phrases (e.g., "save $1.50 on 2", "save at least 98¢ on 2", "$1.50 off on 2"), computing `originalTotal = total + savings` and deriving `unitPrice`, `originalPrice`, and `discountPercent` across the bundle items.
- Upgraded `parseBuyNGetM` in `apps/service/src/deals/price/parsers.ts` to derive effective unit pricing when a base price is available (for both Buy-N-Get-M Free and Buy-N-Get-Amount-Off promotions), while preserving skips for partial BOGOs and missing base prices.
- Upgraded `parseMinimumQuantity` in `apps/service/src/deals/price/parsers.ts` to directly return shelf prices when available while deferring bundle offers (`2/$6.00 MUST BUY 2`) to `parseMultiBuy`.
- Expanded unit tests in `apps/service/src/deals/price/parse-price.test.ts` covering all promotion shapes and bundle edge cases.
- **Commit:** `f23e46e` (`feat(service): derive pricing math for bundles and promotions`)

## Decisions Made

- `feat(service)` commit scope used instead of `feat(deals)` due to closed commitlint scope enum `[web, service, shared, recurrence, matching, db, e2e, docker]`.
- Implemented bundle savings extraction in `parseMultiBuy` for both explicit "save" clauses and inline "off" clauses (e.g. "with $1.50 off on 2"), ensuring flyer marketing text accurately informs original price derivations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Scope/Commitlint Convention] Commit message scope adapted to commitlint rules**
- **Found during:** Task 13-01-01
- **Issue:** Commitlint hook rejected `feat(deals)` because the allowed scope enum is closed.
- **Fix:** Used `feat(service)` scope with concise summary <= 71 characters and detailed bullet body.
- **Files modified:** None (commit message adjustment).

## Self-Check: PASSED

- All 4 modified source files and test suites exist and pass.
- Commits `47da1e3` and `f23e46e` verified in git history.
