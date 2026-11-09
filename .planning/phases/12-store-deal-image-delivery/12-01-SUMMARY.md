---
phase: 12-store-deal-image-delivery
plan: "01"
subsystem: shared
tags:
  - csp
  - cdn
  - images
  - validation
  - flipp
  - caddy
requires:
  - phase: 11-deal-matching-engine
    provides: Deals ingestion and deal UI schemas
provides:
  - Centralized ALLOWED_IMAGE_DOMAINS constant and isAllowedImageUrl validator in @hestia/shared
  - Caddy reverse proxy CSP img-src directives permitting Flipp and Open Food Facts CDNs
affects:
  - "12-02"
  - deals
  - web
  - sw
actuals:
  tokens: 1250
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - Centralized origin validation using WHATWG URL parser with strict dot-subdomain matching
key-files:
  created:
    - packages/shared/src/images.ts
    - packages/shared/src/images.test.ts
  modified:
    - packages/shared/src/index.ts
    - docker/Caddyfile
    - e2e/tests/20-ingress-client-ip-and-csp.spec.ts
key-decisions:
  - "D-01: Centralized allowed image domain definitions and URL validation in @hestia/shared"
  - "D-02: Strict HTTPS and dot-subdomain suffix validation against ['flipp.com', 'wishabi.com', 'wishabi.net', 'openfoodfacts.org']"
  - "D-04: Configured Caddyfile Content-Security-Policy img-src header with CSP Level 3 wildcards for Flipp and Open Food Facts origins"
patterns-established:
  - "Strict dot-prefixed subdomain validation (hostname === domain || hostname.endsWith('.' + domain)) preventing prefix/suffix domain hijacking"
requirements-completed:
  - IMG-01
  - IMG-03
coverage:
  - id: D1
    description: "Centralized image domain validator (isAllowedImageUrl) and domain constant (ALLOWED_IMAGE_DOMAINS) in @hestia/shared"
    requirement: IMG-03
    verification:
      - kind: unit
        ref: packages/shared/src/images.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "Caddy reverse proxy ingress Content-Security-Policy img-src directive permitting modern Flipp and Open Food Facts CDNs"
    requirement: IMG-01
    verification:
      - kind: e2e
        ref: e2e/tests/20-ingress-client-ip-and-csp.spec.ts
        status: pass
    human_judgment: false
duration: 8 min
completed: 2026-11-09
status: complete
---

# Phase 12 Plan 01: Shared Image Domain Validation & Ingress CSP Summary

**Centralized image CDN domain definitions and strict URL validation in `@hestia/shared`, and updated Caddy CSP `img-src` headers to permit modern Flipp and Open Food Facts CDNs.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-09T16:10:40Z
- **Completed:** 2026-11-09T16:18:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Established `ALLOWED_IMAGE_DOMAINS` constant (`['flipp.com', 'wishabi.com', 'wishabi.net', 'openfoodfacts.org']`) and `isAllowedImageUrl` validation utility in `@hestia/shared`.
- Enforced strict HTTPS protocol verification and dot-prefixed subdomain suffix validation preventing origin spoofing and mixed-content injection.
- Re-exported image validation utilities from root `@hestia/shared` for client-tier consumption.
- Updated `docker/Caddyfile` Content-Security-Policy `img-src` directive with CSP Level 3 wildcards for all approved origins, unblocking modern Flipp flyer assets and Open Food Facts product images.
- Added automated E2E CSP header assertions in `e2e/tests/20-ingress-client-ip-and-csp.spec.ts`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author unit test suite for image URL validator and scaffold stub** - `25c2583` (test)
2. **Task 2: Implement centralized image domain validator and export from shared package** - `a7411b1` (feat)
3. **Task 3: Update Caddyfile Content-Security-Policy img-src header and E2E assertions** - `fff98f1` (feat)

## Files Created/Modified

- `packages/shared/src/images.ts` - Centralized domain allowlist constant and URL validation function
- `packages/shared/src/images.test.ts` - 23 Vitest unit tests covering positive and negative validation checks
- `packages/shared/src/index.ts` - Re-export `images.js` from shared package
- `docker/Caddyfile` - Ingress Content-Security-Policy `img-src` header directive with expanded CDN hosts
- `e2e/tests/20-ingress-client-ip-and-csp.spec.ts` - E2E Playwright test assertions for Caddy CSP image CDN hosts

## Decisions Made

- D-01: Centralized allowed image domain definitions and URL validation in `@hestia/shared` as single source of truth.
- D-02: Strict HTTPS and dot-subdomain suffix validation against `['flipp.com', 'wishabi.com', 'wishabi.net', 'openfoodfacts.org']`.
- D-04: Updated `docker/Caddyfile` `img-src` directive with CSP Level 3 wildcards for all allowed origins.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scope and length constraints in commit messages**
- **Found during:** Task commits
- **Issue:** Commitlint enforces scoped messages from `[web, service, shared, recurrence, matching, db, e2e, docker]` and max subject length of 71 characters.
- **Fix:** Used `test(shared): ...`, `feat(shared): ...`, and `feat(docker): ...` with concise subjects under 71 characters.
- **Files modified:** None
- **Verification:** Commitlint and pre-commit hooks passed.

---

**Total deviations:** 1 auto-fixed (commit formatting)
**Impact on plan:** Standard compliance with repository commitlint rules.

## Issues Encountered

None. All unit tests, typechecks, and lint-staged hooks passed cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 12-01 completed the shared domain validation and ingress CSP layer.
Ready for Plan 12-02: Update PWA Service Worker image caching route with 200-entry quota, and refactor `DealImage.tsx` to use `@hestia/shared`.

---
*Phase: 12-store-deal-image-delivery*
*Plan: 01*
*Completed: 2026-11-09*
