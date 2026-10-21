# File Map

What every top-level folder and key file in the Hearth repository is for. Not an implementation
reference — for behavior, architecture, and design decisions, see the specs in `docs/`.

## 1. Repository layout

| Path | Purpose |
| --- | --- |
| `apps/web` | The installable PWA (Progressive Web App) that household members use day to day. |
| `apps/service` | The backend API, its background jobs, and the admin command-line tool. |
| `packages/shared` | Data shapes and validation rules shared by the web app and the service. |
| `packages/recurrence` | Standalone logic for recurring bills and chores (due dates, rotations). |
| `packages/matching` | Standalone logic for matching grocery items and ingredients by name. |
| `supabase/` | Configuration, database migrations, and seed data for the self-hosted Supabase stack. |
| `docker/` | Everything needed to build and run the production stack with Docker Compose. |
| `e2e/` | End-to-end tests that exercise the whole running system like a real user would. |
| `scripts/` | Small operational scripts for deployment and secret generation, the CI image pre-pull, the test date and time-zone sweep and the knip report normalizer, with harness tests for the scripts that have one. |
| `test/` | Shared test setup that pins the clock and checks the time zone for every workspace's unit tests, and the harness tests that check that setup. |
| `docs/` | The specifications and reference documents that describe what Hearth is and how it behaves. |
| `.github/` | Continuous integration and deployment automation (GitHub Actions), plus dependency updates. |
| `.husky/` | Git hooks that run checks automatically before a commit is made. |
| `README.md` | The entry point: prerequisites, local development, deployment, and backup/restore steps. |
| `CONTRIBUTING.md` | How changes land: which go straight to `main`, which need a pull request, and the commit rules. |
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` | Define the monorepo's workspaces and pin every dependency's exact version. |
| `tsconfig.base.json` | Shared TypeScript compiler settings every workspace builds on. |
| `eslint.config.js`, `.prettierrc.json`, `.prettierignore` | Code style and quality rules enforced across the repo. |
| `commitlint.config.js`, `.lintstagedrc.json` | Rules for commit message format and pre-commit checks. |
| `knip.json` | Configuration for the knip report of unused files, exports and dependencies (`pnpm knip`, `pnpm knip:production`); report-only. |
| `.nvmrc` | Pins the Node.js version contributors and CI should use. |
| `.gitattributes`, `.gitignore`, `.dockerignore` | Tell Git and Docker which files to normalize, ignore, or exclude from builds. |
| `.env.example` | A template for the real, never-committed configuration file used in production. |

## 2. apps/web

`apps/web` is the installable Progressive Web App — the thing a household member actually opens
on their phone or laptop to manage groceries, meals, bills, and chores. It is built with React and
Vite, styled with Tailwind, and uses Workbox to work offline and install like a native app.

| Subfolder | Purpose |
| --- | --- |
| `screens` | The top-level pages a user navigates to (dashboard, bills, chores, lists, meals, deals, onboarding, settings). Each screen assembles the view for one route. |
| `pillars` | Thin routing glue that connects a top-level navigation area ("pillar" of the app, like Bills or Chores) to its screens. |
| `components` | Reusable visual building blocks, organized by feature area (bills, chores, dashboard, errands, lists, meals) plus cross-cutting ones: `ui` (generic buttons, cards, dialogs, form fields), `shell` (the app frame — top bar, tab bar, household switcher), and `states` (loading, empty, and error placeholders used throughout). |
| `lib` | Supporting logic that isn't a visual component: talking to the API (`api`), authentication (`auth`), offline queueing and sync (`offline`), push notifications (`push`), realtime updates (`realtime`), formatting, validation, and small reusable hooks. |
| `test` | Shared test helpers and setup for the web app's own test suite. |
| `public` | Static assets served as-is, including app icons used for installation. |
| `scripts` | Build-time helper scripts for the web app. |
| `index.css`, `tokens.test.ts` | Global styling and a check that design tokens stay consistent. |
| `sw.ts` | The service worker entry point that makes the app installable and usable offline. |

## 3. apps/service

`apps/service` is the backend: a Fastify-based API, the background jobs that keep data current
(fetching deals, sending notifications, pruning caches), and the `hearth-admin` command-line tool
used for operational tasks like resetting a user's password.

| Subfolder | Purpose |
| --- | --- |
| `routes` | The HTTP endpoints grouped by feature (auth, bills, chores, deals, errands, health, households, lists, match overrides, meal plans, recipes, system, users). |
| `services` | The business logic behind each feature — the rules and calculations that routes and jobs call into. |
| `jobs` | Scheduled background work: dispatching notifications, logging autopay, refreshing deals and meal plans, pruning stale data, and the scheduler that runs them. |
| `privileged` | The small, deliberately isolated set of operations allowed to use elevated database or auth-provider access (for example, the owner CLI and system-level notification delivery). Everything else in the service is restricted to the narrow, non-privileged access a regular request gets. |
| `auth` | Verifying access tokens issued by the auth provider. |
| `gotrue` | The client used to talk to GoTrue, the self-hosted authentication service (signup, sign-in, password resets). |
| `db` | The database access layer and generated database types. |
| `http` | Shared request-handling plumbing used across routes. |
| `deals` | Logic for ingesting and pricing grocery deals, including the Flipp flyer source. |
| `recipes` | Fetching and parsing recipes from external URLs so they can be added to meal plans. |
| `chores` | Chore- and errand-specific scheduling logic. |
| `notifications` | Composing and planning the notifications sent to users. |
| `push` | Sending web push notifications to installed PWAs. |
| `test` | Shared fixtures and harnesses used by the service's own automated tests. |
| `bin` | The `hearth-admin` command-line entry point: a hand-written POSIX shell wrapper that runs the bundled `dist/cli.js` (built from `src/cli.ts`). The service image links it onto the `PATH`. |
| `scripts` | Operational helper scripts for the service (for example, regenerating database types). |

## 4. packages/

These are small, standalone libraries used by more than one part of the system, kept out of
`apps/` so that logic isn't duplicated or tangled up with a particular app's framework.

| Package | What it's for | Why it's separate |
| --- | --- | --- |
| `packages/shared` | The data shapes (schemas), types, and validation rules both the web app and the service agree on — essentially the contract for what a bill, chore, list item, user, etc. look like, and how API requests and responses are validated. | Both `apps/web` and `apps/service` depend on it; keeping the contract in one place means the frontend and backend can't silently drift apart. |
| `packages/recurrence` | The math for recurring things with an anchor date — when a bill or chore is next due, and how chore rotations advance. | It's pure logic with no framework or network dependency, and both the web app (to display due dates) and the service (to schedule and generate occurrences) need the exact same answer. |
| `packages/matching` | Normalizing and matching grocery item and ingredient names (so "2% milk" and "milk, 2%" are recognized as the same thing). | Pure, dependency-free logic reused by the service (for deal and recipe matching) and by the database seed tooling, so it's isolated rather than duplicated or buried inside one app. |

## 5. supabase/

Hearth self-hosts Supabase, which bundles several open-source pieces behind one configuration:

- **Postgres** is the database that stores all household data.
- **GoTrue** is the authentication service — it handles signup, sign-in, password resets, and issuing the tokens that prove who a user is.
- **Realtime** pushes live database changes out to connected clients, so one household member's edit shows up for everyone else without a page refresh.
- **Kong** is the API gateway in front of GoTrue and Realtime — it's the single door those two services are reached through.

`supabase/migrations/` holds every schema change as a numbered, timestamped SQL file, applied in
order. Migrations are forward-only (there's no "undo" migration) because the safe way to fix a
mistake is a new migration that corrects it — rolling back a schema change on a database already
holding real data is risky and not supported here. `supabase/seed/` holds the script and SQL that
populate a fresh database with realistic sample households, users, and data for local development
and testing.

## 6. docker/

Docker Compose is a way to define and run a group of related containers (the pieces of the app)
together with one command, instead of starting each one by hand. `docker/docker-compose.yml`
defines the full production stack:

| Service | Role |
| --- | --- |
| `db` | The Postgres database. |
| `auth` | GoTrue, handling sign-in and account management. |
| `realtime` | Pushes live updates to connected clients. |
| `kong` | The gateway that routes external requests to `auth` and `realtime` only — nothing else is exposed through it. |
| `hearth-service` | The backend API and background jobs (built from `apps/service`). |
| `caddy` | The reverse proxy that the PWA is served through and that forwards API and auth traffic to the right internal service. It also builds in the PWA itself as static files. |
| `backup` | Runs the nightly database backup and keeps a rotation of older backups. |

In plain terms, Caddy is the front door: every request from the internet reaches the box through
it, and it decides whether to hand that request to the web app's static files, the API, or the
auth service. (TLS — the encryption that makes a connection `https://` — is actually terminated
upstream by Tailscale Funnel before traffic reaches Caddy; see `docker/Caddyfile` and the README's
"Deployment" section for specifics.) `docker/kong.yml` configures Kong's routing, the
`docker/db/*.sql` files set up database roles used only at container start, and the two
`*.Dockerfile`s describe how to build the service and Caddy container images.

## 7. e2e/

Playwright is a tool for automating a real web browser — it can open a page, click things, fill
in forms, and check what ends up on screen, just as a person would. An end-to-end ("E2E") test
differs from a unit test in scope: a unit test checks one small piece of logic in isolation
(for example, a single function in `packages/recurrence`), while an end-to-end test drives the
entire running system — browser, web app, API, database, and auth all together — through a
complete user journey, like signing up, inviting a household member, or adding an item to a
shopping list.

| Subfolder/file | Purpose |
| --- | --- |
| `tests/` | The actual test journeys, one file per scenario (signup, invites, realtime sync, offline behavior, bills, chores, accessibility, notifications, and more). |
| `fixtures/` | Sample data (such as recorded grocery flyer data and recipes) the tests load instead of depending on live external sources. |
| `support/` | Shared helpers the tests use to talk to the API, the database, and the running Compose stack, and to check things like accessibility (axe) and logs. |
| `setup/` | Logic for standing up a disposable copy of the whole stack before the suite runs. |
| `global-setup.ts`, `global-teardown.ts` | Playwright hooks that build/start the stack before all tests and tear it down afterward. |
| `playwright.config.ts` | Playwright's configuration for this suite. |
| `docker-compose.e2e.yml` | An overlay on top of the production Compose file, adjusting it for throwaway test runs. |

## 8. scripts/

| Script | Purpose |
| --- | --- |
| `deploy.sh` | Builds and deploys the production stack: backs up the database, applies pending migrations, swaps in new containers, and rolls back automatically if the new version fails a health check. |
| `deploy.test.mjs` | Harness test for `deploy.sh`: runs the real script against stub `docker`, `supabase` and `curl` binaries and checks that the database password reaches the Supabase CLI through its environment and appears in no argument. Run by `pnpm test:harness`. |
| `ci-prepull-images.sh` | Pre-pulls the images the end-to-end stack needs, with retries and a `ghcr.io` mirror tried first for the three Supabase images, so a rate-limited registry does not fail `docker compose up` in CI. |
| `ci-prepull-images.test.mjs` | Harness test for the pre-pull script, run against stub `docker` and `sleep` binaries so no image is pulled. Run by `pnpm test:harness`. |
| `test-sweep.mjs` | Runs the unit or service integration test suite once per cell of a fixed matrix of pinned dates and time zones, each cell in its own process (`pnpm test:sweep`, `pnpm test:sweep:integration`). |
| `test-sweep.test.mjs` | Harness test for the sweep: argument checks, an `--only` that selects nothing, a listing that cannot run, and one real single-cell run. Run by `pnpm test:harness`. |
| `knip-summary.mjs` | Turns a `knip --reporter json` report into sorted lines of kind, path and symbol separated by tabs, with a closing `total` line, so two knip runs can be compared line by line (`pnpm knip:summary {report.json} {out.txt}`). |
| `generate-secrets.sh` | Creates the real `.env` file with freshly generated passwords and keys for a new production install. Refuses to overwrite an existing one, since regenerating secrets on a live install would sign everyone out and break the database login. |

## 9. docs/

| Document | Purpose |
| --- | --- |
| `file-map.md` | Map of the repository's folders and files. |
| `testing.md` | How unit, integration, frontend, and end-to-end tests are structured, how to add more of each, and how to test the running app by hand. |
| `deploy.md` | System requirements, dependencies, and the full setup and operating instructions for a production deployment. |
| `use-cases.md` | Hearth's product requirements, restated as use cases: who does what, under what conditions, with what result. |
| `architecture.md` | The system's shape — request authorization and the RLS isolation pattern, data model, API surface, background jobs, realtime sync, offline writes, and the notification pipeline. |
| `branding.md` | Hearth's name, voice, and visual identity — color, type, spacing, icons, motion, and copy rules. |
| `design.md` | Hearth's design decisions — navigation, state handling, empty states, and accessibility commitments. |

## 10. Root configuration files

| Tool/file | What it is | Why Hearth uses it |
| --- | --- | --- |
| pnpm, `pnpm-workspace.yaml` | pnpm is the package manager that installs JavaScript/TypeScript dependencies. A "workspace" lets one repository (a "monorepo") hold several installable projects — here, the apps and packages — that can depend on each other directly. | Lets `apps/web` and `apps/service` share `packages/shared`, `packages/recurrence`, and `packages/matching` without publishing them anywhere, and keeps every dependency version pinned exactly in one lockfile. |
| TypeScript, `tsconfig.base.json` | TypeScript adds type-checking to JavaScript, catching a category of bugs before the code ever runs. The base config holds the strict settings every workspace inherits. | Keeps the whole codebase held to the same strict standard, with no workspace quietly opting out. |
| ESLint, `eslint.config.js` | A linter: it scans code for likely bugs, risky patterns, and style inconsistencies beyond what the type checker catches. | Enforces project-specific rules too, such as which parts of the service are allowed to use privileged database access. |
| Prettier, `.prettierrc.json`, `.prettierignore` | An automatic code formatter — it rewrites code into one consistent style so contributors don't argue over formatting. | Keeps every file formatted the same way regardless of who wrote it. |
| commitlint, `commitlint.config.js` | Checks that every commit message follows the Conventional Commits format (a `type(scope): subject` style) with an approved list of types and scopes. | Keeps commit history readable and consistent, and scopes it to the project's actual areas (web, service, shared, etc.). |
| knip, `knip.json` | A tool that reads every workspace and reports files, exports and dependencies that nothing uses. It only reports; it never edits or deletes anything. | Finds unused code across workspaces, which the linter and type checker cannot see. Code it reports is removed only when a text search and the tests also show it is unused. |
| Husky, `.husky/` | Installs Git hooks — small scripts that run automatically at points like "before a commit is created." | Runs linting, formatting, and type-checking before a commit, and checks the commit message, so problems are caught before they're even committed. |
| lint-staged, `.lintstagedrc.json` | Runs linters and formatters only on the files actually being committed, not the whole repo. | Keeps the pre-commit check fast. |
| Vitest | The test runner used for unit, component, and integration tests throughout the repo (in `apps/web`, `apps/service`, and the packages) — distinct from Playwright, which drives full end-to-end journeys in `e2e/`. | Fast, consistent testing across every workspace. |
| `.nvmrc` | Pins the exact Node.js version the project expects. | Keeps every contributor and CI on the same JavaScript runtime version, avoiding "works on my machine" issues. |
| `.dockerignore` | Lists files and folders excluded when building a Docker image. | Keeps build context small and makes sure secrets, test artifacts, and unrelated folders never end up inside a built image. |
| `.gitattributes` | Tells Git how to handle certain files — here, normalizing line endings to LF for text files and marking binary files (images, archives) so Git doesn't try to treat them as text. | Prevents line-ending mismatches between contributors on different operating systems. |
| CI, `.github/workflows/` | GitHub Actions automation: `ci.yml` runs checks (lint, typecheck, tests) on every pull request and push; `deploy.yml` deploys a passing `main` commit to production. `dependabot.yml` opens automated pull requests to keep dependencies up to date. | Catches problems before merge and automates getting a verified change into production. |

## 11. test/

Shared test setup for the unit suites, plus the harness tests that check it. Both kinds of file are
plain Node ES modules (`.mjs`). The harness tests use Node's built-in runner (`node --test`) and run
through `pnpm test:harness`, which `pnpm test` runs before any workspace suite. How the pieces work
is in `docs/testing.md`, under "Dates and time zones".

| File | Purpose |
| --- | --- |
| `clock-setup.mjs` | Vitest setup file loaded by every workspace's unit config: pins `Date` to `HEARTH_TEST_NOW` (default `2026-10-14T12:00:00.000Z`) so a test does not depend on the wall clock. Skips `*.integration.test.*` files. |
| `global-tz.mjs` | Vitest `globalSetup` loaded by every workspace's Vitest config: validates `TZ` and `HEARTH_TEST_NOW` before any test runs. |
| `test-now.mjs` | Parses `HEARTH_TEST_NOW` into an instant; shared by the pin and the zone hook. |
| `clock-setup.test.mjs` | Harness test for the clock pin, run from inside real Vitest workers. |
| `global-tz.test.mjs` | Harness test for the zone hook, one child process per case. |
| `eslint-clock-ban.test.mjs` | Harness test for the ESLint rule that bans real-clock reads in test files. |
| `eslint-service-role-fence.test.mjs` | Harness test for the ESLint fence that keeps modules outside `main.ts`, `cli.ts`, tests and `apps/service/src/privileged/` from importing that folder: bad and good snippets are linted with the repo's real config. |
| `support/vitest-project.mjs` | Helper for the harness tests: writes a throwaway Vitest project in a temporary directory and runs it with the clock setup file. |
