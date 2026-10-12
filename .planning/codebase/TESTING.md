---
last_mapped_commit: b96ca32ac1130c09f8aa3066d715181ddf3fb31a
last_mapped_at: 2026-10-11
---
# Testing Patterns

**Analysis Date:** 2026-10-11

## Test Framework

**Runner:**
- Vitest 5.0.1 for every workspace (`apps/service/package.json`, `apps/web/package.json`, `packages/*/package.json`). Vitest 5 is pinned in the service and packages.
- Exception: `e2e/support/run-identity.test.ts` uses Node's built-in runner (`node --test`, script `test` in `e2e/package.json`).
- E2E: Playwright (`e2e/playwright.config.ts`) with `@axe-core/playwright` for accessibility checks (`e2e/support/axe.ts`).
- Web component tests: jsdom environment and `@testing-library/react` / `@testing-library/user-event` (`apps/web/vite.config.ts`, `environment: 'jsdom'`).

**Configs:**
- `apps/service/vitest.config.ts`: unit tests, excludes `*.integration.test.ts`.
- `apps/service/vitest.integration.config.ts`: integration tests only, `fileParallelism: false`, testTimeout 20s, hookTimeout 30s.
- `apps/service/vitest.coverage.config.ts`: unit and integration together, with thresholds.
- `apps/web/vite.config.ts` (`test` block): jsdom, setup file `apps/web/src/test-setup.ts`.
- `packages/recurrence/vitest.config.ts`, `packages/matching/vitest.config.ts`, `packages/shared/vitest.config.ts`: unit tests with coverage thresholds.

**Assertion Library:**
- Vitest's built-in `expect` (Chai-style matchers, `toEqual`, `toBe`, `toThrow`). Jest DOM matchers come from `@testing-library/jest-dom/vitest`, loaded via `apps/web/tsconfig.json` types.

**Run Commands:**

```bash
pnpm test                                    # Every workspace's unit and component tests (pnpm -r test)
pnpm --filter @hearth/service test           # Service unit tests (excludes integration)
pnpm --filter @hearth/web test               # Web component tests
pnpm --filter @hearth/recurrence test        # One package
pnpm test:integration                        # Service integration tests (needs `supabase start`)
pnpm --filter @hearth/service test:coverage  # Service coverage over unit and integration (needs `supabase start`)
pnpm --filter @hearth/web test:coverage      # Web coverage (script exists; see Coverage)
pnpm test:e2e                                # Full Docker Compose stack plus Playwright journeys
```

## Test File Organization

**Location:**
- Co-located. A unit or component test sits next to the module it covers, e.g. `packages/recurrence/src/occurrence.test.ts` next to `occurrence.ts`, `apps/web/src/components/ui/Toast.test.tsx` next to `Toast.tsx`, `apps/service/src/services/bills.test.ts` next to `services/bills.ts`.
- Integration tests are co-located under `apps/service/src/` as `*.integration.test.ts` (e.g. `apps/service/src/bills.integration.test.ts`, `apps/service/src/db/rls-isolation.integration.test.ts`).
- Cross-cutting or journey tests live in `e2e/tests/`.
- Shared test helpers live in `apps/service/src/test/` (service) and `apps/web/src/test/` (web).

**Naming:**
- Unit: `<module>.test.ts`. Component: `<Component>.test.tsx`, or `<feature>.test.tsx` when several related components share one file (`apps/web/src/components/ui/primitives.test.tsx`, `apps/web/src/components/shell/shell.test.tsx`).
- Screen tests: `apps/web/src/screens/<feature>/<name>.test.tsx`, e.g. `bills-index.test.tsx`, `subscriptions.test.tsx`, `household-timezone.test.tsx`.
- Integration: `<feature>.integration.test.ts`.
- E2E: `NN-<journey>.spec.ts` under `e2e/tests/`, numbered in run order (e.g. `01-signup-and-first-household.spec.ts`, `14-bills-and-subscriptions.spec.ts`). `20-remove-member.spec.ts` must stay last because it mutates shared seed data.

**Structure:**

```
packages/recurrence/src/
  bills.ts
  bills.test.ts          # unit, pure logic
apps/service/src/
  services/bills.ts
  services/bills.test.ts              # unit, pure logic
  bills.integration.test.ts           # route plus Postgres
  db/rls-isolation.integration.test.ts
apps/web/src/
  components/dashboard/DashboardCard.tsx
  components/dashboard/dashboard.test.tsx   # component
e2e/tests/
  14-bills-and-subscriptions.spec.ts
```

## Test Structure

**Suite Organization:**

Unit tests group by function, with `describe` named after the function under test, and `it` titles written as plain-English behavior:

```typescript
// packages/recurrence/src/bills.test.ts
import { describe, expect, it } from 'vitest';
import { currentBillOccurrence } from './bills.js';
import type { Recurrence } from './types.js';

describe('currentBillOccurrence', () => {
  const monthly: Recurrence = { unit: 'month', interval: 1, anchorDate: '2026-01-15' };

  it('the earliest occurrence with no log row is current', () => {
    const result = currentBillOccurrence(monthly, new Set(), '2026-01-20');
    expect(result).toEqual({ occurrenceDate: '2026-01-15', occurrenceIndex: 0, isOverdue: true });
  });

  describe('late payment does not shift the series', () => {
    it('a bill paid late advances to the anchor-derived next occurrence', () => {
      const result = currentBillOccurrence(monthly, new Set(['2026-01-15']), '2026-02-10');
      expect(result.occurrenceDate).toBe('2026-02-15');
    });
  });
});
```

Table-driven checks use `it.each` (37 test files use it, e.g. `apps/service/src/deals/money.test.ts`, `packages/recurrence/src/occurrence.test.ts`). Prefer one table over many near-identical `it` blocks.

Component tests use `describe` per screen or component and `render` plus `screen` queries:

```typescript
// apps/web/src/components/dashboard/dashboard.test.tsx
function renderCard(state: DashboardCardState): void {
  render(
    <MemoryRouter>
      <DashboardCard pillar="bills" title="Bills" state={state} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});
```

**Patterns:**
- Setup: local helper functions (`renderCard`, `renderDashboard`) rather than `beforeEach` where possible. Module-level `const` fixtures (e.g. `monthly`) are shared across `it` blocks.
- Teardown: `afterEach(() => vi.restoreAllMocks())` in web tests; `apps/web/src/test-setup.ts` calls Testing Library `cleanup()` after every test.
- Assertion style: `toEqual` for objects, `toBe` for primitives, `toThrow` / `rejects` with `ProblemError` for error paths (`apps/service/src/services/bills.test.ts`).
- Non-null assertions (`!`) are allowed only in tests (`eslint.config.js`). Elsewhere they are a lint error.
- Dates are fixed explicitly (`today: '2026-01-20'`, `'2026-01-15'`). Tests never depend on the wall clock (`docs/testing.md`).

**Integration suite setup, two patterns (from `docs/testing.md`):**
1. Database and RLS tests use `withTestDb(fn)` from `apps/service/src/test/integration-db.ts`. Every test runs inside a transaction that is always rolled back. `db.admin` seeds fixtures; `db.as(user)` runs statements as an authenticated user so RLS applies. `buildWorld()` in `apps/service/src/test/world.ts` builds a two-household fixture.
2. Route and service tests use `startStack()` from `apps/service/src/test/service-stack.ts`. Requests commit for real, so isolation comes from unique data per test (`signUp()`, `uniqueName()`, a per-file `nextPostalCode()` counter), and shared keys are cleaned up in `beforeEach` or `afterAll`.

## Mocking

**Framework:** Vitest (`vi`) for the few module mocks needed. Most seams are dependency injection with hand-written doubles instead of mocks.

**Patterns:**

Module mocks (used only in five test files) are declared at the top of the file and hoisted by Vitest:

```typescript
vi.mock('virtual:pwa-register/react', ...)      // apps/web/src/test-setup.ts: build-time virtual module
vi.mock('workbox-precaching', ...)              // service worker tests (apps/web/src/sw.test.ts)
vi.mock('./advisory-lock.js', ...)              // apps/service/src/jobs/scheduler tests
vi.mock('../../lib/url-hash.ts', ...)           // apps/web screen test
```

Typed test doubles, preferred for anything with behavior:
- Service: `apps/service/src/test/fixture-deal-source.ts` (stands in for the Flipp fetch), `apps/service/src/test/push-double.ts` (records Web Push instead of sending), `apps/service/src/push/recording-transport.ts`, and the `DummyDriver` in-memory Kysely setup in `apps/service/src/test/fake-app.ts`.
- Web: `createAuthStub()` in `apps/web/src/test/harness.tsx` implements the `AuthClient` interface and exposes `setState` to move the session. `apps/web/src/test/push-double.ts` implements `PushPort`. `RealtimePort` and `PushPort` are interfaces precisely so tests can swap them.
- Fetch: the web `AppProviders` harness (`apps/web/src/test/harness.tsx`) stubs `fetch` for component tests. No network is used anywhere in tests.

**What to Mock:**
- Anything that would touch the network (Flipp, recipe pages, Web Push, GoTrue): use the existing fixture or double, not `vi.mock`.
- Browser-only or build-only modules (`virtual:pwa-register/react`, Workbox modules) and layout APIs jsdom lacks (`ResizeObserver`, `scrollIntoView`, pointer capture), which `apps/web/src/test-setup.ts` stubs globally.
- Auth and realtime: use `createAuthStub()` and the `RealtimePort` double.

**What NOT to Mock:**
- The database in integration tests. `docs/testing.md` says tests run against a real Postgres migrated from `supabase/migrations/` so SQL, RLS, and triggers are exercised.
- Pure recurrence, matching, and money logic. Those are tested directly with tables of inputs.
- Fastify routing in service tests. Use `app.inject()` (`apps/service/src/app.test.ts`, `apps/service/src/test/fake-app.ts`) instead of stubbing handlers.

## Fixtures and Factories

**Test Data:**

Web fixture modules, one per domain, under `apps/web/src/test/`:
- `fixtures.ts` (shared IDs such as `ALEX_ID`), `bills-fixtures.ts`, `chore-fixtures.ts`, `deal-fixtures.ts`, `list-fixtures.ts`, `meal-fixtures.ts`.

Service and package fixtures:
- `apps/service/src/test/world.ts`: `buildWorld()` for a two-household database fixture.
- `apps/service/src/recipes/fixtures/*.html` and `apps/service/src/deals/flipp/normalized-fixtures.ts`: captured recipe pages and normalized deal payloads.
- `packages/matching/src/fixtures.test.ts`: matching ground-truth table.

Captured data for E2E:
- `e2e/fixtures/flipp/raw/` and `e2e/fixtures/flipp/normalized/`: real Flipp captures, mounted read-only into the service container through `HEARTH_FLIPP_FIXTURE_DIR`.
- `e2e/fixtures/recipes/*.html`: recipe pages served through `HEARTH_RECIPE_FIXTURE_DIR`.
- `e2e/fixtures/e2e-seed.sql`: layered on top of `supabase/seed/seed.sql`.

Seed (local dev and E2E): `supabase/seed/seed-users.ts`, run with `pnpm db:seed`. It creates three households, five users, and named edge cases (documented in `docs/testing.md`, "Seed data").

**Location:**
- Test-only data lives in `apps/*/src/test/` or as `*-fixtures.ts` beside the tests. Captured external data lives under `e2e/fixtures/`.

## Coverage

**Requirements (actual configuration, verified in source):**
- `packages/recurrence`, `packages/matching`, `packages/shared`: 90% for lines, branches, functions, and statements (`vitest.config.ts` in each). Enforced on `pnpm test`, which runs with `--coverage` in `packages/recurrence/package.json`.
- `apps/service`: `statements: 95, branches: 83, functions: 96, lines: 97` in `apps/service/vitest.coverage.config.ts`. Measured over unit and integration tests together. Enforced by CI's `test-integration` job (`.github/workflows/ci.yml`, step `pnpm --filter @hearth/service test:coverage`).
- `apps/web`: a `test:coverage` script and thresholds exist in `apps/web/vite.config.ts`: `statements: 82, branches: 78, functions: 74, lines: 84`. Note that `docs/testing.md` says the web package has no coverage configuration. The source is the authority here, so treat the web thresholds as enforced only when `test:coverage` is run. CI runs plain `pnpm test` for web.

**View Coverage:**

```bash
pnpm --filter @hearth/service test:coverage     # HTML report under apps/service/coverage/
pnpm --filter @hearth/web test:coverage         # HTML report under apps/web/coverage/
pnpm --filter @hearth/recurrence test           # runs with --coverage
```

Coverage excludes: `src/main.ts`, `src/db/types.ts` (generated), `src/test/**`, and pure type or re-export barrels (`src/jobs/index.ts`, `src/jobs/types.ts`, `src/deals/deal-source.ts`, `src/push/web-push.d.ts`, `src/write-openapi.ts`).

## Test Types

**Unit Tests:**
- Pure logic in `packages/*/src/` and `apps/service/src/services/`, `apps/service/src/deals/`, `apps/service/src/recipes/`. Table-driven, no I/O. Examples: recurrence (`packages/recurrence/src/*.test.ts`, including month-end clamping and rotation), price parsing (`apps/service/src/deals/price/parse-price.test.ts`), and matching (`packages/matching/src/matcher.test.ts`, with named false-positive cases such as "chicken breast" vs "chicken broth").
- Service units that build the real Fastify app in memory with `fake-app.ts` and drive it with `app.inject()` (`apps/service/src/app.test.ts`, `apps/service/src/routes/routes.test.ts`). They count as unit tests because nothing touches a socket or database.
- Shared schemas: `packages/shared/src/api/*.test.ts` and `packages/shared/src/api/schemas.test.ts` check Zod contracts.
- Web hooks and pure modules: `apps/web/src/lib/**/*.test.ts` (e.g. `apps/web/src/lib/money.test.ts`, `apps/web/src/lib/offline/write-queue.test.tsx`).

**Component and Screen Tests (web):**
- Render with providers (`MemoryRouter`, `AppProviders`, `ToastProvider`) and query by role or label (`getByRole`, `getByLabelText`), never by test id. Example: `card(name)` in `apps/web/src/components/dashboard/dashboard.test.tsx` uses `getByRole('region', { name })`.
- Interaction via `@testing-library/user-event`. Async UI assertions use `waitFor`, never fixed delays. The exact pattern is in `apps/web/src/lib/offline/chore-errand-writes.test.ts` and `apps/web/src/components/shell/shell.test.tsx`.
- Screens to cover: `apps/web/src/screens/**/*.test.tsx`, including offline queue behavior (`chores-offline-queue.test.tsx`, `errands-offline-queue.test.tsx`) and timezone handling (`household-timezone.test.tsx`).
- Component tests assert markup, props, and behavior, not rendered colors. Contrast is checked in E2E with axe.

**Integration Tests (service):**
- `apps/service/src/**/*.integration.test.ts` against `supabase start` Postgres and GoTrue (through Kong). Covers SQL, RLS, triggers, the membership functions, the job runner (`jobs.integration.test.ts`, `log-autopay.integration.test.ts`, `dispatch-notifications.integration.test.ts`), and the route layer.
- `apps/service/src/db/rls-isolation.integration.test.ts` asserts that a member of household A cannot read, insert, update, or delete household B's rows.
- Files run one at a time (`fileParallelism: false`) because fixtures share natural keys such as a postal code.

**E2E Tests:**
- Framework: Playwright, real Chromium, full Docker Compose stack (`docker/docker-compose.yml` plus `e2e/docker-compose.e2e.yml`), including Caddy and Kong. Playwright config: `e2e/playwright.config.ts`. Global setup and teardown: `e2e/global-setup.ts`, `e2e/global-teardown.ts`, `e2e/setup/stack.ts`.
- Journeys: `e2e/tests/01-…` through `e2e/tests/20-…`. Each journey's `test.describe` loops over `['light', 'dark']` with `test.use({ colorScheme: theme })`, so every journey runs in both themes.
- Accessibility: every screen state calls `expectAccessible(page, screenName)` from `e2e/support/axe.ts`, which waits for animations to settle and then runs axe against WCAG 2.1 A and AA. States no ordinary journey reaches are covered by `e2e/tests/17-accessibility-states.spec.ts`.
- Single worker, file order, one shared seeded database per run. Each run has its own id (`HEARTH_E2E_RUN_ID`) that namespaces the Compose project, network, image tags, and ports (`e2e/support/run-identity.ts`), so runs can execute concurrently on one machine.
- Tests never call live Flipp or fetch live recipe pages. Web Push is recorded through `HEARTH_PUSH_TRANSPORT=test-double` and read back at `/api/test/push` (`e2e/support/push.ts`).
- Run iteration: `HEARTH_E2E_REUSE_STACK=1 HEARTH_E2E_RUN_ID=<id> pnpm --filter @hearth/e2e exec playwright test tests/<file>.spec.ts`. Only trust results from a run that started from an empty database.

## Common Patterns

**Async Testing (unit):**

```typescript
it('resolves the recipe', async () => {
  await expect(fetchRecipe(url)).resolves.toEqual(expected);
});
```

**Async Testing (component):**

```typescript
await user.click(screen.getByRole('button', { name: 'Save' }));
await waitFor(() => {
  expect(screen.getByRole('status')).toHaveTextContent('Saved');
});
```

**Error Testing (service domain):**

```typescript
expect(() => planBillMove(...)).toThrow(ProblemError);
// or, for route-level assertions through app.inject():
expect(response.statusCode).toBe(400);
expect(response.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
```

**Error Testing (route, integration):**
Routes return RFC 9457 problem bodies. Assert the status code and the `problem` shape (`type`, `title`, `status`, `detail`) rather than raw text. The SQLSTATE mapping table (`apps/service/src/problem.ts`) is covered by `apps/service/src/problem.test.ts`.

**Writing a new test (checklist):**
1. Put the file next to the module. Use `.integration.test.ts` only if it needs Postgres or the real route stack.
2. Use `it.each` for tables of inputs. Fix any clock reads with an explicit date.
3. Use the existing fixture or double (`createAuthStub`, `push-double`, `fixture-deal-source`, `buildWorld`). Never reach the live network.
4. In component tests, query by role or label and wait with `waitFor`.
5. Run `pnpm lint` and `pnpm typecheck`. Test files may use `!`; other code may not.

---

*Testing analysis: 2026-10-11*
