---
phase: "02"
slug: baseline-net-stabilization-and-analysis
status: validated
nyquist_compliant: false
wave_0_complete: true
created: "2026-10-19"
---

# Phase 02 - Validation Strategy

> Per-phase validation contract. Reconstructed after execution from the plans, summaries and the code at `origin/main` `4ebc90b`.

Result: **partial**. All five code requirements (TIME-01 to TIME-05) have automated verification that runs in CI. The four analysis requirements (BASE-01 to BASE-04) deliver measurement and triage records, not behavior, so they are verified by inspection and re-computation and are listed as manual-only below. No tests were generated.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.1 (workspaces), Node's built-in `node --test` (root harness, `e2e/support`), Playwright 1.63.0 (E2E journeys) |
| **Config file** | `apps/*/vitest.config.ts`, `packages/*/vitest.config.ts`, `apps/service/vitest.integration.config.ts`, `apps/service/vitest.coverage.config.ts`, `e2e/playwright.config.ts` |
| **Quick run command** | `pnpm test:harness` (167 tests, about 20 seconds) |
| **Full suite command** | `pnpm test` (harness, then every workspace's unit suite), then `pnpm --filter @hearth/service test:coverage` against `supabase start` for the integration suite |
| **Zone and weekday matrix** | `pnpm test:sweep` (36 cells) and `pnpm test:sweep:integration` (5 cells) |
| **Estimated runtime** | about 2 minutes for `pnpm test`; 10+ minutes for the 36-cell sweep; 5 minutes for coverage |

---

## Sampling Rate

- **After every task commit:** `pnpm test:harness`, plus the workspace suite the task touched
- **After every plan wave:** `pnpm test` and `node scripts/test-sweep.mjs --workspace all`
- **Before `/gsd-verify-work`:** `pnpm test`, the unit sweep and CI green (six jobs)
- **Max feedback latency:** about 120 seconds for the quick path

---

## Per-Task Verification Map

Mapped per requirement, since every plan contributes to several requirements.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-02, 02-03 | 02, 03 | 2, 3 | TIME-01 (one clock pin for every unit suite) | T-02-07 | Pin is per-test, assertions not weakened | harness + unit sweep | `pnpm test:harness && node scripts/test-sweep.mjs --workspace all` | ✅ `test/clock-setup.test.mjs` (37 cases) | ✅ green |
| 02-02, 02-03 | 02, 03 | 2, 3 | TIME-02 (zone hook, sweep across zones) | T-02-04, T-02-05 | Zone validated; sweep rejects shell metacharacters in `--only` and fails when `--only` selects nothing | harness | `pnpm test:harness` | ✅ `test/global-tz.test.mjs`, `scripts/test-sweep.test.mjs` | ✅ green |
| 02-05, 02-09 | 05, 09 | 5, 6 | TIME-03 (E2E dates from one household-clock helper, no weekday assumptions) | T-02-13, T-02-14, T-02-24 | Helpers answer in the household zone | node:test + E2E journeys | `pnpm --filter @hearth/e2e test` and CI `test-e2e` | ✅ `e2e/support/clock.test.ts`, 19 specs | ✅ green (see manual-only: weekend run) |
| 02-05 | 05 | 5 | TIME-04 (lint ban on bare clock reads) | T-02-12 | Only reasoned next-line opt-outs; production code not covered | harness | `pnpm test:harness && pnpm lint` | ✅ `test/eslint-clock-ban.test.mjs` | ✅ green |
| 02-04 | 04 | 4 | TIME-05 (bills dated by the household calendar) | T-02-09, T-02-10 | Guard bites in two zones at any hour | integration | `pnpm --filter @hearth/service test:coverage` (needs `supabase start`) | ✅ `apps/service/src/bills.integration.test.ts`, `apps/service/src/test/zone-dates.test.ts` | ✅ green in CI (`test-integration`) |
| 02-01 | 01 | 1 | BASE-01 (untouched-main baseline) | T-02-02, T-02-03 | Measured on a detached checkout, no repository change | none (record) | manual-only | ✅ `.planning/cleanup/BASELINE.md` | manual-only |
| 02-06 | 06 | 2 | BASE-02 (knip calibrated, canaries behave) | T-02-15, T-02-16, T-02-17 | Report-only scripts, no deletions | none (record) | manual-only (`pnpm knip`, `pnpm knip:production` re-run by the verifier: 59 and 80 findings) | ✅ `knip.json`, `.planning/cleanup/knip/` | manual-only |
| 02-07 | 07 | 7 | BASE-03 (findings triaged, owner list) | T-02-18, T-02-19 | Nothing deleted; uncertain items go to the owner | none (record) | manual-only | ✅ `.planning/cleanup/TRIAGE.md`, `OWNER-CANDIDATES.md` | manual-only |
| 02-07 | 07 | 7 | BASE-04 (jscpd duplication baseline) | T-02-SC | `jscpd` run through `pnpm dlx` at an approved pin, not installed | none (record) | manual-only (totals recomputed from the raw JSON by the verifier) | ✅ `.planning/cleanup/jscpd/` | manual-only |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Evidence for the green rows on this checkout, 2026-10-19: `pnpm test:harness` 167 of 167 pass; `pnpm --filter @hearth/e2e test` 15 of 15; `zone-dates.test.ts` 9 of 9; CI on `main` and on every Phase 2 pull request ran the six jobs green.

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Phase 2 itself built the infrastructure (the harness, the sweep and the helpers), and each piece has tests.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Baseline numbers for untouched `main` | BASE-01 | A measurement record, not behavior | Read `.planning/cleanup/BASELINE.md`; the rows were measured twice on a detached `d3da748` checkout |
| knip calibration (canaries, known-live entries) | BASE-02 | The canaries were planted on a throwaway branch and deleted, so the experiment is not repeatable from the repository | `pnpm knip` and `pnpm knip:production` must still report 59 and 80 findings at the Phase 2 tree; compare with `TRIAGE.md` "Canary table" |
| Triage ledger completeness | BASE-03 | Document structure; the plans' verify script is not committed | Every finding in `.planning/cleanup/knip/` summaries has a row in `TRIAGE.md`, and every uncertain row appears in `OWNER-CANDIDATES.md` |
| jscpd totals | BASE-04 | A scan record | Recompute `statistics.total` from `.planning/cleanup/jscpd/*.json` |
| E2E journeys on a different weekday | TIME-03 | Only CI can run the journeys, and no run is scheduled on a weekend | Deferred by the owner on 2026-10-13 (decision D-14, recorded in `02-UAT.md`). Run `test-e2e` on a Saturday and a Sunday in New York when convenient |

---

## Validation Sign-Off

- [x] All tasks have an automated verify, or are listed as manual-only with a reason
- [x] Sampling continuity: no three consecutive tasks without automated verify (TIME-01 to TIME-05 are automated)
- [x] Wave 0 covers all MISSING references (none missing)
- [x] No watch-mode flags
- [x] Feedback latency under 120 seconds on the quick path
- [ ] `nyquist_compliant: true` set in frontmatter (not set: BASE-01 to BASE-04 are manual-only records)

**Approval:** validated 2026-10-19 (partial). No tests were generated; the four manual-only items are analysis records.

---

## Validation Audit

| Audit Date | Gaps found | Resolved | Escalated |
|------------|------------|----------|-----------|
| 2026-10-19 | 4 | 0 | 4 |
