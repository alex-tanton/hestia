---
phase: "04"
slug: bug-fixes-with-regression-tests
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-20"
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from the Validation Architecture section of `04-RESEARCH.md`; the per-task map is filled in once plans exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.1 (web, shared, service); `node --test` (root harness); Playwright 1.63.0 (E2E, CI only) |
| **Config file** | `apps/web/vitest.config.ts` (jsdom), `packages/shared/vitest.config.ts`, `apps/service/vitest.config.ts` and `vitest.integration.config.ts`; root harness listed in `package.json` `test:harness` |
| **Quick run command** | `pnpm --filter @hearth/web exec vitest run src/screens/deals/deal-card.test.tsx src/components/chores/RotationEditor.test.tsx && pnpm --filter @hearth/shared exec vitest run src/api/patch-schemas.test.ts && node --test test/eslint-service-role-fence.test.mjs scripts/deploy.test.mjs test/kong-routes.test.mjs` |
| **Full suite command** | `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` (plus CI `test-integration` and `test-e2e`) |
| **Estimated runtime** | ~60 seconds locally for the full unit suite; integration and E2E run in PR CI only |

---

## Sampling Rate

- **After every task commit:** Run the quick run command for the files the task touched
- **After every plan wave:** Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`
- **Before `/gsd-verify-work`:** Full suite green locally and green `test-integration` and `test-e2e` on each PR
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-TBD | — | — | FIX-01 | — | Retry after a lost response reuses the id; success mints a new one; another list gets its own id | component | `pnpm --filter @hearth/web exec vitest run src/screens/deals/deal-card.test.tsx` | ✅ extend | ⬜ pending |
| 04-TBD | — | — | FIX-02 | — | Overlapping add-to-list calls on one list add each ingredient once | integration | `pnpm --filter @hearth/service exec vitest run --config vitest.integration.config.ts src/meal-plan.integration.test.ts` | ✅ extend | ⬜ pending |
| 04-TBD | — | — | FIX-03 | — | No PATCH body injects a default; guard flags mutants | unit | `pnpm --filter @hearth/shared exec vitest run src/api/patch-schemas.test.ts` | ❌ W0 | ⬜ pending |
| 04-TBD | — | — | FIX-04 | — | Rotation editor operable by keyboard alone; no `eslint-disable` | component + lint | `pnpm --filter @hearth/web exec vitest run src/components/chores/RotationEditor.test.tsx && pnpm lint` | ❌ W0 | ⬜ pending |
| 04-TBD | — | — | FIX-05 | service-role fence | Fence reports privileged imports outside `privileged/` | harness | `node --test test/eslint-service-role-fence.test.mjs` | ❌ W0 | ⬜ pending |
| 04-TBD | — | — | FIX-06 | DB password exposure | Password in no argv; reaches only the migration command via `PGPASSWORD` | harness | `node --test scripts/deploy.test.mjs` | ❌ W0 | ⬜ pending |
| 04-TBD | — | — | FIX-07 | GoTrue path exposure | Exact Kong allowlist; denied paths refused | harness | `node --test test/kong-routes.test.mjs` | ❌ W0 | ⬜ pending |
| 04-TBD | — | — | FIX-07 | GoTrue path exposure | Denied paths answer Kong's 403; sign-in, refresh, reset still pass | E2E (CI) | `pnpm test:e2e` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `yaml@2.9.1` root devDependency (after `checkpoint:human-verify`), `package.json` and `pnpm-lock.yaml` committed together
- [ ] Three new harness files appended to `test:harness` in root `package.json`
- [ ] `packages/shared/src/api/patch-schemas.test.ts`
- [ ] `apps/web/src/components/chores/RotationEditor.test.tsx`
- [ ] `test/eslint-service-role-fence.test.mjs`, `scripts/deploy.test.mjs`, `test/kong-routes.test.mjs`
- [ ] `.planning/cleanup/FIX-LEDGER.md` (red-first evidence, D-12; never in a PR)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Kong picks up the new `kong.yml` after merge | FIX-07 | `deploy.sh` does not recreate Kong and a bind-mounted file edit does not trigger a recreate | Owner runs `hearth-compose up -d --force-recreate kong`, then signs in and refreshes a session |
| Firefox pointer drag on the grip `<button>` | FIX-04 | Cannot be run in jsdom or the CI Chromium | Drag a rotation member in Firefox; the Up/Down buttons remain the guaranteed alternative |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
