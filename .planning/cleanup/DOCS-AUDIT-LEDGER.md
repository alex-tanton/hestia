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

After (docs and README at the tip of `docs/sync-specs`, with the allowlist of 34 tokens; raw output in
the gitignored `logs/05-08-claims-after.tsv`):

checked-after=582
misses-after=0

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
| research-5 | docs/file-map.md:21 and the CI row at :189 | `.github/` without the composite action | `.github/actions/setup/action.yml` (pnpm/action-setup@v6, actions/setup-node@v7 with `.nvmrc` and the pnpm cache, `pnpm install --frozen-lockfile`); `grep -c 'uses: ./.github/actions/setup' .github/workflows/ci.yml` is 6 | fixed: both rows name the composite action in `.github/actions/setup/` that the six CI jobs call after checkout | 5cfa35d |
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
| 27 | docs/architecture.md:298 | every queueable write carries a client-generated UUID or an absolute value (deal-add not distinguished) | `apps/web/src/lib/api/deals.ts:230-275` (`heldDealAdds` WeakMap per `QueryClient`, key `listId:dealId`, per user); `FIX-LEDGER-HELD-ID.md` (c), (d) | fixed: new paragraph says deal-add is an online mutation, id held per list and deal across retry and unmount, in memory only, reload mints a new id; queued-write sentence kept (research-6) | e9fe4ac, f58c28e |
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
| 37 | docs/branding.md:195-205 | source line numbers for `notifications.ts:112-113`, `scrub.ts:4-13`, `:78`, `:16`, `:4-5` | `sed -n` at `base=` and at the tip of `refactor/drop-spec-citations` (PR C lands first): the schema lines are 111-112 at base and 109-110 after PR C, the `RULES` list starts at line 82; the doc's numbers were already off by one | fixed: names the symbols (`notificationCopySchema`, `RULES`, `SECRET_KEYS`, `CONTENT_KEYS`, `SCRUBBED_MESSAGE_MAX_LENGTH`) instead of lines | 853f94a |
| 38 | docs/branding.md:184 | "Queued change refused" pattern | `git grep -i 'queued change\|change refused'` finds only the doc; the message is in `apps/web/src/lib/offline/chore-errand-writes.ts:266-267` | fixed: names the refused-write message and its file | 853f94a |
| 39 | docs/branding.md:19-165 | 40 hex values, token names, type scale, motion tokens, `data-section`, no `tailwind.config.*`, Lucide `size={24}` `strokeWidth={1.5}` | script over `apps/web/src/index.css` (39 of 40 hex values present; the 40th, `#CA8A04`, is the 600 stop the doc says is not used); `grep` of the tokens, `TabBar.tsx:33-34`, `Button.tsx` `duration-150`, `ls apps/web/tailwind.config.*` | holds | - |
| 40 | docs/design.md (all sections) | 1025px breakpoint, `lg:w-56`/`lg:pl-56`, `max-w-160`/`max-w-240`, five pillars and sub-tabs, `RELEASED_PILLARS`, state primitives, `PendingMark`, `useWriteQueue` toast text, `flushPersister` and the 1 s throttle, `ConfirmDialog` starts on Cancel, `deletionSummary`, axe tags, `THEMES`, `prefers-reduced-motion` | `index.css:20, 259, 385`; `AppShell.tsx:99-110`; `TabBar.tsx`; `sections.ts`; `PendingMark.tsx`; `use-write-queue.ts:111`; `persist.ts:38-51`; `ConfirmDialog.tsx`; `DeleteHouseholdPanel.tsx`; `e2e/support/axe.ts:5`; `17-accessibility-states.spec.ts:28` | holds | - |
| 41 | docs/use-cases.md (Add deal items to a list) | a repeated tap after a lost response is not described | `apps/web/src/lib/api/deals.ts:230-275`, `FIX-LEDGER-HELD-ID.md` | fixed: new alternate flow (held id, per list, deal and user, memory only, online action) | 853f94a |
| 42 | docs/use-cases.md (Add missing ingredients to a list) | overlapping calls for one list are not described | `apps/service/src/services/add-to-list.ts:28-37` | fixed: new alternate flow (handled one after the other per list) | 853f94a |
| 43 | docs/use-cases.md:15-120, 380-581 | password rules (8 characters, 72 bytes, 10,000-entry list), Crockford code of 8 characters, 7-day invite, `hearth-admin reset-password` prints a one-time link, subscription formulas, `household_bill_reminders`, batch `send_after`, undo toast 5 s, notification send times and the 60-character cap | `packages/shared/src/password.ts:6-15`, `apps/service/src/services/invites.ts:8-16`, `apps/service/src/cli.ts:19-50`, `services/subscriptions.ts:23-28`, `20260919070000_schema.sql:48`, `notifications/planners.ts:16`, `Toast.tsx:36-39`, `use-chore-completion.ts:22`, `api/notifications.ts` | holds | - |
| 44 | docs/design.md:142-143 | queueable writes "from v1" and "from v1.3" | the labels name plan versions that no document explains | fixed: version labels removed, the list of writes kept | 853f94a |
| 45 | docs/file-map.md:182 | "Phase 3 removes only what knip plus a text search and tests prove dead" | Phase 3 is complete; the sentence was a plan note | fixed: "Code it reports is removed only when a text search and the tests also show it is unused" | 853f94a |
| 46 | README.md:69 | "Engineering Practices, 'E2E environment', has the detail." (research-8) | `git grep -nE -f cit-rx.txt -- README.md docs` printed 3 lines at base, now none | fixed: sentence removed | 158fd52 |
| 47 | README.md:121 | "Creates the Seed Data users" | same | fixed: "Creates the seed users" | 158fd52 |
| 48 | README.md:146 | "(Technical Architecture, \"Deployment\")" | same | fixed: parenthetical removed, the statement kept | 158fd52 |
| 49 | README.md:24 | `scripts` row lists `deploy.sh` and `generate-secrets.sh` | `git ls-files scripts` | fixed: "Deploy, secrets, CI pre-pull and test sweep scripts" | 158fd52 |
| 50 | README.md:40 | `pnpm test` runs "Vitest unit and component tests" | root `package.json`: `pnpm test:harness && pnpm -r test` | fixed: "Harness tests, then Vitest unit and component tests" | 158fd52 |
| 51 | README.md:126-131 | the owner CLI "is a bin in the service image" and runs from the built bundle | `apps/service/bin/hearth-admin` is a `#!/bin/sh` wrapper over `dist/cli.js` (row 1) | fixed: says it is a shell wrapper around the built `dist/cli.js` | 158fd52 |
| 52 | README.md (commands) | `pnpm db:seed`, `pnpm db:types`, `pnpm test:sweep`, `pnpm knip`, `pnpm --filter @hearth/service test:coverage`, the E2E variables, `HEARTH_SEED_*`, the deploy and restore steps | claims checker over README (0 misses with the allowlist); `apps/service/package.json` scripts; `supabase/seed/seed-users.ts:11-13`; `e2e/setup/stack.ts:165` (`ready at`); steps match `docs/deploy.md` (rows 19 to 24) | holds | - |
| 53 | docs/branding.md:130, docs/design.md:119 and :231 | checker misses `components/icons`, `Dialog.tsx`, `lg:pl-56` | each is a negation or a Tailwind class | allowed: reasons in `docs-claims-allow.tsv` | - |
| 54 | docs/file-map.md:21 | `.github/` row | `.github/actions/setup/action.yml` exists on `main` (PR A) | fixed: names the composite setup action | 5cfa35d |
| 55 | docs/file-map.md:73 | service `test` row | `ls apps/service/src/test`: `stack-hooks.ts` (`registerStackHooks`, `expectStatus`), `job-logger.ts` (`recordingJobLogger`) | fixed: names both helpers | 5cfa35d |
| 56 | docs/file-map.md:46 | web `test` row | `apps/web/src/test/browser.ts` exports `setOnline`, `stubCoarsePointer`, `registerBrowserStubs`, `registerHouseholdClock`, `openMenu` | fixed: names `browser.ts` and what it stubs | 5cfa35d |
| 57 | docs/testing.md (Integration tests, after the isolation patterns) | how route-level files start the stack | `apps/service/src/test/stack-hooks.ts`: `beforeAll` starts the stack, `beforeEach` builds an app, `afterAll` closes it; `expectStatus` asserts the status with the body as message; `job-logger.ts` collects job log lines; 8 test files call `registerStackHooks()`, others keep their own hooks | fixed: new paragraph, worded as "many" files | 5cfa35d |
| 58 | docs/testing.md (Frontend/component tests, after Tools) | shared web test helpers | `apps/web/src/test/browser.ts`: `setOnline` spies `navigator.onLine` and sets TanStack's `onlineManager`; `stubCoarsePointer` stubs `matchMedia`; `registerHouseholdClock(instant)` fakes only `Date` | fixed: new "Shared helpers" paragraph | 5cfa35d |
| 59 | README.md:5, :121 and `.env.example:9`, `docker/docker-compose.yml:275` pointers | README citations of sections and docs | README headings `Deployment` (line 145), `Restore test (quarterly)` (243) and `Restore production` (282); `docs/testing.md` has the isolation text; `git grep -nE -f cit-rx.txt -- README.md docs CONTRIBUTING.md` prints nothing | holds for `README, "Deployment"` and `docs/testing.md`; `docker/docker-compose.yml:275` said `README, "Restore"` but no heading is exactly that (two start with `Restore`); fixed in 05-12 under the owner's request, see row 61 | 29b9c6a |
| 60 | docs/file-map.md:62 | the `jobs` row says the folder refreshes "deals and meal plans" | `apps/service/src/jobs/scheduler.ts` `JobName` is `'refresh-deals' \| 'log-autopay' \| 'dispatch-notifications' \| 'prune-cache'` (four scheduled jobs); `refresh-plan.ts` exports the pure planners `planRefresh` and `planFlyerRefreshNotifications`, imported by `refresh-deals.ts:12`, and decides which flyers a deal refresh fetches; nothing under `jobs/` refreshes meal plans; `docs/architecture.md:243-248` lists the four jobs | fixed: "refreshing deals" | eda7416 |
| 61 | docker/docker-compose.yml:275 | comment cites `(README, "Restore")` | README headings `Restore test (quarterly)` (243) and `Restore production` (282); the second explains restoring into a fresh Supabase Postgres container, the case `--clean --if-exists` serves; `nonts-comment-check.mjs --base HEAD` printed `OK docker/docker-compose.yml (parsed YAML deep-equal)` | fixed: `(README, \"Restore production\")`, comment-only | 29b9c6a |
| 62 | docs/*.md, README.md | version claims for images and tools (the Caddy tag drifted in the old `.claude/CLAUDE.md`) | `grep -rnoE 'caddy:?[ -]?2\.[0-9.]+' docs README.md` is empty; images in `docker/docker-compose.yml` (postgres 17.6.1.167, gotrue v2.196.0, realtime v2.130.0, kong 3.9.3, backup 17-debian-d257e5d) and `docker/caddy.Dockerfile:33` (caddy 2.11.7-alpine) against every doc, map and CLAUDE.md; a script compared every `pkg x.y.z` in the maps, CLAUDE.md, docs and README with the `package.json` files (no mismatch); `node:24.21.0`, `pnpm 10.34.5`, Supabase CLI `2.117.0`, esbuild `0.28.2`, Workbox `7.4.1` match | holds in docs and maps; the stale `caddy:2.11.4-alpine` in the old CLAUDE.md was replaced by regeneration (maps-2) | - |
| maps-1 | .planning/codebase/CONVENTIONS.md:62 | the five `eslint-disable-next-line` comments "each carry a `-- reason`" | `git grep -n eslint-disable` over apps, packages, e2e and supabase/seed: five; four have `-- reason`, `apps/service/src/cli.test.ts:65` has its reason on the comment line above | fixed in the map before regeneration: "Four carry a `-- reason`; the `cli.test.ts` one states its reason in the comment line above it" | b506589 |
| maps-2 | .claude/CLAUDE.md:117 (old) | Caddy image `caddy:2.11.4-alpine`; scheduled jobs "(dispatch notifications, refresh deals, refresh plan, prune cache, log autopay)" | `docker/caddy.Dockerfile:33` is `caddy:2.11.7-alpine`; four scheduled jobs (row 60) | fixed by regeneration: the stack block says `caddy:2.11.7-alpine`; the maps state `refresh-plan.ts` is a planner used by `refresh-deals.ts`, not scheduled | b506589 |
| maps-3 | .planning/codebase/*.md (research row 7) | stale statements: RotationEditor suppression, Kong `auth-v1-all`, "eslint-disable appears only twice", console use in the deleted benchmark, tests never depend on the wall clock | `grep -rniE 'rotation\|catch-all\|auth-v1-all\|benchmark\|wall clock\|console\.' .planning/codebase`: none of the five old statements remains; CONCERNS.md:131 describes the pin and the real-clock integration and E2E runs; `git grep -n 'console\.'` over `apps/**/src`, `packages/**/src` and `e2e` is empty | holds in the regenerated maps | - |
| maps-4 | .planning/codebase/ARCHITECTURE.md:256, CONCERNS.md:113, ARCHITECTURE.md:258 | deals route is the only route importing `withUserDb`; `functions.sql` has 13 function definitions and 14 `search_path` lines; `lists/deals` and `lists/flyers` precede `lists/*` | `git grep withUserDb -- apps/service/src/routes` (`deals.ts:14` import, `recipes.ts:25` comment only); `grep -ciE 'create (or replace )?function'` is 13 and `grep -ci search_path` is 14 in `20260919070200_functions.sql`; `apps/web/src/routes.tsx:83-89` | holds | - |
| maps-5 | .planning/codebase/*.md, .claude/CLAUDE.md | checker misses (72 map tokens, 8 more in CLAUDE.md) | the raw output has 138 misses over the maps (72 distinct tokens): 34 distinct `ambiguous` bare names shared by several tracked files, and 38 other tokens that are `missing`: that are file suffixes, gitignored build output (`dist/`, `coverage/`, `playwright-report/`), image and Action references, route paths and a media type; no token is a path that should exist and does not; CLAUDE.md adds `origin/main`, the skill directories its generated skills block says may be added, `SKILL.md` and the `!docker/ca.crt` dockerignore line | allowed: 80 rows in all, a reason each, in `docs-claims-allow.tsv` | 2a02f8a |
| restore-1 | `.claude/CLAUDE.md` Anti-Patterns (old), subsection "Querying the database outside `withUserDb`" | "The query runs as `hearth_service` without the caller's claims, bypassing the RLS boundary" | `supabase/migrations/20260919060000_hearth_service_role.sql:1-5`: `hearth_service` is NOINHERIT and holds no rights of its own until a transaction switches role, "so a query that forgets to switch fails instead of running with them"; `apps/service/src/privileged/service-role-db.ts` and `docs/architecture.md:50`: `service_role` bypasses RLS | corrected: a bare query fails; switching to `service_role` by hand runs outside the policies. Restored in `ARCHITECTURE.md` | 82324c0 |
| restore-2 | Anti-Patterns (old), "Enforcing household isolation only in application code" | "A query filters by `household_id` in TypeScript and skips RLS" | services legitimately filter by `household_id` under RLS (`apps/service/src/services/lists.ts:153,161`, `invites.ts`); the rule is that the filter must not be the only isolation rule | corrected: "relies on a `household_id` filter written in TypeScript as the only isolation rule, with no policy behind it" | 82324c0 |
| restore-3 | Anti-Patterns (old), "Hand-edited generated database types" | "Change the migration, then run `pnpm db:types`" | `STACK.md`: `pnpm db:types` runs `kysely-codegen` against a running local database | corrected: change the migration, apply it to a local database, then run `pnpm db:types` | 82324c0 |
| restore-4 | Component Responsibilities (old map row "Jobs") and Key Dependencies (old, `node-cron`) | jobs include "plan refresh" / "refresh plan"; the job list is in `apps/service/src/jobs/index.ts` | `apps/service/src/jobs/scheduler.ts:131-138` registers four tasks (`refresh-deals`, `log-autopay`, `dispatch-notifications`, `prune-cache`); `refresh-plan.ts` is a pure planner called by `refresh-deals.ts`; `jobs/index.ts` is a barrel with no `cron.schedule` | corrected in the Jobs row, the Scheduler row and the Key Dependencies bullet (`STACK.md` pointed at `jobs/index.ts` too) | 82324c0 |
| restore-5 | Component Responsibilities (old), "Auth verification"; also `ARCHITECTURE.md` External protocol adapters and Cross-Cutting Authentication | "JWT verify and JWKS fetch from GoTrue" / "verifies against JWKS" | `apps/service/src/auth/jwt.ts:11-16`: production GoTrue signs HS256 with `JWT_SECRET`; ES256 is accepted only when the token's `kid` names a key GoTrue publishes at its JWKS endpoint (`supabase start`) | corrected in the new row and in the two existing map sentences | 82324c0 |
| restore-6 | Component Responsibilities (old), "CLI"; Entry Points (old), "built to `apps/service/bin/hearth-admin`" | "owner commands (password reset, etc.)" | `apps/service/src/cli.ts`: the only command is `reset-password`; `bin/hearth-admin` is a hand-written `sh` wrapper (row 1) | corrected: the row names `reset-password` as the only command and the wrapper as `node dist/cli.js` | 82324c0 |
| restore-7 | Component Responsibilities (old), "App assembly" | registers every route plugin "under `/api`" | `apps/service/src/app.ts:159-171` registers plugins with no prefix; route paths carry `/api` themselves (`routes/bills.ts:36`); the rate-limit comment says every service route lives under `/api` | corrected: "registers every route plugin (every route lives under `/api`)" | 82324c0 |
| restore-8 | Component Responsibilities (old), "Services" | `services/*.ts` only | `apps/service/src/chores/` (chores, errands, occurrence) and `apps/service/src/notifications/` (copy, planners) hold business rules outside `services/` (Layering Deviations) | extended: the row names both sibling folders | 82324c0 |
| restore-9 | Layers (old), "Database access", Used by | "`http/context.ts` and the jobs' `privileged/job-database.ts`" | `grep -rn user-db apps/service/src`: importers are `http/context.ts` (`withUserDb`), `routes/deals.ts` (`withUserDb`), `main.ts` (`withAnonDb`); `privileged/job-database.ts` imports `withServiceRoleDb` only | corrected in the restored layer | 82324c0 |
| restore-10 | `CONVENTIONS.md` Functions (existing, and old); old raw-row reference | `planBillMove` "in `packages/recurrence/src/bills.ts`"; raw rows "see `packages/recurrence/src/bills.test.ts`" | `grep -rn planBillMove` finds the definition at `apps/service/src/services/bills.ts:409`; `packages/recurrence/src/bills.ts` exports only `currentBillOccurrence`; `billOccurrence` is `services/bills.ts:92`; snake_case raw rows are in `apps/service/src/services/bills.test.ts:11` | corrected in `CONVENTIONS.md` (the wrong path was in the old file and in the regenerated one); `TESTING.md` already had it right | 82324c0 |
| restore-11 | Key Abstractions (old), "Pillar" | "top-level area (Lists, Meals, Chores, Bills, Deals)" | `apps/web/src/lib/sections.ts`: `PillarId` is lists, meals, bills, chores; Deals and Flyers are sub-tabs of Lists; `RELEASED_PILLARS` has all four | corrected in the Pillars abstraction | 82324c0 |
| restore-12 | Module Design (old), barrels | "`packages/*/src/index.ts` ... coverage is excluded in `packages/*/vitest.config.ts`" | only `packages/matching/vitest.config.ts` and `packages/shared/vitest.config.ts` list `src/index.ts` in coverage `exclude`; `packages/recurrence` does not and has `index.test.ts` | corrected: the two configs are named; "the barrel" avoids an ambiguous bare path for the checker | 82324c0 |
| restore-13 | CI/CD Toolchain (old) | Actions list without `docker/login-action@v4`; jobs described without the shared setup action | `.github/workflows/ci.yml` (`docker/login-action@v4` twice; every job runs `./.github/actions/setup`, which holds `pnpm/action-setup@v6` and `actions/setup-node@v7`; `test-e2e` runs on pull requests and `main` only); `deploy.yml` skips a docs-only change | extended and corrected in the restored section | 82324c0 |
| restore-14 | Container table Notes (old), kong | "API gateway" | `docker/kong.yml` and `docs/deploy.md`: an allowlist for GoTrue and Realtime only | extended: "API gateway for GoTrue and Realtime" | 82324c0 |
| restore-15 | Entry Points (old), database migrations | Triggers: `supabase db reset`, `supabase start`, `scripts/deploy.sh`; Responsibilities: schema, RLS, functions, realtime, send-time logic | `scripts/deploy.sh:97` runs `supabase migration up`; migrations also add notification producers (`20261004090000`) and the depart cleanup (`20261004090100`) | restored; Responsibilities extended with producers | 82324c0 |
| restore-16 | Error handling (old) | GoTrue errors map through `problemFromGoTrueError` (`apps/service/src/gotrue/http.ts`) | `problemFromGoTrueError`, `problemFromRecipeFetchError` and `problemFromDatabaseError` are all in `apps/service/src/problem.ts` and chained in `app.ts:98-106` | corrected path; restored the three mappings | 82324c0 |
| restore-17 | Problem details (old) | "Non-5xx details are shown to clients; 5xx details are scrubbed and recorded" | `apps/service/src/app.ts:108-134`: a `ProblemError` is sent as is; an unexpected 5xx is logged scrubbed, recorded, and answered with a generic problem | restated precisely | 82324c0 |
| restore-18 | Test time (old), Conventions | "Do not set `TZ` by hand" | `docs/testing.md:182-184`: set it only through the sweep or an `env` object passed to a spawned process; never force `TZ=UTC` for a suite | restored with the full rule | 82324c0 |
| restore-19 | Unchanged on check (no correction) | Database section; package table; Vitest setup detail; Playwright zone and locale; knip:production; Husky hooks; Tailscale command and `docker` group; `/` dashboard route; service worker handlers path; HR001 to 410; tokens.test.ts; `active_household_id`; Pinned names heading; E2E overlay | `config.toml:16`, `package.json:16-27`, `vitest*.config.ts`, `playwright.config.ts:34-35`, `.husky/`, `README.md:150,173,192`, `routes.tsx:80`, `sw.ts:21`, `problem.ts:47`, `tokens.test.ts:7`, `schema.sql:45`, `docker-compose.e2e.yml:54-60` | held; restored as written (with the file-level checks listed) | 82324c0 |

## Final check (05-12 Task 1)

pr-d-base=3a561ade0b55a7b2078ed5d13d73586e0bb5e5fa
docs-tip=5cfa35dbf79e2d1df4452a719b72768ff9f60096
checked-final=591
misses-final=0

Final run over `docs/*.md README.md` at the docs tip, allowlist as committed (no allowlist change in 05-12 Task 1). WB was
synced with `origin/main` past PR C (`pr-c-merged=9fdc9c9`) by one merge (conflicts only under `.planning/**`, taken from
WB); `docs/sync-specs` then merged WB.

## Behavioral sample

| # | Statement (file:line) | Verified against | Result |
| --- | --- | --- | --- |
| 1 | `apps/service/bin/hearth-admin` is a hand-written POSIX shell wrapper that runs `dist/cli.js` (docs/file-map.md:74) | `head -1` is `#!/bin/sh`; last line `exec node "$here/../dist/cli.js" "$@"`; `git ls-files -s` mode 100755; `docker/service.Dockerfile:35-37` copies it with `--chmod=755` and links it to `/usr/local/bin` | holds (after the fix in row 1) |
| 2 | `hearth-admin reset-password <email>` prints a one-time reset link for the server owner to hand over (docs/use-cases.md:111) | `apps/service/src/cli.ts:19-50`: usage string, `recoveryLink(...)`, prints the link and "One-time link; it expires in an hour. Hand it over in person." | holds |
| 3 | `docker/kong-entrypoint.sh` starts Kong with the key variables substituted (docs/deploy.md:73) | script: `sed` replaces `$SUPABASE_ANON_KEY` and `$SUPABASE_SERVICE_KEY` into `KONG_DECLARATIVE_CONFIG`, then `exec /entrypoint.sh kong docker-start`; compose mounts it read-only | holds |
| 4 | The notification outbox is claim-then-send: `claim` stamps `sent_at` or deletes a stale row before any device is contacted, `release` clears it when no device accepts (docs/architecture.md:333-340) | `apps/service/src/privileged/notification-outbox.ts:22-23, 90-125` (`claim`, `release`, `'claimed'` and stale branches) | holds |
| 5 | The E2E overlay changes the production Compose file for throwaway runs: loopback ports, fixture directories and instant, rate limit raised, push test double (docs/file-map.md:140-146, README.md E2E section) | `e2e/docker-compose.e2e.yml:35-78`: `db`/`caddy` ports, `HEARTH_FLIPP_FIXTURE_DIR`, `HEARTH_FLIPP_FIXTURE_NOW`, `HEARTH_RECIPE_FIXTURE_DIR`, `HEARTH_RATE_LIMIT_PER_MINUTE: 3000`, `HEARTH_PUSH_TRANSPORT: test-double` | holds |
| 6 | A deal-add keeps its item id per list and deal across a retry and an unmount, in memory only (docs/architecture.md, new paragraph) | `apps/web/src/lib/api/deals.ts:238-275`: `WeakMap<QueryClient, HeldDealAdds>`, key `listId:dealId`, `userId` check, cleared only by success; `FIX-LEDGER-HELD-ID.md` (c), (d) | holds |
| 7 | Kong is an allowlist for GoTrue (docs/deploy.md:76-86) | `docker/kong.yml` routes `auth-v1-*` with exact regex paths and methods, `auth-v1-denied` request-termination 403 on the `/auth/v1` prefix; `apps/service/src/kong-routes.test.ts` pins them | holds (route names added in row 18) |
| 8 | The migration step's database password is command-scoped (docs/deploy.md:160) | `scripts/deploy.sh`: `PGPASSWORD="$(env_value POSTGRES_PASSWORD)" supabase migration up ... --db-url "postgresql://postgres@${db_ip}:5432/postgres?sslmode=disable"`; `scripts/deploy.test.mjs` | holds |
| 9 | Unit tests pin `Date` to `2026-10-14T12:00:00.000Z` unless `HEARTH_TEST_NOW` is set (docs/testing.md:63-64, file-map.md `test/` table) | `test/clock-setup.mjs` default; `test/test-now.mjs`; every unit `vitest.config.ts` lists it under `setupFiles` | holds |
| 10 | knip is report-only and not run in CI; jscpd is on demand only (docs/testing.md, new subsection) | `grep -rn knip .github` prints nothing; root scripts `knip`, `knip:production`, `knip:summary`; `git grep jscpd -- . ':!.planning'` printed nothing at `base=` | holds |
| 11 | Only `packages/recurrence` runs `--coverage` in `test`; web coverage is not run by CI (docs/testing.md, rows 10 and 11) | package `test` scripts, `apps/web/vite.config.ts:78-88`, `.github/workflows/ci.yml` steps | holds (after the fix) |
| 12 | The password for the seed users is `hearth-seed-pass-2026`; `pnpm db:seed` refuses a database with other users (README.md, docs/testing.md) | `supabase/seed/seed-users.ts:25, 88-124` | holds |
| 13 | Recipe and meal-plan add-to-list is serialized per list (docs/architecture.md, docs/use-cases.md, rows 28 and 42) | `apps/service/src/services/add-to-list.ts:28-37`; `meal-plan.integration.test.ts` `describe('when the same call arrives again')` (FIX-02) | holds |
| 14 | `README.md` and `docs/` carry no retired-spec citation (D-08, D-21) | `git -C ../hearth-docs-sync grep -nE -f cit-rx.txt -- README.md docs` prints nothing | holds |

## Maps and project instructions

maps-commit=e486d7f692c29a79476a815cf858b6d63c3b496b
maps-mapped-at=283f15dbb2b5ed8ded0ba14e04d5015e5d0d367c
maps-misses=0
hearth-admin-claims=hand-written
e2e-section-restored=no
claude-md-restored=yes

`/gsd-map-codebase` (run by the operator session) wrote all seven maps in `e486d7f` with one
`last_mapped_commit`, `283f15d`, a WB commit that contains `pr-c-merged` (`9fdc9c9`). The only edits
made to the regenerated maps are the D-11 Comments line and the `eslint-disable` count note (maps-1,
commit `b506589`). Checker run over `.planning/codebase/*.md .claude/CLAUDE.md` with the allowlist as
committed: `checked=1762`, `misses=0` (raw map misses were 138, all allowlisted with reasons, maps-5).
`git grep -nE -f cit-rx.txt -- .planning/codebase .claude` prints nothing; the two hearth-admin
wording searches print nothing over the maps, CLAUDE.md and `docs` in `../hearth-docs-sync`.

`.claude/CLAUDE.md` was regenerated with `generate-claude-md` (`b506589`; 253 lines added, 289 removed,
diff in the gitignored `logs/05-12-claude-md.diff`). What changed: (1) the hand-maintained `Running
E2E in the Claude cloud sandbox` section was compared byte for byte before and after and is identical
(no restore needed); the `## Project` block still carries the six constraints, its Git line now reads
as in `PROJECT.md` ("Phase 1, `origin/main` from d3da748"); (2) the stack block follows the new
`STACK.md`: Caddy `caddy:2.11.7-alpine` instead of `2.11.4`, `scripts/ci-prepull-images.sh` listed,
`## Container Images` replacing `## Container and Infrastructure Images`, and the old `## Database`
and `## CI/CD Toolchain` headings gone; (3) the conventions block carries the D-11 text ("Explain why,
not what. Do not cite sections of retired spec documents; state the rule itself.") with the
spec-citation instruction removed, and gains `## Patterns for New Code`; (4) the architecture block
follows the new `ARCHITECTURE.md`: `refresh-plan.ts` is described as a planner used by
`refresh-deals.ts` and not scheduled, `hearth-admin` as a hand-written POSIX shell wrapper over
`dist/cli.js`, `## Component Responsibilities` and `## Anti-Patterns` replaced by `## Layering
Deviations (observed)`, and `### Error Path` and `### Deals and Recipe Import Paths` added; (5) the
workflow, skills and profile blocks are unchanged. The mapper dropped the Anti-Patterns and Component
Responsibilities headings; that is the generated content, left as produced.

Owner request (05-13 rework, PR D): the dropped sections were put back through the maps, then
`.claude/CLAUDE.md` was regenerated again (`claude-md-restored=yes`; the E2E section is byte-identical
to `logs/05-12-e2e-section-before.md`, `e2e-section-restored=no`). The loss inventory is in the
gitignored `logs/05-13-claude-md-loss-inventory.md`: it compared every old line with the new file.
Came back: `## Anti-Patterns` (five subsections, now as headings plus bullets so the text reaches
CLAUDE.md; before, the old file had only the headings), the `## Component Responsibilities` table
(all 28 rows of the old map, which is 21 of the old CLAUDE.md plus Env validation, Database pool,
Scheduler, Auth verification, Recipe import and Push), a Database access layer, `## Database` and
`## CI/CD Toolchain`, the workspace package table, the container Notes column, the Vitest clock and
zone setup, Playwright zone and locale, `knip:production`, the Husky hook names, the Test time
convention, the Import Organization bullets, barrel and design-token statements, the PostgREST and
"one service instance" statements, the Tailscale command and the `docker` group, the dashboard
route, the migrations Triggers and Responsibilities, and the error mappings. In the maps these are
bullets and tables because `generate-claude-md` copies only headings, `- ` bullets, `|` rows and
fence markers (so the numbered Data Flow steps, the System Overview diagram and the Cross-Cutting
Concerns lines are in `ARCHITECTURE.md` but not in CLAUDE.md, as before). Corrected instead of
copied: rows restore-1 to restore-18 (the Anti-Patterns RLS reasoning, the jobs list and the
`refresh-plan.ts` status, token verification, CLI, route registration, `planBillMove` location,
the pillar list, the barrel coverage exclusion, CI actions, the GoTrue error mapping path, the
database layer's callers). Not restored on purpose: the "Circular imports: Not analyzed" placeholder,
two line-number citations, the keep-spec-citations rule (D-11) and a test helper used as a
component example. Checks after the restore: the checker over `.planning/codebase/*.md
.claude/CLAUDE.md` with the allowlist as committed (no new rows needed): `checked=2071`, `misses=0`;
`git grep -nE -f cit-rx.txt -- .planning/codebase .claude` prints nothing; both hearth-admin wording
searches print nothing; the token scans (pattern and `GH_TOKEN` value) over `.planning` and
`.claude` are clean.

## CI

Filled in by 05-12.

filemap-complete=yes

Reverse check for `filemap-complete=yes`: every tracked file name of `scripts/` and `test/` appears
in backticks in `docs/file-map.md` (the verify command's loop over `git ls-files scripts test`), and
every route module under `apps/service/src/routes/` (tests excluded) appears in the `routes` row.

## Phase close

Checked at `../hearth-docs-sync` (`docs/sync-specs`) after `git merge --no-edit claude/eloquent-mayer-szjtjf`
(merge `9dd125a`), `origin/main` at `9fdc9c9` (PR C), phase base `c64d79e`. Logs are `05-13-*` in the
gitignored logs folder.

final-citations=0

`node citation-inventory.mjs inventory --repo ../hearth-docs-sync` (default scope: everything outside
`.planning/`, `docs/`, `supabase/migrations/`) prints `rows=0`, and the TSV holds only its header.
`git grep -nE -f cit-rx.txt -- .planning/codebase docs README.md .claude` prints nothing. Migrations
still carry 17 citation lines in 8 files, equal to `count-migrations=17`.

migrations-untouched=yes

`git diff --exit-code c64d79e -- supabase/migrations` exits 0 at the D head.

docs-files=7

`git ls-files docs | wc -l` is 7 and `git diff --name-only --diff-filter=A c64d79e -- docs` is empty.

final-claims-misses=0

`docs-claims-check.mjs --allow docs-claims-allow.tsv` over `docs/*.md README.md .planning/codebase/*.md
.claude/CLAUDE.md`: `checked=2353 misses=0`.

final-clones=66
final-duplicated-lines=858
final-percentage=1.11

The Phase 2 test-inclusive command (jscpd 5.4.1; this version rejects `--gitignore`, which the
Phase 2 command carried, and ignores git-ignored paths on its own) at the D head, label `05-13`
(`.planning/cleanup/jscpd/phase5-05-13/jscpd-report.json`): `jscpd-compare.mjs --max-clones 95` exits 0.
Against the Phase 2 baseline of 96 clones, 1,438 duplicated lines and 1.87%: 66 clones, 858 lines,
1.11%, identical to `final-b-clones=66` (the text-only PRs add no clone).

Local gates at the D head, Node v24.21.0, `TZ` unset, each log ending `exit=0`: `pnpm install
--frozen-lockfile`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build`, `commitlint
--from origin/main --to HEAD`, and `pnpm test` (harness 231 pass, 0 fail; matching 156, shared 172,
recurrence 77, service 757, web 728, e2e support 15, all equal to `tests-final-c.*`).

D's diff against `origin/main` outside `.planning/` is `docs/*.md` (seven specs), `README.md`,
`.claude/CLAUDE.md` and one comment line in `docker/docker-compose.yml` (the backup comment now cites
the README heading "Restore production", `29b9c6a`, comment-only with a YAML deep-equal proof). The
plan text lists only the first three; the compose fix is an owner request from 05-12.

knip on the D head (`pnpm knip`, report-only) lists six unused files, all `.planning/cleanup/tools/*.mjs`
proof tools: `citation-inventory`, `comment-only-check`, `docs-claims-check`, `expand-compare`,
`jscpd-compare`, `nonts-comment-check`. `tailwindcss` as an unused devDependency of `apps/web` was
reported before this phase and is not touched here.

pr-d-ready=166ae77413fdb324d315bf37e0572096a2b7a885

`docs/sync-specs` is pushed at that merge of WB `6535a7a` (the index commit). WB takes later commits that
only record PR D's number, head and CI; they are not merged into D again, so PR D's head stays `pr-d-ready=`.

## PR D

pr-d=29
pr-d-url=https://github.com/alex-tanton/hearth/pull/29
pr-d-title=docs: bring specs and codebase maps in line with the code
pr-d-head=166ae77413fdb324d315bf37e0572096a2b7a885

PR D was opened through REST from `docs/sync-specs` into `main` at `pr-d-head=` (equal to `pr-d-ready=`),
not draft, GitHub reports it `clean` and not merged. Its files outside `.planning/` are the seven
`docs/*.md`, `README.md`, `.claude/CLAUDE.md` and the one-line comment in `docker/docker-compose.yml`
(the plan's file list omitted the compose comment, an owner request from 05-12). The body is
`logs/05-13-pr-d.md` (gitignored); it states the owner decision about the regenerated
`.claude/CLAUDE.md` (dropped Anti-Patterns section, Component Responsibilities table, and the stack
block's `## Database` and `## CI/CD Toolchain` headings, with an offer to restore them before merge).

pr-d-ci=39712387383 lint:success typecheck:success test-unit:success test-integration:success test-e2e:success build:success

First attempt, no rerun. `test-integration` reports `Tests  1190 passed (1190)` in 76 files, equal to
`main-integration-tests=1190` (`logs/05-13-pr-integration.log`).
