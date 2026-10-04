# Hearth — Engineering Practices

2026-09-17 · @Someone

TypeScript monorepo, Tailwind, comprehensive testing including Playwright E2E, Conventional Commits with PR-based review and GitHub Actions checks.

## Stack and repository

TypeScript everywhere. One language across frontend, service, and tests means shared types and no context switching.

### Versions

| Tool | Version | Notes |
| --- | --- | --- |
| Node | 24 LTS | Pinned in `.nvmrc` and the Dockerfile |
| TypeScript | Newest stable that `typescript-eslint` supports | `strict: true`, no exceptions. Type-aware linting cannot yet run on the 7.x native compiler, so 6.0 at kickoff |
| pnpm | 10 | Workspaces; faster and stricter than npm for a monorepo. Pinned via `packageManager` in `package.json` |
| React | Current stable |  |
| Vite | Current stable | Frontend build and dev server |
| Fastify | Current stable | Service HTTP |
| Tailwind | Current stable |  |
| Vitest | Current stable | Unit and integration |
| Playwright | Current stable | E2E |
| Postgres | Follows the pinned Supabase image | Never pinned independently |

"Current stable" means the latest stable release at project kickoff, pinned to an exact version in the lockfile. After that, versions change only through Dependabot PRs.

### Monorepo layout

```
hearth/
  apps/
    web/                 React PWA
    service/             Fastify API, jobs, and the hearth-admin CLI
  packages/
    shared/              Zod schemas, domain types, shared constants
    recurrence/          Anchored recurrence logic (pure, heavily tested)
    matching/            Ingredient normalization and fuzzy matching (pure)
  supabase/
    migrations/          Timestamped SQL
    seed/                Seed-users script (GoTrue admin API) and seed SQL
  e2e/                   Playwright specs and fixtures
    fixtures/flipp/      Raw Flipp responses and normalized NormalizedDeal JSON
  docker/                Compose file, Caddyfile, Kong config, Dockerfiles
```

### Why these packages are separate

`recurrence` and `matching` are extracted deliberately. Both are pure functions with intricate rules and high bug potential, both are used by the service and (for preview rendering) the frontend, and both benefit from exhaustive table-driven tests without any surrounding infrastructure. Keeping them dependency-free makes that possible.

`shared` holds the Zod schemas that define the API contract, the common-password list, and the error-scrubbing function. The service validates with the schemas, the frontend infers its types from them, and the OpenAPI document is generated from them. There is no separate type declaration that can drift.

### Key libraries

| Need | Choice |
| --- | --- |
| Server state | TanStack Query v5 |
| Validation | Zod |
| Query builder | Kysely (no ORM) |
| Rate limiting | `@fastify/rate-limit` |
| Fuzzy matching | `fastest-levenshtein` 1.0.16 — tied with `fuse.js` 7.5.0 at 12/12 on Seed Data's matching test cases, 2-3x faster over hundreds of real deal names, and a normalized-edit-distance metric that maps onto the 0.85 threshold without Fuse's prose-search-oriented location weighting (`packages/matching/scripts/fuzzy-benchmark.ts`) |
| Dates | `date-fns` plus `@date-fns/tz` for timezone handling |
| Recipe parsing | `cheerio` for HTML, with JSON-LD extracted directly |
| Ingredient lines | `parse-ingredient` 3.0.0, chosen in Phase 3: it splits a free-text line into quantity, unit, and description in one call, with no dependencies of its own, which is what the recipe library's ingredient split needs and nothing more |
| Push | `web-push` |
| Offline persistence | `idb-keyval`, as the storage for TanStack Query's persister |
| Logging | `pino` |
| Routing | `react-router` (data router, with lazy route modules per pillar) |

There is no client-state library. The active household comes from the server (`GET /api/users/me`), and UI state lives in React state or context.

`date-fns` over Luxon or Day.js because the timezone-aware arithmetic in anchored recurrence needs to be explicit and tree-shakeable. Never use the raw `Date` constructor for date math.

### Tooling

- **ESLint** flat config, `typescript-eslint` strict, plus `eslint-plugin-jsx-a11y` given the WCAG AA target
- **Prettier** for formatting, no arguments about style
- **Husky** and **lint-staged** running lint, format, and typecheck on staged files pre-commit
- **commitlint** enforcing Conventional Commits on the commit message
- The PWA only ever calls same-origin paths, because in production one origin serves it, `/api`, and `/auth/v1`. The Vite dev server and `vite preview` stand in for Caddy by proxying `/api`, `/auth/v1`, and `/realtime/v1`; the upstreams default to a locally run service and `supabase start`, and `HEARTH_DEV_API` and `HEARTH_DEV_SUPABASE` override them.

## Code conventions

### TypeScript

- `strict: true`. No `any` — use `unknown` and narrow. A genuine escape hatch needs an inline comment explaining why.
- No non-null assertions (`!`) outside tests. Handle the null case.
- Types inferred from Zod schemas rather than hand-written alongside them
- Discriminated unions for anything with variants (deal price forms, notification types, job outcomes)
- **Money is integer cents.** Every price calculation (parsing, unit price, discount, subtotal, monthly and annualized amounts) works in integer cents, with half-up rounding wherever it divides. It converts to or from `numeric(10,2)` only at the database boundary, and formats as dollars only for display. Floating-point dollars are never used for arithmetic.
- Exported functions have explicit return types; internal ones may infer

### Naming

| Thing | Convention |
| --- | --- |
| Files | `kebab-case.ts`; React components `PascalCase.tsx` |
| Components, types | `PascalCase` |
| Functions, variables | `camelCase` |
| Constants | `SCREAMING_SNAKE` only for true module-level constants |
| Database | `snake_case`, singular table names |
| API responses | `camelCase`, mapped in one layer |
| Booleans | `is`/`has`/`should` prefix |

### Frontend patterns

- **Server state belongs to TanStack Query**, never copied into component state. The active household id is server state: it is read from `GET /api/users/me` and changed with `PUT /api/users/me/active-household`. Transient UI state lives in React state, or in context when several components share it.
- Query keys are structured and household-scoped: `['lists', householdId]`, `['deals', householdId, query]`. Switching household must invalidate cleanly, which structured keys make trivial.
- **Optimistic updates** for every offline-queueable write (see PWA implementation), with explicit rollback and an error toast on failure
- Each time the app opens, the PWA compares the browser's timezone with `profile.timezone` and sends `PATCH /api/users/me` if they differ
- Components are function components with hooks. No class components. The single exception is the error boundary, since React can only catch render errors in a class.
- A component that fetches does not also lay out complex UI — split container from presentation once a file passes 150 lines
- Tailwind utilities inline; extract to a component when a pattern repeats, not to an `@apply` class
- Section color is provided by context from the route, so a `DealCard` does not hardcode green

### Service patterns

- Route handler → validate with Zod → call a service function → map to response. Handlers stay thin.
- Business logic lives in service functions that take a Kysely instance, so tests inject a transaction that rolls back
- Every handler reaches the database only through `withUserDb(jwt, fn)` (Technical Architecture). A code path using the service role for a user request is a review blocker; the four sanctioned service-role uses are listed in Technical Architecture.
- Kysely for queries, no ORM. The schema is small and RLS interacts badly with ORM abstractions. Kysely's database types are generated from the migrated schema.

### Comments

Comment the *why*, never the *what*. Particularly warranted: anchored-recurrence edge cases, each price parser's motivating example, and any Flipp response quirk being worked around. A parser without an example string in a comment will be misunderstood later.

## Testing

Comprehensive coverage including E2E. Tests never make live network calls — Flipp is always a fixture or a test double in tests.

### Layers

| Layer | Tool | Scope |
| --- | --- | --- |
| Unit | Vitest | Pure logic: recurrence, matching, price parsing, normalization |
| Component | Vitest + Testing Library | React components with their states |
| Integration | Vitest against a real Postgres | Service functions, RLS policies, job idempotency |
| E2E | Playwright | User journeys through the real stack |

### What gets exhaustive unit tests

These three are where correctness actually lives, and each deserves table-driven tests over many cases:

- **Recurrence.** Occurrence derivation from the anchor for every unit and interval, late completion not shifting the series, chores rolling forward past a missed occurrence, early completion closing the upcoming occurrence, bills staying overdue until paid or skipped, month-end clamping (a 31st anchor through February and back), leap years, rotation assignment from `rotation_offset` and the completion count, rebasing the offset when a member departs, and deleting the most recent completion moving the rotation and next due back. Autopay logging never backfills an occurrence dated before the bill's `created_at` date; an integration test runs `log-autopay` against such a bill and asserts that the earlier occurrence stays overdue.
- **Price parsing.** Each parser against real recorded strings, plus the skip path (including rebates and BOGO with no base price) and the rounding rules. Every new Flipp format encountered in the wild gets a test case added before the parser is changed.
- **Matching and normalization.** Punctuation, quantity, unit, descriptor, and brand stripping; singularization; token containment at the 0.85 threshold; pantry-beats-sale; overrides; and specifically the false-positive cases — "chicken breast" must not match "chicken broth", and this should be an explicit named test.

### RLS testing is mandatory

Integration tests must include an explicit isolation suite: a user in household A attempting to read and write every household-B resource, asserting failure at the database level. This is the one test suite whose absence would undermine the entire security model.

Also tested: personal bills invisible to household members, admin-only actions rejected for non-admins, a removed member losing access immediately, every membership lifecycle function refusing a caller who fails its check, only a household's admin reading or writing its invites, deleting a chore completion other than the most recent returning `409`, and undoing a completion deleting its unsent `chore_rotation` row.

The E2E suite, which runs through Caddy, also includes a smoke test that external `POST /auth/v1/signup` and `PUT /auth/v1/user` are refused, including percent-encoded and doubled-slash variants of the paths.

### Integration test database

A disposable stack per run from the Supabase CLI (`supabase start`), migrated from `supabase/migrations/` so tests exercise the real schema, roles, and policies. Each test runs in a transaction that rolls back, and acts as a user with the same two statements `withUserDb` runs. Test files run one at a time, because fixtures share natural keys such as a postal code. Never test against a shared or development database.

`supabase start` after a `supabase stop` does not re-run migrations: it prints "Starting database from backup" and reuses the CLI's own `supabase_db_hearth` Docker volume, which still holds every row any previous session — a manual `supabase start` for local dev, or a prior test run — ever committed. This is normal Supabase CLI behavior, not a repo defect, and this suite is already written defensively against it: every integration file that writes rows scoped to a postal code deletes exactly those rows in its own `beforeEach` (or wipes the shared cache tables wholesale in `afterAll`, per `jobs.integration.test.ts`), so a leftover row from an earlier session never survives into a test that runs after it. Two consecutive `test:integration` runs against the same un-reset volume pass cleanly for this reason. A contributor who wants a genuinely empty database — for instance, to rule out this exact possibility while debugging — needs `supabase db reset`, or `supabase stop` followed by `docker volume rm supabase_db_hearth` before the next `supabase start`; stopping the stack alone leaves the volume, and with it every row, in place.

### E2E journeys

Playwright covering, at minimum:

1. Sign up with email and password, create household, set postal code and favorites, reach the dashboard
2. Search deals, add items to a list, check them off
3. Two browser contexts on one list — assert realtime propagation between members
4. Import a recipe by URL, view readiness, add missing ingredients to a list
5. Create a recurring bill, mark it paid late, assert the next due date is the anchor and not the payment date
6. Complete a rotating chore, assert rotation advances and next due is anchored, then undo it from the toast and assert both revert
7. Go offline, check list items off and add one, return online, assert queued writes sync in order. The chores and errands portion (complete a chore, mark an errand done) is added in Phase 5.
8. Remove a member, assert the reassignment prompt appears and blocks until resolved
9. Switch household, assert no data from the previous household remains visible

Each journey runs in both light and dark themes with `axe-core` assertions, satisfying the accessibility verification requirement. Everything else the suite covers — the Caddy refusal smoke test, the owner reset CLI, the invite paths, the magic-link flag — runs once, because the theme matrix is about the journeys' screens.

### E2E environment

The suite runs against the production stack, because "through Caddy" means the Caddyfile and Kong config that ship, not a stand-in. `pnpm test:e2e` is the whole command from a cold machine: Playwright's global setup builds and starts `docker/docker-compose.yml` with `e2e/docker-compose.e2e.yml` over it, and its teardown drops the stack and the database volume. Because every run starts from an empty database, the journeys see exactly the Seed Data fixtures.

The overlay changes only what the loopback demands, and every such value belongs to one run. A run's identity is a six-hex-digit run id: the Compose project `hearth-e2e-<id>`, a network of the same name, the image tag `e2e-<id>` for the two images the run builds, and a state directory under the system temporary directory named for the id. Two runs on one machine, such as two clones or two agents, therefore never share a project, network, image, database, or port, and `down --volumes` can only drop that run's own database. The run creates its network itself, before `up`, on the first free `172.16.240.0/24` through `172.16.254.0/24` (the production stack owns `172.16.238.0/24`): Docker refuses an overlapping network atomically, so the run moves to the next candidate rather than sharing one. The overlay declares that network external and takes its name, subnet, gateway, and the Caddy and Postgres ports from the run's generated `.env`. Caddy and Postgres publish on free loopback ports picked at run start, not on fixed ones, because Caddy's origin is printed into every invite and reset link and so must be known before the stack starts, which is why Docker cannot assign the port itself. Teardown removes that run's project, network, and two images by name, never by pattern. A fresh run id is one whose state directory does not exist yet, and a run never takes over an id that is already in use, so a run cannot tear down another run's stack; a run that crashes before teardown keeps its id until it is cleared by hand. Reusing a stack needs the id it was started with, `HEARTH_E2E_RUN_ID`, and `HEARTH_E2E_REUSE_STACK=1` then finds that run's ports and stack; reuse without an id is refused. Caddy is started without `docker/caddy-entrypoint.sh`, whose guard exists to keep the pinned public origin an https one — E2E is plain HTTP on the loopback, so `HEARTH_HOST` is given directly. `HEARTH_ORIGIN` is that loopback origin, so the invite links and the owner's reset link the stack prints are ones the browser can open unaltered. The `backup` service is left out; nothing in the suite reads a backup.

Deal search and flyer browsing (Phase 2) run through the same built image the rest of the suite does, so the overlay also mounts `e2e/fixtures/flipp/raw` read-only into `hearth-service` and sets `HEARTH_FLIPP_FIXTURE_DIR` (the mount path) and `HEARTH_FLIPP_FIXTURE_NOW` (the captures' own instant): unset in every real deployment, so `fetchGet` and the live Flipp endpoint are what production always gets, but present here so the wrapper reads the checked-in captures instead — the same non-negotiable that keeps Vitest off the live endpoint, held for the one caller that runs the built binary rather than the source tree. `LOG_LEVEL` is `info` rather than `warn` for the same reason: the rate discipline the deal journeys assert on is read from `docker compose logs`, and `warn` would drop the "flipp request" line entirely.

Recipe import (Phase 3) needs the same treatment, for a different reason than Flipp's: `fetchRecipePage` refuses to connect to any private, loopback, or link-local address (Technical Architecture, "Recipe fetching"), checked against the resolved IP specifically so a fixture HTTP server cannot be reached by pointing at a "safe-looking" hostname — the E2E network's own subnet (one of `172.16.240.0/24` through `172.16.254.0/24`, chosen per run) falls inside the private ranges that check refuses, by design, so a same-network fixture server would be turned away exactly as an attacker's rebound target would be, and standing one up outside Docker for the container to reach would need a real routable address this suite has no business obtaining. The overlay therefore mounts `e2e/fixtures/recipes` read-only and sets `HEARTH_RECIPE_FIXTURE_DIR` (the mount path): unset in every real deployment, so `fetchRecipePage` and a real fetch are what production always gets, but present here so `hearth-service` swaps in `recipeFixtureFetch` (`apps/service/src/recipes/fixture-fetch.ts`), which reads the matching committed HTML file directly and never opens a socket at all — the fetch step itself is replaced, not routed through a reachable address, which is the smallest change that keeps "tests never make live network calls" true for recipe import the same way it already holds for Flipp. Journey 4 pastes one of three fixture URLs (`https://fixtures.hearth-e2e.test/recipes/{baked-cod-with-asparagus,baked-cod-with-broccoli,no-recipe-markup}`); the domain is never resolved, since the swapped-in fetch function short-circuits on the URL's path before any DNS lookup would happen.

Bring-up is the same sequence a deploy uses: start the database and the Supabase services, apply `supabase/migrations/` with the Supabase CLI, start the service and Caddy, then `pnpm db:seed` followed by `e2e/fixtures/e2e-seed.sql`. Secrets are a throwaway `.env` that `scripts/generate-secrets.sh` writes outside the checkout, under the run's own temporary directory, and teardown deletes; nothing generated for a run is ever committed.

The suite runs on one worker in file order, because the journeys share one database and each leaves the seeded households in a state the next accounts for. The journey that removes members from Oak Street (`17-remove-member.spec.ts`) is the last file, so every earlier journey sees the full seed. For the same reason there are no retries: a retry of "remove Sam from Oak Street" would find Sam already gone and report a failure that says nothing, so a flake is fixed rather than retried away. Tests wait on web-first assertions and never on a fixed delay; `axe-core` additionally waits for every animation that has an end, since a dialog still fading reads as a contrast failure.

CI runs exactly this, with `pnpm test:e2e` on a GitHub-hosted runner, and uploads the Playwright report when it fails.

### Coverage

90%+ on `packages/recurrence` and `packages/matching`, which should approach complete. 80%+ on the service. No numeric target on UI components — journeys matter more there than line coverage.

The service's figure is measured over its unit and integration tests together (`pnpm --filter @hearth/service test:coverage`, which needs the `supabase start` stack), because its service functions exist to be exercised against the real schema and policies; a unit-only figure would describe a different program.

### Not tested

Flipp's live endpoint. Test doubles and fixtures only; hitting it from CI would be both flaky and rude.

## Git and CI

### Branching

Trunk-based. `main` is always deployable. Work happens on short-lived branches merged by PR; nothing is pushed directly to `main`.

The repository is private, and GitHub Free cannot enforce branch protection on private repositories, so "every change via PR" is a written convention. What enforces it is the deploy gate: only commits whose checks all passed are deployed.

Branch naming: `feat/deal-search`, `fix/recurrence-month-clamp`, `chore/bump-deps`.

### Conventional Commits

Enforced by commitlint.

```
<type>(<scope>): <description>

[body]
[footer]
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`.

Scopes matching the structure: `web`, `service`, `shared`, `recurrence`, `matching`, `db`, `e2e`, `docker`.

```
feat(service): add anchored recurrence advancement
fix(matching): prevent chicken breast matching chicken broth
test(recurrence): cover month-end clamping through February
```

Description in imperative mood, lowercase, no trailing period, under 72 characters.

### Pull requests

Every change goes through a PR, including solo work — the PR is where CI runs and where the diff gets read once more before it lands.

PR requirements:

- Title follows Conventional Commit format; it becomes the squash-merge commit
- Description states what changed and why, and links the relevant document section for anything spec-driven
- All CI checks green
- UI changes include a screenshot in both themes
- Squash merge only, so `main` history stays one commit per change

### CI — GitHub Actions

Every CI job runs on GitHub-hosted runners. On every PR:

| Job | Runs |
| --- | --- |
| `lint` | ESLint and Prettier check |
| `typecheck` | `tsc --noEmit` across all workspaces |
| `test-unit` | Vitest unit and component tests |
| `test-integration` | Vitest against `supabase start`, migrations applied |
| `test-e2e` | Playwright against a built app and the `supabase start` stack |
| `build` | Production builds of web and service |

Jobs run in parallel where possible. E2E is the slow one; it runs on PRs and on `main`, not on every push to a branch.

**On merge to `main`: deploy automatically.** The `deploy` job, and nothing else, runs on a self-hosted Actions runner on the box. The runner connects outbound to GitHub, so no inbound port is opened. **A self-hosted runner never runs PR jobs**, because a PR's code would then run on the production machine.

The deploy job runs only once every check has passed for the merged commit. It then:

1. builds the service image and the PWA locally on the box, tagging the image with the commit SHA (there is no image registry)
2. takes a database backup (`docker compose exec backup /backup.sh`)
3. applies pending migrations with the Supabase CLI
4. restarts `hearth-service` and `caddy` on the new build

Safeguards, given this deploys straight to the only environment there is:

- A failed backup or a failed migration aborts the deploy without restarting anything
- Health checks gate the restart; a service that fails `GET /api/health` within 60 seconds is rolled back to the previous locally built image tag
- Deploys are skipped when the only changes are under `docs/`
- A deploy starts any Supabase service that is not running but never recreates one, so it never restarts the database. A change to the `db`, `auth`, `realtime`, `kong`, or `backup` configuration or image is applied by hand with `docker compose up -d` after a backup (README, "Deploy").

The deploy is `scripts/deploy.sh`, which the workflow runs from the runner's checkout of the merged commit.

### Dependencies

Dependabot weekly, grouped by ecosystem. Security updates are reviewed within 7 days; the rest batch monthly.

### What lands in the repo

Committed: source, migrations, Flipp fixtures, `.env.example`, the Compose file, Caddyfile, Kong config, and these specification documents under `docs/`.

Never committed: `.env`, backups, database dumps, VAPID keys, or anything containing real household data.

## PWA implementation

### Service worker

Built with **Workbox** via `vite-plugin-pwa`. Hand-rolling a service worker for offline queueing and cache versioning is a known source of subtle bugs.

Caching strategy by asset type:

| Asset | Strategy |
| --- | --- |
| App shell (JS, CSS, HTML) | Precache, revisioned at build |
| Fonts | None needed — system fonts only |
| Deal images | Loaded directly from Flipp's image CDN (cross-origin, allowed by the CSP's `img-src`); cache-first, 7-day expiry, 100-entry cap |
| API responses | Not cached by the service worker; TanStack Query's persisted cache handles this |

**Update handling**: a new service worker activates on next load rather than immediately. When one is waiting, show a subtle "Update available" affordance rather than reloading under the user — a forced reload mid-shopping-trip would be a genuine annoyance.

### Offline data

TanStack Query's persister writes its cache to IndexedDB through `idb-keyval`. The cache holds the last-synced shopping lists, meal plan, chores, errands, and bills for the active household, so a cold start offline renders from the last known state rather than empty.

### The write queue

The part most likely to be implemented incorrectly, so the rules are explicit. The queue *is* TanStack Query's paused mutations. There is no custom queue, no `client_mutation` table, and no server-side dedupe middleware.

- Only the writes the Requirements document lists are queueable. v1.0 covers list item add, check, uncheck, and edit; v1.3 adds chore complete and errand done. Every other mutation is disabled while offline.
- Each queueable mutation has a default `mutationFn` registered with `setMutationDefaults`, so paused mutations can resume after a reload. They are persisted along with the query cache via `idb-keyval`.
- Every queueable mutation carries a `scope` id: `list:<listId>`, `chore:<choreId>`, or `errand:<errandId>`. Mutations in the same scope run one at a time, **in the order they were made**.
- The UI applies the change optimistically and marks the row pending (reduced opacity, clock icon)
- Writes are idempotent, so replaying a write that already landed changes nothing:
  - Inserts carry a client-generated UUID primary key and use `on conflict do nothing`.
  - Updates send absolute values (`status: 'bought'`), never toggles or increments.
  - A chore-completion Undo tapped while the completion is still queued removes the paused mutation from the queue. Deleting a completion that has already been sent is online-only.
  - A chore completion relies on the unique (`chore_id`, `occurrence_date`) key, with `occurrence_date` computed by the client at the time of the action.
- A write that fails permanently (410, 403, or 404 for a deleted parent) is dropped from the queue and surfaced once, naming what could not be saved. It is never retried forever and never silently discarded.
- Conflicts: **the last write to arrive wins**, per the Requirements document. This includes its documented quirk: a late offline "in cart" can move a "bought" item back to "in cart".
- The queue survives a page reload and a browser restart; it is not in memory
- `updated_at` exists only where the UI needs it: `shopping_list.updated_at`, shown as a list's last activity

### Client error reporting

The PWA reports unexpected errors to `POST /api/client-error` after passing them through the shared scrubbing function in `packages/shared`. It reports from global `error` and `unhandledrejection` handlers and from React error boundaries, at most 10 reports per page load. There is no third-party error SDK.

### Install and notifications

- Web app manifest with name, section-neutral theme color (the Dashboard slate `#475569`), maskable icons at 192 and 512px, `display: standalone`
- Install prompt offered after onboarding completes, not on first paint
- **iOS specifically**: web push only works once the PWA is added to the home screen, so on iOS the notification permission request must follow install, and onboarding should explain the sequence rather than requesting permission that will fail
- Permission is requested with context — after a user enables their first notification type, never on load

### Performance budget

On a mid-range phone over 3G: first contentful paint under 2s, interactive under 3.5s. The app shell stays under 200KB gzipped, which the absence of web fonts and a UI library makes comfortable. Route-level code splitting per pillar.

The shell is what the entry chunk pulls in statically: the HTML, the stylesheet, and the modules `index.html` preloads alongside it. `pnpm build` gzips exactly those files, prints the total, and fails over the budget, so the number is checked on every build rather than remembered. Two things are deliberately kept out of it, because both are large and neither is needed to paint.

- **The common-password list** (10,000 entries, 99KB of text) is reachable from every request schema that mentions a password, so it lives behind the `@hearth/shared/common-passwords` subpath rather than the package's entry point. The service composes it into the schemas its signup and change-password routes validate with; the PWA reaches it only from the three screens that set a password, each behind a lazy route. A test walks the entry point's static imports and asserts the shell never gets there.
- **supabase-js** is imported dynamically, in the one module that constructs it. Its single entry point carries the auth, realtime, storage, and postgrest clients together, and nothing can be shown until the session is known anyway — which is what the session's `loading` state is for. The shell paints its skeleton while the client arrives.
