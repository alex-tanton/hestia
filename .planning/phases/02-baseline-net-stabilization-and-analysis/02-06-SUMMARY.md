---
phase: 02-baseline-net-stabilization-and-analysis
plan: 06
subsystem: tooling
tags: [knip, dead-code-analysis, calibration, canaries, package-legitimacy]

requires:
  - phase: 02-baseline-net-stabilization-and-analysis
    provides: "02-01: BASELINE.md and the measured toolchain; origin/main as the branch base"
provides:
  - "knip 6.41.0 as an exact-pinned root devDependency with report-only scripts knip and knip:production"
  - "Root knip.json declaring only the entries knip can model (sw.ts, seed, e2e globals, cli, package exports), with no ignore, ignoreFiles or ignoreDependencies"
  - "TRIAGE.md Approvals (knip and jscpd approved by the owner) and Calibration (counts, known-live check, canary table)"
  - "Raw JSON and normalized summaries for the baseline and canary runs under .planning/cleanup/knip/"
  - "Branch chore/knip-config backed up on origin"
affects: [02-07, 02-08, phase-03]

actuals:
  tokens: 2450
  tasks: 3
  commits: 2
plan_head_before: 89eb558e7c83865117a226239a2377642c43ef81
plan_head_after: 78cca6989fbedd66079f7cd51348289c3f5ce35e

tech-stack:
  added: [knip 6.41.0]
  patterns:
    - "Calibrate an analyzer with planted canaries on a throwaway branch before trusting its report"
    - "Normalize tool JSON to sorted kind/path/symbol lines so runs can be diffed"

key-files:
  created:
    - knip.json
    - .planning/cleanup/TRIAGE.md
    - .planning/cleanup/knip/ (eight calibration files)
  modified:
    - package.json
    - pnpm-lock.yaml
    - docs/file-map.md

key-decisions:
  - "The owner approved knip@6.41.0 and jscpd@5.4.1 (approve-both) before anything was installed; the approval lines are the first content of TRIAGE.md"
  - "tailwindcss is left reported as a known false positive (CSS @import is not followed) instead of being hidden by an ignoreDependencies entry (D-10); it goes to 02-07's uncertain bucket"
  - "The redundant-entry configuration hints are left as they are: the plan requires explicit entries and the redundancy is mode-dependent"

requirements-completed: [BASE-02]

duration: ~25min (start not captured; worktree install at about 00:27Z, finished 00:32Z)
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 06: knip pinned, configured and calibrated with canaries Summary

**knip 6.41.0 runs report-only in default and production mode from a root `knip.json` that flags all four planted canaries correctly and none of the nine known-live entry files; baseline totals are 58 (default) and 79 (production).**

## Performance

- **Tasks:** 3 of 3 (Task 1 was the owner's package-legitimacy checkpoint, resolved with `approve-both` in the dispatch message)
- **Commits on `chore/knip-config`:** 2 (measured from the ledger: `89eb558..78cca69`), plus the docs commit that carries this SUMMARY
- **Changed files outside `.planning/`:** `package.json`, `pnpm-lock.yaml`, `knip.json`, `docs/file-map.md` only; nothing deleted

## Accomplishments

- Approvals: `## Approvals` in TRIAGE.md holds `knip@6.41.0 approved - 2026-10-13` and `jscpd@5.4.1 approved - 2026-10-13`, written before the worktree install, `pnpm add` or any knip run. jscpd was not installed or run. 02-07 Task 3's precondition line is in place.
- Install: `pnpm add -Dw knip@6.41.0` added 14 packages with no `Ignored build scripts` line. `package.json` has `"knip": "6.41.0"` and the scripts `knip` and `knip:production` (`knip --production --workspace "!e2e" --workspace "!supabase/seed"`) after `build`.
- `knip.json`: the entries the plan lists per workspace, `ignoreExportsUsedInFile`, `ignoreBinaries`, `includeEntryExports` on the three packages; no `ignore`, `ignoreFiles` or `ignoreDependencies` key. `format:check`, `lint` and `typecheck` pass (the commit hooks ran lint-staged and typecheck on all three commits).
- Baseline report (no canaries): default 58 findings (2 devDependencies, 1 unlisted, 17 exports, 37 types, 1 duplicates); production 79 (1 file, 40 exports, 37 types, 1 duplicates). None of `apps/web/src/sw.ts`, `supabase/seed/seed-users.ts`, `e2e/global-setup.ts`, `e2e/global-teardown.ts`, `apps/service/src/cli.ts` and the four package entry files is reported as an unused file in either mode.
- Research cross-check: `tsx` (supabase/seed devDependency) and `fuse.js` (unlisted, `packages/matching/scripts/fuzzy-benchmark.ts`) both appear, as do `pruneCutoffs`, `useFavoriteStores`, `listIdOfWrite` and the three meal fixtures.
- Canaries (scratch branch `scratch/knip-canaries`, deleted, never pushed): orphan file reported as `files` in both modes; dead export reported in both modes; unused dependency `fastest-levenshtein` reported for `apps/web/package.json`; test-only export absent in default and reported in production. All PASS on the first measurement, so no config fix was needed.

## Task Commits

1. Task 1: no commit (owner checkpoint; approval lines are part of commit 2)
2. Task 2: `1ee3209` chore: add knip with a report-only workspace config
3. Task 3: `78cca69` docs: record the knip calibration (TRIAGE.md and `.planning/cleanup/knip/`); the canary commit lived only on the deleted scratch branch
4. This SUMMARY: `docs: complete plan 02-06` (made after this file was written, so not in `commits:` above)

## Findings worth carrying into 02-07

- `tailwindcss` is reported as an unused devDependency of `apps/web` (false positive: `@import 'tailwindcss'` in `index.css`, which knip does not follow). Research predicted it for any `apps/web` entry override, which the plan requires. It is documented as a known limitation, not suppressed.
- Default mode reports an orphan file as a `files` line. Research had said default mode reports no unused files; with this config it does, so both modes find dead files, and production mode adds files reachable only from tests (`apps/service/src/deals/flipp/normalized-fixtures.ts`, used by a test and a script).
- `includeEntryExports: true` surfaces unused re-exports from the package barrels (for example `packages/matching/src/index.ts` `BRANDS`, `UNITS`, `tokenize`). These are API-surface candidates, not proof of dead code.
- Default mode prints 13 "Remove redundant entry pattern" hints because plugins and `package.json` already supply those entries there; left in place (plan requires explicit entries, and production mode needs them).

## Verification run

- Task 2 verify, run as written: exit 0 (devDependency and script strings exact, both JSON reports parse, both summaries end in a `total` line, none of the nine live entries on a `files` line, `sw.ts!` and `seed-users.ts` in `knip.json`, `## Calibration` present, `knip.json` row in `docs/file-map.md`). The `ignore`/`ignoreFiles`/`ignoreDependencies` absence check exits 0.
- Task 3 first verify, run as written: exit 0 (all canary lines as expected, no `scratch/*` branch, clean worktree, no canary name in code on `chore/knip-config`, canary rows with PASS in TRIAGE.md, TRIAGE.md and the canary summary committed on the branch, no log path on the branch).
- Task 3 second verify (backup push): exit 0. `git ls-remote --heads origin chore/knip-config` equals the local tip `78cca69`; no `scratch/` head on `origin`.
- `git diff --name-only origin/main...HEAD -- . ':(exclude).planning'` lists exactly `docs/file-map.md`, `knip.json`, `package.json`, `pnpm-lock.yaml`; `git diff --diff-filter=D --name-only origin/main...chore/knip-config` prints nothing.
- Pre-push checks (phase rule 4): the branch diff against `origin/main` lists 13 paths (the four above, TRIAGE.md and eight files under `.planning/cleanup/knip/`); none is under `.claude/`, `.github/`, `supabase/migrations/`, `docker/` or `.planning/cleanup/logs/`, and none is an env file; the secret-shaped scan of added lines (plan 02-08's pattern) counted 0. Plain `git push -u origin chore/knip-config` created the branch on `origin`; no pull request was opened. The SUMMARY commit is pushed the same way afterwards.
- `pnpm test` was not run: on this base (`origin/main`) the seven time-dependent web tests fail until the clock branch is merged at 02-08, as the plan states. Gates here were format:check, lint and typecheck.

## Deviations from Plan

**1. [Plan/reality] Calibration expectations differ from research in two places**
- Default mode reports the orphan file (the plan allowed for this: "if it reports the orphan, note that as well"), and `tailwindcss` is reported (the plan asked only to record whether it is). Both are recorded in TRIAGE.md `## Calibration`; neither required a config change.

**2. [Process] STATE.md, ROADMAP.md and REQUIREMENTS.md not touched**
- The orchestrator owns those writes, so this plan's docs commit carries only this SUMMARY, not the four files the plan's `<output>` names.

**3. [Process] The worktree branch-namespace check was not applied**
- Same as 02-02 to 02-05: the plan names `../hearth-knip` on `chore/knip-config`, so the protected/detached-branch check was applied and the `agent-*` allow-list was not.

**4. [State] Primary checkout is not on `main`**
- Phase rule 1 says the primary checkout stays on `main`; this session's primary checkout is on `claude/trusting-lovelace-y4r87h`. Nothing was switched, reset, stashed or cleaned there; `.planning/cleanup/` files were written there and copied to the worktree for commit.

**Total deviations:** 1 expectation note, 3 process or state notes. No auth gates.

## Known Stubs

None.

## Threat Flags

None. Only a devDependency, a report-only config, a docs row and planning records changed; no endpoint, auth path or schema.

## Self-Check

- FOUND: `knip.json`, `docs/file-map.md` row, `.planning/cleanup/TRIAGE.md` and the eight files under `.planning/cleanup/knip/` in `../hearth-knip`
- FOUND commits 1ee3209 and 78cca69 on `chore/knip-config` and on `origin/chore/knip-config`
- `git status --porcelain` in `../hearth-knip` was empty after the last code commit
- `../hearth-aside/bin/knip-summary.mjs` exists (session-local, not committed)
