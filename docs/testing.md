# Testing

## Overview

Four layers, each catching a different class of bug:

| Layer | Tool | Runs where | Catches |
| --- | --- | --- | --- |
| Unit | Vitest (two files, `node --test`, in `e2e/support`) | Plain Node, no I/O | Bugs in pure logic: recurrence math, price parsing, matching, formatting |
| Integration | Vitest against a real Postgres | `supabase start`'s local Postgres/GoTrue | Bugs in SQL, RLS policies, transactions, and the service's route layer |
| Component (frontend) | Vitest + Testing Library | jsdom (a simulated browser DOM, no real browser) | Bugs in how a React component renders and reacts to state |
| End-to-end | Playwright | A real Chromium browser against the full Docker Compose stack | Bugs that only show up with real HTTP, real Caddy routing, and a real browser |

Tests never make a live network call. Everywhere the app would talk to Flipp or fetch a recipe
page, tests substitute a fixture or a test double instead.

## Unit tests

**Where they live:** co-located next to the code they test, as `<name>.test.ts`. For example:

- `packages/recurrence/src/occurrence.test.ts` next to `occurrence.ts`
- `packages/matching/src/matcher.test.ts` next to `matcher.ts`
- `apps/service/src/deals/money.test.ts` next to `money.ts`
- `apps/web/src/lib/money.test.ts` next to `money.ts`

The two exceptions are `e2e/support/run-identity.test.ts`, which tests the pure run-naming logic in
`run-identity.ts` (Compose project/network/image-tag derivation), and `e2e/support/clock.test.ts`,
which tests the household-clock helpers in `clock.ts`. Both use Node's built-in test runner
(`node --test`) instead of Vitest, so they need no dependencies and no Docker to run.

**What they're for:** pure logic with no I/O — no database, no HTTP, no filesystem. This is where
correctness actually lives for three areas that get deliberately exhaustive, table-driven coverage:
recurrence (occurrence derivation, rotation, month-end clamping), price parsing (every real Flipp
string format plus the skip paths), and matching/normalization (token containment, pantry-beats-
sale, named false-positive cases like "chicken breast" must not match "chicken broth").

Not every file under `apps/service/src/**/*.test.ts` is purely functional — some (e.g.
`apps/service/src/app.test.ts`, `apps/service/src/cli.test.ts`) build the real Fastify app in
memory with `apps/service/src/test/fake-app.ts`, which wires fake dependencies (a Kysely
`DummyDriver`, no real database, no GoTrue) and drives it with Fastify's `inject()`. These still
count as unit tests: nothing touches a socket or a real database.

**Runner:** Vitest everywhere except the two `node --test` files above.

**How to run them:**

```sh
pnpm test                              # every workspace's unit + component tests
pnpm --filter @hearth/recurrence test  # one workspace
pnpm --filter @hearth/matching test
pnpm --filter @hearth/service test     # excludes *.integration.test.ts (vitest.config.ts)
```

**Adding one:** put `<name>.test.ts` next to the module it tests, in the same package. A minimal
file looks like `packages/recurrence/src/occurrence.test.ts` or
`apps/service/src/deals/money.test.ts`: import `describe`, `expect`, `it` (and `it.each` for
table-driven cases) from `vitest`, import the function under test by its relative path, and group
assertions under `describe` blocks named after the function. Favor `it.each` tables over one `it`
per case when checking many inputs against the same rule, the way `money.test.ts` and
`occurrence.test.ts` do. No test setup or teardown is normally needed. The clock is already pinned
(see Dates and time zones below); a test that needs a different instant sets it explicitly.

### Dates and time zones

Tests must pass on any weekday and in any household time zone, so the clock and the zone are
controlled, not inherited from the machine.

- **The clock pin.** Every unit and component test runs with `Date` pinned by
  `test/clock-setup.mjs` to `HEARTH_TEST_NOW`, which defaults to `2026-10-14T12:00:00.000Z` (a
  Wednesday). Every workspace's unit Vitest config (and the service coverage config) loads the setup
  file; the integration config does not, and the setup file skips `*.integration.test.*` files in
  any case. It re-pins before each test and restores after it. A test overrides the instant with
  `vi.setSystemTime`.
- **The pin does not move.** Under the pin `Date.now()` and `new Date()` stay frozen while real
  timers run, and `performance.now()` is the real clock. A test of elapsed time, a deadline or a
  wait loop measures with `performance.now()` or installs fake timers in the test body.
  `vi.useRealTimers()` does not unpin `Date`: the next read is the pin again, not the machine
  clock. Only `*.integration.test.*` files see the machine clock.
- **Text rendered in the viewer's zone.** A test that asserts a stamp the browser formats in the
  viewer's zone (such as the deals "As of" line) keeps a literal expected string and pins that
  file's zone in a `vi.hoisted` block, restoring it in `afterAll`, as
  `apps/web/src/screens/deals/favorites.test.tsx` does with `America/New_York`.
- **Integration tests** run on the real clock, because the database clock cannot be pinned. They
  take dates from `apps/service/src/test/zone-dates.ts`: `currentInstant` (the one real-clock
  read), `dateInZone`, `householdDate`, and the helpers `addDays` and `daysBetween`.
- **The zone hook.** `test/global-tz.mjs` is a Vitest `globalSetup`, loaded by every workspace's
  Vitest config including the integration one. It validates `TZ` as an IANA zone, fails the run on
  a bad value, prints one `[test-clock]` line, and does nothing when `TZ` is unset.
- **The sweep.** `pnpm test:sweep` runs the unit suite once per cell of a fixed matrix, each cell in
  its own process with its own `HEARTH_TEST_NOW` and `TZ`; `pnpm test:sweep:integration` runs the
  service integration suite once per zone. Both come from `scripts/test-sweep.mjs`, which also
  takes `--workspace`, `--cell`, `--only`, `--log-dir` and `--list`, and prints
  `sweep: {passed}/{total} passed`.

  | Unit cell | Instant (UTC) | `TZ` | What it covers |
  | --- | --- | --- | --- |
  | `default` | pinned default | unset | The plain run CI makes |
  | `wed-tokyo` | 2026-10-14 12:00 | `Asia/Tokyo` | A weekday in a UTC-positive zone |
  | `sat-utc-fri-la` | 2026-10-17 02:30 | `America/Los_Angeles` | Saturday in UTC, still Friday in a UTC-negative zone |
  | `sun-utc-mon-kiritimati` | 2026-10-18 22:30 | `Pacific/Kiritimati` | Sunday in UTC, already Monday at UTC+14 |
  | `newyear-pago-pago` | 2027-01-01 00:30 | `Pacific/Pago_Pago` | A year boundary, still the old year at UTC-11 |
  | `dst-start-new-york` | 2026-03-08 07:30 | `America/New_York` | The spring-forward day |

  | Integration cell | `TZ` | What it covers |
  | --- | --- | --- |
  | `default` | unset | The plain run CI makes |
  | `la` | `America/Los_Angeles` | A UTC-negative machine zone |
  | `kiritimati` | `Pacific/Kiritimati` | The furthest UTC-positive zone (UTC+14) |
  | `pago-pago` | `Pacific/Pago_Pago` | The furthest UTC-negative zone (UTC-11) |
  | `tokyo` | `Asia/Tokyo` | A mid UTC-positive zone |

- **Setting `TZ`.** Set it only through the sweep, or through an `env` object passed to a spawned
  process. The hook then validates it, and the sweep checks that it took effect. Never export it in
  the shell or force `TZ=UTC` for a whole suite.
- **The lint rule.** ESLint's `no-restricted-syntax` bans bare `new Date()` and `Date.now()` in test
  files, `e2e/`, the test helper folders and `test/**/*.mjs`; production modules are not covered.
  Read the clock through a helper where one exists: `currentInstant()` from
  `apps/service/src/test/zone-dates.ts` in service tests, and from `e2e/support/clock.ts` in E2E.
  `apps/web`, `packages/*` and `test/` have no such helper, so pass an explicit instant to the
  `Date` constructor there, even though the lint message names `currentInstant()` everywhere. A
  read that must stay carries `// eslint-disable-next-line no-restricted-syntax -- {reason}` on the
  line directly above it.

## Integration tests

**Where they live:** `apps/service/src/**/*.integration.test.ts`, for example
`apps/service/src/db/rls-isolation.integration.test.ts`, `apps/service/src/bills.integration.test.ts`,
`apps/service/src/chores.integration.test.ts`.

**Setup:** they run against a real local Postgres started by the Supabase CLI
(`supabase start`), migrated from `supabase/migrations/`, so they exercise real SQL, real Row Level
Security policies, and real triggers — not a mock. `vitest.integration.config.ts` only includes
`*.integration.test.ts`, runs files one at a time (`fileParallelism: false`, because fixtures share
natural keys like a postal code), and raises the test/hook timeouts to 20s/30s for the slower I/O.

**Test isolation — there are two patterns used side by side, by what the test is checking:**

1. **Database/RLS-level tests** (`apps/service/src/db/*.integration.test.ts`, and files like
   `apps/service/src/deals.integration.test.ts`) use `apps/service/src/test/integration-db.ts`'s
   `withTestDb(fn)`. It opens one Postgres connection, begins a transaction, and always rolls that
   transaction back when the test function returns or throws — nothing a test writes ever commits.
   Inside the transaction, `db.admin` runs as the connection's own superuser-like role for fixture
   setup, and `db.as(user)` runs a statement inside its own savepoint after `set local role
   authenticated` plus `request.jwt.claims` set to that user's claims, so `auth.uid()` resolves and
   every RLS policy applies exactly as it would for a real request. `apps/service/src/test/world.ts`
   builds a standard two-household fixture (`buildWorld`) with one row in every household-scoped
   table, which the RLS isolation suite (`db/rls-isolation.integration.test.ts`) uses to assert that
   a member of household A can neither read, insert, update, nor delete anything in household B.

2. **Service/route-level tests** (most other `*.integration.test.ts` files, e.g.
   `bills.integration.test.ts`, `chores.integration.test.ts`) use
   `apps/service/src/test/service-stack.ts`'s `startStack()`. This builds the real Fastify app
   wired to the real `supabase start` Postgres (as `hearth_service`) and real GoTrue through Kong,
   and tests call it with `app.inject()` the way a real HTTP request would arrive. Requests here
   **commit for real** — there is no rollback — so isolation instead comes from every test creating
   its own users, households, and postal codes with randomized or counter-based unique values
   (`signUp()`, `uniqueName()`, a per-file `nextPostalCode()` counter). Rows scoped to a shared key
   (like a postal code's refresh cache) are cleaned up explicitly, either deleted in the file's own
   `beforeEach` or wiped wholesale in `afterAll` (see `jobs.integration.test.ts`), so a stale row
   from one test run never leaks into a later one.

`apps/service/src/test/fixture-deal-source.ts` and `apps/service/src/test/push-double.ts` are test
doubles used by both patterns to stand in for the live Flipp fetch and for Web Push.

**How to run them:**

```sh
supabase start                # once; starts local Postgres, GoTrue, Realtime, Kong
pnpm test:integration          # pnpm -r --if-present test:integration; currently just the service
```

**Adding one:** name the file `<name>.integration.test.ts` under `apps/service/src/`. If it's
asserting something at the database/RLS level, use `withTestDb` from `test/integration-db.ts`
(optionally `buildWorld` from `test/world.ts` for a ready two-household fixture) and let the
transaction rollback handle cleanup. If it's asserting service/route behaviour, use `startStack`
and `newApp()`/`as()`/`signUp()` from `test/service-stack.ts`, give every fixture row a unique name
or postal code, and clean up any row keyed on something shared (like a postal code) yourself.

## Frontend/component tests

**Where they live:** `apps/web/src/**/*.test.tsx` (and `*.test.ts` for non-component modules),
co-located with the code, e.g. `apps/web/src/components/dashboard/dashboard.test.tsx`,
`apps/web/src/screens/bills/bills-index.test.tsx`, `apps/web/src/lib/offline/write-queue.test.tsx`.

**Tools:** Vitest as the runner, jsdom as the simulated DOM, and `@testing-library/react` /
`@testing-library/user-event` for rendering components and simulating user interaction the way a
real user would (clicking, typing) rather than calling internal methods. `apps/web/src/test-setup.ts`
runs before every test file: it mocks the PWA update-prompt hook (`virtual:pwa-register/react`,
a build-time virtual module unavailable under Vitest), stubs layout APIs jsdom lacks
(`ResizeObserver`, `scrollIntoView`, pointer capture) that Radix components call, and calls
Testing Library's `cleanup()` after each test.

**Asserting async UI state:** never a fixed delay (`setTimeout`/`sleep`). Use `waitFor` from
`@testing-library/react` to poll for a condition — a resolved query, a re-rendered element — the
way `apps/web/src/lib/offline/chore-errand-writes.test.ts` and
`apps/web/src/components/shell/shell.test.tsx` do. A fixed delay is either too short (flaky) or
wastefully long; `waitFor` resolves the moment the assertion passes.

**Both-theme coverage:** there is no per-component-test loop over light/dark theme — that pattern
(`test.use({ colorScheme })`, see below) is specific to the Playwright E2E layer, which checks
real rendered contrast with axe-core. Component tests assert markup, props, and behavior, not
rendered colors, so they don't need a theme pass.

**Adding one:** name the file `<name>.test.tsx` (or `.test.ts` for a non-JSX module) next to the
component or module. Import `render`, `screen`, and (for interaction) `userEvent` from Testing
Library plus `describe`/`expect`/`it`/`waitFor` from the relevant libraries; render the component
with whatever providers it needs (query client, router), query for elements the way a user would
(`getByRole`, `getByLabelText`) rather than by test id, and assert on what's visible. For anything
that triggers a query or a state update, wrap the assertion in `waitFor` instead of asserting
immediately after the interaction.

**Naming a test file:** a component test file is named after the component it tests, one-to-one
(`Toast.test.tsx` next to `Toast.tsx`), unless several small, related components share one file, in
which case the file is named after their containing module or folder instead (`primitives.test.tsx`
covers several `components/ui` primitives together, `dashboard.test.tsx` covers the dashboard
card components, `shell.test.tsx` covers the shell's own small pieces). Either name is fine; what
matters is that one file maps to either one component or one clearly-related group, not an
arbitrary mix.

**Running them:**

```sh
pnpm --filter @hearth/web test
```

## End-to-end tests

**Setup:** drives a real Chromium browser against the production Docker Compose stack —
`docker/docker-compose.yml` with `e2e/docker-compose.e2e.yml` layered over it — including Caddy
and Kong exactly as deployed, and the service's real build, not a dev server or a mock.

**How journeys are organized:** numbered spec files under `e2e/tests/`, each a real user story,
e.g. `01-signup-and-first-household.spec.ts`, `09-search-deals-and-add-to-list.spec.ts`,
`14-bills-and-subscriptions.spec.ts`, `19-notifications.spec.ts`, `20-remove-member.spec.ts`.
Journeys with two files for one story keep the shared number scheme in order rather than sharing a
prefix (journey 7's list half is `11-offline-list-sync.spec.ts`, its chores/errands half is
`18-chores-and-errands-offline.spec.ts`). `20-remove-member.spec.ts` runs last on purpose: the
suite runs on a single worker, in file order, sharing one seeded database, and removing members
from Oak Street would invalidate what later journeys expect to find — so a new journey is numbered
after the last non-removal file, and the removal journey is renumbered to stay last.

Every journey's `test.describe` is wrapped in a `for (const theme of ['light', 'dark'])` loop with
`test.use({ colorScheme: theme })` (see `01-signup-and-first-household.spec.ts`), so each journey
runs once per theme. Every screen state a journey passes through calls
`expectAccessible(page, screenName)` from `e2e/support/axe.ts`, which first waits for every
running CSS animation/transition to finish (`settleAnimations`, since axe reads computed styles
and would otherwise catch a mid-transition color) and then runs `@axe-core/playwright` against
WCAG 2.1 A/AA tags, failing the test on any violation. States no ordinary journey passes through
(first-run screens, offline states, confirmation dialogs, notification states) are covered instead
by `e2e/tests/17-accessibility-states.spec.ts`, which runs the same theme loop.

**Clock and browser zone:** E2E stays on the real clock, since no seam pins the stack's. A spec
that needs a date derives it at run time through `e2e/support/clock.ts` (`currentInstant`,
`dateInZone`, `hourInZone`, `addDays`) in the household's zone, or reads the seeded value from the
database, and never assumes a weekday. `e2e/playwright.config.ts` runs the browser in
`America/New_York` with locale `en-US`, so rendered times do not depend on the runner's zone (CI
runs in UTC). The seed households run on New York time, so calendar dates already follow them.

**Seed data:** every run seeds the same local-dev fixtures described in Seed data below, then layers
`e2e/fixtures/e2e-seed.sql` on top — Casey's personal "Car Insurance" bill (survives Empty House's
deletion) and two pre-warmed `deal_query_cache` rows the search journey depends on as a cache hit
rather than a live Flipp call. Journey 1 (`01-signup-and-first-household.spec.ts`) also creates two
accounts of its own outside either seed, since signing up is the journey under test: Riley Park
(`riley@example.com`, household "Maple Court") and Drew Alvarez (`drew@example.com`, household
"Birch Lane"), both in postal code 27514 with the same seed password.

**Per-run isolation:** each invocation of `pnpm test:e2e` is a "run" with its own six-hex-digit id
(`HEARTH_E2E_RUN_ID`, generated if not set), computed in `e2e/support/run-identity.ts` and
`e2e/support/env.ts`. Everything the run touches is namespaced by that id: the Compose project
(`hearth-e2e-<id>`), a Docker network of the same name (created by the run itself, before `compose
up`, on the first free `/24` between `172.16.240.0/24` and `172.16.254.0/24` — Docker's atomic
"refuse an overlapping subnet" check means two runs starting together can't collide), the image
tag (`e2e-<id>`) for the two images the run builds, a state directory under the OS temp dir holding
a throwaway generated `.env`, and two free loopback ports for Caddy and Postgres picked at run
start. Two runs — two clones, or two people — can therefore run the full suite at the same time on
one machine without touching each other's stack, each other's `supabase start`, or any `.env`
already on disk. Teardown (`global-teardown.ts` / `stopStack()`) removes exactly that run's
project, network, and images by name, and drops the database volume, so a trusted run always starts
from an empty, freshly-seeded database.

**The Flipp/recipe fixture seam:** the suite never calls the live Flipp service or fetches a real
recipe page. The overlay mounts `e2e/fixtures/flipp/raw` read-only into the service container and
sets `HEARTH_FLIPP_FIXTURE_DIR` (plus `HEARTH_FLIPP_FIXTURE_NOW`, pinning "now" to the captures'
own instant) so the deal-fetching code reads the checked-in captures instead of the network; both
variables are unset in every real deployment. Recipe import similarly mounts
`e2e/fixtures/recipes` read-only and sets `HEARTH_RECIPE_FIXTURE_DIR`, so `fetchRecipePage` is
swapped for a fixture-reading function that never opens a socket. Journey 4 pastes one of three
fixture URLs under the never-resolved domain `fixtures.hearth-e2e.test`. Web Push gets the same
treatment: `HEARTH_PUSH_TRANSPORT=test-double` records pushes instead of sending them, read back
through `/api/test/push`, and the browser's `PushManager` is stubbed before the app loads so no
real push service is ever contacted.

**Running the suite:**

```sh
# once: install the browser
pnpm --filter @hearth/e2e exec playwright install --with-deps chromium

# the whole suite: builds and starts the Compose stack from an empty database,
# migrates, seeds, runs every journey, tears the stack down
pnpm test:e2e
```

Needs Docker, the Supabase CLI, and `psql` on the path. For iterating on a single test without
paying for a full stack bring-up/teardown each time:

```sh
# first run: note the run id it prints ("run <id>, project hearth-e2e-<id>: ...")
HEARTH_E2E_REUSE_STACK=1 pnpm test:e2e

# subsequent runs: reuse that stack, point Playwright at one spec file
HEARTH_E2E_REUSE_STACK=1 HEARTH_E2E_RUN_ID=<id> pnpm --filter @hearth/e2e exec playwright test tests/14-bills-and-subscriptions.spec.ts
```

`HEARTH_E2E_REUSE_STACK=1` skips bring-up (if a stack for that run id already exists) and skips
teardown, so the stack is still running — and, importantly, no longer backed by an *empty*
database — afterward. Only trust a run's result when it started from an empty database, i.e.
without reuse.

**Adding a new journey:** create `e2e/tests/<next-number>-<slug>.spec.ts`, where `<next-number>` is
one past the highest-numbered file that isn't the member-removal journey (currently `20-`); if your
journey needs to run after member removal is irrelevant, add it as the new highest number and leave
`20-remove-member.spec.ts` renumbered to stay last. Wrap the test in the `for (const theme of
['light', 'dark'])` / `test.use({ colorScheme: theme })` loop, and call `expectAccessible(page,
'<screen description>')` from `e2e/support/axe.ts` on every screen state the journey reaches. Use
the helpers in `e2e/support/` (`app.ts` for shared navigation like `expectDashboard`/`switcher`,
`bills.ts`, `db.ts`, `push.ts`, `api.ts`, `raw-http.ts`) rather than duplicating selectors. If the
journey needs new captured data, add a Flipp fixture under `e2e/fixtures/flipp/` (raw plus its
normalized counterpart) or a recipe fixture under `e2e/fixtures/recipes/`, following the existing
naming (merchant/postal code for Flipp, descriptive slug for recipes) — never point the journey at
a real external URL. Never add a fixed wait or a retry to make a flaky step pass: Playwright's own
web-first assertions (`expect(locator).toBeVisible()`, etc.) already poll, and the suite runs with
`retries: 0` deliberately, so a flake has to be fixed, not retried away.

## Seed data

`pnpm db:seed` populates a fresh local stack with three households, five users, and fixtures for
every pillar — deals, pantry, recipes, meal plan, bills, chores, errands — real enough to browse
without waiting on a live Flipp fetch. Seeding runs in two steps, both run by that one command:
`supabase/seed/seed-users.ts` creates the five users through GoTrue's admin API (firing the same
`profile` trigger a real signup would), then applies `supabase/seed/seed.sql` with `psql` for
everything else. Both steps refuse a database that has any user besides the five seed users, so the
published seed password below never ends up protecting anything but a throwaway local stack. The SQL
runs once per database — `supabase db reset` before seeding again. Dates throughout are computed
relative to the seed run (in each household's own timezone, not the server's), so the data never
goes stale no matter when it's seeded.

The E2E suite (see End-to-end tests above) seeds from this same data, plus a small E2E-only layer of
its own.

### Users and households

Every seed user has the password `hearth-seed-pass-2026`.

| Name | Email | Timezone |
| --- | --- | --- |
| Alex Rivera | `alex@example.com` | `America/New_York` |
| Sam Chen | `sam@example.com` | `America/New_York` |
| Jordan Blake | `jordan@example.com` | `America/New_York` |
| Morgan Reed | `morgan@example.com` | `America/Chicago` |
| Casey Nguyen | `casey@example.com` | `America/Los_Angeles` |

`HEARTH_OWNER_EMAIL` in the local `.env` is `alex@example.com`, so Alex is the only seed user who
sees System health.

| Household | Postal code | Timezone | Members |
| --- | --- | --- | --- |
| Oak Street | 27514 (Chapel Hill, NC) | `America/New_York` | Alex (admin), Sam, Jordan |
| Rivera Family | 27601 (Raleigh, NC) | `America/New_York` | Alex (admin), Morgan |
| Empty House | 27705 (Durham, NC) | `America/Los_Angeles` | Casey (admin) |

Alex belongs to both Oak Street and Rivera Family (active household: Oak Street), which is the
fixture for multi-household switching and isolation. Morgan's own timezone (`America/Chicago`)
differs from Rivera Family's household timezone — dates and send times always follow the household,
quiet hours always follow the user, and this is the one seed account where those two diverge. Empty
House has no pillar data at all, for first-run/empty-state screens, and Casey is also a **former
member of Oak Street** who left 5 weeks ago, so Oak Street's own history has records attributed to a
departed member (rendered as "Former member" — see Chores below).

Notification settings: Jordan has "remind me about all household bills" on; Sam has quiet hours
22:00–07:00; Alex has opted into the weekly meal-plan nudge for Oak Street only.

Oak Street also has three household invites, covering every invite state: one outstanding (code
`K7M2Q9XA`, created 2 days ago — `pnpm db:seed` prints its link token), one expired (`EXP9RD2Z`,
created 9 days ago), and one revoked (`RVK4D3NM`, created 4 days ago and revoked a day later).

### Deals, pantry, and shopping lists

Favorite stores: Oak Street has Harris Teeter, Food Lion, and CVS Pharmacy; Rivera Family has Publix
and Walmart; Empty House has Harris Teeter and Food Lion. Flipp merchant ids are stable across
captures and worth knowing if you're writing a new test against them: Harris Teeter `2431`, Food
Lion `2100`, Publix `2361`, Lowes Foods `2469`, CVS Pharmacy `2264`, Walmart `2175`.

Deals for postal code 27514 are real captured Flipp items (not invented strings), covering every
pricing shape the parser handles: clean shelf prices (e.g. Harris Teeter's Woodbridge Cabernet,
$7.19, 20% off $8.99), multi-buy ("2/$5.00" Egg-Land's Best Eggs → $2.50 each), one BOGO (Publix's
Mifroma Gruyère, half of $9.49 rounded to $4.75, 50% off), loyalty-card/coupon conditional prices
(CVS's Colgate Optic White at $4.79 "WITH CARD"), and a dozen everyday favorite-store groceries
(Food Lion's broccoli, ground beef, chuck roast; Harris Teeter's pork chops and bakery bread) that
the recipe readiness scores below are computed against. Three deals are deliberately expired
(`valid_to` yesterday), each attached to a "This Week" list item to exercise a different repricing
outcome on next fetch: Food Lion's old broccoli re-matches this week's broccoli deal, Food Lion's
bacon falls back to its known regular price, and CVS's shampoo has its price cleared entirely with
no fallback. Postal code 27514 also has a stale `deal_query_cache` row for "chicken" (cached 7 hours
ago, past the 6-hour TTL) and an empty-result row for "saffron"; postal code `99999` is the
no-merchants fixture (used directly by `apps/service/src/deals.integration.test.ts`); and 27705
(Empty House) has no `postal_code_refresh` row at all, so its flyers screen shows "no cache,
refreshing".

Pantry: Oak Street has twenty staples (olive oil, salt, pepper, garlic, rice, flour, sugar, butter,
milk, bread, soy sauce, cumin, paprika, canned tomatoes, black beans, chicken broth, parmesan, eggs,
yellow onions, pasta). Eggs, bread, and pasta also match a current deal at a favorite merchant, which
is the pantry-beats-sale fixture — each should count once, in the pantry bucket, never double-counted
as "on sale" too.

Shopping lists: Oak Street's **"This Week"** (created by Sam) has 15 items mixing deal-sourced,
recipe-sourced, and manual entries, bought/in-cart/needed statuses, and the three repriced items
above; its store subtotals from needed/in-cart items only are Food Lion $18.26 (plus one unpriced),
Harris Teeter $7.00 (plus one unpriced), CVS Pharmacy $10.78 (plus one unpriced), and a store-less
"Anywhere" group at $0.00 with three unpriced. **"Weekend Cookout"** (created by Jordan) is 4 items,
all bought, for the all-bought summary. **"Party Supplies"** is archived, 8 items, all bought, for
the read-only archived-list view. Rivera Family has one list, left empty, for the empty-list state.

### Recipes, pantry readiness, and meal plan

Oak Street has twelve recipes, chosen so readiness spreads across the full range rather than
clustering; ten carry a `source_url` and each ingredient's original `raw_text` as if imported from a
URL, and two ("Lentil Curry", "Shrimp Pad Thai") are manual entries with no source. Readiness is not
hand-written into the seed — `supabase/seed/seed-users.ts` computes it after `seed.sql` applies, by
calling the real matcher against the seeded pantry, deals, and overrides, so the numbers below are
always that code's own output, not an asserted constant. **"Sheet Pan Chicken and Vegetables" scores
6 of 7 ingredients ready (86%)** — 3 on sale at Food Lion, 3 in the pantry, 1 to buy — and this exact
figure is a genuine test oracle: `apps/service/src/services/readiness.test.ts` asserts
`computeReadinessPercent(3, 3, 7)` equals `86` specifically because it's this recipe's seeded shape,
and `e2e/tests/13-recipe-import-and-readiness.spec.ts` asserts "86%" directly against the running
app. "Grilled Cheese and Tomato Soup" scores 100% (bracketing the other end of the range). Rivera
Family's two recipes ("Tuna Poke Bowl", "Miso Soup") both score 0%, since nothing at Publix or
Walmart matches them — the fixture for the "all recipes at 0%" and empty-suggestions states. Oak
Street also has one match-override fixture: a force-no-match between ingredient "cheese" and the
deal "snack cheese" (Harris Teeter's), which demonstrates the "Corrected" label without changing any
score above, since "cheese" already matches Food Lion's "chunk or cheese" instead.

The meal plan's current week has seven entries for Oak Street, including two in Wednesday's dinner
slot; the previous week has five, one of which has a null `recipe_id` and the snapshot title
"Mushroom Stroganoff" — a recipe that no longer exists, for the deleted-recipe display. The coming
week is left empty on purpose, which is what makes Alex's weekly meal-plan nudge eligible.

### Bills and subscriptions

Nine bills on Oak Street/personal, spanning every state. Every occurrence from a bill's anchor date
up to (but not including) its current occurrence has a paid or skipped `bill_payment_log` row, except
Duke Energy's, which is left unlogged on purpose:

| Bill | Amount | Current occurrence | Autopay | Visibility | Owner |
| --- | --- | --- | --- | --- | --- |
| Rent | $1,850.00/mo | 1st of next month | No | Household (Oak Street) | Alex |
| Duke Energy | $142.30/mo | 5 days ago — **overdue, unlogged** | No | Household (Oak Street) | Sam |
| Spectrum Internet | $74.99/mo | In 3 days | Yes | Household (Oak Street) | Alex |
| Water and Sewer | $58.40/mo | In 9 days | No | Household (Oak Street) | Jordan |
| Renters Insurance | $186.00/yr | In 40 days | Yes | Household (Oak Street) | Alex |
| Spotify | $11.99/mo | In 12 days | Yes | **Personal** | Alex |
| Adobe Creative Cloud | $59.99/mo | In 20 days | Yes | **Personal** | Sam |
| Gym Membership | $34.00/mo | In 6 days | Yes | **Personal** | Jordan |
| Old Phone Plan | $45.00/mo | — archived 30 days ago | No | Household (Oak Street) | Sam |

Spectrum, Spotify, Adobe, and Gym are subscriptions with `is_auto` payment-log rows. Sam's Adobe
subscription has its `last_used_confirmed_at` set 70 days ago — past the 60-day threshold — so it's
the one fixture that triggers the "Still using this?" prompt; Spectrum, Spotify, and Gym all have a
recent confirmation and deliberately do not. Personal bills (Spotify, Adobe, Gym) have a null
`household_id` and must stay invisible to household members other than their owner — the RLS
isolation tests assert against exactly this. Subscription-view totals are another test oracle, used
directly by `e2e/tests/14-bills-and-subscriptions.spec.ts`: **Alex sees Spectrum + Spotify for
$86.98/month, Sam sees Spectrum + Adobe for $134.98, Jordan sees Spectrum + Gym for $108.99**, and
Adobe never appears for Alex. Water and Sewer's payment history includes one skipped occurrence, for
the skip display; one Duke Energy payment was recorded 4 days late, which is the fixture proving a
late payment never shifts the next occurrence's date.

### Chores and errands

Six chores on Oak Street, covering every recurrence and rotation shape:

| Chore | Recurrence | Rotation / assignee | State |
| --- | --- | --- | --- |
| Take out trash | Weekly | Alex → Sam → Jordan, offset 2 | **Sam's turn, due today** |
| Clean bathroom | Weekly | Alex → Sam → Jordan, offset 1 | Jordan's turn, due in 2 days |
| Vacuum common areas | Weekly | Unassigned | Overdue 3 days; last done 5 weeks ago, by "Former member" |
| Replace HVAC filter | Monthly | Assigned to Alex | Due in 11 days |
| Deep clean fridge | Monthly | Alex → Sam, offset 0 | Alex's turn, due in 6 days |
| Water plants | Every 3 days | Unassigned | Due tomorrow |

Take out trash's rotation is a live test oracle, not just a display value: its offset-2 rotation over
8 completed occurrences lands on `(2 + 8) mod 3 = 1`, which is Sam — and
`e2e/tests/15-chores-and-errands.spec.ts` mutates this exact seeded row in place (advancing and
undoing the rotation) rather than creating its own, so changing the seed's rotation numbers here would
invalidate that journey. Vacuum common areas' one completion was recorded by Casey, who has since left
Oak Street — the "Former member" attribution fixture.

Six errands on Oak Street mix every open/done and due/overdue/undated combination: "Return Amazon
package" (due in 2 days, Alex), "Pick up dry cleaning" (2 days overdue, unassigned), "Renew car
registration" (due in 3 weeks, Sam), "Buy birthday card" (no due date, unassigned), "Mail rent check"
(done, completed by its own assignee Alex), and "Replace porch light bulb" (done, assigned to Jordan
but completed by Sam — the completed-by-someone-else-than-assignee case).

### App errors

Three `app_error` rows seed System health: a `FlippFetchError` from `refresh-deals` (14 occurrences,
most recent 2 hours ago), a web `TypeError` on `/lists/:id` (3 occurrences, 5 hours ago), and a
`RecipeParseError` from the recipe-parse route (1 occurrence, 30 days ago — outside the last-24-hours
window, so it never shows in the default view).

## Manual system testing

A walkthrough for clicking through the real app locally, outside the test suites.

### 1. Start the local Supabase stack and seed it

```sh
supabase start                                                      # Postgres, GoTrue, Realtime, Kong, Studio
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "alter role hearth_service with login password 'hearth'"
pnpm db:seed                                                         # creates the 5 seed users + seed.sql rows
```

`pnpm db:seed` needs `psql` on the path, and it runs once per database — run `supabase db reset`
before seeding again. It refuses a database that already has any user other than the five seed
users, so it's safe only against a fresh local stack.

### 2. Start the service and web dev servers with the right environment

```sh
eval "$(supabase status -o env)"                                    # ANON_KEY, SERVICE_ROLE_KEY, JWT_SECRET
export DATABASE_URL=postgresql://hearth_service:hearth@127.0.0.1:54322/postgres
export GOTRUE_URL=http://127.0.0.1:54321/auth/v1
export HEARTH_ORIGIN=http://127.0.0.1:5173
export HEARTH_OWNER_EMAIL=alex@example.com                          # Alex is the seeded owner
export ANON_KEY SERVICE_ROLE_KEY JWT_SECRET
pnpm --filter @hearth/service dev
```

In a second terminal:

```sh
pnpm --filter @hearth/web dev
```

Open `http://127.0.0.1:5173`.

### 3. Sign in as a seeded user

Sign in as **Alex Rivera** (`alex@example.com`), the seeded owner — the only account that sees
System health (`HEARTH_OWNER_EMAIL` above). See Seed data above for every other seeded account, who
belongs to which household with what role, and what's already there to look at in each pillar.

### 4. Click through each pillar

Do this once as Alex in Oak Street (populated data) and once as Casey in Empty House (empty
states), and repeat the whole pass in both themes (see step 5).

- **Deals and lists.** Search for a grocery term (e.g. "chicken" or "milk"); browse flyers for a
  favorite merchant (Harris Teeter, Food Lion, CVS for Oak Street); open the "This Week" list and
  confirm store subtotals, the "Bought" group collapses, and unpriced items show the "+N unpriced"
  note; add an item manually and check it off.
- **Meals/recipes.** Open a recipe (e.g. "Sheet Pan Chicken and Vegetables") and check its
  readiness percentage and on-sale/pantry/to-buy buckets; add a missing ingredient to a list from
  the recipe; open the meal plan and confirm the current week's entries, including the
  "Mushroom Stroganoff" snapshot-title entry for a deleted recipe in the previous week.
  Try importing a recipe by URL if you have a fixture-free one to test against (this is a live
  fetch outside of E2E, so use a real page you control).
- **Bills.** Open the bills list and find one overdue (Duke Energy), one due soon with autopay
  (Spectrum Internet), and the Subscriptions view; mark a bill paid and confirm the next occurrence
  date is the anchor date, not today; check a personal bill (Alex's Spotify) stays out of the
  household view for other members.
- **Chores/errands.** Open "Take out trash" (rotating Alex → Sam → Jordan) and confirm whose turn
  it is; complete it and undo from the toast, confirming rotation and due date both revert; check
  "Vacuum common areas" shows "last done 5 weeks ago" and a completion attributed to "Former
  member" (Casey); open errands and confirm the overdue, unassigned, and done groups.
- **Notifications.** In Settings, toggle a notification type on/off and confirm it's reflected
  immediately; as Jordan, confirm "remind me about all household bills" is on.
- **Settings.** Switch between Oak Street and Rivera Family as Alex and confirm no household-A
  data leaks into household-B screens; open System health as Alex and confirm it's hidden for
  every other seeded user.

### 5. Check both themes

The app follows the OS/browser color-scheme preference rather than exposing an in-app toggle (the
same mechanism Playwright's `colorScheme` option drives in E2E). In Chrome DevTools: open the
Command Menu (Ctrl/Cmd+Shift+P), run "Show Rendering", and use "Emulate CSS media feature
prefers-color-scheme" to flip between `light` and `dark` without changing your OS setting. Re-run
a pass of the checklist above in both.

### 6. Check offline behavior

In DevTools' Network panel, switch the throttling dropdown to "Offline" (or check the offline
checkbox in the Application/Network panel, depending on Chrome version). With a list or chores
screen open, check an item off / complete a chore / mark an errand done — the UI should accept the
write immediately and show it as queued. Go back online and confirm the queued writes sync, in the
order they were made.

### 7. Check the PWA install prompt

The install prompt is offered only after onboarding completes, never on first paint — so finish
signup/household setup before expecting it. In Chrome, look for the install icon in the address
bar, or DevTools → Application → Manifest to inspect the manifest and trigger "Add to home
screen" manually. Confirm the standalone window opens without browser chrome once installed.

### 8. Reset back to a clean seeded state

```sh
supabase db reset        # drops and recreates the local database, reapplies every migration
pnpm db:seed              # re-seed from scratch
```

## Coverage

- **`packages/recurrence`**, **`packages/matching`**, and **`packages/shared`** — the three pure-logic
  packages with no I/O — each configure and enforce a coverage threshold: every one of their
  `vitest.config.ts` sets `thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 }`,
  and their `test`/`test:coverage` scripts both run with `--coverage`, so `pnpm test` — which CI's
  `test-unit` job runs — fails the moment coverage drops below 90% on any of the four metrics in any
  of the three. Each package's `index.ts` (a pure re-export barrel with no logic of its own) is
  excluded from the `coverage.exclude` glob rather than counted against the threshold.
- **`apps/service`** has a coverage threshold configured on `vitest.coverage.config.ts`:
  `thresholds: { statements: 95, branches: 83, functions: 96, lines: 97 }`, each a few points under
  the suite's actual measured coverage (96.65% / 85.78% / 98.07% / 98.56% as of the coverage unit
  that added it) rather than the exact number, so ordinary churn doesn't fail CI on noise.
  `pnpm --filter @hearth/service test:coverage` reports coverage across its unit *and* integration
  tests together (a unit-only number would understate what's exercised through the integration
  suite). It needs `supabase start` running, so CI's `test-integration` job runs it in place of a
  plain `pnpm test:integration` (the same job already pays for `supabase start`), enforcing the
  thresholds on every pull request and push to main; `test-unit` still runs plain `pnpm test`
  separately, with no coverage step.
- **`apps/web`** has no `test:coverage` script and no coverage configuration at all — component
  tests aren't measured by line coverage; the E2E journeys are what stand in for coverage on the
  UI.
