---
phase: "19"
slug: "entry-dashboard-grocery-ecosystem-screens"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-15"
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.1 (node + jsdom) |
| **Config file** | `apps/web/vite.config.ts` |
| **Quick run command** | `pnpm --filter @hestia/web test` |
| **Full suite command** | `pnpm --filter @hestia/web test:coverage && pnpm test:e2e` |
| **Estimated runtime** | ~15 seconds (unit) / ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @hestia/web test`
- **After every plan wave:** Run `pnpm --filter @hestia/web test:coverage && pnpm typecheck && pnpm lint`
- **Before `/gsd-verify-work`:** Full suite must be green (`pnpm build && pnpm test:e2e`)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | DASH-01, DASH-02 | — | N/A | unit / DOM | `pnpm --filter @hestia/web exec vitest run --project dom src/components/states/StateBlocks.test.tsx` | ❌ W0 | ⬜ pending |
| 19-01-02 | 01 | 1 | DASH-01 | — | N/A | unit / DOM | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/DashboardScreen.test.tsx` | ❌ W0 | ⬜ pending |
| 19-02-01 | 02 | 2 | AUTH-06 | — | Magic link token not exposed in logs or URLs | unit / build | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/onboarding/ && node apps/web/scripts/check-build.mjs` | ✅ | ⬜ pending |
| 19-02-02 | 02 | 2 | AUTH-07 | — | Household isolation preserved | unit / DOM | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/onboarding/OnboardingScreen.test.tsx` | ✅ | ⬜ pending |
| 19-03-01 | 03 | 3 | LIST-01 | — | List ID validated on delete | unit / DOM | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/lists/ListsIndexScreen.test.tsx` | ❌ W0 | ⬜ pending |
| 19-03-02 | 03 | 3 | LIST-02 | — | XSS escaping on grocery item names | unit / DOM | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/lists/ListDetailScreen.test.tsx` | ❌ W0 | ⬜ pending |
| 19-03-03 | 03 | 3 | LIST-01 | — | Expiry dates validated | unit / DOM | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/lists/PantryScreen.test.tsx` | ❌ W0 | ⬜ pending |
| 19-04-01 | 04 | 4 | LIST-03 | — | Camera stream stopped on dialog unmount | unit / DOM | `pnpm --filter @hestia/web exec vitest run --project dom src/components/lists/BarcodeScannerDialog.test.tsx` | ❌ W0 | ⬜ pending |
| 19-05-01 | 05 | 5 | DEAL-06, DEAL-07 | — | Deal price tampering prevented | unit / DOM | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/deals/DealSearchScreen.test.tsx` | ❌ W0 | ⬜ pending |
| 19-05-02 | 05 | 5 | DEAL-07 | — | External links sanitized | unit / DOM | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/deals/DealCard.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/src/components/states/StateBlocks.test.tsx` — stubs for DASH-02
- [ ] `apps/web/src/screens/DashboardScreen.test.tsx` — stubs for DASH-01
- [ ] `apps/web/src/screens/lists/ListsIndexScreen.test.tsx` — stubs for LIST-01
- [ ] `apps/web/src/screens/lists/ListDetailScreen.test.tsx` — stubs for LIST-02
- [ ] `apps/web/src/screens/lists/PantryScreen.test.tsx` — stubs for LIST-01
- [ ] `apps/web/src/components/lists/BarcodeScannerDialog.test.tsx` — stubs for LIST-03
- [ ] `apps/web/src/screens/deals/DealSearchScreen.test.tsx` — stubs for DEAL-06
- [ ] `apps/web/src/screens/deals/DealCard.test.tsx` — stubs for DEAL-07

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Camera Live Video Feed & Flashlight | LIST-03 | Physical camera hardware required | Open Barcode Scanner on a physical mobile device, verify camera HUD renders, toggle flashlight, aim at UPC barcode, verify beep/haptic feedback. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending 2026-11-15

