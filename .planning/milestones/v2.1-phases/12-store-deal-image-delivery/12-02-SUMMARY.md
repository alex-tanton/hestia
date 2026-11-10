---
phase: 12-store-deal-image-delivery
plan: "02"
subsystem: web
tags:
  - pwa
  - service-worker
  - cache
  - workbox
  - deals
  - images
  - react
requires:
  - phase: 12-store-deal-image-delivery
    plan: "01"
    provides: Centralized isAllowedImageUrl and ALLOWED_IMAGE_DOMAINS in @hestia/shared
provides:
  - Workbox service worker caching for modern Flipp and Open Food Facts CDNs with 200-entry capacity
  - DealImage component refactored to use @hestia/shared domain validation with layout-preserving fallback placeholders
affects:
  - deals
  - offline
  - pwa
actuals:
  tokens: 1400
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - Workbox CacheFirst with ExpirationPlugin 200-entry LRU and CacheableResponsePlugin for opaque cross-origin responses
key-files:
  created:
    - apps/web/src/screens/deals/DealImage.test.tsx
  modified:
    - apps/web/src/sw.ts
    - apps/web/src/sw.test.ts
    - apps/web/src/screens/deals/DealImage.tsx
    - apps/web/src/screens/deals/deal-card.test.tsx
key-decisions:
  - "D-01: Imported isAllowedImageUrl from @hestia/shared into sw.ts and DealImage.tsx"
  - "D-02: Subdomain matching supports all modern Flipp subdomains and Open Food Facts hosts"
  - "D-03: Scoped strictly to remote HTTPS CDN domains while local assets continue using standard Vite imports"
  - "Discretion: Expanded Service Worker image cache quota from 100 to 200 entries with 7-day TTL"
patterns-established:
  - "DealImage: Layout-preserving container (shrink-0 overflow-hidden rounded-sm bg-raised) with fallback ImageOff icon for missing, invalid, or errored CDN images"
requirements-completed:
  - IMG-02
  - IMG-03
coverage:
  - id: D1
    description: "PWA Service Worker intercepts image requests for allowed Flipp and Open Food Facts CDNs, caching responses via CacheFirst with 200-entry cap and 7-day TTL"
    requirement: IMG-02
    verification:
      - kind: unit
        ref: apps/web/src/sw.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "DealImage renders allowed CDN images and layout-preserving fallback placeholders for null, invalid, or failed image loads"
    requirement: IMG-03
    verification:
      - kind: unit
        ref: apps/web/src/screens/deals/DealImage.test.tsx
        status: pass
    human_judgment: false
duration: 10 min
completed: 2026-11-09
status: complete
---

# Phase 12 Plan 02: PWA Service Worker Image Caching & DealImage Delivery Summary

**Expanded PWA Service Worker image caching route to intercept all allowed Flipp and Open Food Facts CDNs with a 200-entry quota, and refactored DealImage to consume centralized domain validation with fallback placeholders.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-11-09T16:18:50Z
- **Completed:** 2026-11-09T16:26:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Authored comprehensive component test suite in `apps/web/src/screens/deals/DealImage.test.tsx` verifying placeholder rendering for null and invalid URLs, lazy/async image rendering for allowed Flipp and Open Food Facts CDNs, and `onError` image fallback state flipping.
- Updated `apps/web/src/sw.ts` to route all allowed image URLs using `isAllowedImageUrl` from `@hestia/shared`, caching opaque (0) and successful (200) responses via CacheFirst with an expanded 200-entry quota and 7-day TTL.
- Updated `apps/web/src/sw.test.ts` to assert coverage across `*.flipp.com`, `flipp-image-retrieval.flipp.com`, `*.wishabi.com`, `*.wishabi.net`, and `*.openfoodfacts.org`, while rejecting disallowed/spoofed domains.
- Refactored `apps/web/src/screens/deals/DealImage.tsx` to eliminate redundant local domain allowlists, importing and re-exporting `isAllowedImageUrl` from `@hestia/shared` while preserving layout-preserving placeholder boxes.
- Updated outdated domain expectation in `apps/web/src/screens/deals/deal-card.test.tsx`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author component test suite for DealImage rendering and fallback** - `c91feb8` (test)
2. **Task 2: Update Service Worker image route caching and sw.test.ts expectations** - `4a22917` (feat)
3. **Task 3: Refactor DealImage.tsx to use centralized domain validator** - `204f2f9` (feat)

## Files Created/Modified

- `apps/web/src/screens/deals/DealImage.test.tsx` - Component tests for `DealImage` and `isAllowedImageUrl`
- `apps/web/src/sw.ts` - Workbox route matching using `isAllowedImageUrl` with 200-entry quota
- `apps/web/src/sw.test.ts` - Unit tests for Service Worker image routing and cache configuration
- `apps/web/src/screens/deals/DealImage.tsx` - Re-export and consume `isAllowedImageUrl` from `@hestia/shared`
- `apps/web/src/screens/deals/deal-card.test.tsx` - Updated domain test expectation for approved CDN hosts

## Decisions Made

- D-01: Centralized allowed image domain validation by importing `isAllowedImageUrl` from `@hestia/shared` into `sw.ts` and `DealImage.tsx`.
- D-02: Support modern Flipp subdomains and Open Food Facts image hosts with strict dot-subdomain suffix validation.
- D-03: Scoped strictly to remote HTTPS CDN domains in `isAllowedImageUrl` and service worker caching, while local assets continue using standard Vite imports.
- Discretion: Increased Service Worker cache quota from 100 to 200 entries with 7-day TTL to comfortably support multi-circular weekly browsing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug / Outdated Test Expectation] Updated deal-card.test.tsx for approved Flipp CDN subdomains**
- **Found during:** Task 3 verification
- **Issue:** `apps/web/src/screens/deals/deal-card.test.tsx` had a test expecting `isAllowedImageUrl('https://flipp-image-retrieval.flipp.com/x.jpg')` to be `false` from before modern Flipp subdomains were approved.
- **Fix:** Updated expectation to `true` for approved Flipp subdomains and added negative check for `https://attacker-flipp.com/x.jpg`.
- **Files modified:** `apps/web/src/screens/deals/deal-card.test.tsx`
- **Verification:** All 19 tests in `deal-card.test.tsx` passed.
- **Committed in:** `204f2f9`

---

**Total deviations:** 1 auto-fixed (test fixture update)
**Impact on plan:** Essential for consistent test expectations across the workspace.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All 2 plans in Phase 12 are complete:
- 12-01: Shared CDN domain validation and Ingress CSP update
- 12-02: PWA Service Worker caching and DealImage delivery

Ready for phase goal verification.

---
*Phase: 12-store-deal-image-delivery*
*Plan: 02*
*Completed: 2026-11-09*

