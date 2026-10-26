---
phase: 05-redundancy-reduction-and-text-sync
plan: 08
subsystem: docs
tags: [docs, readme, claims-checker, audit, ledger, pull-request-d]

requires:
  - phase: 05-redundancy-reduction-and-text-sync
    provides: "05-06: cit-rx.txt and the citation vocabulary; PR A and PR B merged on main (a660d58) and in the working branch"
provides:
  - docs/sync-specs (PR D branch, not yet a pull request) at 158fd52 with the seven specs and the README audited against the code
  - docs-claims-check.mjs (backticked path, script and pnpm command checker) and docs-claims-allow.tsv (34 tokens with reasons)
  - DOCS-AUDIT-LEDGER.md with 53 numbered claim rows, research rows 1 to 6 and 9, a 14-row behavioral sample and the checker totals
affects: [05-12 maps, CLAUDE.md and the CI rows of the file map, 05-13 PR D opening and landing]

actuals:
  tokens: 12000
  tasks: 3
  commits: 3

# commits: measured on the working branch from plan_head_before (git rev-list --count 5df00ce..b8a4111 is 3:
# 95eb9a2, b195cff, b8a4111). The seven docs commits live on docs/sync-specs in ../hearth-docs-sync
# (6880c28, 7f630d3, 7ae5179, e9fe4ac, f58c28e, 853f94a, 158fd52) and are not on the working branch. The
# close-out commit `docs: complete plan 05-08` follows plan_head_after. tokens is chars/4 over the checker,
# the ledger, the allowlist and the docs diff.
plan_head_before: 5df00ce31e21706d5dae47c0bd08922c04737ea1
plan_head_after: b8a4111b77c7cb1a6f5585fb713a321216fe607a

tech-stack:
  added: []
  patterns:
    - "A docs claim is checked against the code, never against another doc; the checker covers paths, scripts and commands, a hand-read behavioral sample covers the rest"
    - "A source line number in a spec is replaced by the symbol it pointed at, because PR C moves lines"

key-files:
  created:
    - .planning/cleanup/tools/docs-claims-check.mjs
    - .planning/cleanup/tools/docs-claims-allow.tsv
    - .planning/cleanup/DOCS-AUDIT-LEDGER.md
  modified:
    - "docs/file-map.md, docs/testing.md, docs/deploy.md, docs/architecture.md, docs/branding.md, docs/design.md, docs/use-cases.md and README.md on docs/sync-specs (no file added under docs/)"

key-decisions:
  - "Source line numbers in docs/branding.md are replaced by symbol names, because the lines for notificationCopySchema shift when PR C merges"
  - "Plan version labels (v1, v1.3) and a GSD phase number are removed from design.md and file-map.md rather than left as dangling references"
  - "The Phase 4 behavior (held deal-add id, per-list add-to-list lock) is added to architecture.md and use-cases.md; no Phase 6 decision is described as made"
  - "The checker treats tokens that start with /, ~ or @ and bare words as out of scope; ambiguous bare file names go to the allowlist with a reason"

patterns-established:
  - "Ledger key lines checked-after, misses-after and filemap-complete are the recorded evidence for RED-05"

requirements-completed: []

duration: about 20 minutes wall time by the session clock
completed: 2026-10-21
status: complete
---

# Phase 5 Plan 08: PR D content Summary

**A path, script and pnpm checker now runs clean (582 tokens, 0 misses with a 34-token reasoned allowlist) over all seven specs and the README; the docs say `hearth-admin` is a hand-written shell wrapper, state the coverage setup as configured, name the Kong routes, describe the held deal-add id, and the README carries no retired-spec citation.**

## Performance

- **Duration:** about 20 minutes wall time by the session clock
- **Completed:** 2026-10-21
- **Tasks:** 3 (one tracer, two auto)
- **Files modified:** 8 docs files on `docs/sync-specs`; three new files under `.planning/cleanup/` on the working branch

## Accomplishments

- **Checker (D-18).** `docs-claims-check.mjs` takes inline code spans (and `pnpm` lines in fenced blocks), tests path-like tokens against `git ls-files` (exact, directory prefix, unique suffix, glob), `pnpm` commands against the root and `--filter` workspace scripts, and bare `a:b` tokens as script names. It lints clean. Before (docs and README at `base=`, no allowlist): `checked=551 misses=62`, none a missing repository path. After: `checked=582 misses=0` with the allowlist. Informational run over the codebase maps: `maps-misses-before=182` of 1270 (regenerated in 05-12).
- **Task 1, file map.** The `bin` row now says `apps/service/bin/hearth-admin` is a hand-written POSIX shell wrapper that runs the bundled `dist/cli.js` and is linked onto the PATH; the routes row names `health` and `match-overrides`; the `scripts/` table lists `deploy.test.mjs`, `ci-prepull-images.sh`, `ci-prepull-images.test.mjs`; the `test/` table lists `eslint-service-role-fence.test.mjs`. The reverse check (every tracked file of `scripts/`, `test/` and every route module appears) holds: `filemap-complete=yes`. The `.github/` rows wait for 05-12 (research row 5).
- **Task 2, testing, deploy, architecture.** `testing.md`: only `packages/recurrence` runs `--coverage` in `test`; matching and shared set 90% thresholds that apply to `test:coverage`, which CI does not run; `apps/web` has `test:coverage` and thresholds 82/78/74/84 that CI does not run; a new "Analysis tools" subsection documents `pnpm knip`, `pnpm knip:production`, `pnpm knip:summary` and the pinned `pnpm dlx jscpd@5.4.1` command as report-only. `deploy.md`: the Kong paragraph now names every route in `docker/kong.yml` (including the Realtime routes it had left out); the force-recreate step, command-scoped `PGPASSWORD`, deploy order, 60 s health poll, backup schedule, ports and docs-only skip were confirmed (`holds` rows). `architecture.md`: deal-add is an online mutation whose item id is held per list, deal and user at `QueryClient` scope, in memory only; recipe and meal-plan add-to-list is serialized per list by an advisory lock.
- **Task 3, remaining specs and README.** `branding.md`, `design.md` and `use-cases.md` were checked claim by claim (40 hex values, token names, breakpoints, pillars, state primitives, password and invite rules, CLI, subscription formulas, notification timing); mismatches fixed (source line numbers replaced by symbol names, a refused-write message named by file, two plan version labels and one phase number removed) and the two Phase 4 behaviors added to `use-cases.md`. The README lost its three retired-spec citations (the `Engineering Practices` pointer sentence, `Seed Data` and the `Technical Architecture` parenthetical), its scripts and `pnpm test` rows were corrected, and the owner CLI is described as a shell wrapper. `git grep -nE -f cit-rx.txt -- README.md docs` prints nothing.
- **Result.** `docs/` still holds exactly seven files and none was added (T-05-21); `docs/sync-specs` differs from `origin/main` outside `.planning` only in `docs/` and `README.md`. The three verify commands passed (`TASK1-VERIFY-PASS`, `TASK2-VERIFY-PASS` after one rewording, `TASK3-VERIFY-PASS`).

## Claims fixed per doc

| Doc | Claims fixed | Rows |
| --- | --- | --- |
| docs/file-map.md | 6 (bin, routes, scripts table, test table, layout row, phase number) | 1 to 5, 45 |
| docs/testing.md | 3 (two coverage statements, analysis tools) | 10 to 12 |
| docs/deploy.md | 1 (Kong route names and Realtime routes) | 18 |
| docs/architecture.md | 2 (held deal-add id, add-to-list lock) | 27, 28 |
| docs/branding.md | 2 (line numbers, refused-write message) | 37, 38 |
| docs/design.md | 1 (version labels) | 44 |
| docs/use-cases.md | 2 (held id, overlapping calls) | 41, 42 |
| README.md | 6 (three citations, scripts row, test row, CLI wording) | 46 to 51 |

Confirmed unchanged (`holds`): rows 13 to 17, 19 to 26, 29 to 35, 39, 40, 43, 52. Research rows 1, 2, 3, 4, 6, 9 are fixed, row 5 is deferred to 05-12, rows 7 and 8 belong to the maps and the README rows above.

## Allowlist (34 tokens, `docs-claims-allow.tsv`)

| Tokens | Reason |
| --- | --- |
| `tests/`, `fixtures/`, `support/`, `setup/` | subfolders of `e2e/` scoped by the section heading; several tracked directories share each name |
| `.env` | the real configuration file at `/srv/hearth/.env`, never committed |
| `.mjs`, `.test.ts` | bare file suffixes in prose |
| `dist/cli.js` | tsup build output, gitignored |
| eight IANA zone ids (`America/New_York`, `America/Chicago`, `America/Los_Angeles`, `Asia/Tokyo`, `Etc/UTC`, `Pacific/Kiritimati`, `Pacific/Pago_Pago`, `:America/New_York`) | time-zone ids, not paths |
| `money.ts`, `money.test.ts`, `occurrence.ts`, `app.ts`, `bills.ts`, `db.ts`, `index.ts`, `vitest.config.ts` | bare names scoped by their sentence; several tracked files carry each name |
| `ghcr.io/supabase`, `public.ecr.aws/supabase`, the postgres image reference, `supabase/setup-cli@v3` | registry names, image reference and an action reference |
| `virtual:pwa-register/react`, `import('../privileged/…')`, the jscpd ignore globs | a virtual module, a syntax example, comma-joined globs |
| `components/icons`, `Dialog.tsx`, `lg:pl-56` | named in negations, and a Tailwind class |

## Behavioral sample (14 rows in `DOCS-AUDIT-LEDGER.md`)

All 14 hold after the fixes: (1) `hearth-admin` is a hand-written shell wrapper over `dist/cli.js`; (2) `reset-password` prints a one-time link; (3) `kong-entrypoint.sh` substitutes the two keys and starts Kong; (4) the outbox is claim-then-send; (5) the E2E overlay changes ports, fixtures, rate limit and push transport; (6) deal-add holds its id per list and deal; (7) Kong is an allowlist; (8) the migration password is command-scoped; (9) unit tests pin `Date` to `2026-10-14T12:00:00.000Z`; (10) knip is report-only and not in CI; (11) coverage statements match the scripts; (12) the seed password and the refusal of non-seed databases; (13) add-to-list is serialized per list; (14) no retired-spec citation remains in `README.md` or `docs/`.

## Task Commits

1. **Task 1: checker, file map** - `6880c28` (docs, on `docs/sync-specs`), `95eb9a2` (docs: record the docs claims checker and file map audit, working branch)
2. **Task 2: testing, deploy, architecture** - `7f630d3`, `7ae5179`, `e9fe4ac`, `f58c28e` (docs), `b195cff` (working branch ledger)
3. **Task 3: design, branding, use-cases, README** - `853f94a`, `158fd52` (docs), `b8a4111` (working branch ledger and allowlist)

**Plan metadata:** the `docs: complete plan 05-08` commit that adds this summary and the state updates.

`docs/sync-specs` is pushed at `158fd52`; the working branch `claude/eloquent-mayer-szjtjf` was pushed at `b8a4111` before this summary. PR D is not opened: 05-13 opens it after PR C is merged.

## Decisions Made

- The checker is deliberately narrow (paths, scripts, `pnpm` commands); everything else is covered by the hand-read behavioral sample and the per-doc claim rows.
- `docs/branding.md` and `docs/design.md` quote code by symbol, not by line, because PR C changes the lines they pointed at (checked on the tip of `refactor/drop-spec-citations`).
- No Phase 6 decision is described: the coverage and analysis-tool text states only what is configured and what CI runs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Verify command needed a line containing both "deal" and "held"**
- **Found during:** Task 2 (the plan's check `grep -niE 'deal' architecture.md | grep -qiE 'held|retry'` works per line)
- **Issue:** the new architecture paragraph put the words on different lines, so the check failed although the text was correct.
- **Fix:** the paragraph's first sentence now reads "Adding a deal to a list is not a queued write, and its item id is held across a retry." (a new commit, `f58c28e`; nothing amended).
- **Files modified:** `docs/architecture.md`
- **Commit:** `f58c28e`

**2. [Rule 2 - Missing critical] Route names were absent from deploy.md**
- **Found during:** Task 2 (the plan expects `auth-v1-*` and `realtime-v1-ws` in the Kong paragraph)
- **Issue:** the paragraph described the allowlist by short names (`token`, `logout`) and left out the Realtime routes `realtime-v1-ws` and `realtime-v1-rest` and the refused `tenants` and `openapi` paths that `docker/kong.yml` defines.
- **Fix:** the paragraph names every route and states the Realtime routes (T-05-20).
- **Files modified:** `docs/deploy.md`
- **Commit:** `7ae5179`

**3. [Rule 1 - Bug] Checker glob and directory handling**
- **Found during:** Task 1 and Task 2 (first runs reported `privileged/**`, `packages/*` and a unique directory as misses)
- **Fix:** a glob matches a tracked path or one of its directories, and a bare directory name with exactly one tracked match is accepted.
- **Files modified:** `.planning/cleanup/tools/docs-claims-check.mjs`
- **Commit:** `95eb9a2`, `b195cff`

**Total deviations:** 3 auto-fixed (1 verify-command shape, 1 missing documentation, 1 checker refinement), 0 architectural. **Impact on plan:** none; every acceptance criterion holds.

## Issues Encountered

None beyond the above. The Husky pre-commit hook ran lint-staged and a full workspace typecheck on each commit and passed; no `workflow`-scope refusal, no registry flake, no gate failure. No integration or E2E run was needed for a docs-only change.

## Known Stubs

None.

## Threat Flags

None. Docs and planning text only; no endpoint, auth path, file access or schema change. T-05-20 is mitigated by rows 18 to 24 (each Kong, recreate and password statement checked against `docker/kong.yml`, `scripts/deploy.sh` and `scripts/deploy.test.mjs`), T-05-21 by the seven-file count and the empty added-files diff under `docs/` in every task.

## Next Phase Readiness

- 05-09 (`apps/web` comment batches, PR C) is independent of this plan. 05-12 refreshes the codebase maps and `.claude/CLAUDE.md` from the corrected docs and adds the `.github/actions/setup` rows to `docs/file-map.md` (research row 5).
- `docs/sync-specs` is based on `5df00ce` and takes a fresh `git merge --no-edit {WB}` before its push in 05-13 (D-04).

## Self-Check: PASSED

- Files exist: `.planning/cleanup/tools/docs-claims-check.mjs`, `.planning/cleanup/tools/docs-claims-allow.tsv`, `.planning/cleanup/DOCS-AUDIT-LEDGER.md`; `docs/` holds seven files.
- Commits `6880c28`, `7f630d3`, `7ae5179`, `e9fe4ac`, `f58c28e`, `853f94a`, `158fd52` are ancestors of `origin/docs/sync-specs` (`158fd52`); `95eb9a2`, `b195cff`, `b8a4111` are ancestors of the working branch and its `origin` tip.
- Ledger keys `checked=`, `filemap-complete=yes`, `misses-after=0` are present; the research rows 1 to 6 and 9 and 14 behavioral rows exist.
- Token scans (tracked-pattern scan and value scan) succeeded.

---
*Phase: 05-redundancy-reduction-and-text-sync*
*Completed: 2026-10-21*
