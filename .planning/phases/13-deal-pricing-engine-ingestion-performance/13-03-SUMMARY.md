---
phase: 13-deal-pricing-engine-ingestion-performance
plan: "03"
subsystem: deals
tags:
  - web
  - react
  - deals
  - pricing
  - polling
  - ui
requirements-completed:
  - DEAL-01
  - DEAL-03
status: complete
plan_head_before: 41345a413320b5dbf73300f7593ef3d7e2d48984
plan_head_after: 30f771f42c7c83dfc902f653c2c95abf926be531
commits: 2
actuals:
  tokens: 2862
  tasks: 2
  commits: 2
---

# Phase 13 Plan 03: PWA DealCard Pricing Display & Adaptive Ingestion Polling Summary

Anchored primary sale price and placed inline discount badge beside strikethrough original price with clean missing-price fallback, and transitioned PWA deals polling to fixed 4.5s intervals with a 3-minute hard ceiling.

## What Was Done

### Task 13-03-01: DealCard Pricing Display & Inline Discount Badge (DEAL-01)
- Refined `DealCard.tsx` pricing cluster to anchor unit sale price prominently with `text-h3 tabular-nums text-section`.
- Placed `-X%` discount badge inline beside the strikethrough original price when original price and discount percent are present.
- Provided clean fallback when regular price is missing: no strikethrough text or discount badge is rendered.
- Removed duplicate discount badge from the secondary lower badge row while preserving conditional price, category, and validity dates labels.
- Added comprehensive unit and component tests in `deal-card.test.tsx` verifying primary sale price styling, inline badge placement, missing regular price fallback, and screen reader announcements.
- **Commit:** `061e681` (`feat(web): anchor unit price and inline discount badge (DEAL-01)`)

### Task 13-03-02: Adaptive 4-5s Client Polling with 3-Minute Hard Ceiling (D-08, DEAL-03)
- Replaced exponential backoff in `use-refresh-poll.ts` with fixed 4.5s intervals (`POLL_INTERVAL_MS = 4_500`) and a 3-minute hard ceiling (`MAX_POLL_MS = 180_000`, `MAX_ATTEMPTS = 40`).
- Updated `useRefreshPoll` hook to poll on the 4.5s beat while `isRefreshing` is active, immediately halt when offline or resolved, and set `hasGivenUp: true` when 40 attempts elapse.
- Verified `DealFreshness.tsx` displays status `" This is taking a while."` and renders `Try again` retry affordance when `hasGivenUp` is true.
- Updated unit tests in `refresh-poll.test.ts` covering the 4.5s interval, 3-minute ceiling, resolution halting, and offline pause.
- **Commit:** `30f771f` (`feat(web): 4.5s refresh polling with 3-minute ceiling (D-08, DEAL-03)`)

## Decisions Made

- Placed inline discount badge beside strikethrough original price within the primary price cluster, eliminating duplicate discount badges in the lower metadata row.
- Ensured clean single-price fallback: when `deal.originalPrice === null`, neither strikethrough price nor discount badge is rendered, avoiding misleading zero/null discounts.
- Fixed polling frequency at 4.5 seconds with a 3-minute ceiling (~40 attempts) per locked decision D-08, preventing premature backoff timeouts while background ingestion completes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Scope/Commitlint Convention] Commit message length adjusted for commitlint**
- **Found during:** Task 13-03-01 and 13-03-02
- **Issue:** Commit subjects required commitlint-compliant scope `web` and concise header <= 72 characters.
- **Fix:** Used concise commit subject <= 72 characters with bulleted body descriptions.
- **Files modified:** None (commit message adjustment).

## Self-Check: PASSED

- `apps/web/src/screens/deals/DealCard.tsx` exists and passes typecheck.
- `apps/web/src/screens/deals/deal-card.test.tsx` exists and passes 20 tests.
- `apps/web/src/screens/deals/use-refresh-poll.ts` exists and passes typecheck.
- `apps/web/src/screens/deals/refresh-poll.test.ts` exists and passes 5 tests.
- Commits `061e681` and `30f771f` verified in git history.
