---
phase: 07-planning-cleanup-documentation-restructure
plan: 03
subsystem: docs
tags: [docs, development, testing, contributing, fact-map, coverage]

requires:
  - phase: 07-planning-cleanup-documentation-restructure
    provides: "07-02 delivered 07-doc-checks.mjs (links, facts, coverage) and docs/deployment.md with the hearth-compose alias in First-time setup"
provides:
  - "docs/development.md: setup, dev servers, command table, local service run, database and seed, commits and hooks, scripts, checks before pushing"
  - "CONTRIBUTING.md reduced to policy plus links to docs/development.md#scripts and #checks-before-pushing"
  - "docs/testing.md End-to-end tests section carries the README's only README-only fact (the ready at line)"
  - "docs/file-map.md docs index row for development.md"
affects: [07-04]

actuals:
  tokens: 2100
  tasks: 3
  commits: 3

plan_head_before: d80154a4f41a16380349d190c67187380a52be4d
plan_head_after: 0cf13b354d7912329c6632cd5023e856c4903cb5

tech-stack:
  added: []
  patterns:
    - "Moved docs text is copied verbatim and proven by facts plus clause-level coverage; reworded clauses are backed by => fact rows"

key-files:
  created:
    - docs/development.md
  modified:
    - CONTRIBUTING.md
    - docs/testing.md
    - docs/file-map.md

key-decisions:
  - "DOC-02 stays open in REQUIREMENTS.md: the README links and the landing-page cut belong to 07-04"
  - "CONTRIBUTING.md keeps the Checks before pushing heading with a one-sentence pointer, so contributors still find it by name"

requirements-completed: []

coverage:
  - id: D1
    description: "docs/development.md holds every README development, local-service and database clause (lines 28-53 and 71-144 at a21db47), verbatim or backed by a fact row, with all links resolving"
    requirement: DOC-02
    verification:
      - kind: other
        ref: "07-doc-checks.mjs facts --source README.md --dest docs/development.md: facts=58 missing=0; coverage: units=64 verbatim=61 backed=3 uncovered=0"
        status: pass
    human_judgment: false
  - id: D2
    description: "CONTRIBUTING's Scripts and Checks before pushing content (lines 101-117) lives in docs/development.md; CONTRIBUTING.md keeps every policy section and links to the moved steps"
    requirement: DOC-02
    verification:
      - kind: other
        ref: "facts --source CONTRIBUTING.md: facts=14 missing=0; coverage: units=10 verbatim=9 backed=1 uncovered=0; Task 2 verify block (policy headings, links, format:check)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The README's end-to-end notes are merged into the End-to-end tests section of docs/testing.md with the ready at sentence; its 25 headings are unchanged and only that section changed"
    requirement: DOC-02
    verification:
      - kind: other
        ref: "facts --dest docs/testing.md: facts=27 missing=0; coverage: units=11 verbatim=0 backed=11 uncovered=0; heading diff empty; hunk-range check"
        status: pass
    human_judgment: false
  - id: D4
    description: "Plans 02 and 03 combined: every README development, database, E2E, deployment and restore fact is accounted for, and README.md is byte-identical to the base"
    requirement: DOC-02
    verification:
      - kind: other
        ref: "facts 07-02+07-03: facts=247 missing=0; coverage: ranges=5 units=196 uncovered=0; git diff --quiet a21db47 -- README.md"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-25
status: complete
---

# Phase 7 Plan 03: Development runbook and E2E merge Summary

**`docs/development.md` now holds the README's development material and CONTRIBUTING's script and pre-push steps, the README's one README-only E2E fact (`ready at …`) is in `docs/testing.md`, and CONTRIBUTING.md is policy plus links, proven by 247 facts and 196 covered clauses with none missing.**

## Performance

- **Duration:** 8 min
- **Tasks:** 3
- **Files modified:** 4 (one created, three edited)

## Accomplishments

- Created `docs/development.md` (Setup, Dev servers, Commands, Running the service locally, Database, Commits and hooks, Scripts, Checks before pushing). The README text is copied verbatim; only three clauses are reworded, each backed by a fact row: the `pnpm test:e2e` row now links the testing guide, the database table's integration row links `testing.md#integration-tests`, and the Compose seeding sentence names the `hearth-compose` alias by link to `deployment.md#first-time-setup`. The two shell blocks match the README line for line.
- Moved CONTRIBUTING's Scripts section and Checks before pushing body into `docs/development.md`. CONTRIBUTING.md keeps the Checks before pushing heading with a one-sentence link, the hygiene row now links `docs/development.md#scripts`, and Prettier re-aligned that table. The Commands table and What CI checks table are linked, not copied.
- Added one paragraph to the End-to-end tests section of `docs/testing.md` after the first code block: global setup hands the suite a stack on a free loopback port, printed as `ready at …`. Every other README E2E clause was already there; reworded fact rows name the existing wording.
- Added the `development.md` row to the docs index in `docs/file-map.md`.

## Task Commits

1. **Task 1 (tracer): docs/development.md and file-map row** - `cc1b986` (docs)
2. **Task 2: move Scripts and Checks before pushing** - `35ad97d` (docs)
3. **Task 3: ready-at note in docs/testing.md** - `0cf13b3` (docs)

**Plan metadata:** committed after this file (docs: complete the development runbook plan, 07-03).

Tracer gate: `human_verify_mode` is `end-of-phase` and the verify block is automated-only, so it was re-run end to end after Task 1 and passed before the later tasks started.

## Gate results

| Gate | Result |
| --- | --- |
| `facts --source README.md --dest docs/development.md` | `fact-map: facts=58 plans=1 missing=0 map-errors=0` |
| `coverage --source README.md --dest docs/development.md` | `coverage: plans=1 ranges=2 units=64 verbatim=61 backed=3 uncovered=0` |
| `facts --source CONTRIBUTING.md` | `fact-map: facts=14 plans=1 missing=0 map-errors=0` |
| `coverage --source CONTRIBUTING.md` | `coverage: plans=1 ranges=1 units=10 verbatim=9 backed=1 uncovered=0` |
| `facts --dest docs/testing.md` | `fact-map: facts=27 plans=1 missing=0 map-errors=0` |
| `coverage --dest docs/testing.md` | `coverage: plans=1 ranges=1 units=11 verbatim=0 backed=11 uncovered=0` |
| `facts` plans 02 + 03 (final) | `fact-map: facts=247 plans=2 missing=0 map-errors=0` |
| `coverage` plans 02 + 03 (final) | `coverage: plans=2 ranges=5 units=196 verbatim=147 backed=49 uncovered=0` |
| `links` (final) | `doc-links: files=11 links=22 broken=0` |
| docs-claims (final) | `checked=1378 misses=0` |
| `docs/testing.md` headings vs `a21db47` | identical (25); hunks inside the E2E section only |
| `README.md` vs `a21db47` | byte-identical |
| `pnpm format:check` | pass |
| `pnpm lint` | pass |
| `pnpm test:harness` | 393 tests, 393 pass |
| Pre-commit hook (lint-staged, typecheck) | pass on all 3 commits |

## Decisions Made

- DOC-02 stays open in `REQUIREMENTS.md`; the README cut and its links are 07-04.
- Kept the Checks before pushing heading in CONTRIBUTING.md (contributors look for it) rather than deleting both sections outright.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] docs-claims resolves names from tracked files only**
- **Found during:** Task 1 verification
- **Issue:** The docs-claims tool reads `git ls-files`, so the new `docs/development.md` row in `docs/file-map.md` reported `development.md missing` while the file was untracked (`misses=1`).
- **Fix:** Staged the new file with `git add` before the verify run; the commit then contained both. No content change.
- **Files modified:** none
- **Verification:** re-run reported `checked=1379 misses=0`.

**2. [Environment] Clean-tree check scoped around the orchestrator lock**
- The final `git status --porcelain` assertion is not empty here because the untracked orchestrator file `.planning/milestone.lock` exists (left alone on instruction). Everything else was clean.

**Total deviations:** 1 auto-fixed (verification ordering), 1 environment note. **Impact:** none on scope.

## Issues Encountered

- Default `node` on PATH is v22, so every command ran with `/opt/node-v24/bin` first.

## Known Stubs

None.

## Threat Flags

None. The seed password and local `hearth` role password were already published in the README; the moved text keeps "development only, never production" for Compose seeding (T-07-07 to T-07-09 mitigations hold via the fact map).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 07-04: every operational fact the README holds now has a home in `docs/` (development, deployment, testing). `docs/development.md` links `../README.md#prerequisites`, so 07-04 must keep the Prerequisites heading. `docs/file-map.md` line 23 still describes the README as holding deployment and backup steps; 07-04 rewrites that row when it cuts the README.

## Self-Check: PASSED

- `docs/development.md` exists; headings Scripts and Checks before pushing present.
- Commits `cc1b986`, `35ad97d`, `0cf13b3` are ancestors of HEAD.

---
*Phase: 07-planning-cleanup-documentation-restructure*
*Completed: 2026-10-25*
