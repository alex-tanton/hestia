---
phase: 07-planning-cleanup-documentation-restructure
plan: 02
subsystem: docs
tags: [docs, deployment, runbook, link-check, fact-map, git-mv]

requires:
  - phase: 07-planning-cleanup-documentation-restructure
    provides: "07-01 left .planning/phases/ holding only phase 07, so this plan works against live material"
provides:
  - "07-doc-checks.mjs with links, facts and coverage modes, reused by plans 07-03 and 07-04"
  - "docs/deployment.md: the deployment runbook (renamed from docs/deploy.md with git mv), with the README's restore command blocks and a Compose services table"
  - "Every pointer to the README's deployment material (.env.example, docker-compose.yml, docs/file-map.md, .claude/CLAUDE.md) now names docs/deployment.md"
affects: [07-03, 07-04]

actuals:
  tokens: 5400
  tasks: 3
  commits: 4

plan_head_before: 90684232d3641b9c2327825f24b058d0d10fc164
plan_head_after: f8ffa6171c3b1f4e9c76d84dd493c1d5e6159e40

tech-stack:
  added: []
  patterns:
    - "Zero-loss doc moves are proven by a fact map plus a clause-level coverage pass against the pre-phase commit, with negative controls that show the checker can fail"

key-files:
  created:
    - .planning/phases/07-planning-cleanup-documentation-restructure/07-doc-checks.mjs
  modified:
    - docs/deployment.md
    - docs/file-map.md
    - docs/use-cases.md
    - .env.example
    - docker/docker-compose.yml
    - .claude/CLAUDE.md

key-decisions:
  - "DOC-02 is not marked complete: this plan delivers only the docs/deployment.md part; docs/development.md, the testing.md merge and the README links land in 07-03 and 07-04"
  - "The restore command blocks sit after the guide's numbered steps (which carry the reasons) instead of replacing them"

requirements-completed: []

coverage:
  - id: D1
    description: "docs/deployment.md is the guide renamed with git mv; git log --follow keeps its history and no active tracked file names the old path"
    requirement: DOC-02
    verification:
      - kind: other
        ref: "Task 1 verify block (git log --follow count above 1, git grep for the old name exits 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every README deployment, backup and restore fact (lines 145-313 at a21db47) is in docs/deployment.md, including both full restore command blocks"
    requirement: DOC-02
    verification:
      - kind: other
        ref: "07-doc-checks.mjs facts: facts=148 missing=0 map-errors=0; coverage: units=111 verbatim=77 backed=34 uncovered=0"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/deployment.md has a Compose services table naming all seven services with the images pinned in docker/docker-compose.yml"
    requirement: DOC-02
    verification:
      - kind: other
        ref: "Task 2 verify block (service-name and pinned-image loops)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Config comments, the file map and CLAUDE.md point at docs/deployment.md; the two config files changed in comment lines only; README.md is unchanged"
    requirement: DOC-02
    verification:
      - kind: other
        ref: "Task 3 verify block (comment-only diff filter, git diff --quiet against a21db47 for README.md)"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-10-25
status: complete
---

# Phase 7 Plan 02: Deployment guide rename and README merge Summary

**`docs/deploy.md` is now `docs/deployment.md` with its history, holding every README deployment, backup and restore fact (148 facts, 111 README clauses, 0 missing) plus a Compose services table, and `07-doc-checks.mjs` can prove that again at the end of the phase.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-25T15:18:10Z
- **Completed:** 2026-10-25T15:27Z
- **Tasks:** 3
- **Files modified:** 7 (one created, one renamed, five edited)

## Accomplishments

- Wrote `.planning/phases/07-planning-cleanup-documentation-restructure/07-doc-checks.mjs`: a dependency-free ESM checker with `links` (Markdown links and GitHub anchors), `facts` (fact map with reworded `=>` rows, read against the base commit) and `coverage` (sentence, clause, table-row and code-line coverage of a moved line range). It has no shebang, passes ESLint with zero warnings, and uses exit codes 0, 1 and 2.
- Renamed the guide with `git mv` (content identical in the rename commit) and repointed the docs index row and the `docs/use-cases.md` pointer.
- Added to `docs/deployment.md`: the full restore-test and restore-production command blocks (copied from README lines 250-282 and 288-310 and matched line for line by the coverage pass), a `## Compose services` table (seven services, five pinned third-party images, the two built images as `<sha>` tags) with the port, network and volume facts read from the compose file, and a rewritten pinned-names sentence that no longer sends the owner to the README.
- Repointed `.env.example`, `docker/docker-compose.yml` (two comments), the `docs/file-map.md` TLS sentence and the `.claude/CLAUDE.md` Pinned origin bullet.

## Task Commits

1. **Task 1 (tracer): checker** - `d732978` (chore); **rename and inbound references** - `d2a9b9f` (docs)
2. **Task 2: merge README restore steps and add Compose services** - `c1988b7` (docs)
3. **Task 3: repoint config comments, file map and CLAUDE.md** - `f8ffa61` (docs)

**Plan metadata:** committed after this file (docs: complete the deployment guide merge plan, 07-02).

Tracer gate: `human_verify_mode` is `end-of-phase` and the verify block is automated-only, so it was re-run end-to-end after Task 1 and passed before the merge started.

## Gate results

| Gate | Result |
| --- | --- |
| Task 1 negative controls | links control: `doc-links: files=1 links=3 broken=2`, exit 1; facts before merge: `fact-map: facts=148 plans=1 missing=23 map-errors=0`, exit 1; coverage before merge: `coverage: plans=1 ranges=1 units=111 verbatim=35 backed=39 uncovered=37`, exit 1, all 37 `[code]` lines in README 251-306 |
| `07-doc-checks.mjs facts` (final) | `fact-map: facts=148 plans=1 missing=0 map-errors=0` |
| `07-doc-checks.mjs coverage` (final) | `coverage: plans=1 ranges=1 units=111 verbatim=77 backed=34 uncovered=0` |
| `07-doc-checks.mjs links` (final) | `doc-links: files=10 links=7 broken=0` |
| docs-claims (archived tool) | `checked=1350 misses=0` (1342 at base, plus the new backticked tokens) |
| Comment-only diff of `.env.example` and `docker/docker-compose.yml` against `a21db47` | pass |
| `README.md` against `a21db47` | byte-identical |
| `pnpm format:check` | pass |
| `pnpm lint` | pass |
| `pnpm test:harness` | 393 tests, 393 pass |
| `node scripts/check-repo-hygiene.mjs` | clean (1006 files, 14 scripts) |
| Pre-commit hook (lint-staged, typecheck) | pass on every commit |

## Decisions Made

- DOC-02 stays open in `REQUIREMENTS.md`. The plan lists it, but its acceptance text also covers `docs/development.md`, `docs/testing.md` and the README links, which belong to 07-03 and 07-04. Marking it complete here would overstate the state.
- Kept the old guide's numbered restore steps as the explanation and added the README command blocks after them, so the reasons and the exact commands both survive.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Compose services intro said "three built images"**
- **Found during:** Task 2, reviewing the diff before commit
- **Issue:** My first wording counted three built images; the compose file builds two (`hearth-service`, `hearth-caddy`).
- **Fix:** Reworded to name the two built images.
- **Files modified:** `docs/deployment.md` (before it was first committed)
- **Committed in:** `c1988b7`

**2. [Environment] Clean-tree check scoped around the orchestrator lock**
- **Issue:** The Task 3 final assertion `git status --porcelain` empty is not true here because the untracked orchestrator file `.planning/milestone.lock` exists (left alone on instruction). I ran the check with that one path excluded; everything else was clean.

**Total deviations:** 1 auto-fixed (wording), 1 environment note. **Impact:** none on scope.

## Issues Encountered

- The default `node` on PATH is v22, so every command ran with `/opt/node-v24/bin` first. The husky typecheck prints an engine warning from the pnpm wrapper but passes.
- The checker was exercised against a temporary untracked copy of the guide before the rename so that the checker commit stayed alone; the copy was removed before the rename commit.

## Known Stubs

None.

## Threat Flags

None. No network endpoint, auth path or schema changed; the only new doc text uses the existing angle-bracket template values (`<machine>`, `<tailnet>`, `<sha>`, `<yyyymmdd>`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 07-03 (`docs/development.md` and the E2E merge into `docs/testing.md`). 07-03 and 07-04 can reuse `07-doc-checks.mjs` with their own `fact:` and `cover:` rows. `docs/file-map.md` line 23 still describes the README as holding deployment and backup steps; plan 07-04 rewrites that row when it cuts the README down.

## Self-Check: PASSED

- `.planning/phases/07-planning-cleanup-documentation-restructure/07-doc-checks.mjs` and `docs/deployment.md` exist; `docs/deploy.md` does not.
- Commits `d732978`, `d2a9b9f`, `c1988b7`, `f8ffa61` are ancestors of HEAD.

---
*Phase: 07-planning-cleanup-documentation-restructure*
*Completed: 2026-10-25*
