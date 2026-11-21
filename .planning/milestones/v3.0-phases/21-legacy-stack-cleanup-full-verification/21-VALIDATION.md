---
phase: "21"
slug: "legacy-stack-cleanup-full-verification"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-15"
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.1 (`unit` Node.js + `dom` jsdom) & Playwright 1.63.0 (E2E) |
| **Config file** | `apps/web/vite.config.ts` & `e2e/playwright.config.ts` |
| **Quick run command** | `pnpm --filter @hestia/web test` |
| **Full suite command** | `pnpm --filter @hestia/web test:coverage && pnpm test:e2e` |
| **Estimated runtime** | ~20 seconds (unit) / ~120 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @hestia/web test` or relevant test/verification script
- **After every plan wave:** Run `pnpm --filter @hestia/web test:coverage && pnpm typecheck && pnpm lint`
- **Before `/gsd-verify-work`:** Full suite must be green (`pnpm test:e2e` + CI ratchets)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | FND-05 | — | Strict CSP & zero unsafe-inline | Build / Lint | `pnpm --filter @hestia/web typecheck && pnpm --filter @hestia/web build` | ✅ Exists | ⬜ pending |
| 21-01-02 | 01 | 1 | FND-05 | — | N/A | Build / Hygiene | `node scripts/check-repo-hygiene.mjs` | ✅ Exists | ⬜ pending |
| 21-02-01 | 02 | 2 | VER-01 | — | N/A | unit / DOM | `pnpm --filter @hestia/web test` | ✅ Exists | ⬜ pending |
| 21-02-02 | 02 | 2 | VER-01 | — | N/A | Coverage | `pnpm --filter @hestia/web test:coverage` | ✅ Exists | ⬜ pending |
| 21-03-01 | 03 | 3 | VER-02 | — | N/A | E2E | `pnpm --filter @hestia/e2e exec playwright test tests/01-auth.spec.ts tests/02-navigation.spec.ts` | ✅ Exists | ⬜ pending |
| 21-03-02 | 03 | 3 | VER-02 | — | N/A | E2E | `pnpm test:e2e` | ✅ Exists | ⬜ pending |
| 21-04-01 | 04 | 4 | VER-03 | — | N/A | A11y / Axe | `pnpm --filter @hestia/e2e exec playwright test tests/17-accessibility-states.spec.ts` | ✅ Exists | ⬜ pending |
| 21-04-02 | 04 | 4 | VER-04 | — | Supply chain & CSP enforcement | CI Ratchets | `node apps/web/scripts/check-build.mjs && node scripts/check-knip-baseline.mjs && node scripts/audit-prod.mjs` | ✅ Exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual aesthetic and layout parity post-Tailwind purge | FND-05 | Human perception of visual spacing, contrast, and font rendering | Spot-check all primary screens (Dashboard, Lists, Deals, Meals, Bills, Chores, Settings) in light and dark schemes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending 2026-11-15
