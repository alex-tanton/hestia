---
last_mapped_commit: 283f15dbb2b5ed8ded0ba14e04d5015e5d0d367c
last_mapped_at: 2026-10-22
---
# Testing Patterns

**Analysis Date:** 2026-10-22

## Test Framework

**Runner:**
- Vitest 5.0.1 (pinned in `package.json`, `apps/service/package.json`, `apps/web/package.json`) for unit, component, and integration tests.
- Node's built-in test runner (`node --test`) for the harness tests (see Test Types).
- Playwright (`@playwright/test`) for end-to-end tests: `e2e/playwright.config.ts`.
- Config files:
  - `apps/service/vitest.config.ts`: unit tests (`src/**/*.test.ts`, excludes `*.integration.test.ts`).
  - `apps/service/vitest.integration.config.ts`: integration tests (`src/**/*.integration.test.ts`).
  - `apps/service/vitest.coverage.config.ts`: unit and integration together, with coverage thresholds.
  - `apps/web/vite.config.ts` (a `test:` block): jsdom environment, `src/**/*.test.{ts,tsx}`.
  - `packages/matching/vitest.config.ts`, `packages/recurrence/vitest.config.ts`, `packages/shared/vitest.config.ts`.

**Assertion and component libraries:**
- Assertions: Vitest `expect`. `toEqual` and `toBe` dominate (about 1,400 uses in test files).
- DOM matchers: `@testing-library/jest-dom/vitest`, loaded in `apps/web/src/test-setup.ts`.
- Component queries and events: `@testing-library/react` 16.3.3 and `@testing-library/user-event` (used in 27 web test files, with `userEvent.setup()`).
- Accessibility: `@axe-core/playwright` in E2E (`e2e/support/axe.ts`).

**Run commands (from root `package.json` and the per-package scripts):**

```bash
pnpm test                               # harness tests, then every workspace's unit and component tests
pnpm test:harness                       # only the harness tests (node --test)
pnpm -r test                            # every workspace's unit tests, without the harness
pnpm --filter @hearth/service test      # service unit tests (no database)
pnpm --filter @hearth/web test          # web component and unit tests (jsdom)
pnpm test:integration                   # integration tests in every workspace that defines one (needs supabase start)
pnpm --filter @hearth/service test:coverage   # unit and integration together, enforces thresholds (CI test-integration job)
pnpm --filter @hearth/web test:coverage       # web coverage, enforces thresholds
pnpm test:sweep                         # unit suite across the date and time-zone matrix
pnpm test:sweep:integration             # integration suite across the zone matrix
pnpm test:e2e                           # Playwright against the Docker Compose stack
```

**Coverage thresholds (verified in config):**
- Web (`apps/web/vite.config.ts`): statements 82, branches 78, functions 74, lines 84.
- Service (`apps/service/vitest.coverage.config.ts`): thresholds are set in that file; read it for current numbers. Coverage covers `src/**/*.ts` minus tests, `src/main.ts`, `src/db/types.ts`, `src/test/**`, and a few build-time or type-only files.

## Test File Organization

**Location:**
- Co-located with the module under test, in the same `src/` directory. Verified examples: `packages/recurrence/src/occurrence.test.ts` next to `occurrence.ts`, `packages/matching/src/matcher.test.ts`, `apps/service/src/deals/money.test.ts`, `apps/web/src/lib/money.test.ts`, `apps/service/src/services/bills.test.ts`.
- Integration tests are co-located too, as `<name>.integration.test.ts` (20 files). Examples: `apps/service/src/realtime.integration.test.ts`, `apps/service/src/bills.integration.test.ts`, `apps/service/src/recipes.integration.test.ts`.
- Shared test helpers sit in `test/` folders, not beside production code:
  - `apps/service/src/test/`: `fake-app.ts`, `integration-db.ts`, `service-stack.ts`, `stack-hooks.ts`, `world.ts`, `zone-dates.ts` (plus `zone-dates.test.ts`), `push-double.ts`, `fixture-deal-source.ts`, `job-logger.ts`.
  - `apps/web/src/test/`: `harness.tsx`, `fixtures.ts`, `bills-fixtures.ts`, `chore-fixtures.ts`, `deal-fixtures.ts`, `list-fixtures.ts`, `meal-fixtures.ts`, `browser.ts`, `push-double.ts`.
  - `apps/web/src/test-setup.ts`: the web setup file, listed as a Vitest `setupFiles` entry.
  - `e2e/support/`: `api.ts`, `app.ts`, `axe.ts`, `bills.ts`, `clock.ts`, `compose.ts`, `db.ts`, `env.ts`, `logs.ts`, `push.ts`, `raw-http.ts`, `run-identity.ts`.
  - `test/` at the repo root: `clock-setup.mjs`, `global-tz.mjs`, `test-now.mjs`, and the harness tests.
- E2E specs are in `e2e/tests/`, numbered `NN-<journey>.spec.ts` (19 specs, from `01-signup-and-first-household.spec.ts` to `20-remove-member.spec.ts`; there is no `04` spec).

**Naming:**
- Unit and component tests: `<name>.test.ts` or `<name>.test.tsx`.
- Integration tests: `<name>.integration.test.ts`.
- E2E: `NN-<journey>.spec.ts`.
- Harness tests: `<name>.test.mjs` under `test/` and `scripts/`.

**Structure:**

```
packages/<pkg>/src/<module>.ts
packages/<pkg>/src/<module>.test.ts                       # unit, pure logic
apps/service/src/<area>/<module>.ts
apps/service/src/<area>/<module>.test.ts                  # unit, in-memory app or pure logic
apps/service/src/<area>/<feature>.integration.test.ts     # against supabase start
apps/web/src/<area>/<component>.tsx
apps/web/src/<area>/<component>.test.tsx                  # jsdom, Testing Library
```

## Test Structure

**Suite organization:** `describe` blocks named after the function under test, with `it` clauses that read as behavior. Abridged from `apps/service/src/services/bills.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { ProblemError } from '../problem.js';
import { billOccurrence, billScope, planBillMove } from './bills.js';

/*
 * Pure logic only; everything that touches Postgres (RLS, the payment log, the job) is covered by
 * bills.integration.test.ts and log-autopay.integration.test.ts instead.
 */

describe('billOccurrence', () => {
  const monthly = { recurrence_unit: 'month' as const, interval: 1, anchor_date: '2026-01-01' };

  it('is the anchor itself when nothing has been paid or skipped yet', () => {
    const state = billOccurrence({ ...monthly, today: '2026-01-01' }, new Set());
    expect(state).toEqual({ date: '2026-01-01', overdue: false });
  });

  describe('a one-time bill (null recurrence_unit)', () => {
    // a nested describe groups a distinct input shape
  });
});
```

**Table-driven cases:** `it.each` appears on about 83 lines across the unit suites. Use it when one rule is checked against many inputs. `packages/recurrence/src/occurrence.test.ts` and `apps/service/src/deals/money.test.ts` are reference examples. Matching cases are tables too (`packages/matching/src/normalize.test.ts` pairs a real product string with the ingredient it should match).

**Setup and teardown:**
- Pure unit tests need none.
- Component tests: `cleanup()` runs in `afterEach` from `apps/web/src/test-setup.ts`. Do not add a second cleanup.
- Integration tests: `registerStackHooks` from `apps/service/src/test/stack-hooks.ts` wires the shared `beforeAll`/`afterAll` for the stack.
- Fake timers and spies are installed in the test body or `beforeEach`, and restored in `afterEach`.

**Focused and skipped tests:** No `.skip`, `.only`, `it.todo`, or `test.todo` appear in any test file (verified by search). Do not commit one.

**Snapshots:** None. `toMatchSnapshot` and `toMatchInlineSnapshot` do not appear in test files (verified). Assertions are explicit.

## Mocking

**Framework:** Vitest's `vi` (`vi.fn`, `vi.mock`, `vi.mocked`, `vi.hoisted`, `vi.useFakeTimers`, `vi.setSystemTime`).

**Where `vi.mock` is used:** Module-level mocks appear in 5 files, all in `apps/web`. The main case is `apps/web/src/sw.test.ts`, which mocks each `workbox-*` package it imports:

```typescript
vi.mock('workbox-precaching', () => ({ /* stub the exports the service worker imports */ }));
```

The web setup file mocks the PWA virtual module for every component test (`apps/web/src/test-setup.ts`):

```typescript
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    offlineReady: [false, () => undefined],
    updateServiceWorker: () => Promise.resolve(),
  }),
}));
```

**Preferred seam: typed stubs through interfaces, not module mocks.** The codebase injects dependencies through interfaces, so tests substitute typed stubs:
- `createAuthStub`, `createFetchStub`, `stubFetch`, `createRealtimeStub` in `apps/web/src/test/harness.tsx`. The auth stub implements `AuthClient`; the fetch stub maps URL keys to `StubHandler` functions.
- `createPushDouble` in `apps/web/src/test/push-double.ts` for the web `PushPort`.
- `RecordingPushTransport` (re-exported by `apps/service/src/test/push-double.ts` from `apps/service/src/push/recording-transport.ts`) for service push delivery.
- `fixtureDealSource` in `apps/service/src/test/fixture-deal-source.ts` for the deal source.
- `emptyDb()` in `apps/service/src/test/fake-app.ts`: a Kysely instance on `DummyDriver` that answers every query with no rows. No test reaches a real database through it.

**Web stub example (from `apps/web/src/test/harness.tsx`, abridged):**

```typescript
export function createAuthStub(
  initial: AuthState = { status: 'signed-in', userId: ALEX_ID },
): AuthStub {
  let state = initial;
  const listeners = new Set<(next: AuthState) => void>();
  // ... getState, subscribe, and vi.fn() spies for signIn, signUp, getAccessToken
}
```

**What to mock:**
- Network: any `fetch` to the service, Supabase, Flipp, or a recipe host. Use `stubFetch` (web) or the in-memory app with `inject()` (service).
- Browser APIs that jsdom lacks. `apps/web/src/test-setup.ts` stubs `ResizeObserver`, `window.scrollTo`, `Element.prototype.scrollIntoView`, and the pointer-capture methods.
- Build-time virtual modules (`virtual:pwa-register/react`).
- Push delivery and the realtime channel.

**What NOT to mock:**
- Pure logic in `packages/recurrence`, `packages/matching`, `packages/shared`, and the service's pure functions (`billOccurrence`, `planBillMove`). Test them directly.
- Postgres behavior in the service. RLS, triggers, and SQL belong in integration tests against `supabase start` (`apps/service/src/test/integration-db.ts`). A mocked database here would hide the isolation boundary the product relies on.
- The clock. Use the pinned clock (see Dates and Time Zones) instead of mocking `Date`.

## Fixtures and Factories

**Web fixtures:** typed constant objects shaped like the shared API types, built from the seed-data identities.
- `apps/web/src/test/fixtures.ts` exports `ALEX_ID`, `SAM_ID`, `JORDAN_ID`, `OAK_STREET_ID`, `RIVERA_FAMILY_ID`, and typed objects such as `profileFixture: ProfileResponse`. The IDs are fixed UUIDs, so tests read like the real app.
- Feature fixtures sit beside it: `bills-fixtures.ts`, `chore-fixtures.ts`, `deal-fixtures.ts`, `list-fixtures.ts`, `meal-fixtures.ts`.
- Problem bodies: `problemBody(status, title, detail?)` in `apps/web/src/test/harness.tsx`.

**Service fixtures (integration):**
- `apps/service/src/test/world.ts` builds two households with a row in every household-scoped table. It is the fixture the isolation suite attacks. Households are created through `create_household`, the same path the service uses; other rows are inserted directly.
- `apps/service/src/test/service-stack.ts` exports helpers used by integration tests: `adminPool`, `as`, `household`, `signUp`, `uniqueName`, `uniquePostalCode`, and the `HouseholdFixture` and `SignedUpUser` types.
- `apps/service/src/test/stack-hooks.ts` exports `app`, `expectStatus`, and `registerStackHooks`.

**Dates in fixtures:** Build calendar dates in the household's zone, not the machine's. Use `householdDate(zone, offsetDays)`, `dateInZone`, `addDays`, and `daysBetween` from `apps/service/src/test/zone-dates.ts`.

**Location:** Fixtures live in the `test/` folder of each app. Production modules do not import them.

## Dates and Time Zones

Unit and component tests run with `Date` pinned, so results do not depend on the day they run or the machine's zone.

- **Pinned instant:** `test/clock-setup.mjs` pins `Date` to `HEARTH_TEST_NOW`, or to `2026-10-14T12:00:00.000Z` (a Wednesday) when unset. The value must be an ISO-8601 instant with `Z` or an offset. The file is a `setupFiles` entry in every unit config, and it skips `*.integration.test.*` files.
- **Overrides:** Set a different instant with `vi.setSystemTime` or `vi.useFakeTimers` in a test body or `beforeEach`. The override ends with that test. At module scope or in `beforeAll`, the override lasts for the whole scope until `afterAll` calls `vi.useRealTimers()`. After `vi.useRealTimers()` the pin is back.
- **Real timers keep running.** The pin freezes `Date.now()` and `new Date()`, but `performance.now()` is the real clock. Use `performance.now()` to measure elapsed time, or fake timers in the test body.
- **Time zone validation:** `test/global-tz.mjs` is a Vitest `globalSetup` in every unit and integration config. When `TZ` is set, it checks that the zone is real and that Node honors it, and fails the run before any test starts. It also validates `HEARTH_TEST_NOW`. When `TZ` is unset it changes nothing.
- **Never set `TZ` in the shell or in a config.** Set it only through the sweep (`scripts/test-sweep.mjs`) or an `env` object passed to a spawned process.
- **Integration tests** run on the real clock, because Postgres `now()` cannot be pinned. They read time through `currentInstant()` from `apps/service/src/test/zone-dates.ts`, the one real-clock read in that file.
- **Text rendered in the viewer's zone:** a component test that asserts a formatted stamp pins that file's zone in a `vi.hoisted` block, restores it in `afterAll`, and keeps a literal expected string. Reference: `apps/web/src/screens/deals/favorites.test.tsx`, which uses `America/New_York`.

**Sweep matrix (verified with `node scripts/test-sweep.mjs --list`):**

| Unit cell | Pinned instant (UTC) | `TZ` |
| --- | --- | --- |
| `default` | default pin | unset |
| `wed-tokyo` | 2026-10-14T12:00:00Z | `Asia/Tokyo` |
| `sat-utc-fri-la` | 2026-10-17T02:30:00Z | `America/Los_Angeles` |
| `sun-utc-mon-kiritimati` | 2026-10-18T22:30:00Z | `Pacific/Kiritimati` |
| `newyear-pago-pago` | 2027-01-01T00:30:00Z | `Pacific/Pago_Pago` |
| `dst-start-new-york` | 2026-03-08T07:30:00Z | `America/New_York` |

| Integration cell | `TZ` |
| --- | --- |
| `default` | unset |
| `la` | `America/Los_Angeles` |
| `kiritimati` | `Pacific/Kiritimati` |
| `pago-pago` | `Pacific/Pago_Pago` |
| `tokyo` | `Asia/Tokyo` |

**The clock lint rule.** ESLint `no-restricted-syntax` (in `eslint.config.js`) fails on real-clock reads in test files (`*.test.*`, `*.spec.*`), `e2e/**`, `apps/service/src/test/**`, `apps/web/src/test/**`, `apps/web/src/test-setup.ts`, and `test/**/*.mjs`. Banned forms include `new Date()`, `new Date(undefined)`, `Date()`, `Date.now` in any spelling, and an `Intl.DateTimeFormat` formatter called without an instant. `performance.now()` is allowed.
- Web and package tests pass an explicit instant to the `Date` constructor. The lint message names `currentInstant()`, but no such helper exists in `apps/web` or `packages/*`.
- Service tests use `currentInstant()` from `apps/service/src/test/zone-dates.ts`. E2E uses `currentInstant()` from `e2e/support/clock.ts`.
- The real-clock reads that carry a next-line suppression with a reason are `apps/service/src/test/zone-dates.ts:15`, `e2e/support/clock.ts:12`, and two in `apps/service/src/deals/flipp/request-queue.test.ts` (lines 27 and 174, reading a fake-timer clock).

## Integration Tests

**Location:** `apps/service/src/**/*.integration.test.ts` (20 files). Example: `apps/service/src/bills.integration.test.ts`.

**Database:**
- Runs against `supabase start` with the migrations in `supabase/migrations/`. The connection string comes from `TEST_DATABASE_URL` in `apps/service/src/test/integration-db.ts`.
- Each test runs inside a transaction that is rolled back. `withTestDb(fn)` opens it, and `rollback to savepoint` undoes statement-level work (`apps/service/src/test/integration-db.ts`).
- Files run one at a time (`fileParallelism: false` in `apps/service/vitest.integration.config.ts` and `vitest.coverage.config.ts`), because fixtures share natural keys such as a postal code's refresh row.
- Tests call the service through `app.inject()` (via `apps/service/src/test/stack-hooks.ts`), so RLS decides every isolation assertion.

**Timeouts:** `testTimeout: 20_000` and `hookTimeout: 30_000` in `apps/service/vitest.integration.config.ts`.

## E2E Tests

**Framework:** Playwright, `e2e/playwright.config.ts`.
- `testDir: './tests'`, `workers: 1`.
- Browser context: `timezoneId: 'America/New_York'`, `locale: 'en-US'`.
- `globalSetup` and `globalTeardown` (`e2e/global-setup.ts`, `e2e/global-teardown.ts`) build and start the Docker Compose stack (`e2e/docker-compose.e2e.yml`) from an empty database, then drop it.
- Expected dates are computed at run time in the household's zone (`e2e/support/clock.ts`), never assuming a weekday.

**Run:** `pnpm test:e2e` locally and in CI. CI runs E2E on pull requests and on `main` only. On failure, CI uploads `e2e/playwright-report/` as an artifact.

## Component Tests

**Setup pattern (`apps/web/src/test/harness.tsx`):**
- `renderScreen(...)` renders a screen inside a memory router (`createMemoryRouter`). `renderApp(...)` renders the whole app.
- `testQueryClient()` builds a `QueryClient` with `retry: false` for queries and mutations.
- `WithQueue` supplies the offline write queue.

**Interaction pattern:** `userEvent.setup()` then `await user.click(...)`, querying by role or label:

```typescript
const user = userEvent.setup();
await user.click(screen.getByRole('button', { name: /add/i }));
expect(await screen.findByRole('status')).toHaveTextContent(/saved/i);
```

The query and role names in that snippet are illustrative. Match the real labels in the component under test.

**Accessibility:** E2E checks axe (`e2e/support/axe.ts`, journey `17-accessibility-states.spec.ts`). `eslint-plugin-jsx-a11y` (strict) runs on web source.

## Common Patterns

**Async waiting:** `findBy*` and `waitFor` from Testing Library. A `waitFor` loop works under the pin, because real timers keep running.

**Error testing (service unit):**

```typescript
expect(() => planBillMove(/* invalid move */)).toThrow(ProblemError);
```

Assert the `ProblemError` type, and where useful its status, rather than the message text.

**Error testing (route, integration):** `expectStatus(response, 403)` from `apps/service/src/test/stack-hooks.ts` checks the problem status.

**Table cases:**

```typescript
it.each([
  ['chicken breast', 'chicken broth', false],
])('matches %s against %s as %s', (a, b, expected) => { /* ... */ });
```

This shape is illustrative. The real matching table is in `packages/matching/src/normalize.test.ts`.

## Test Types

**Unit tests (Vitest):** pure logic in `packages/*/src`, `apps/service/src` modules that do not touch the database, and `apps/web/src/lib`. The service unit suite also builds the real Fastify app in memory with `fake-app.ts` (for example `apps/service/src/app.test.ts` and `apps/service/src/cli.test.ts`). Nothing touches a socket or a real database.

**Component tests (Vitest + jsdom):** `apps/web/src/**/*.test.tsx`, 39 files. They render real components and screens through the harness.

**Integration tests (Vitest + Postgres):** 20 `*.integration.test.ts` files against `supabase start`. They cover SQL, RLS, transactions, and the route layer.

**E2E tests (Playwright):** 19 journey specs in `e2e/tests/` against the full Compose stack, run in a real Chromium browser.

**Harness tests (`node --test`):** thirteen files, run by `pnpm test:harness` (listed in the root `package.json`) before any workspace suite:
- `test/clock-setup.test.mjs`: the clock pin, checked from inside real Vitest workers.
- `test/global-tz.test.mjs`: the zone hook, one child process per case.
- `scripts/test-sweep.test.mjs`: sweep argument handling and one real single-cell run.
- `test/eslint-clock-ban.test.mjs`: the clock lint rule, against snippets with the repo's ESLint config.
- `test/eslint-service-role-fence.test.mjs`: the `privileged/` import fence, against probe snippets.
- `scripts/deploy.test.mjs`: the deploy script, against stub `docker`, `supabase`, and `curl` binaries.
- `scripts/ci-prepull-images.test.mjs`: the CI image pre-pull script, against stub binaries.
- `scripts/check-knip-baseline.test.mjs`: the knip baseline check, against stub knip reports.
- `scripts/check-repo-hygiene.test.mjs`: the repository hygiene check, against temporary git repositories.
- `scripts/check-migrations-append-only.test.mjs`: the migration append-only check, against temporary git repositories.
- `scripts/audit-prod.test.mjs`: the production audit check and its allowlist rules, against stub pnpm reports.
- `scripts/jscpd-config.test.mjs`: the `.jscpd.json` settings and the `jscpd` script.
- `scripts/deploy-gate.test.mjs`: the deploy gate, against temporary git repositories and a stub `docker`.

**Other:** `apps/service/src/kong-routes.test.ts` is a Vitest unit test that reads `docker/kong.yml` and pins the GoTrue allowlist routes.

## CI

Seven jobs are in `.github/workflows/ci.yml`, each with a timeout, on every pull request and push to `main`. Every job runs the composite action `.github/actions/setup`, which installs pnpm (`pnpm/action-setup@v6`), then Node from `.nvmrc` with the pnpm cache (`actions/setup-node@v7`), then runs `pnpm install --frozen-lockfile`.

| Job | Runs | Notes |
| --- | --- | --- |
| `lint` | `pnpm lint`, `pnpm format:check` | `--max-warnings=0` |
| `typecheck` | `pnpm typecheck` | |
| `test-unit` | `pnpm test:harness`, `pnpm -r --filter '!@hearth/web' test`, `pnpm --filter @hearth/web test:coverage` | Harness tests, the non-web workspaces' tests, then web with its coverage thresholds |
| `test-integration` | `supabase start`, then `pnpm db:types` (drift check), then `pnpm --filter @hearth/service test:coverage` | Supabase CLI 2.117.0 via `supabase/setup-cli@v3`; coverage gate; fails when `apps/service/src/db/types.ts` differs from the regenerated file |
| `test-e2e` | `pnpm test:e2e` | Pull requests and `main` only; pre-pulls images with `scripts/ci-prepull-images.sh` |
| `build` | `pnpm build` | |
| `hygiene` | `pnpm knip`, `node scripts/check-knip-baseline.mjs`, `pnpm jscpd`, `node scripts/audit-prod.mjs`, `node scripts/check-repo-hygiene.mjs`, `node scripts/check-migrations-append-only.mjs` | Each is its own step and every step runs after a failure; the audit depends on the date |

The `Sweep` workflow (`.github/workflows/sweep.yml`) is separate from `CI`: it runs `pnpm test:sweep` on pushes to `main` that change more than `docs/` and `.planning/`, and adds the today cell nightly at 05:17 UTC and on demand. It gates nothing and triggers no deploy.

## Coverage

**Requirements:**
- Web: enforced thresholds (statements 84, branches 80, functions 77, lines 85, set in `apps/web/vite.config.ts`), checked by `pnpm --filter @hearth/web test:coverage`, which CI's `test-unit` job runs.
- Service: enforced by `apps/service/vitest.coverage.config.ts`, measured over unit and integration tests together, because many service functions are exercised only through integration tests. CI's `test-integration` job runs it.

**View coverage:**

```bash
pnpm --filter @hearth/service test:coverage   # text report plus HTML and JSON summary
pnpm --filter @hearth/web test:coverage
```

## Adding a Test: Checklist

1. Put `<name>.test.ts(x)` next to the module. Use `<name>.integration.test.ts` only if the test needs Postgres.
2. Import `describe`, `expect`, `it`, and `vi` from `vitest`.
3. Use `it.each` for many inputs against one rule.
4. Pass an explicit instant to `Date`, or use `currentInstant()` (service) or `householdDate()`. Do not write `new Date()` or `Date.now()`; the lint rule rejects them.
5. Stub at the interface (`createAuthStub`, `stubFetch`, `createPushDouble`) rather than with `vi.mock`.
6. Put shared fixtures in the app's `test/` folder, not in production code.
7. Do not commit `.only`, `.skip`, or `it.todo`.

---

*Testing analysis: 2026-10-22*
