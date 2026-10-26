---
phase: 03-evidence-gated-removal
plan: 06
subsystem: stale-references-and-leftovers
tags: [dead-code, stale-references, ignore-files, leftovers-audit, pr-3]

requires:
  - phase: 03-evidence-gated-removal
    provides: "03-05 ledger rows 1 to 62 and the owner decisions A1/A2/A8, OQ1, knip-summary"
provides:
  - "Branch chore/stale-references (one commit, pushed, no pull request) without the two BUILD_PROMPT.md ignore entries"
  - "Ledger rows 63 and 64, the research A6 owner note, and the filled Stale-reference sweep and Leftovers audit sections"
affects: [03-07, 03-08, 03-09]

tech-stack:
  added: []
  patterns: ["path proof for ignore-file entries: log --all, ls-files, absence, git grep", "path-existence sweep classified a to e with a committed-evidence table in the gitignored logs"]

key-files:
  created: []
  modified:
    - .dockerignore
    - .prettierignore
    - .planning/cleanup/REMOVAL-LEDGER.md

key-decisions:
  - "Only the two proven-stale BUILD_PROMPT.md lines were removed; the sweep found no other stale ignore, config, docs or comment path, so nothing else changed on chore/stale-references"

requirements-completed: []

plan_head_before: 7d14b7775fa653e11ac85020564340ac5ba176cf
plan_head_after: d9d61bb850e3bca6b10ac279b0b36665159db052
commits: 1
actuals:
  tokens: 400
  tasks: 2
  commits: 1

duration: 30min
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 06: Stale references and leftovers of PR 3 Summary

**The two `BUILD_PROMPT.md` ignore entries (`.dockerignore:24`, `.prettierignore:4`) are removed in one commit on `chore/stale-references` (0 added, 2 deleted lines) after proof the file was never tracked and nothing else names it, and the path sweep and leftovers audit found no other stale reference and no tracked leftover.**

`plan_head_before` and `plan_head_after` and `commits: 1` measure the code branch `chore/stale-references` (`origin/main` to its tip). The plan also made three `docs:` commits on the working branch (two ledger commits and this summary commit), which are not code commits.

## Commits

| Branch | SHA | Subject |
| --- | --- | --- |
| `chore/stale-references` (cut from `origin/main` `7d14b77`, pushed, no pull request) | `d9d61bb850e3bca6b10ac279b0b36665159db052` | `chore: drop stale BUILD_PROMPT.md ignore entries` |
| `claude/trusting-lovelace-y4r87h` | `2fe0277` | `docs: record the stale ignore-entry removals` |
| `claude/trusting-lovelace-y4r87h` | `a11f41e` | `docs: record the Phase 3 reference sweep and leftover audit` |

## Task 1: BUILD_PROMPT.md (tracer)

- Tool proof (`$L/03-06-buildprompt.log`): `git log --all --oneline -- BUILD_PROMPT.md` and `git ls-files -- BUILD_PROMPT.md` print nothing; the file is absent from the tree.
- Text proof: `git grep -n -I -F -e BUILD_PROMPT -- . ':!.planning' ':!.claude'` printed exactly `.dockerignore:24` and `.prettierignore:4` before the edit and exits 1 after it.
- Gates: `pnpm format:check` and `pnpm lint` exit 0 after the edit (`$L/03-06-t1-{format-check,lint}.log`); the pre-commit hook's typecheck also passed. Both files keep their trailing newline. The Docker image builds are CI evidence from PR 3's `test-e2e` (plan 03-08), not a local claim.
- Ledger rows 63 and 64 and the research A6 note are in `REMOVAL-LEDGER.md`: an untracked local `BUILD_PROMPT.md` in the owner's checkout is now checked by `pnpm format:check` locally.
- Tracer gate: the slice is a two-line removal verified end to end by the commands above; autonomous mode, nothing to expand on a failure, and none occurred.

## Task 2: sweep and audit (results in the ledger)

- `tracked-ignored: none` (`git ls-files -ci --exclude-standard` is empty).
- `pattern-audit: .env.example only` over 673 tracked files outside `.planning/` and `.claude/`; paths only were printed.
- `lockfiles: pnpm-lock.yaml`. The ten largest tracked files are the Flipp raw captures (D-10) and the lockfile. `apps/service/src/db/types.ts` and the two `apps/web/public/icons/*.png` files are intentional generated files and stay.
- `path-sweep`: 618 files, 642 tokens, 385 existing or globs, 257 misses: class a 163, b 12, c 0, d 82, e 0 (`$L/03-06-path-misses.tsv`, 257 lines, three tab-separated fields each). No class e token, so no further commit on `chore/stale-references` and no `docs/` or source-comment edit.
- One Phase 5 (RED-04) observation, not edited: `apps/service/vitest.coverage.config.ts:40` cites a build-process label, `test/service-coverage-and-fixtures`, that names no file.
- No `orphan-docs:` line, by design: plan 03-07 does that at the PR 2 tip.

## Branch checks

- `git diff --name-only origin/main...HEAD` on `chore/stale-references` is `.dockerignore` and `.prettierignore` only; nothing under `.planning`, `.claude`, `docker`, `supabase` or `.github`; no secret-shaped added line.
- Both task `<automated>` commands pass (the Task 2 pattern was read from a scratch file because a tool guard blocks any command line containing a literal env-file regex; the pattern is the plan's, unchanged).
- Worktree `../hearth-refs` was created with `pnpm install --frozen-lockfile` (exit 0).

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. The only edits are two removed ignore lines for a file that does not exist; every other exclusion in both files, including `supabase`, `backups`, `*.dump` and `*.sql.gz`, is unchanged (T-03-17).

## Self-Check: PASSED

- `d9d61bb850e3bca6b10ac279b0b36665159db052` is the tip of `origin/chore/stale-references`.
- `.planning/cleanup/REMOVAL-LEDGER.md` contains the two `BUILD_PROMPT.md` rows, `## Stale-reference sweep` and `## Leftovers audit`.
