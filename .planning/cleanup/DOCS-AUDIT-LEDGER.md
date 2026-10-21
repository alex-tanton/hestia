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
| 10 | docs/testing.md:692-693 | the three pure packages' `test` and `test:coverage` both run `--coverage`, so `pnpm test` fails below 90% in any of the three | `grep '"test"' packages/{recurrence,matching,shared}/package.json`: only recurrence has `--coverage`; thresholds (lines, branches, functions, statements all 90) in the three `vitest.config.ts`; CI `test-unit` runs `pnpm test` | fixed: only recurrence's `test` runs `--coverage`; matching and shared thresholds apply to `test:coverage`, which CI does not run (research-2) | 7f630d3 |
| 11 | docs/testing.md:706-708 | `apps/web` has no `test:coverage` script and no coverage configuration | `apps/web/package.json:12`; `apps/web/vite.config.ts:78-88` thresholds 82/78/74/84; `.github/workflows/ci.yml` has no web coverage step | fixed: states the script, the four thresholds and that CI does not run them; no Phase 6 decision described (research-3) | 7f630d3 |
| 12 | docs/testing.md (new subsection) | analysis tools: knip scripts and the jscpd command are report-only | root `package.json` scripts `knip`, `knip:production` (`!e2e`, `!supabase/seed`), `knip:summary`; `grep -n knip .github` empty; jscpd command and four ignore globs from `TRIAGE.md` "Duplication baseline" (test-inclusive form); `git grep jscpd -- . ':!.planning'` was empty at `base=` | fixed: added "Analysis tools" under Coverage (research-9) | 7f630d3 |
| 13 | docs/testing.md:6, 18-27, 52 | nine `node --test` files: two in `e2e/support`, seven harness tests; `pnpm test:harness` runs the seven | `e2e/package.json` test script lists 2 files; root `test:harness` lists 7 files, names match the doc's list (clock pin, zone hook, sweep, lint ban, service-role fence, deploy, pre-pull) | holds | - |
| 14 | docs/testing.md:693-704 | service coverage thresholds 95/83/96/97 on `vitest.coverage.config.ts`; `test-integration` runs it | `apps/service/vitest.coverage.config.ts` thresholds statements 95, branches 83, functions 96, lines 97; `ci.yml:53` `pnpm --filter @hearth/service test:coverage` | holds | - |
| 15 | docs/testing.md:63-70 | `HEARTH_TEST_NOW` defaults to `2026-10-14T12:00:00.000Z`; every unit config loads the pin and the zone hook, the integration config only the hook | `test/clock-setup.mjs`; `setupFiles`/`globalSetup` in the workspace configs read above; `apps/service/vitest.integration.config.ts` has `globalSetup` only | holds | - |
| 16 | docs/testing.md:94-135 | sweep matrix (6 unit cells, 5 integration cells) and flags `--workspace --cell --only --log-dir --list` | `scripts/test-sweep.mjs` `UNIT_CELLS`, `INTEGRATION_CELLS`, `parseArguments` | holds | - |
| 17 | docs/testing.md:345-355 | E2E run isolation: subnets `172.16.240.0/24` to `172.16.254.0/24`, `retries: 0`, `HEARTH_E2E_REUSE_STACK`, spec numbering up to `20-remove-member` | `e2e/support/run-identity.ts` `SUBNET_CANDIDATES` (15 from 240), `e2e/playwright.config.ts:23`, `e2e/support/env.ts`, `ls e2e/tests` | holds | - |
| 18 | docs/deploy.md:77-82 | the Kong allowlist paragraph names the allowed calls | `docker/kong.yml` route names: `auth-v1-verify`, `-token`, `-logout`, `-user`, `-otp`, `-admin-users`, `-denied`, `realtime-v1-ws`, plus `realtime-v1-rest` (open to anon and admin) and the refused `realtime-v1-rest-tenants` and `-openapi` | fixed: the paragraph now names each route and states the Realtime routes it left out (T-05-20) | 7ae5179 |
| 19 | docs/deploy.md:177-179 | after a `docker/kong.yml` change run `hearth-compose up -d --force-recreate kong` | `docker/docker-compose.yml:157` bind-mounts `./kong.yml`; `scripts/deploy.sh` step 3 starts `kong` with `--no-recreate` | holds (T-05-20) | - |
| 20 | docs/deploy.md:160 | the migration step passes the password in `PGPASSWORD`, for that one command, never on its command line | `scripts/deploy.sh` migration step: `PGPASSWORD="$(env_value POSTGRES_PASSWORD)" supabase migration up --workdir ... --db-url "postgresql://postgres@${db_ip}:5432/..."`; `scripts/deploy.test.mjs` | holds (T-05-20) | - |
| 21 | docs/deploy.md:150-175 | deploy steps 1 to 8 in order, 60 s health poll, automatic rollback, five newest SHA tags kept | `scripts/deploy.sh` (`health_timeout_seconds=60`, `keep_tags=5`, `switch_to`, `healthy_within`) | holds | - |
| 22 | docs/deploy.md:206-209 | backup nightly at 02:00 UTC, keeps 14 daily, 8 weekly, 6 monthly | `docker/docker-compose.yml:277-281` (`SCHEDULE: 0 2 * * *`, `TZ: UTC`, `BACKUP_KEEP_*`) | holds | - |
| 23 | docs/deploy.md:6-9, 66-72 | only Caddy publishes a port, `127.0.0.1:8080`; Caddy refuses `POST /auth/v1/signup*` and `PUT /auth/v1/user*` with 403; `BACKUP_DIR` read-write in `backup`, read-only in `hearth-service` | `docker/docker-compose.yml:245-246, 214, 267`; `docker/Caddyfile` `@refused_signup`, `@refused_user` | holds | - |
| 24 | docs/deploy.md:131-134, 297-298 | deploy workflow re-checks push to `main`, runs on `[self-hosted, hearth]`, skips when only `docs/` changed | `.github/workflows/deploy.yml` (`if:` conditions, `runs-on`, the `git diff --name-only HEAD~1 HEAD` step) | holds | - |
| 25 | docs/deploy.md:83-103 | `.env.example` variables in order; the first five owner-filled (three copied by `generate-secrets.sh`); `VAPID_SUBJECT` fallback | `.env.example`; `scripts/generate-secrets.sh:72` (`HEARTH_ORIGIN`, `HEARTH_OWNER_EMAIL`, `BACKUP_DIR`); `apps/service/src/env.ts` `vapidSubjectFor` | holds | - |
| 26 | docs/deploy.md:37-38 | Supabase CLI 2.117.0 as CI uses; Node 24 from `.nvmrc` | `.github/workflows/ci.yml:44-46` version 2.117.0; `.nvmrc` is `24` | holds | - |
| 27 | docs/architecture.md:298 | every queueable write carries a client-generated UUID or an absolute value (deal-add not distinguished) | `apps/web/src/lib/api/deals.ts:230-275` (`heldDealAdds` WeakMap per `QueryClient`, key `listId:dealId`, per user); `FIX-LEDGER-HELD-ID.md` (c), (d) | fixed: new paragraph says deal-add is an online mutation, id held per list and deal across retry and unmount, in memory only, reload mints a new id; queued-write sentence kept (research-6) | e9fe4ac |
| 28 | docs/architecture.md (API surface) | idempotency of add-to-list is not described | `apps/service/src/services/add-to-list.ts:35` `pg_advisory_xact_lock` per list (Phase 4 FIX-02) | fixed: added the per-list serialization sentence | e9fe4ac |
| 29 | docs/architecture.md:75-130 | the data-model tables (25) and the Realtime publication of four tables | `grep 'create table public' supabase/migrations/*.sql` gives 25 names, all listed; `20260919070300_realtime.sql` adds `shopping_list`, `shopping_list_item`, `chore_completion`, `errand` | holds | - |
| 30 | docs/architecture.md:34-40 | `hearth_service` is `NOLOGIN` in the migration, `NOINHERIT`, member of `anon`, `authenticated`, `service_role` | `supabase/migrations/20260919060000_hearth_service_role.sql` | holds | - |
| 31 | docs/architecture.md:42-62 | only `main.ts` and `cli.ts` import `privileged/`; lint rule pattern `**/privileged/*` plus a `no-restricted-syntax` selector for dynamic imports | `eslint.config.js:97-128`; `test/eslint-service-role-fence.test.mjs` | holds | - |
| 32 | docs/architecture.md:228-246 | job names and schedules, `withJobLock` with `pg_try_advisory_lock(hashtext(...))`, unlock in `finally`, `queueBackgroundRefresh` | `apps/service/src/jobs/scheduler.ts:29-32`, `advisory-lock.ts:26-32`, `scheduler.ts`; `prune-cache.ts` deletes four things | holds | - |
| 33 | docs/architecture.md:297-350 | retries capped at 3; claim-then-send in `notification-outbox.ts`; unsent rows dropped 24 hours after `send_after`; quiet-hours functions in the named migrations | `apps/web/src/lib/offline/write-queue.ts:113`; `apps/service/src/privileged/notification-outbox.ts:36, 90-125`; `grep 'function public.'` of the migrations | holds | - |
| 34 | docs/architecture.md:166-180 | membership lifecycle function names and the helper functions | `grep -E 'function public\.(create_household|household_members|...)'` finds each in `20260919070200_functions.sql`, `..070100_rls.sql`, `20260925080000_...`, `20261004090000_...` | holds | - |
| 35 | docs/architecture.md:196-214 | API groups: `POST /api/signup`, `/api/users/me/*`, `GET /api/health/deep` owner-only | `apps/service/src/routes/auth.ts:14`, `users.ts`, `system.ts:34-36` | holds | - |
| 36 | docs/testing.md and docs/architecture.md | checker misses: IANA zone ids (`America/New_York`, `America/Chicago`, `America/Los_Angeles`, `Asia/Tokyo`, `Etc/UTC`, `Pacific/Kiritimati`, `Pacific/Pago_Pago`, `:America/New_York`), bare suffix `.test.ts`, bare names (`money.ts`, `money.test.ts`, `occurrence.ts`, `app.ts`, `bills.ts`, `db.ts`, `index.ts`, `vitest.config.ts`), registry names (`ghcr.io/supabase`, `public.ecr.aws/supabase`, the postgres image), `supabase/setup-cli@v3`, `virtual:pwa-register/react`, `import('../privileged/…')`, the jscpd ignore globs | each read in place; reasons are in `docs-claims-allow.tsv` | allowed: not repository paths, or bare names scoped by their sentence | - |
| research-2 | docs/testing.md:692-693 | coverage enforcement of the three pure packages | see row 10 | fixed | 7f630d3 |
| research-3 | docs/testing.md:706-708 | `apps/web` coverage | see row 11 | fixed | 7f630d3 |
| research-6 | docs/architecture.md:298 | deal-add is a queued write | see row 27 | fixed | e9fe4ac |
| research-9 | docs/testing.md | jscpd and knip documented | see row 12; D-17 asks for the scan to be documented, so the subsection was added | fixed | 7f630d3 |

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
