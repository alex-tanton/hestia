---
phase: "12"
slug: "store-deal-image-delivery"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-09"
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.1 |
| **Config file** | `vitest.config.ts` / `packages/shared/package.json`, `apps/web/package.json` |
| **Quick run command** | `pnpm --filter @hestia/shared test && pnpm --filter @hestia/web test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~10-15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @hestia/shared test && pnpm --filter @hestia/web test`
- **After every plan wave:** Run `pnpm typecheck && pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 0 | IMG-03 | T-12-01 | Rejects attacker-flipp.com and http:// URLs | unit | `pnpm --filter @hestia/shared test src/images.test.ts` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | IMG-03 | T-12-01 | Validates HTTPS Flipp/Wishabi/OpenFoodFacts subdomains | unit | `pnpm --filter @hestia/shared test src/images.test.ts` | ❌ W0 | ⬜ pending |
| 12-01-03 | 01 | 1 | IMG-01 | T-12-02 | CSP img-src includes wildcard Flipp and Open Food Facts CDNs | E2E | `pnpm --filter @hestia/e2e test:e2e tests/20-ingress-client-ip-and-csp.spec.ts` | ✅ | ⬜ pending |
| 12-02-01 | 02 | 1 | IMG-02 | T-12-03 | Workbox route matches all allowed CDN domains with CacheFirst and statuses [0, 200] | unit | `pnpm --filter @hestia/web test src/sw.test.ts` | ✅ | ⬜ pending |
| 12-02-02 | 02 | 1 | IMG-03 | T-12-04 | DealImage renders image for allowed origins, placeholder for null/failed/invalid | component | `pnpm --filter @hestia/web test src/screens/deals/DealImage.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/shared/src/images.test.ts` — stubs for IMG-03 validator positive/negative cases
- [ ] `apps/web/src/screens/deals/DealImage.test.tsx` — component test stubs for DealImage placeholder & allowed URL rendering

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual rendering of real flyer images in browser | IMG-01, IMG-02, IMG-03 | Real external network CDN fetching and visual confirmation in browser UI | Open PWA Deals tab, verify flyer thumbnails and store logos load without placeholders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending 2026-11-09

