# Testing Guide

## Overview

Hestia uses four test layers:

| Layer | Tool | Environment | Scope |
| --- | --- | --- | --- |
| **Unit** | Vitest | Node.js | Pure business logic: recurrence calculations, parsing, matching, formatting. |
| **Component** | Vitest + Testing Library | jsdom | React component rendering, user interactions, accessibility, state transitions. |
| **Integration** | Vitest | Local Postgres (`supabase start`) | Database migrations, RLS policies, transactions, and service route handlers. |
| **End-to-End** | Playwright | Chromium + Docker Compose | Full application flows across web, Caddy gateway, GoTrue auth, and backend service. |

> [!NOTE]
> Tests never make live external network calls. Tests substitute checked-in fixtures or test doubles for external services (e.g., Flipp or recipe fetches).

---

## Running Tests

### Unit and Component Tests

```bash
# Run all workspace unit and component tests
pnpm test

# Run tests for a specific workspace
pnpm --filter @hestia/web test
pnpm --filter @hestia/service test
pnpm --filter @hestia/recurrence test
pnpm --filter @hestia/matching test
pnpm --filter @hestia/shared test

# Run web test coverage
pnpm --filter @hestia/web test:coverage
```

### Integration Tests

Requires local Supabase CLI and Docker:

```bash
# Start local Supabase instance
supabase start

# Run service integration tests
pnpm --filter @hestia/service test:integration
```

### End-to-End Tests

E2E tests spin up an isolated test stack using Docker Compose:

```bash
# Run Playwright E2E suite
pnpm test:e2e

# Run with interactive UI
pnpm --filter @hestia/e2e test:e2e --ui
```

---

## Deterministic Dates and Timezones

- Test runners use a fixed clock instant (`TEST_NOW = '2026-09-19T06:38:27.000Z'`) configured via `test/clock-setup.mjs`.
- Always pass an explicit instant to `Date` constructors or use the test clock helpers (`currentInstant()`) rather than reading the live system clock.
- Multi-timezone testing validates behaviour across household vs device timezone offsets.
