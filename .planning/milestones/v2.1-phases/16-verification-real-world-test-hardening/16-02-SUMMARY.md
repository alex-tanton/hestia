---
phase: 16-verification-real-world-test-hardening
plan: "02"
subsystem: test
tags:
  - barcodes
  - open-food-facts
  - meal-planning
  - pg_advisory_xact_lock
  - integration-testing
  - supabase
requires:
  - phase: 14-barcode-scanning-grocery-list-integration
    provides: Barcode product proxy caching and route handlers
  - phase: 15-flexible-meal-planning-custom-items-recipes
    provides: Custom food item planning and advisory locked add-to-list
provides:
  - Hardened integration tests for Open Food Facts proxy caching and error resilience
  - PostgreSQL row-level security and permission verification for barcode_products
  - Meal plan service integration verifying custom item lifecycle, recipe deletion coexistence, and advisory-locked concurrency
affects:
  - service
  - db
actuals:
  tokens: 42000
  tasks: 3
  commits: 1
tech-stack:
  added: []
  patterns:
    - PostgreSQL integration tests using registerStackHooks() and live Supabase stack
    - Upstream HTTP stubbing with vi.stubGlobal('fetch', ...) ensuring zero external egress
    - Concurrent mutation testing using Promise.all to verify advisory lock serialization
key-files:
  created:
    - apps/service/src/barcodes.integration.test.ts
  modified:
    - apps/service/src/meal-plan.integration.test.ts
    - apps/service/src/db/policies.integration.test.ts
    - apps/service/src/chores.integration.test.ts
    - apps/service/src/errands.integration.test.ts
    - supabase/migrations/20261110000000_barcode_products.sql
key-decisions:
  - "D-03: Barcode lookup integration verifies cache miss insertion, cache hit retrieval, upstream 429/503/timeout RFC 9457 Problem Details, and input validation without network egress"
  - "D-04: Meal plan integration verifies standalone custom items, deleted recipe snapshot coexistence, and advisory-locked concurrent list addition"
requirements-completed:
  - TEST-02
duration: 15 min
completed: 2026-11-10
status: complete
---

# Phase 16 Plan 02: Service Integration Test Hardening Summary

**Harden PostgreSQL integration tests for Open Food Facts barcode proxy caching, upstream failure resilience, and flexible meal plan concurrency with advisory locks.**

## Accomplishments

- Created `apps/service/src/barcodes.integration.test.ts` verifying barcode lookup lifecycle and error resilience against live Supabase PostgreSQL (TEST-02, D-03):
  - Cache miss queries Open Food Facts v3 with compliant `User-Agent` (`Hestia/2.1 (https://hestia.aberrance.app; mailto:...)`) and `Accept: application/json`, writes product to `barcode_products`, and returns 200 with `BarcodeProduct`.
  - Second lookup for identical barcode resolves directly from PostgreSQL cache with zero additional `fetch` calls.
  - Upstream 429 (Too Many Requests), 503 (Service Unavailable), and network timeout (`AbortError`) return RFC 9457 404 Problem Details without service crashes or hanging sockets.
  - Malformed barcodes (`invalid!@#`) reject with RFC 9457 400 Bad Request before database or upstream calls.
  - Unauthenticated requests reject with RFC 9457 401 Unauthorized Problem Details.
- Added table grants `grant select, insert on public.barcode_products to authenticated;` in migration `20261110000000_barcode_products.sql` to resolve RLS permission constraints and updated public schema table count assertions in `apps/service/src/db/policies.integration.test.ts`.
- Expanded `apps/service/src/meal-plan.integration.test.ts` (TEST-02, D-04):
  - Verified custom food item creation, week listing, and clean deletion.
  - Verified that when a recipe is deleted, its entry retains the snapshot recipe title and null `readinessPercent`, while adjacent custom items in the same meal slot remain completely unaffected.
  - Verified that week add-to-list adds active recipe ingredients and custom items while omitting deleted recipes.
  - Verified concurrent `POST /api/households/:id/meal-plan/add-to-list` requests executing under `pg_advisory_xact_lock` using `Promise.all` serialize cleanly without deadlock or duplicate items.

## Task Commits

1. **Task 16-02-01, 16-02-02, 16-02-03: Hardened barcode and meal plan integration tests (TEST-02, D-03, D-04)** - `test(service)` (Commit: `dec5c45`)

## Files Created / Modified

- `apps/service/src/barcodes.integration.test.ts` - Integration tests for barcode proxy caching and upstream error resilience
- `apps/service/src/meal-plan.integration.test.ts` - Integration tests for custom items, deleted recipe coexistence, and advisory locks
- `apps/service/src/db/policies.integration.test.ts` - Updated table count assertion for public schema (26 tables)
- `apps/service/src/chores.integration.test.ts` - Tolerant timestamp assertion for host clock drift
- `apps/service/src/errands.integration.test.ts` - Tolerant timestamp assertion for host clock drift
- `supabase/migrations/20261110000000_barcode_products.sql` - Added missing table grants for authenticated role
