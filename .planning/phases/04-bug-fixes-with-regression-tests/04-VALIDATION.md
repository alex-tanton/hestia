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
| **Quick run command** | `pnpm --filter @hearth/web exec vitest run src/screens/deals/deal-card.test.tsx src/components/chores/RotationEditor.test.tsx && pnpm --filter @hearth/shared exec vitest run src/api/patch-schemas.test.ts && pnpm --filter @hearth/service exec vitest run src/kong-routes.test.ts && node --test test/eslint-service-role-fence.test.mjs scripts/deploy.test.mjs` (the Kong config test is a Vitest test in `apps/service` per D-08; research had suggested the root harness) |
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

Commands run from the primary checkout root against the plan's sibling worktree (`W`, `C`, `G`, `F`, `K`, `FW` as each plan defines them); CI rows are read through `gh api` per the plans' rule 8.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 04-01 | 1 | FIX-01 | T-04-01 | Retry after a lost response reuses the id; success mints a new one; ids are held per list and deal | component | `pnpm --dir ../hearth-list-adds-rotation --filter @hearth/web exec vitest run src/screens/deals` (red log `04-01-fix01-red.log`) | ✅ extend | ⬜ pending |
| 04-01-T2 | 04-01 | 1 | FIX-04 | — | Rotation editor operable by keyboard alone; no suppression; drag through a real button | component + lint | `pnpm --dir ../hearth-list-adds-rotation --filter @hearth/web exec vitest run src/components/chores src/screens/chores` and ESLint on the component | ❌ W0 (new file) | ⬜ pending |
| 04-01-T3 | 04-01 | 1 | FIX-02 | T-04-02 | Tests on the PR head without the fix; per-list lock one commit ahead | typecheck + unit (integration in CI) | `pnpm --dir ../hearth-list-adds-lock --filter @hearth/service typecheck && pnpm --dir ../hearth-list-adds-lock --filter @hearth/service test` | ✅ extend | ⬜ pending |
| 04-02-T1 | 04-02 | 2 | FIX-01, FIX-02, FIX-04 | T-04-04, T-04-05 | PR 1 content exact; every local gate and the sweep green; no new knip line | full local gates | gate logs `04-02-*.log` and `04-02-sweep/summary.txt` | ✅ | ⬜ pending |
| 04-02-T3 | 04-02 | 2 | FIX-02 | T-04-06 | Overlapping add-to-list calls add each ingredient once: red on the PR head, green after the fast-forward | integration (CI) | `gh api repos/alex-tanton/hearth/actions/jobs/{fix02-red job}` = `test-integration failure`; six jobs `success` on the final head | ✅ | ⬜ pending |
| 04-03-T1 | 04-03 | 1 | FIX-05 | T-04-07, T-04-09 | Fence reports privileged imports outside `privileged/` at error severity; four config mutations killed; audit 0 violations | harness | `(cd ../hearth-guard-tests && node --test test/eslint-service-role-fence.test.mjs)` | ❌ W0 (new file) | ⬜ pending |
| 04-03-T2 | 04-03 | 1 | FIX-03 | T-04-08 | No PATCH body injects a default; the `autopay` mutation is killed | unit | `pnpm --dir ../hearth-guard-tests --filter @hearth/shared exec vitest run src/api/patch-schemas.test.ts` | ❌ W0 (new file) | ⬜ pending |
| 04-04-T3 | 04-04 | 3 | FIX-03, FIX-05 | T-04-10, T-04-11 | PR 2 is tests, wiring and docs only; six jobs green | CI | six jobs `success` on the PR 2 head through `gh api` | ✅ | ⬜ pending |
| 04-05-T1 | 04-05 | 2 | FIX-06 | T-04-12, T-04-14 | Password in no argv; reaches only the migration command via `PGPASSWORD`; red 4 of 6 on the old script | harness | `(cd ../hearth-deploy-kong && node --test scripts/deploy.test.mjs)` | ❌ W0 (new file) | ⬜ pending |
| 04-05-T2 | 04-05 | 2 | FIX-07 | T-04-16 | Kong probes committed on the PR 3 head with the old `kong.yml` | e2e typecheck (E2E in CI) | `pnpm --dir ../hearth-deploy-kong --filter @hearth/e2e typecheck` | ✅ extend | ⬜ pending |
| 04-05-T3 | 04-05 | 2 | FIX-07 | T-04-SC | `yaml@2.9.1` installed only after the owner's legitimacy check | checkpoint (blocking-human) | `grep -nE '^gate-yaml=(approve|reject) ' .planning/cleanup/FIX-LEDGER-INFRA.md` | — | ⬜ pending |
| 04-06-T1 | 04-06 | 3 | FIX-07 | T-04-16 to T-04-19 | Exact Kong allowlist; denied paths refused; red 13 of 32 on the old file | unit (Vitest, D-08) | `pnpm --dir ../hearth-kong-allowlist --filter @hearth/service exec vitest run src/kong-routes.test.ts` | ❌ W0 (new file) | ⬜ pending |
| 04-06-T2 | 04-06 | 3 | FIX-07 | T-04-21 | Allowlist and recreate step documented | docs + lint | `grep -qF 'hearth-compose up -d --force-recreate kong' ../hearth-kong-allowlist/docs/deploy.md` | ✅ | ⬜ pending |
| 04-07-T3 | 04-07 | 4 | FIX-06, FIX-07 | T-04-20, T-04-22 | Denied paths answer Kong's 403 (red on the old Kong, green after the fast-forward); sign-in, refresh, reset still pass | E2E (CI) | `gh api repos/alex-tanton/hearth/actions/jobs/{fix07-e2e-red job}` = `test-e2e failure`; six jobs `success` on the final head | ✅ extend | ⬜ pending |
| 04-08-T1 | 04-08 | 5 | FIX-01 to FIX-07 | T-04-24 | Every fix and guard green on the final `main`; index complete | full suite on `main` | `pnpm --dir ../hearth-final test` and the index checks | ✅ | ⬜ pending |
| 04-08-T2 | 04-08 | 5 | FIX-07 | T-04-26 | Kong recreated on the host by the owner | human check | `grep -qE '^kong-recreate=' .planning/cleanup/FIX-LEDGER.md` | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `yaml@2.9.1` devDependency of `@hearth/service` (after the blocking-human `checkpoint:human-verify` in 04-05 Task 3), `apps/service/package.json` and `pnpm-lock.yaml` committed together (04-06 Task 1)
- [ ] Two new harness files appended to `test:harness` in root `package.json` (04-03, 04-05)
- [ ] `packages/shared/src/api/patch-schemas.test.ts` (04-03 Task 2)
- [ ] `apps/web/src/components/chores/RotationEditor.test.tsx` (04-01 Task 2)
- [ ] `test/eslint-service-role-fence.test.mjs` (04-03), `scripts/deploy.test.mjs` (04-05), `apps/service/src/kong-routes.test.ts` (04-06, Vitest per D-08)
- [ ] Red-first ledgers (D-12; never in a PR): `.planning/cleanup/FIX-LEDGER-WEB.md` (04-01), `FIX-LEDGER-GUARDS.md` (04-03), `FIX-LEDGER-INFRA.md` (04-05), and the phase index `.planning/cleanup/FIX-LEDGER.md` (04-08)

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
