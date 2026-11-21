---
phase: "20"
slug: "meals-bills-chores-settings-screens"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-15"
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.1 (`unit` Node.js + `dom` jsdom) |
| **Config file** | `apps/web/vite.config.ts` |
| **Quick run command** | `pnpm --filter @hestia/web exec vitest run --project dom <test-path>` |
| **Full suite command** | `pnpm --filter @hestia/web test:coverage && pnpm test:e2e` |
| **Estimated runtime** | ~15 seconds (unit) / ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run quick vitest DOM command for the affected test file(s)
- **After every plan wave:** Run `pnpm --filter @hestia/web test:coverage && pnpm typecheck && pnpm lint`
- **Before `/gsd-verify-work`:** Full suite must be green (`pnpm build && pnpm test:e2e`)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | MEAL-04 | — | N/A | unit / DOM | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/meals/planner.test.tsx` | ✅ Exists | ⬜ pending |
| 20-01-02 | 01 | 1 | MEAL-05 | — | N/A | unit / DOM | `pnpm --filter @hestia/web exec vitest run --project dom src/components/meals/MealPlacementSheet.test.tsx` | ✅ Exists | ⬜ pending |
| 20-01-03 | 01 | 1 | MEAL-06 | — | N/A | unit / DOM | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/meals/recipe-detail.test.tsx src/screens/meals/recipe-library.test.tsx` | ✅ Exists | ⬜ pending |
| 20-02-01 | 02 | 1 | BILL-01 | — | N/A | unit / DOM | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/bills/bills-index.test.tsx src/screens/bills/subscriptions.test.tsx` | ✅ Exists | ⬜ pending |
| 20-02-02 | 02 | 1 | BILL-02 | — | N/A | unit / DOM | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/bills/bill-detail.test.tsx` | ✅ Exists | ⬜ pending |
| 20-03-01 | 03 | 1 | CHOR-01 | — | N/A | unit / DOM | `pnpm --filter @hestia/web exec vitest run --project dom src/components/chores/RotationEditor.test.tsx src/screens/chores/chores-offline-queue.test.tsx` | ✅ Exists | ⬜ pending |
| 20-03-02 | 03 | 1 | CHOR-02 | — | N/A | unit / DOM | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/chores/errands.test.tsx src/screens/chores/errands-offline-queue.test.tsx` | ✅ Exists | ⬜ pending |
| 20-04-01 | 04 | 1 | SET-01 | — | N/A | unit / DOM | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/settings/settings.test.tsx` | ✅ Exists | ⬜ pending |
| 20-04-02 | 04 | 1 | SET-02 | — | N/A | unit / DOM | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/settings/notification-types.test.tsx src/screens/deals/favorites.test.tsx` | ✅ Exists | ⬜ pending |
| 20-04-03 | 04 | 1 | SET-03 | — | — | unit / DOM | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/settings/system-health.test.tsx src/screens/settings/departure.test.tsx` | ✅ Exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Responsive full-screen dialog transition animation | MEAL-06, BILL-02, CHOR-01 | Visual animation and hardware GPU compositing | Open RecipeForm, BillForm, ChoreForm on mobile viewport (<600px) and verify full-viewport canvas and Top App Bar layout |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending 2026-11-15
