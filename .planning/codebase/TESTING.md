---
last_mapped_commit: 431e646ab110c804b7229cecc9e151d343790b3a
last_mapped_at: 2026-10-21
---
# Testing Patterns

**Analysis Date:** 2026-10-21

## Test Framework

**Runner:**
- Vitest 5.0.1 in every workspace that has unit tests: `apps/service`, `apps/web`, `packages/recurrence`, `packages/matching`, `packages/shared`.
- Configs: `apps/service/vitest.config.ts` (unit), `apps/service/vitest.integration.config.ts` (integration), `apps/service/vitest.coverage.config.ts` (coverage), `apps/web/vite.config.ts` (the `test` block, jsdom), and each package's `vitest.config.ts`.
- Node's built-in runner (`node --test`) is used for nine harness and E2E-support files, with no extra dependencies. See the list below.
- Assertion library: Vitest's built-in `expect`. Component tests add `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/jest-dom` 7.0.1 and `@testing-library/user-event` 14.6.7.
- DOM environment for web tests: jsdom 30.1.0 (`apps/web/vite.config.ts`, `environment: 'jsdom'`).
- End-to-end: `@playwright/test` 1.63.0 with `@axe-core/playwright` 4.13.0 (`e2e/playwright.config.ts`).

**Run commands:**

```bash
pnpm test                                # Harness tests, then every workspace's unit + component tests
pnpm test:harness                        # Only the node --test harness files (package.json)
pnpm --filter @hearth/service test       # Service unit tests (excludes *.integration.test.ts)
pnpm --filter @hearth/web test           # Web unit and component tests
pnpm --filter @hearth/recurrence test    # One package
pnpm --filter @hearth/service test:coverage   # Service coverage, enforced in CI
pnpm --filter @hearth/web test:coverage       # Web coverage, enforced thresholds
pnpm test:integration                    # Every workspace's test:integration (needs supabase start)
pnpm test:sweep                          # Unit suite across the fixed date and TZ matrix
pnpm test:sweep:integration              # Service integration suite across zones
pnpm test:e2e                            # Playwright against the Docker Compose stack (~9 min)
```

Watch mode: run `vitest` directly inside a workspace (`pnpm --filter @hearth/web exec vitest`). No script alias is defined.

**Node built-in test files** (`node --test`):
- `e2e/support/run-identity.test.ts`, `e2e/support/clock.test.ts`
- `test/clock-setup.test.mjs`, `test/global-tz.test.mjs`, `test/eslint-clock-ban.test.mjs`, `test/eslint-service-role-fence.test.mjs`
- `scripts/test-sweep.test.mjs`, `scripts/deploy.test.mjs`, `scripts/ci-prepull-images.test.mjs`

## Test File Organization

**Location:**
- Co-located with the module under test, in the same `src/` directory. Examples: `packages/recurrence/src/bills.test.ts` next to `bills.ts`, `apps/service/src/services/bills.test.ts` next to `services/bills.ts`, `apps/web/src/components/ui/Toast.test.tsx` next to `Toast.tsx`.
- Integration tests sit beside the code they exercise in `apps/service/src/`, with the suffix `.integration.test.ts`. Examples: `apps/service/src/bills.integration.test.ts`, `apps/service/src/db/rls-isolation.integration.test.ts`, `apps/service/src/db/membership.integration.test.ts`. Twenty such files exist in `apps/service`.
- Shared test helpers live in `test/` directories inside each app:
  - `apps/service/src/test/`: `fake-app.ts`, `integration-db.ts`, `service-stack.ts`, `world.ts`, `fixture-deal-source.ts`, `push-double.ts`, `zone-dates.ts`
  - `apps/web/src/test/`: `harness.tsx`, `fixtures.ts`, `bills-fixtures.ts`, `chore-fixtures.ts`, `deal-fixtures.ts`, `list-fixtures.ts`, `meal-fixtures.ts`, `push-double.ts`
  - `apps/web/src/test-setup.ts` is the jsdom setup file.
- Top-level harness: `test/clock-setup.mjs`, `test/global-tz.mjs` (setup and global setup loaded by every unit config).

**Naming:**
- `<module>.test.ts(x)` for unit and component tests.
- `<module>.integration.test.ts` for real-Postgres tests.
- Harness tests are `<name>.test.mjs` under `test/` and `scripts/`.

**Structure:**

```
apps/service/src/
├── services/bills.ts
├── services/bills.test.ts              # pure logic, unit
├── bills.integration.test.ts           # real Postgres via supabase start
├── app.test.ts                         # buildApp + inject(), no DB
└── test/fake-app.ts                    # shared unit-test app factory
apps/web/src/
├── components/ui/Toast.tsx
├── components/ui/Toast.test.tsx        # component test, jsdom
└── test/harness.tsx                    # renderScreen, createFetchStub, problemBody
```

## Test Structure

**Suite organization:**

```ts
import { describe, expect, it } from 'vitest';
import { ProblemError } from '../problem.js';
import { billOccurrence, billScope, planBillMove } from './bills.js';

/*
 * Pure logic only (Engineering Practices, "Testing" ...); everything that touches Postgres
 * is covered by bills.integration.test.ts instead.
 */

describe('billOccurrence', () => {
  const monthly = { recurrence_unit: 'month' as const, interval: 1, anchor_date: '2026-01-01' };

  it('is the anchor itself when nothing has been paid or skipped yet', () => {
    const state = billOccurrence({ ...monthly, today: '2026-01-01' }, new Set());
    expect(state).toEqual({ date: '2026-01-01', overdue: false });
  });
});
```

Source: `apps/service/src/services/bills.test.ts`.

**Patterns:**
- Group assertions under `describe` blocks named after the function under test (`describe('billOccurrence', ...)`).
- Name `it` blocks as behavior sentences ("is overdue once its date is before today and still unresolved").
- Use `it.each` for tables of inputs against the same rule. 39 test files use `it.each` or `test.each`. The recurrence, price-parsing and matching suites are the most exhaustive.
- A module-level comment names the spec sections the suite covers (`apps/service/src/services/bills.test.ts`).

**Setup and teardown:**
- Unit tests usually need none; the clock is pinned globally.
- Apps that build a Fastify instance track it and close it in `afterEach`:

```ts
const apps: FastifyInstance[] = [];

async function makeApp(pingDatabase: () => Promise<void>): Promise<FastifyInstance> {
  const app = await makeTestApp({ pingDatabase });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
```

Source: `apps/service/src/app.test.ts`.

- Web tests set and restore global state in `beforeEach` / `afterEach`, for example `configure({ asyncUtilTimeout: 5000 })` at module scope and `onlineManager` toggles (`apps/web/src/screens/chores/household-timezone.test.tsx`).
- Time-zone-dependent web tests pin the zone in a `vi.hoisted` block and restore it in `afterAll`, as `apps/web/src/screens/deals/favorites.test.tsx` does with `America/New_York`.

**Assertion style:**
- `expect(x).toEqual({...})` for objects, `toBe` for primitives and status codes.
- `expect(response.statusCode).toBe(200)` then `expect(response.json()).toEqual(...)` for HTTP tests.
- Throw assertions use `ProblemError` for domain errors (`apps/service/src/services/bills.test.ts`).
- Testing Library queries in component tests: `screen`, `within`, role-based queries, and `user-event` for interaction.

## Dates and Time

This repo treats the clock and the time zone as controlled inputs. Read `docs/testing.md` ("Dates and time zones") before writing time-dependent tests.

- **Unit and component tests**: `Date` is pinned by `test/clock-setup.mjs` to `HEARTH_TEST_NOW`, default `2026-10-14T12:00:00.000Z`. The pin is re-applied before each test and restored after it. `vi.useRealTimers()` does not unpin `Date`.
- **Overrides**: `vi.setSystemTime` or `vi.useFakeTimers` in a test body or `beforeEach` (ends with that test); at module scope or in `beforeAll` (lasts for the suite, removed in `afterAll` with `vi.useRealTimers()`).
- **Elapsed time**: use `performance.now()` or fake timers. `performance.now()` is allowed by the lint rules.
- **Zone**: never set `TZ` by hand. `test/global-tz.mjs` validates `TZ` as an IANA zone and fails the run on bad values. Unset `TZ` does nothing. `e2e/playwright.config.ts` pins `America/New_York` and `en-US`.
- **Forbidden in tests and test helpers**: bare `new Date()`, `Date.now()`, `Intl.DateTimeFormat(...).format()` without an instant. The ESLint `no-restricted-syntax` selectors enforce this. Pass an explicit instant, or call `currentInstant()` from `apps/service/src/test/zone-dates.ts`.
- **Integration tests** run on the real clock because Postgres `now()` cannot be pinned. They take dates from `apps/service/src/test/zone-dates.ts`: `currentInstant`, `dateInZone`, `householdDate`, `addDays`, `daysBetween`.
- **Sweep**: `scripts/test-sweep.mjs` runs the unit suite once per cell of a fixed `HEARTH_TEST_NOW` × `TZ` matrix, each cell in its own process. `pnpm test:sweep:integration` runs the service integration suite per zone. An `--only` filter that selects no file exits 2 before running.

## Mocking

**Framework:** Vitest's `vi` (`vi.mock`, `vi.fn`, `vi.hoisted`, `vi.setSystemTime`, `vi.useFakeTimers`).

**Usage is sparing.** Only four test files call `vi.mock(`. The codebase prefers injected dependencies and hand-written doubles:

```ts
// apps/service/src/jobs/scheduler-stop.test.ts
vi.mock('./advisory-lock.js', () => ({
  // ...
}));
```

Source: `apps/service/src/jobs/scheduler-stop.test.ts`.

**Preferred: typed doubles and injected ports.**
- Service: `apps/service/src/test/fake-app.ts` builds the real Fastify app with fake dependencies. The database is a Kysely `DummyDriver`, with no Postgres and no GoTrue. Requests run through Fastify's `inject()`. Helpers include `signToken`, `userClaims`, `bearer`, `makeTestApp`, `TEST_JWT_SECRET`, `TEST_ORIGIN`.
- Service: `apps/service/src/test/push-double.ts`, `apps/service/src/test/fixture-deal-source.ts` replace Web Push and Flipp.
- Web: `apps/web/src/test/harness.tsx` provides a typed `AuthStub` (implements `AuthClient`), `createFetchStub` (replaces `fetch`), `problemBody`, and `renderScreen` (builds the real route table in a memory router with providers). Its header comment: "There is no network in a component test, and no supabase-js either."
- Web: `apps/web/src/test/push-double.ts` replaces `PushPort`.

**Fetch stub pattern (web):** handlers are keyed by request, return `{ status, body }`, and are composed per test (`stubWith({...})` in `apps/web/src/screens/chores/household-timezone.test.tsx`).

**What to mock:**
- Network (`fetch`), the Supabase auth client, realtime, and push, via the existing ports and doubles.
- External protocols at their boundary: Flipp and recipe fetches use fixtures or doubles.
- Time, via the pin (never via ad hoc mocks of `Date`).

**What NOT to mock:**
- Pure domain logic (recurrence, matching, money, validation). Test it directly.
- The Fastify app and its routing inside unit tests: use `makeTestApp` and `inject()`.
- Database behavior. RLS, SQL, transactions and triggers are tested against real Postgres in `*.integration.test.ts` files. A fake database cannot prove a policy.

## Fixtures and Factories

**Web fixtures:** typed constants and builders under `apps/web/src/test/`.
- `apps/web/src/test/fixtures.ts`: `ALEX_ID`, `OAK_STREET_ID`, `oakStreetFixture`, `oakStreetMembers`, `profileFixture`.
- Per-domain: `bills-fixtures.ts`, `chore-fixtures.ts` (`takeOutTrashFixture`, `choreListFixture`, `returnPackageFixture`), `deal-fixtures.ts`, `list-fixtures.ts`, `meal-fixtures.ts`.
- Test-local overrides spread the fixture: `const abroadProfile = { ...profileFixture, timezone: BROWSER_ZONE };` (`apps/web/src/screens/chores/household-timezone.test.tsx`).

**Service fixtures:** `apps/service/src/test/world.ts` and `apps/service/src/test/service-stack.ts` build worlds of households and users for integration tests against `supabase start`. `apps/service/src/test/integration-db.ts` is the connection helper.

**Seed data:** `supabase/seed/` (`@hearth/seed`) holds seed users and SQL, run by `pnpm db:seed` (requires `psql`).

**Location:**
- Web: `apps/web/src/test/`.
- Service: `apps/service/src/test/`.
- Recurrence and matching: no fixture folder; tables are inline in the test file.

## Coverage

**Requirements (enforced):**
- Service: `apps/service/vitest.coverage.config.ts` enforces thresholds (statements 95, with branch, function and line floors in the same block). Measured at 96.65% statements, 85.78% branches, 98.07% functions, 98.56% lines when set, per the file's comment.
- Web: `apps/web/vite.config.ts` enforces `statements: 82, branches: 78, functions: 74, lines: 84`, enforced by `pnpm --filter @hearth/web test:coverage`.
- Coverage provider: `@vitest/coverage-v8` 5.0.1 (`provider: 'v8'`).
- Exclusions: `src/main.ts`, `src/db/types.ts` (generated), `src/test/**`, and `*.test.*` files.

**CI runs:**
- `pnpm --filter @hearth/service test:coverage` in the integration job (after `supabase start`), per `.github/workflows/ci.yml`.
- The web unit job runs `pnpm test`, which does not enforce web coverage thresholds; run `pnpm --filter @hearth/web test:coverage` locally to check them.

**View coverage:**

```bash
pnpm --filter @hearth/service test:coverage   # text table plus coverage/index.html
pnpm --filter @hearth/web test:coverage
```

Reports: `text`, `html`, `json-summary`.

## Test Types

**Unit tests (`*.test.ts`):**
- Pure functions in `packages/recurrence`, `packages/matching`, `packages/shared`, and the service's `money.ts`, `occurrence.ts` and similar.
- Route and app tests using `makeTestApp` and `inject()`. No socket, no database (`apps/service/src/app.test.ts`, `apps/service/src/cli.test.ts`).
- Schema and token tests (`apps/web/src/tokens.test.ts`, `apps/web/src/sw.test.ts`).

**Component tests (`*.test.tsx`, jsdom):**
- Render real screens through `renderScreen` from `apps/web/src/test/harness.tsx`, with a stubbed fetch and auth. Examples: `apps/web/src/components/ui/primitives.test.tsx`, `apps/web/src/components/shell/shell.test.tsx`, `apps/web/src/screens/chores/household-timezone.test.tsx`.
- Accessibility is covered by role queries and by `axe` in E2E.

**Integration tests (`*.integration.test.ts`):**
- Real Postgres from `supabase start`, run on the real clock.
- RLS isolation and policies: `apps/service/src/db/rls-isolation.integration.test.ts`, `apps/service/src/db/policies.integration.test.ts`.
- Membership lifecycle: `apps/service/src/db/membership.integration.test.ts`.
- Route layer end to end against the database: `apps/service/src/api.integration.test.ts`.
- Jobs and notifications: `apps/service/src/jobs.integration.test.ts`, `apps/service/src/dispatch-notifications.integration.test.ts`, `apps/service/src/log-autopay.integration.test.ts`.
- Config: `apps/service/vitest.integration.config.ts` loads only `test/global-tz.mjs` (no clock pin).

**E2E tests (Playwright):**
- Directory: `e2e/`. Config: `e2e/playwright.config.ts`. Compose overlay: `e2e/docker-compose.e2e.yml`.
- Runs a real Chromium against the full Docker stack with fixture Flipp and recipe transports (`HEARTH_FLIPP_FIXTURE_DIR`, `HEARTH_RECIPE_FIXTURE_DIR`) and the push test double (`HEARTH_PUSH_TRANSPORT=test-double`).
- Browser pinned to `America/New_York` and `en-US`.
- Support helpers in `e2e/support/` (`clock.ts`, `run-identity.ts`).
- Suite size per the local workaround notes: 104 tests expected to pass.

**Harness tests (`node --test`):**
- Validate the test infrastructure itself: clock pin, `TZ` hook, sweep script, the ESLint clock and service-role rules, the deploy script, and CI image pre-pull.

## Common Patterns

**Async testing:**

```ts
it('resolves to the saved bill', async () => {
  const bill = await createHouseholdBill(db, householdId, userId, body);
  expect(bill.name).toBe(body.name);
});
```

Component tests await Testing Library queries (`await screen.findByRole(...)`) and use `configure({ asyncUtilTimeout: 5000 })` where screens load lazily.

**Error testing:**

```ts
expect(() => planBillMove(current, move)).toThrow(ProblemError);
```

HTTP error tests assert both the status and the problem body:

```ts
const response = await app.inject({ method: 'GET', url: '/api/health' });
expect(response.statusCode).toBe(503);
expect(response.json()).toMatchObject({ status: 503 });
```

**Table-driven tests:**

```ts
it.each([
  ['chicken breast', 'chicken broth', false],
  // ...
])('matches %s against %s as %s', (a, b, expected) => { /* ... */ });
```

Favor `it.each` when many inputs share one rule. Name cases that encode known false positives or real Flipp string formats.

**Regression tests:** every bug fix ships with one. Put it in the file that owns the behavior, and name the `it` after the failure mode.

## Test Data Rules

- Use fixed dates in the pinned clock's range. Relative dates come from `addDays` or `currentInstant` (integration), never from `new Date()`.
- Use the household's zone for calendar dates in integration tests (`dateInZone`, `householdDate`); do not compute days on the UTC or machine calendar.
- Keep fixture IDs as named constants (`ALEX_ID`, `OAK_STREET_ID`).
- No live network: tests substitute fixtures or doubles for Flipp, recipe fetches, GoTrue and Web Push.

---

*Testing analysis: 2026-10-21*
