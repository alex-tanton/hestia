---
phase: "15"
slug: "flexible-meal-planning-custom-items-recipes"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-10"
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.1 |
| **Config file** | `apps/web/vite.config.ts`, `apps/service/vitest.config.ts`, `packages/shared/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @hestia/shared test && pnpm --filter @hestia/service test src/services/meal-plan.test.ts src/routes/meal-plan.test.ts` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @hestia/shared test && pnpm --filter @hestia/service test src/services/meal-plan.test.ts src/routes/meal-plan.test.ts`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | MEAL-01 | T-15-01 | Zod request/response contracts validate custom items and sanitize input | unit | `pnpm --filter @hestia/shared test src/api/meal-plan.test.ts` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | MEAL-01 | T-15-02 | Database migration check constraint enforces recipe XOR custom integrity | integration | `pnpm --filter @hestia/service test:integration` | ✅ | ⬜ pending |
| 15-01-03 | 01 | 1 | MEAL-01, MEAL-03 | T-15-01 | Service persists custom items and handles single/week list additions | unit | `pnpm --filter @hestia/service test src/services/meal-plan.test.ts src/routes/meal-plan.test.ts` | ✅ | ⬜ pending |
| 15-02-01 | 02 | 2 | MEAL-02 | — | Disambiguates custom items from deleted recipes and renders primary text | component | `pnpm --filter @hestia/web test src/components/meals/MealSlotEntry.test.tsx` | ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 2 | MEAL-02 | — | Unified placement sheet supports Recipe tab and Quick Item entry tab | component | `pnpm --filter @hestia/web test src/components/meals/MealPlacementSheet.test.tsx` | ❌ W0 | ⬜ pending |
| 15-02-03 | 02 | 2 | MEAL-02, MEAL-03 | — | PlannerScreen orchestrates custom item placement and single/week list addition | component | `pnpm --filter @hestia/web test src/screens/meals/planner.test.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/shared/src/api/meal-plan.test.ts` — test suites for union request schema and entry schema with `customTitle`
- [ ] `apps/web/src/components/meals/MealSlotEntry.test.tsx` — test suites for custom item rendering, bullet icon, and overflow actions
- [ ] `apps/web/src/components/meals/MealPlacementSheet.test.tsx` — test suites for Recipe tab, Quick Item tab, and quick chips

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| None | — | — | All phase behaviors have automated verification. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

