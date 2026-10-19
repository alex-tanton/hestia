---
phase: "03"
slug: "evidence-gated-removal"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-19"
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `03-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.1 (web: jsdom; service and packages: node), `node --test` for the root harness, Playwright for E2E (CI only) |
| **Config file** | `apps/*/vitest.config.ts`, `apps/web/vite.config.ts`, `apps/service/vitest.integration.config.ts`, `e2e/playwright.config.ts`, `knip.json` |
| **Quick run command** | `pnpm typecheck && pnpm lint && pnpm format:check` (about 70 s) plus `pnpm --filter <touched-pkg> test` and knip |
| **Full suite command** | `pnpm test` (about 97 s) and `pnpm --filter @hearth/web build`; integration, E2E and Docker builds run in PR CI only |
| **Estimated runtime** | ~70 s quick, ~110 s full local |

---

## Sampling Rate

- **After every task commit:** `pnpm typecheck && pnpm lint && pnpm format:check`, `pnpm --filter <pkg> test` for the touched package, and knip with the committed config and the throwaway `node: false` config
- **After every plan wave:** `pnpm test` and `pnpm --filter @hearth/web build`
- **Before `/gsd-verify-work`:** All three PRs green in CI (six jobs), final knip summaries diffed and archived
- **Max feedback latency:** ~110 seconds locally

---

## Per-Task Verification Map

Task IDs are filled in by the planner from the PLAN.md files.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-T2, 03-07-T1, 03-09-T1 | 03-01, 03-07, 03-09 | 1, 7, 9 | DEAD-01 | T-03-03 | No file deleted without proof | knip | `pnpm knip` and `pnpm knip:production` piped through `node scripts/knip-summary.mjs`, then the `files` lines of each summary; default shows none, production shows only `normalized-fixtures.ts`; the squash commits delete no file | ❌ W0 (03-01-T1) | ⬜ pending |
| 03-03-T1 to T3, 03-04-T1 to T2, 03-05-T1 to T3, 03-07-T1, 03-09-T1 | 03-03, 03-04, 03-05, 03-07, 03-09 | 3, 4, 5, 7, 9 | DEAD-02 | T-03-09 to T-03-16, T-03-22 | Every removal has three recorded proof results | knip + git grep + suite | per item: `--trace-file {path} --trace-export {name}` shows `(no imports found)` (also with `$NONODE` under `test/`), the rule 4 `git grep` shows the definition only, then typecheck, lint, format, the workspace tests with unchanged counts and the web build; per branch and on final main: the ledger check maps every changed knip line to Removals or Kept | ❌ W0 (03-01-T1) | ⬜ pending |
| 03-01-T1, 03-02-T3 | 03-01, 03-02 | 1, 2 | DEAD-03 | T-03-01, T-03-07 | Lockfile changes only by the seed importer entry | install + typecheck + CI | `pnpm install --frozen-lockfile`, the `tsx` commit is exactly `pnpm-lock.yaml` and `supabase/seed/package.json` with 0/4 lines, seed and service typecheck, `tsx --version`; CI: six jobs on PR 1 and `dbseed=exit0` from the throwaway step | ✅ | ⬜ pending |
| 03-06-T1, 03-06-T2, 03-08-T1 | 03-06, 03-08 | 6, 8 | DEAD-04 | T-03-17, T-03-23 | Only a never-tracked, absent path's ignore entries go | git grep + format + CI | the rule 4 `git grep` for the stale name exits 1, the classified path sweep, `pnpm format:check`; CI `test-e2e` builds both images on PR 3 | ✅ | ⬜ pending |
| 03-02-T3, 03-06-T2, 03-09-T1 | 03-02, 03-06, 03-09 | 2, 6, 9 | DEAD-05 | T-03-05, T-03-08, T-03-27 | No drift silently regenerated | git + CI | `git ls-files -ci --exclude-standard` empty, pattern audit only `.env.example`, throwaway CI step prints `run1 == run2` and `run2 == committed`; `dead05=complete` only with `OQ1=accept` and an unchanged schema and types file since `pr1-head` | ✅ (CI step: 03-02-T1) | ⬜ pending |
| 03-01-T3, 03-09-T2 | 03-01, 03-09 | 1, 9 | DEAD-06 | T-03-04, T-03-25, T-03-26 | Nothing uncertain deleted; nothing unlisted | text + git | owner-list completeness check: every final knip finding and every ledger Kept item is named on the live list, removals only under `## Removed in Phase 3`; standing-list paths still exist on `main` | ✅ | ⬜ pending |
| 03-09-T1 | 03-09 | 9 | Phase gate | T-03-21, T-03-26 | No migration, Docker, workflow or fence change | git + CI | `git diff --stat {base} origin/main -- supabase/migrations` prints nothing; six CI jobs green per PR and on each squash commit on `main`; the unit sweep on the final tree | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/knip-summary.mjs` — copy verbatim from `/home/user/hearth-aside/bin/knip-summary.mjs` (100755) plus a root `knip:summary` script, needed by every later evidence step (DEAD-01, DEAD-02) — plan 03-01 Task 1
- [ ] Throwaway knip config generator (a copy of `knip.json` with top-level `"node": false`, passed via `--config`, never committed) — restores the three hidden `meal-fixtures.ts` findings (DEAD-02) — plan 03-01 Task 1 (phase rule 6: written to `.planning/cleanup/logs/03-knip.nonode.json`, outside every worktree; checked during planning to give 57 versus 54 findings from there)
- [ ] `.planning/cleanup/REMOVAL-LEDGER.md` skeleton — columns: item, kind, tool evidence, text-search evidence, build/test evidence, commit, PR (DEAD-02, DEAD-06) — plan 03-01 Task 1
- [ ] Throwaway draft-PR CI step that runs `pnpm db:types` twice after `supabase start` and diffs both runs against the committed file (DEAD-05), plus a `pnpm db:seed` step on a reset database for D-07 — plan 03-02 Task 1

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `pnpm db:seed` end to end after the `tsx` removal | DEAD-03 | Needs a Docker host and no CI job covers it | Owner runs `pnpm db:seed` against a local Supabase stack; local proof is the `tsx` resolution from `apps/service` plus the seed typecheck |
| Both Docker image builds | Phase gate | No Docker on the cloud box | Read the `test-e2e` job in PR CI; re-run on an ECR `toomanyrequests` pre-pull failure rather than revert |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 110s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
