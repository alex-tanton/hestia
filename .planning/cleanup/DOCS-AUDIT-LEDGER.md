# Docs audit ledger (PR D: RED-05)

base=5df00ce31e21706d5dae47c0bd08922c04737ea1
branch=docs/sync-specs
worktree=../hearth-docs-sync

Working branch note: the plan names `claude/vigilant-gates-a4ihid`; the session's working branch is
`claude/eloquent-mayer-szjtjf` (see `CI-SETUP-LEDGER.md`, "Gates and decisions"). `base=` is the
working branch tip from which `docs/sync-specs` was cut (`origin/main` is `a660d58`, already merged
into the working branch). PR D is not opened until 05-13.

## Checker

Tool: `.planning/cleanup/tools/docs-claims-check.mjs` (allowlist `docs-claims-allow.tsv`, one row per
token with its reason). It takes every inline code span (and `pnpm` lines inside fenced blocks) of
the given markdown files and tests path-like tokens against `git ls-files` of the checkout (exact,
directory prefix, unique suffix; several matches are `ambiguous`), `pnpm` commands against the root
and `--filter` workspace scripts, and bare `a:b` tokens as script names. Out of scope by design:
tokens with spaces, `=`, `<`, `{`, `$`, URLs, and tokens that start with `/`, `~` or `@`.

```bash
T=.planning/cleanup/tools; D=../hearth-docs-sync
node $T/docs-claims-check.mjs --repo $D [--allow $T/docs-claims-allow.tsv] {files}
```

Before (docs and README as they stood at `base=`, no allowlist; raw output in the gitignored
`logs/05-08-claims-before.tsv`):

checked=551
misses=62

Resolution of the 62 raw misses: none is a missing repository path (research agrees: the real drift is
behavioral). They are IANA time-zone names, the untracked `.env`, relative file names scoped by the
surrounding table, directory shorthand under `e2e/`, an image name, a Tailwind class and similar;
each is allowlisted with its reason in `docs-claims-allow.tsv` (rows `allowed` below) or fixed.

Informational run over `.planning/codebase/*.md` (regenerated in 05-12, not fixed here):

maps-misses-before=182 (of 1270 tokens checked)

## Claims

| # | File:line | Claim | Check | Result | Commit |
| --- | --- | --- | --- | --- | --- |
| 1 | docs/file-map.md:74 | `bin` is "the built `hearth-admin` command-line executable" | `head -1 apps/service/bin/hearth-admin` is `#!/bin/sh`; its last line is `exec node "$here/../dist/cli.js" "$@"`; `docker/service.Dockerfile:35-37` copies it and links it onto the PATH; `apps/service/tsup.config.ts` builds `src/cli.ts` to `dist/cli.js` | fixed: "a hand-written POSIX shell wrapper that runs the bundled `dist/cli.js` (built from `src/cli.ts`)... linked onto the `PATH`" | 6880c28 |
| 2 | docs/file-map.md:60 | `routes` row lists the feature modules | `git ls-files 'apps/service/src/routes/*.ts'` (13 modules plus `routes.test.ts`); `health.ts` is `GET /api/health`, `match-overrides.ts` is the override create and delete routes | fixed: added health and match overrides | 6880c28 |
| 3 | docs/file-map.md:148-156 | `scripts/` table lists the scripts | `git ls-files scripts` against the table; read the header comment of each missing file | fixed: added `deploy.test.mjs`, `ci-prepull-images.sh`, `ci-prepull-images.test.mjs` with a one-line purpose each | 6880c28 |
| 4 | docs/file-map.md:188-203 | `test/` table lists the files | `git ls-files test` against the table | fixed: added `eslint-service-role-fence.test.mjs` (the other seven files were listed) | 6880c28 |
| 5 | docs/file-map.md:18 | the layout row for `scripts/` | same listing | fixed: mentions the CI image pre-pull and the harness tests | 6880c28 |
| research-1 | docs/file-map.md:74 (and the maps and CLAUDE.md copies) | `hearth-admin` is a built executable | see row 1 | fixed in docs/file-map.md; the map and CLAUDE.md copies move in 05-12 | 6880c28 |
| research-4 | docs/file-map.md scripts, test and routes tables | omitted files | see rows 2 to 4 | fixed | 6880c28 |
| research-5 | docs/file-map.md:21 and the CI row at :186 | `.github/` without the composite action | PR A's `.github/actions/setup` is on `main` | deferred to 05-12 (plan order: the CI rows are edited with the maps) | - |
| 6 | docs/file-map.md:140-143 | `tests/`, `fixtures/`, `support/`, `setup/` | checker reports `ambiguous` (several tracked directories share each name); the e2e table is scoped by its section heading and `ls e2e` shows all four | allowed: subfolders of `e2e/`, scoped by the heading | - |
| 7 | docs/file-map.md:156 and others | `.env` | `git ls-files .env` is empty; only `.env.example` is tracked (`.gitignore` has `.env*` and `!.env.example`) | allowed: the real configuration file, never committed | - |
| 8 | docs/file-map.md:191 | `.mjs` | bare extension in prose, every file in `test/` has it | allowed | - |
| 9 | docs/file-map.md:74 | `dist/cli.js` | `apps/service/dist` is build output (`tsup.config.ts` `outDir`) and gitignored | allowed: build output, not tracked | - |

## Behavioral sample

| # | Statement (file:line) | Verified against | Result |
| --- | --- | --- | --- |

## Maps and project instructions

Filled in by 05-12.

## CI

Filled in by 05-12.

filemap-complete=yes

Reverse check for `filemap-complete=yes`: every tracked file name of `scripts/` and `test/` appears
in backticks in `docs/file-map.md` (the verify command's loop over `git ls-files scripts test`), and
every route module under `apps/service/src/routes/` (tests excluded) appears in the `routes` row.
