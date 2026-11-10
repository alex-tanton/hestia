---
phase: 16-verification-real-world-test-hardening
plan: "01"
subsystem: test
tags:
  - pricing-math
  - deal-card
  - vitest
  - unit-testing
requires:
  - phase: 13-deal-pricing-engine-ingestion-performance
    provides: Deal pricing parsing engine and display components
provides:
  - Hardened unit tests for mathematical pricing rules and edge cases
  - Guardrails verification for negative discounts, case pricing OCR spikes, and discount caps
  - DealCard visual presentation and screen reader announcement tests
affects:
  - service
  - web
  - deals
actuals:
  tokens: 38000
  tasks: 3
  commits: 1
tech-stack:
  added: []
  patterns:
    - Pure unit test suites verifying integer cents rounding without float drift
    - Accessibility sentence verification for structured pricing announcements
key-files:
  modified:
    - apps/service/src/deals/price/parse-price.test.ts
    - apps/web/src/screens/deals/deal-card.test.tsx
key-decisions:
  - "D-01: Multi-buy, Buy-N-Get-M, minimum quantity, and boundary value pricing unit test hardening"
  - "D-02: DealCard presentation with sale price, strikethrough original, discount badge, and single accessible sentence"
requirements-completed:
  - TEST-01
duration: 10 min
completed: 2026-11-10
status: complete
---

# Phase 16 Plan 01: Unit Test Hardening Summary

**Hardened mathematical pricing derivation unit tests in the Fastify service and deal card presentation tests in the PWA frontend.**

## Accomplishments

- Expanded `apps/service/src/deals/price/parse-price.test.ts` with 13 comprehensive edge case tests:
  - Multi-buy promotions with dollar discount amounts ("2/$6.00 with $1.50 off on 2" -> $3.00 unit, $3.75 regular, 20% off).
  - Multi-buy cent divisions and half-up rounding ("4 for $5.00", "3 for $10.00").
  - Buy-N-Get-M derivations ("Buy 2 Get 1 Free", "Buy 1 Get 2 Free") and partial discount skipping.
  - Minimum purchase quantity thresholds and clean per-pound pricing.
  - Boundary guardrails: regular price <= sale price (negative or zero discount), 10x case price OCR drops (original >= 10x unit price), and discount caps (>95%).
  - Qualifiers for digital coupons and loyalty cards.
- Expanded `apps/web/src/screens/deals/deal-card.test.tsx` with companion tracer tests:
  - Verified primary sale price renders with `.text-section` styling.
  - Verified strikethrough regular price renders with `.line-through` and `.text-muted`.
  - Verified inline discount badge renders `-20%`.
  - Verified article accessibility name announces merchant, product, sale price, original price, and qualifiers as a single accessible sentence.

## Task Commits

1. **Task 16-01-01, 16-01-02, 16-01-03: Hardened pricing math and presentation unit tests (TEST-01, D-01, D-02)** - `test(service)`

## Files Modified

- `apps/service/src/deals/price/parse-price.test.ts` - Pricing derivation and boundary guardrail unit tests
- `apps/web/src/screens/deals/deal-card.test.tsx` - DealCard presentation and accessibility unit tests

