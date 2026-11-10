# Phase 13: Deal Pricing Engine & Ingestion Performance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-09T16:50:00.000Z
**Phase:** 13-Deal Pricing Engine & Ingestion Performance
**Areas discussed:** Sale Story Pricing Math, Ingestion Concurrency & Pipeline Performance

---

## Sale Story Pricing Math

### Question 1: Bundle Savings Stories
How should bundle savings stories (e.g. "Save $1.50 on 2", "Save 98¢ on 2" with 2/$6.00) derive original price and percent-off?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-unit mathematical derivation | Distribute the bundle savings across the quantity (e.g., "2/$6.00 with $1.50 off on 2" -> unit $3.00, original $3.75, 20% off) and preserve the original bundle story in displayPrice. | ✓ |
| Strict single-item only | Only derive original price when the saving applies directly to a single item (e.g. "Save $1.00"), leaving bundle savings as display-only without synthesizing regular prices. | |
| You decide | Follow builder discretion to derive when mathematically unambiguous, skipping ambiguous conditional limits. | |

**User's choice:** Per-unit mathematical derivation — Distribute the bundle savings across the quantity and preserve the original bundle story in displayPrice.
**Notes:** Provides accurate regular prices and % off badges while keeping the flyer's literal multi-buy copy visible.

### Question 2: Skipped Multi-buys ("Buy 2 Get 1 Free", "Must Buy N")
Currently, "Buy 2 Get 1 Free" and "Must buy N" deals are completely skipped. How should they be handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Derive effective unit price with quantity badge | Compute effective unit price (e.g. Buy 2 Get 1 Free at $3.00 -> $2.00/ea, $3.00 original, 33% off) and show a "Must buy 3" / promo badge so the deal is visible and priced accurately. | ✓ |
| Show base unit price with promo badge | Keep unit price at $3.00 with a "Buy 2 Get 1 Free" badge, without adjusting unit price downwards for single items. | |
| You decide | Whichever provides clearer grocery comparison while preventing misleading cart totals. | |

**User's choice:** Derive effective unit price with quantity badge.
**Notes:** Prevents dropping valid promotional deals while clearly communicating the purchase requirement to the shopper.

### Question 3: Rounding and Discount Calculation
How should cent rounding and discount percentage calculation be handled for fractional amounts?

| Option | Description | Selected |
|--------|-------------|----------|
| Standard half-up cent rounding with rounded percent | Round unitPrice and originalPrice to integer cents using standard half-up (matching existing divideCents), and compute discountPercent as Math.round((original - unit) / original * 100) clamped 1-99%. | ✓ |
| Always floor unit price | Favor optimistic lower unit price when splitting odd cents (e.g. 3 for $5 -> $1.66 instead of $1.67). | |
| You decide | Use existing money.ts arithmetic patterns across the codebase. | |

**User's choice:** Standard half-up cent rounding with rounded percent.
**Notes:** Consistent with existing financial rounding convention across `@hestia/shared` and `apps/service`.

### Question 4: Validity Bounds for Derived Prices
What validity bounds should guard derived regular prices and discount percentages against OCR/text parsing errors?

| Option | Description | Selected |
|--------|-------------|----------|
| Guard rails on derived pricing (1% to 85% discount) | Enforce originalPrice > unitPrice and clamp plausible derived discounts to 1%-85%; if derived savings exceed 85% or fall <= 0%, keep unitPrice but omit originalPrice to prevent false discounts from OCR/text errors. | |
| Liberal threshold (up to 95% discount) | Allow up to 95% off to accommodate genuine grocery clearance/liquidation items. | ✓ |
| You decide | Builder chooses sane threshold balancing clearance deals against bad OCR/text parsing. | |

**User's choice:** Liberal threshold (up to 95% discount).
**Notes:** Accommodates high-discount clearance and blowout grocery items while still enforcing basic mathematical sanity (`originalPrice > unitPrice` and `< 10x unitPrice`).

---

## Ingestion Concurrency & Pipeline Performance

### Question 1: Flipp Request Queue Concurrency
What concurrency model should we apply to Flipp item-detail requests in FlippRequestQueue?

| Option | Description | Selected |
|--------|-------------|----------|
| Bounded concurrency pool (4-5 concurrent workers, 100-200ms pacing) | Reduces per-flyer fetch from 100s to ~15-20s, completing typical postal code ingestion in under 2 minutes while maintaining respectful non-burst traffic. | ✓ |
| Conservative concurrency (2-3 workers, 250ms pacing) | Cuts execution time to ~4-5 minutes with minimal footprint. | |
| Dynamic concurrency with backoff | Run up to 5 concurrent workers, immediately throttled down to 1 if Flipp returns 429/503 responses. | |

**User's choice:** Bounded concurrency pool (4-5 concurrent workers, 100-200ms pacing).
**Notes:** Eliminates the 15+ minute stall and meets the <2 minute milestone target without abusive traffic.

### Question 2: Ingestion Persistence Staging
How should flyer item ingestion be staged and persisted to Postgres?

| Option | Description | Selected |
|--------|-------------|----------|
| Atomic per-flyer batch with concurrent item resolution | Resolve all flyer items using the concurrency pool, then perform a single atomic DB upsert per flyer (preserves all-or-nothing consistency per flyer so half-fetched flyers are never stored). | ✓ |
| Two-pass staged ingestion (roster first, details second) | Immediately save basic roster items so search/flyer screens show results in seconds, then backfill rich details and calculated discounts. | |
| Streaming chunk upserts (every 25-50 items) | Upsert items into DB as workers complete them, keeping transactions smaller. | |

**User's choice:** Atomic per-flyer batch with concurrent item resolution.
**Notes:** Preserves database integrity and clean rollback/retry semantics if upstream connectivity drops.

### Question 3: Item Detail In-Memory Caching
Should individual item detail responses (`/flipp/items/{id}`) be cached in-memory across flyer runs?

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory LRU item-detail cache (e.g. 6-hour TTL, ~2,000 items) | Skips redundant network calls if nearby postal codes or overlapping runs reference the same flyer items, while keeping memory under ~10MB. | ✓ |
| No item cache (fetch per flyer run) | Rely entirely on Postgres upsert on conflict without memory caching of raw item payloads. | |
| You decide | Implement bounded memory caching where it prevents repeat fetches. | |

**User's choice:** In-memory LRU item-detail cache (e.g. 6-hour TTL, ~2,000 items).
**Notes:** Prevents duplicate network requests across multiple household accounts in the same area.

### Question 4: Client Polling Cadence
How should the PWA deals client poll and communicate status while a background postal code refresh is active?

| Option | Description | Selected |
|--------|-------------|----------|
| Adaptive 4-5s polling with 3-minute window | Poll every 4-5 seconds while refreshing: true with a 3-minute maximum ceiling, displaying a clear freshness sync indicator and automatically rendering deals as soon as flyers are stored. | ✓ |
| Fixed 10s polling with manual refresh button | Check every 10 seconds, leaving manual retry to the user on timeout. | |
| You decide | Align client polling cadence to the accelerated 1-2 minute service response time. | |

**User's choice:** Adaptive 4-5s polling with 3-minute window.
**Notes:** Keeps client responsiveness snappy and synchronized with the accelerated backend ingestion rate.

---

## Builder's Discretion

- DealCard visual refinement: Placing the discount badge inline next to the strikethrough original price if it improves visual scanning.
- Clean presentation for deals with unknown regular prices (no strikethrough, no fake discounts).

## Deferred Ideas

None — discussion stayed within phase scope.

