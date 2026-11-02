---
phase: 07-planning-cleanup-documentation-restructure
plan: 04
subsystem: docs
tags: [docs, readme, landing-page, fact-map, coverage, doc-links]

requires:
  - phase: 07-planning-cleanup-documentation-restructure
    provides: "07-02 and 07-03 moved every README operational fact into docs/deployment.md, docs/development.md and docs/testing.md and proved it with fact maps and coverage rows"
provides:
  - "README.md rewritten as a 70-line landing page: overview, prerequisites, quickstart, architecture with the Layout table, nine-row documentation index"
  - "docs/file-map.md README row describes the landing page"
  - "CLAUDE.md testing pointers target docs/testing.md instead of the deleted TESTING map"
affects: [08-full-rebrand-to-hestia, 09-domain-and-network-migration]

actuals:
  tokens: 1100
  tasks: 2
  commits: 2

plan_head_before: 1589b7562aa74f1d8c56a672b400d62425ba0137
plan_head_after: 69d2fefc0433f311cbbdd5ec529a3d931b629bd2

tech-stack:
  added: []
  patterns:
    - "Landing page keeps only content proven present in docs/; the index table links every docs file and CONTRIBUTING.md"

key-files:
  created: []
  modified:
    - README.md
    - docs/file-map.md
    - .claude/CLAUDE.md

key-decisions:
  - "README keeps the intro, the Prerequisites bullets and the Layout table verbatim, so the clause-level coverage pass finds all 17 units of README lines 1-27"
  - "The Prerequisites heading is kept because docs/development.md links ../README.md#prerequisites"

requirements-completed: [DOC-01, DOC-02]

coverage:
  - id: D1
    description: "README.md is 70 lines (under 150) with overview, Prerequisites, Quickstart, Architecture with Layout, and a nine-row Documentation index, and carries no deployment, backup, restore, database or E2E command detail"
    requirement: DOC-01
    verification:
      - kind: other
        ref: "Task 1 verify block: line count, required headings, index loop over docs/*.md and CONTRIBUTING.md, forbidden-detail grep, no hestia or cloudflare, format:check"
        status: pass
    human_judgment: true
    rationale: "Whether the page reads as approachable and well ordered is a reading judgment; scripts prove length, links and content only"
  - id: D2
    description: "No operational fact from the original README or the moved CONTRIBUTING sections was lost: 273 facts missing=0, 213 coverage units uncovered=0, README cover ranges tile lines 1-313"
    requirement: DOC-02
    verification:
      - kind: other
        ref: "07-doc-checks.mjs facts 07-02+07-03+07-04: facts=273 plans=3 missing=0 map-errors=0; coverage: plans=3 ranges=6 units=213 verbatim=164 backed=49 uncovered=0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every link and anchor in README.md, CONTRIBUTING.md, docs/ and the roadmap resolves; docs claims all hold"
    requirement: DOC-02
    verification:
      - kind: other
        ref: "07-doc-checks.mjs links: files=11 links=35 broken=0 (roadmap: files=1 links=1 broken=0); docs-claims checked=1345 misses=0"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/file-map.md describes the new README and .claude/CLAUDE.md points at docs/testing.md; all phase gates pass on a clean tree"
    requirement: DOC-02
    verification:
      - kind: other
        ref: "Task 2 verify block: hygiene clean (1009 files), knip zero findings, knip-baseline 28 rows match, test:harness 393/393, format:check, eslint on the checker, secret scan 0 lines"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-25
status: complete
---

# Phase 7 Plan 04: README landing page Summary

**README.md is now a 70-line landing page (overview, prerequisites, quickstart, architecture with the Layout table, nine-row documentation index), and the three fact maps plus a clause-level coverage pass over all 313 original lines show nothing the old README held was lost.**

## Performance

- **Duration:** 8 min
- **Tasks:** 2
- **Files modified:** 3 (`README.md`, `docs/file-map.md`, `.claude/CLAUDE.md`)

## Accomplishments

- Rewrote `README.md` from 313 to 70 lines. Kept verbatim: the title and intro, the four Prerequisites bullets (plus a fifth for `psql`), and the Layout table. Quickstart holds `pnpm install`, both dev servers with their comments, and `pnpm lint`, `format:check`, `typecheck`, `test`, `build`, with links to `docs/development.md#running-the-service-locally` and `#commands`. The Architecture paragraph links `docs/architecture.md` and `docs/deployment.md`.
- Added the Documentation table: development, deployment, testing, architecture, design, use-cases, branding, file-map and CONTRIBUTING.md, each linked with a one-line purpose.
- `docs/file-map.md`: the `README.md` row now describes the landing page.
- `.claude/CLAUDE.md`: the Clock fence and New test bullets now point at `docs/testing.md`, "Dates and time zones", instead of the deleted TESTING map.

## Task Commits

1. **Task 1 (tracer): rewrite README.md as a landing page** - `6062410` (docs)
2. **Task 2: point file-map and CLAUDE.md at the new docs layout** - `69d2fef` (docs)

Tracer gate: the Task 1 verify block (automated only, `end-of-phase` mode) passed end to end before Task 2.

## Final checker lines

| Gate | Result |
| --- | --- |
| README length | 70 lines |
| `facts` (07-02, 07-03, 07-04 plans) | `fact-map: facts=273 plans=3 missing=0 map-errors=0` |
| `coverage` | `coverage: plans=3 ranges=6 units=213 verbatim=164 backed=49 uncovered=0` |
| README `cover:` ranges | tile lines 1-313 of the base README exactly (1-27, 28-53, 54-70, 71-144, 145-313) |
| `links` (docs set) | `doc-links: files=11 links=35 broken=0` |
| `links` (roadmap) | `doc-links: files=1 links=1 broken=0` |
| docs-claims | `checked=1345 misses=0` |
| `pnpm format:check` | pass |
| eslint on `07-doc-checks.mjs` | pass |
| `check-repo-hygiene.mjs` | clean (1009 files, 14 scripts) |
| `pnpm knip` and `check-knip-baseline.mjs` | zero findings; 28 rows match |
| `pnpm test:harness` | 393 tests, 393 pass |
| Secret-pattern scan over `a21db47..HEAD` added lines | 0 matches |
| `.planning/phases/` tracked content | only the 07 directory |
| `git status --porcelain` | only the untracked orchestrator lock `.planning/milestone.lock` |

## README section map (all rows confirmed)

| Source section | Base lines | Destination | Status |
|----------------|------------|-------------|--------|
| README title and intro | 1-5 | README.md `# Hearth` | confirmed (verbatim, coverage) |
| README Prerequisites | 7-12 | README.md `## Prerequisites` | confirmed (`psql` added) |
| README Layout | 14-26 | README.md `### Layout` under `## Architecture` | confirmed (unchanged) |
| README Development: install and dev servers | 28-34 | README.md `## Quickstart` and `docs/development.md` | confirmed |
| README Development: command table | 36-46 | `docs/development.md` Commands | confirmed |
| README coverage note | 48-49 | `docs/development.md` Commands | confirmed |
| README commit-hook note | 51-52 | `docs/development.md` Commits and hooks | confirmed |
| README End-to-end tests | 54-69 | `docs/testing.md` End-to-end tests | confirmed |
| README Running the service locally | 71-114 | `docs/development.md` | confirmed |
| README Database | 116-143 | `docs/development.md` Database | confirmed |
| README Deployment intro | 145-148 | `docs/deployment.md` Overview | confirmed |
| README Pinned names | 150-162 | `docs/deployment.md` Pinned names | confirmed |
| README Host prerequisites | 164-174 | `docs/deployment.md` | confirmed |
| README First start | 176-199 | `docs/deployment.md` First-time setup | confirmed |
| README Deploy | 201-232 | `docs/deployment.md` Ongoing deploys, Manual rollback | confirmed |
| README Backups | 234-243 | `docs/deployment.md` Backups | confirmed |
| README Restore test (quarterly) | 245-282 | `docs/deployment.md` | confirmed |
| README Restore production | 284-313 | `docs/deployment.md` | confirmed |
| CONTRIBUTING Scripts | 101-108 | `docs/development.md` Scripts | confirmed |
| CONTRIBUTING Checks before pushing | 110-116 | `docs/development.md` Checks before pushing | confirmed |

## Deploy note for the owner

Merging this branch deploys an unchanged application. `README.md`, `CONTRIBUTING.md`, `.env.example`, `docker/docker-compose.yml` and `.claude/` sit outside `docs/` and `.planning/`, so `scripts/deploy-gate.sh` will not skip the deploy; it rebuilds and redeploys the same code with the usual backup, migration and health-gated rollback (CONTRIBUTING.md, "Deploys"). Nothing was pushed and no pull request was opened.

## Deviations from Plan

None - plan executed exactly as written. Environment notes: `.planning/milestone.lock` is an untracked orchestrator file left alone, so the plan's "tree is clean" check was applied to everything else.

**Total deviations:** 0. **Impact:** none.

## Issues Encountered

None.

## Owner review (carried from 07-01, verbatim from `.planning/milestones/v1.0/README.md`)

Nothing in `cleanup/` was deleted, so there is nothing to restore. These are the candidates kept because they are cited, grouped for a later owner decision. The ones listed first in each group are cited only by phase plans and summaries, not by a ledger, so they are the weakest to keep.

Knip outputs (regenerable with `pnpm knip`; 23 files):

- Cited only by phase plans and summaries: `knip/phase3-after-nonode-summary.txt`, `knip/phase3-before-default-summary.txt`, `knip/phase3-before-nonode-summary.txt`, `knip/phase3-before-production-summary.txt`, `knip/phase3-pr2-default-summary.txt`, `knip/phase3-pr2-nonode-summary.txt`, `knip/phase3-pr2-production-summary.txt`, `knip/phase3-after-production-summary.txt`.
- Cited by a ledger: the other 15 (`before-gap-fix-*`, `calibration-*`, `calibration-canary-*`, `default*`, `production*`, `phase3-after-default-summary.txt`).

jscpd reports (regenerable with `pnpm jscpd`; 14 files):

- Cited only by phase 2 plans: `jscpd/source/jscpd-report.json`, `jscpd/source-with-tests/jscpd-report.json`, `jscpd/whole-repo/jscpd-report.json`.
- Cited by a ledger: the eleven `jscpd/phase5-*/jscpd-report.json` files.

Patches (10 files):

- `ci-pull-supabase-from-ghcr.patch` is the only copy of commits 871ff4d and d25d8e6, which this repository does not contain (the owner applied it with `git am`, which rewrote them as a3f55d4 and ebb9ff6). Keep it.
- The nine `patches/*/000N-*.patch` files are cited by their series' hand-written `apply.sh` and by phase summaries. None of their `From` commits exist in this repository and none has a matching `git patch-id --stable` among its commits, so they also fail the regenerable test.

Notes for the owner:

- GSD tooling (`history-digest`, `/gsd-cleanup`, `complete-milestone`) looks for `milestones/v1.0-phases/` and `milestones/v1.0-ROADMAP.md`. With the `milestones/v1.0/{phases,cleanup,quick,ROADMAP.md,REQUIREMENTS.md}` layout, `history-digest` no longer lists the v1.0 phases. This was accepted with the layout and not worked around.
- `.gitignore` keeps the `.planning/cleanup/logs/` rule, and `.planning/environment/CLOUD-ENVIRONMENT.md` keeps its matching sentence, so raw logs that a clone holds at that old path stay ignored.
- The five v1.0 research files in `.planning/research/` (ARCHITECTURE, FEATURES, PITFALLS, STACK, SUMMARY) still cite pre-archive paths. They stayed in place with the v2.0 research and could move into this archive if you want.
- Do not regenerate `.claude/CLAUDE.md` with GSD (`generate-claude-md`) until `/gsd-map-codebase` has rebuilt the maps: with `.planning/codebase/` gone it would rebuild the stack block from the v1.0 tooling research.
- GSD block-start markers in `.claude/CLAUDE.md` whose source is a deleted map are left unchanged: line 22 `GSD:stack-start source:codebase/STACK.md`, line 173 `GSD:conventions-start source:CONVENTIONS.md`, line 290 `GSD:architecture-start source:ARCHITECTURE.md`. The deferred `/gsd-map-codebase` run after Phase 8 gives their sources back.

Also for the owner: one human check remains from the plan. Open README.md on the branch in GitHub's file view and follow each Documentation link; the page should read as a landing page that fits a couple of screens.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

All four plans of Phase 7 have summaries. The orchestrator runs phase verification and completion. Phase 8 (rebrand) will rewrite the name, `@hearth/*` packages and `hearth-admin` in README.md and the docs.

## Self-Check: PASSED

- `README.md`, `docs/file-map.md`, `.claude/CLAUDE.md` exist; README is 70 lines.
- Commits `6062410` and `69d2fef` are ancestors of HEAD.

---
*Phase: 07-planning-cleanup-documentation-restructure*
*Completed: 2026-10-25*
