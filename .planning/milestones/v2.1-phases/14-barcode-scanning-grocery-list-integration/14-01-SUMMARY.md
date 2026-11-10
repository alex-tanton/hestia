---
phase: 14-barcode-scanning-grocery-list-integration
plan: "01"
subsystem: service
tags:
  - barcode
  - openfoodfacts
  - postgres
  - cache
  - caddy
  - lists
requires:
  - phase: 12-store-deal-image-delivery
    provides: Open Food Facts image CDN ingress policy
provides:
  - barcode_products caching table and shopping_list_item barcode column in Postgres
  - Open Food Facts v3 caching proxy service with 5s AbortController timeout and compliant User-Agent
  - Authenticated Fastify route plugin GET /api/barcodes/:barcode
  - Shared schemas and contracts for barcode endpoints and shopping list barcode persistence
  - Caddy ingress Permissions-Policy camera=(self) and script-src 'wasm-unsafe-eval'
affects:
  - "14-02"
  - "14-03"
  - web
  - lists
actuals:
  tokens: 42000
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - Postgres cache-aside table with on-conflict do-nothing for external API responses
    - AbortController timeout on external API requests
    - Compliant RFC User-Agent header for public API etiquette
key-files:
  created:
    - supabase/migrations/20261110000000_barcode_products.sql
    - packages/shared/src/api/barcodes.ts
    - apps/service/src/services/barcodes.ts
    - apps/service/src/services/barcodes.test.ts
    - apps/service/src/routes/barcodes.ts
    - apps/service/src/routes/barcodes.test.ts
  modified:
    - apps/service/src/db/types.ts
    - apps/service/src/app.ts
    - packages/shared/src/api/contract.ts
    - packages/shared/src/api/lists.ts
    - packages/shared/src/index.ts
    - apps/service/src/services/lists.ts
    - docker/Caddyfile
key-decisions:
  - "D-14-01: Indefinite Postgres caching in barcode_products table to prevent duplicate upstream hits and stay within OFF rate limits"
  - "D-14-02: 5,000ms AbortController timeout on Open Food Facts v3 API fetch with graceful fallback to null"
  - "D-14-03: Caddyfile Permissions-Policy camera=(self) and CSP script-src 'wasm-unsafe-eval' for barcode camera stream and WASM fallback"
patterns-established:
  - "Fastify route authenticate before param parsing ensures consistent 401 Problem Details on missing JWT"
  - "Barcode schema regex /^[A-Za-z0-9_-]+$/ prevents parameter tampering and injection"
requirements-completed:
  - SCAN-02
duration: 18 min
completed: 2026-11-10
status: complete
---

# Phase 14 Plan 01: Barcode Lookup Proxy, Database Cache, and Ingress Permissions Summary

**Delivered database schema, Open Food Facts v3 caching proxy service, authenticated Fastify barcode routes, shopping list item barcode persistence, and Caddy ingress camera permissions.**

## Accomplishments

- Created database migration `20261110000000_barcode_products.sql` with `barcode_products` cache table, RLS policies, and `shopping_list_item.barcode` column with partial index.
- Defined shared barcode schemas and types (`barcodeSchema`, `barcodeParamsSchema`, `barcodeProductSchema`) in `@hestia/shared`.
- Implemented `lookupBarcode` in `apps/service/src/services/barcodes.ts` with Postgres cache check, compliant RFC User-Agent header, 5-second `AbortController` timeout, and resilient error recovery.
- Implemented and registered authenticated Fastify route plugin `GET /api/barcodes/:barcode` in `apps/service/src/routes/barcodes.ts` and `apps/service/src/app.ts`.
- Enhanced shopping list service (`toItem`, `manualValues`, `addListItem`, `updateListItem`) to persist and retrieve item barcodes.
- Updated `packages/shared/src/api/contract.ts` with `GET /api/barcodes/:barcode` endpoint definition.
- Updated `docker/Caddyfile` ingress headers with `Permissions-Policy: camera=(self)` and `script-src 'wasm-unsafe-eval'` to allow camera video streaming and WebAssembly polyfills.
- Full test coverage verified across service and shared packages (all unit tests passing, full workspace typecheck passing).

## Task Commits

1. **Task 14-01-01: End-to-end barcode lookup proxy: migration to route (SCAN-02)** - `09c5dee` (feat)
2. **Task 14-01-02: Register barcode routes in Fastify app and add route/service unit test suites (SCAN-02)** - `35254b8` (feat)
3. **Task 14-01-03: Shopping list service item barcode persistence, shared contracts, and Caddy permissions (SCAN-02)** - `71d3043` (feat)

## Files Created/Modified

- `supabase/migrations/20261110000000_barcode_products.sql` - Barcode products table and shopping list item barcode column
- `packages/shared/src/api/barcodes.ts` - Shared validation schemas and TypeScript types for barcodes
- `packages/shared/src/api/contract.ts` - Shared API contract endpoint declaration
- `packages/shared/src/api/lists.ts` - List item schemas with barcode field
- `packages/shared/src/index.ts` - Export barcode API schemas
- `apps/service/src/db/types.ts` - Kysely types for barcode_products and shopping_list_item.barcode
- `apps/service/src/services/barcodes.ts` - OFF v3 caching proxy with timeout resilience
- `apps/service/src/services/barcodes.test.ts` - Service unit tests
- `apps/service/src/routes/barcodes.ts` - Fastify route plugin for GET /api/barcodes/:barcode
- `apps/service/src/routes/barcodes.test.ts` - Route integration tests
- `apps/service/src/services/lists.ts` - Shopping list item barcode persistence
- `docker/Caddyfile` - Ingress camera permissions and WASM CSP

