---
phase: "16"
slug: "verification-real-world-test-hardening"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-10"
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.1 (unit/integration) / Playwright 1.58.2 (E2E) |
| **Config file** | `apps/service/vitest.config.ts`, `apps/service/vitest.integration.config.ts`, `apps/web/vite.config.ts`, `e2e/playwright.config.ts` |
| **Quick run command** | `pnpm --filter @hestia/service test src/deals/price/parse-price.test.ts && pnpm --filter @hestia/web test src/screens/deals/deal-card.test.tsx` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run focused test command for the modified suite
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | TEST-01 | — | Mathematical pricing calculations (multi-buy, bogo, weight rounding, negative discount guardrails) | unit | `pnpm --filter @hestia/service test src/deals/price/parse-price.test.ts` | ✅ | ⬜ pending |
| 16-01-02 | 01 | 1 | TEST-01 | — | PWA deal card sale, strikethrough original, and discount badge display | unit | `pnpm --filter @hestia/web test src/screens/deals/deal-card.test.tsx` | ✅ | ⬜ pending |
| 16-02-01 | 02 | 2 | TEST-02 | — | Open Food Facts proxy caching, rate limit resilience, and timeout handling | integration | `pnpm --filter @hestia/service test src/barcodes.integration.test.ts` | ❌ W0 | ⬜ pending |
| 16-02-02 | 02 | 2 | TEST-02 | — | Custom meal entry persistence, deleted recipe snapshot, and advisory locking | integration | `pnpm --filter @hestia/service test src/meal-plan.integration.test.ts` | ✅ | ⬜ pending |
| 16-03-01 | 03 | 3 | TEST-03 | — | Deals pricing and discount badge display in light/dark themes | e2e | `pnpm --filter @hestia/e2e test tests/22-deals-pricing-display.spec.ts` | ❌ W0 | ⬜ pending |
| 16-03-02 | 03 | 3 | TEST-03 | — | Barcode scanner sheet manual entry, add to list, and shop check-off | e2e | `pnpm --filter @hestia/e2e test tests/23-barcode-scanning.spec.ts` | ❌ W0 | ⬜ pending |
| 16-03-03 | 03 | 3 | TEST-03 | — | Flexible meal planning Quick Item placement and list transfer | e2e | `pnpm --filter @hestia/e2e test tests/24-flexible-meal-planning.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/service/src/barcodes.integration.test.ts` — integration test suite for OFF proxy caching and resilience
- [ ] `e2e/tests/22-deals-pricing-display.spec.ts` — E2E suite for deal pricing card display
- [ ] `e2e/tests/23-barcode-scanning.spec.ts` — E2E suite for barcode scanning and check-off
- [ ] `e2e/tests/24-flexible-meal-planning.spec.ts` — E2E suite for custom meal item placement and list transfer

---

## Manual-Only Verifications

None. All Phase 16 verifications are automated via Vitest and Playwright.

