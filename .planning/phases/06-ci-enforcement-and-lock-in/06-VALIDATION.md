---
phase: "06"
slug: ci-enforcement-and-lock-in
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-22"
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node `node:test` (CI scripts, harness) and Vitest 5.0.1 (workspaces) |
| **Config file** | none for `node --test`; list in root `package.json` `test:harness` |
| **Quick run command** | `node --test scripts/<new-script>.test.mjs` |
| **Full suite command** | `pnpm test` plus `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm knip` |
| **Estimated runtime** | quick ~5 s; full suite several minutes; `pnpm test:sweep` ~10 min |

---

## Sampling Rate

- **After every task commit:** run the single new `*.test.mjs` plus `pnpm lint` on touched files
- **After every plan wave:** `pnpm test:harness && pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`
- **Before `/gsd-verify-work`:** full `pnpm test`, `pnpm test:sweep`, hygiene commands green, PR CI jobs green
- **Max feedback latency:** 60 seconds for the per-task check

---

## Per-Task Verification Map

Seeded from RESEARCH.md "Validation Architecture"; the planner fills Task IDs.

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| CI-01 | default knip is 0; a new production finding fails; a stale baseline row fails | unit + live | `node --test scripts/check-knip-baseline.test.mjs`; `pnpm knip` | ❌ W0 |
| CI-02 | jscpd gate fails above threshold, passes below; live tree under 2% | unit + live | `node --test scripts/jscpd-gate.test.mjs`; `pnpm exec jscpd` | ❌ W0 |
| CI-03 | tracked-ignored, non-executable script, CRLF each fail; migrations append-only; db:types drift | unit (temp git repos) + CI evidence | `node --test scripts/check-repo-hygiene.test.mjs`; `node --test scripts/check-migrations-append-only.test.mjs` | ❌ W0 |
| CI-04 | `pnpm audit --prod` fails closed on error or missing advisories | unit | `node --test scripts/audit-prod.test.mjs` | ❌ W0 |
| CI-05 | every job has `timeout-minutes`; workflow name and ids unchanged | contract test or ledger evidence | `node --test scripts/workflows.test.mjs` | ❌ W0 (optional) |
| CI-06 | web coverage thresholds pass and agree with `docs/testing.md` | live + docs check | `pnpm --filter @hearth/web test:coverage` | ✅ |
| CI-07 | Deploy run for the merge SHA is `workflow_run`, job `deploy` queued or in progress | API evidence | GitHub REST API runs and jobs for `deploy.yml` | n/a |
| TIME-06 | today-cell resolution is a pure function of the instant; sweep green | unit + live | `node --test scripts/test-sweep.test.mjs`; `pnpm test:sweep` | extend existing |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New `scripts/*.test.mjs` files listed above, each appended to `test:harness`
- [ ] `docs/testing.md` harness count and list updated for each new harness test
- [ ] Hygiene script dry run against the real tree after the three mode fixes (expected: no findings)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Merge to `main` still fires `deploy.yml` from workflow `CI` | CI-07 | needs a real merge and the self-hosted runner | Capture the Deploy run for the merge SHA immediately after merge |
| `db:types` drift step goes red on a deliberate edit | CI-03 | needs a CI runner | Throwaway PR editing `types.ts`; record the run |
| First `push` run of `sweep.yml` is green | TIME-06 | workflow_dispatch needs the file on the default branch | Check the run after merge |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
