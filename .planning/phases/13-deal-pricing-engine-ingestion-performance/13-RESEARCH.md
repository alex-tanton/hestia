# Phase 13: Deal Pricing Engine & Ingestion Performance - Research

**Researched:** 2026-11-09  
**Domain:** Grocery Deals Pricing Engine Math, Concurrency Queue, Rate Discipline & PWA Deal Card UI  
**Confidence:** HIGH  

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Sale Story Pricing Math
- **D-01:** Per-unit mathematical derivation for bundle savings — Distribute bundle savings across bundle quantity (e.g., "2/$6.00 with $1.50 off on 2" -> unitPrice = $3.00, originalPrice = $3.75, discount = 20%). Preserve original bundle story in `displayPrice`. — **Reversibility:** costly — touches price parser chain in `apps/service/src/deals/price/parsers.ts` and downstream card display.
- **D-02:** Derive effective unit price with quantity badges for "Buy N Get M" and "Must Buy N" — Replace outright skips (`skip('buy_n_get_m')`, `skip('minimum_quantity')`) with mathematical derivation of effective unit price (e.g., "Buy 2 Get 1 Free" at $3.00 -> $2.00/ea effective unit price, $3.00 original price, 33% off) and attach a "Must buy 3" / promo badge so deals are displayed accurately without being dropped. — **Reversibility:** costly — modifies price parser outcomes and conditional badge mappings.
- **D-03:** Half-up cent rounding with rounded discount percent — Round calculated unit prices and original prices to integer cents using standard half-up (`Math.round`, consistent with `divideCents`), and compute `discountPercent` as `Math.round((original - unit) / original * 100)` clamped to 1-99%. — **Reversibility:** reversible — pure arithmetic logic within money/price utilities.
- **D-04:** Liberal 1%-95% discount validation threshold — Allow calculated discounts up to 95% off to accommodate genuine grocery clearance and liquidation specials, while rejecting invalid bounds where `originalPrice <= unitPrice` or `originalPrice >= 10 * unitPrice` (preventing OCR/case-pricing errors). — **Reversibility:** reversible — threshold check in price parsing sanity filter.

#### Ingestion Concurrency & Pipeline Performance
- **D-05:** Bounded concurrency pool (4-5 concurrent workers, 100-200ms pacing) — Upgrade `FlippRequestQueue` from strictly serialized 1-by-1 (500ms delay) to a bounded concurrency pool with 4-5 concurrent workers and 100-200ms pacing. Reduces per-flyer fetch from 100s to ~15-20s, allowing an 8-flyer postal code ingestion to finish in under 2 minutes while maintaining respectful, non-burst traffic against Flipp endpoints. — **Reversibility:** costly — modifies central HTTP request queue and concurrency semantics in `apps/service/src/deals/flipp/request-queue.ts`.
- **D-06:** Atomic per-flyer persistence with concurrent item resolution — Resolve all items in a flyer concurrently via the worker pool, then execute a single atomic Postgres batch upsert (`upsertDeals`) per flyer. Keeps the all-or-nothing consistency model so partially-fetched flyers are never persisted. — **Reversibility:** reversible — execution structure in `listFlyerItems` / `refreshPostalCode`.
- **D-07:** In-memory LRU item-detail cache (6-hour TTL, ~2,000 items) — Cache individual `/flipp/items/{id}` responses in memory with a 6-hour TTL and bounded LRU capacity (~2,000 items, <10MB footprint). Avoids duplicate network calls when multiple households or neighboring postal codes share flyers, or during retried runs. — **Reversibility:** reversible — in-memory cache wrapper in service deal source.
- **D-08:** Adaptive 4-5s client polling with 3-minute ceiling — Update deals client polling in PWA (`apps/web/src/lib/api/deals.ts` and `DealFreshness.tsx`) to poll every 4-5 seconds while `refreshing: true` (with a 3-minute maximum timeout), displaying a clear freshness sync indicator and automatically updating the screen as soon as flyers are stored. — **Reversibility:** reversible — client polling interval configuration.

### the agent's Discretion
- DealCard layout refinement: Builder may position the discount badge inline next to the strikethrough original price in `DealCard.tsx` if it improves visual hierarchy, or retain it in the lower badge row alongside conditional qualifiers.
- Incomplete regular price fallback: When regular price is not provided and cannot be derived from sale stories, display clean unit price with no strikethrough or discount badge.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEAL-01 | Deal cards display sale price as primary, discount percent-off badge (e.g. "-25%"), and strikethrough original/regular price as secondary. | Visual layout patterns in `DealCard.tsx`, formatting helpers in `apps/web/src/screens/deals/deal-copy.ts`, and fallback rendering when original price is missing. |
| DEAL-02 | Deal pricing engine parses complex flyer sale stories and pre/post price text (e.g., "save at least 98¢ on 2", "$1.50 off", "2/$6.00") to mathematically derive unit prices, original prices, and percent-off when not directly provided. | Mathematical derivation rules in `apps/service/src/deals/price/parsers.ts`, integer cent arithmetic in `apps/service/src/deals/money.ts`, and validation sanity guards in `parse-price.ts`. |
| DEAL-03 | Deal ingestion pipeline optimizes flyer processing (batching/concurrency and roster caching) to eliminate 15+ minute stalls for new accounts and active postal codes. | Bounded worker pool (4-5 workers, 100-200ms pacing) in `request-queue.ts`, concurrent item resolution and in-memory LRU cache (~2,000 items, 6-hr TTL) in `flipp-deal-source.ts`, and adaptive 4-5s polling in `use-refresh-poll.ts`. |
</phase_requirements>

## Summary

Phase 13 resolves the two primary pain points in Hestia's deals experience: (1) cryptic or missing pricing information resulting from unparsed flyer marketing stories, and (2) severe 15+ minute background deal ingestion stalls that trigger client polling timeouts.

Currently, `apps/service/src/deals/price/parsers.ts` outright drops valid deals featuring multi-item terms ("Buy 2 Get 1 Free", "Must buy 2", "Save $1.50 on 2") by returning `skip('buy_n_get_m')` or `skip('minimum_quantity')`. Furthermore, when deals do carry a discount, `apps/service/src/deals/money.ts` uses `Math.floor` instead of standard half-up rounding, leading to discrepancies (e.g., 49% instead of 50%). On the ingestion side, `apps/service/src/deals/flipp/request-queue.ts` enforces a strict 1-by-1 sequential chain with a 500ms delay per request (`MIN_GAP_MS = 500`). For an 8-flyer postal code containing 1,000+ items, this takes 13–15 minutes, causing the PWA client's exponential-backoff polling (`use-refresh-poll.ts`) to hit `MAX_ATTEMPTS = 10` and give up after 3 minutes.

The phase upgrades the pipeline across three coordinated tiers:
1. **Mathematical Pricing Engine**: Upgrades `parsers.ts`, `parse-price.ts`, and `money.ts` to derive effective unit prices, calculate implied original prices, clamp discounts between 1% and 95%, and attach promotional quantity badges ("Must buy 2", "Buy 2 get 1") without dropping deals.
2. **High-Throughput Rate-Disciplined Queue & Ingestion**: Refactors `FlippRequestQueue` into a bounded concurrency pool (4–5 concurrent workers with 100–200ms pacing), implements concurrent item resolution with an in-memory LRU item-detail cache (6-hour TTL, ~2,000 items) in `FlippDealSource`, keeping per-flyer Postgres batch upserts (`upsertDeals`) strictly atomic.
3. **PWA UI Polish & Adaptive Polling**: Enhances `DealCard.tsx` to prominently display primary unit sale price, strikethrough original price, and a `-X%` discount badge inline, while updating `use-refresh-poll.ts` to poll every 4–5 seconds with a 3-minute ceiling.

**Primary recommendation:** Implement the bounded worker pool and LRU cache using pure TypeScript and native primitives (avoiding third-party package dependencies), refine `parseMultiBuy`, `parseBuyNGetM`, and `parseMinimumQuantity` to compute exact half-up integer cents, and verify the entire pipeline with unit and component tests before end-of-phase integration.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Complex Sale Story Parsing | API / Backend (`@hestia/service`) | — | Pricing math and normalization must be canonical and deterministic before database persistence. |
| Ingestion Concurrency & Rate Discipline | API / Backend (`@hestia/service`) | Database (`Postgres`) | Worker pool and circuit breaker manage upstream Flipp API traffic; atomic batch upserts preserve flyer integrity. |
| Item Detail LRU Caching | API / Backend (`@hestia/service`) | — | Eliminates redundant network calls across overlapping households and retry loops without database bloat. |
| Deal Card Price & Badge Presentation | Browser / Client (`@hestia/web`) | — | Formats integer cents into currency strings, displays strikethrough and badges, and manages screen reader announcements. |
| Deal Sync Polling & Status Indicator | Browser / Client (`@hestia/web`) | — | React Query polling hook (`useRefreshPoll`) detects `refreshing: true` state and keeps freshness banners updated. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | `>=24 <25` [VERIFIED: package.json:7] | Runtime environment | Project standard engine specification |
| TypeScript | `6.0.3` [VERIFIED: package.json:44] | Type safety and schema compilation | Workspace standard compiler |
| Fastify | `5.12.6` [VERIFIED: apps/service/package.json:27] | HTTP service framework | Core backend server framework |
| Kysely | `0.29.6` [VERIFIED: apps/service/package.json:28] | Type-safe SQL query builder | Postgres interface for `upsertDeals` and transactions |
| React | `19.3.0` [VERIFIED: apps/web/package.json:25] | Frontend UI framework | Workspace PWA component runtime |
| @tanstack/react-query | `5.103.1` [VERIFIED: apps/web/package.json:20] | Client data fetching & polling | Manages deals queries, cache keys, and refresh invalidation |
| Vitest | `5.0.1` [VERIFIED: package.json:46] | Unit and component testing framework | Project-wide test runner |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @hestia/shared | workspace:* [VERIFIED: apps/service/package.json:25] | Shared Zod schemas & types | Data contracts crossing API boundary (`Deal`, `Freshness`) |
| Lucide React | `1.47.0` [VERIFIED: apps/web/package.json:23] | UI icons (`Clock`, `RefreshCw`, `RotateCw`) | Freshness banner and button iconography |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `Map`-based LRU Cache | `lru-cache` npm package | Adding an npm package introduces unnecessary external supply chain risk; a native `Map`-based LRU cache with eviction on `map.size > maxSize` is under 40 lines of pure TypeScript. |
| Native Promise Bounded Queue | `p-limit` / `bottleneck` | Hand-rolling within `FlippRequestQueue` preserves existing circuit breaker, logging, and User-Agent semantics without introducing new dependencies. |

**Installation:**
No new dependencies are required for this phase. All changes build upon existing verified libraries.

## Package Legitimacy Audit

> **Required** whenever this phase installs external packages.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| None | N/A | N/A | N/A | N/A | [OK] | Approved (Zero new packages installed) |

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none  

## Architecture Patterns

### System Architecture Diagram

```
[ Flipp Endpoints ]
  - /flipp/flyers
  - /flipp/flyers/{id} (roster)
  - /flipp/items/{id} (details)
         ▲
         │ (HTTP GET with User-Agent)
         ▼
[ FlippRequestQueue ]
  - 4-5 Concurrent Workers
  - 100-200ms Pacing (Token/Gap)
  - Circuit Breaker (5 failures -> 30m open)
         ▲
         │
         ▼
[ FlippDealSource ]
  - In-Memory LRU Cache (6-hr TTL, ~2,000 items)
  - listFlyerItems: Concurrent item resolution (Promise.all)
         │
         ▼
[ Pricing Engine: parsePrice & parsers.ts ]
  - Multi-Buy: Derive bundle savings (2/$6 -> $3 ea, was $3.75)
  - Buy N Get M: Derive effective unit price (B2G1 -> $2 ea, was $3)
  - Min Qty: Derive unit price + attach "Must buy N" promo
  - Money: Half-up rounding, clamp discount 1%-95%
         │
         ▼
[ Storage: upsertDeals ]
  - Single atomic Postgres batch upsert per flyer
         │
         ▼
[ Fastify REST API (/api/households/:id/flyers, /items) ]
         │ (JSON: unitPrice, originalPrice, discountPercent, displayPrice)
         ▼
[ PWA React Client (TanStack Query) ]
  - useRefreshPoll: 4-5s polling, 3m max ceiling
  - DealCard: Primary unit price, inline -X% badge, strikethrough original
```

### Recommended In-Repo Structure

```
apps/service/src/deals/
├── flipp/
│   ├── flipp-deal-source.ts     # Concurrent item resolution & LRU detail cache
│   ├── flipp-deal-source.test.ts
│   ├── request-queue.ts         # Bounded concurrency pool (4-5 workers, 100-200ms)
│   └── request-queue.test.ts
├── price/
│   ├── parse-price.ts           # Chain coordinator & sanity guards (1%-95%)
│   ├── parse-price.test.ts
│   ├── parsers.ts               # Derived pricing: BOGO, Buy N Get M, Multi-buy, Min Qty
│   └── price-copy.ts            # Text normalization & display price formatting
└── money.ts                     # Cent math, divideCents, half-up discountPercent

apps/web/src/
├── screens/deals/
│   ├── DealCard.tsx             # Primary sale price, inline discount badge, strikethrough
│   ├── deal-card.test.tsx
│   ├── deal-copy.ts             # Spoken sentence and badge label formatting
│   ├── DealFreshness.tsx        # Freshness banner and sync indicators
│   ├── use-refresh-poll.ts      # 4-5s adaptive polling with 3m ceiling
│   └── use-refresh-poll.test.ts
```

### Pattern 1: Bounded Concurrency Worker Pool with Rate Pacing
**What:** Manage HTTP requests through an internal task queue processed by up to `N` concurrent workers (e.g. 4–5), where each task start respects a minimum pacing interval (`minGapMs = 100–200ms`).  
**When to use:** Whenever issuing high volumes of requests to external third-party APIs that have rate limits or performance degradation under burst traffic.  
**Example:**
```typescript
export interface RequestQueueOptions {
  get: HttpGet;
  userAgent: string;
  concurrency?: number; // default 4
  minGapMs?: number;    // default 150
  // ...
}
```

### Pattern 2: Bounded In-Memory LRU Cache with Expiration
**What:** Standard JavaScript `Map` where insertion order tracks recency. Accessing an existing item re-inserts it at the end; adding to a full cache deletes the oldest entry (`map.keys().next().value`).  
**When to use:** In-process caching of immutable or slow-changing external resource responses (`/flipp/items/{id}`) across multiple concurrent or sequential workflows.

### Pattern 3: Derived Bundle Arithmetic
**What:** Transforming bundle offers and marketing story strings into exact per-unit pricing.  
**Example:**
- Given: `currentPrice = 600` ($6.00 for 2) and story `"save $1.50 on 2"`:
  - `bundleSavings = 150`
  - `originalTotal = 600 + 150 = 750`
  - `unitPrice = divideCents(600, 2) = 300` ($3.00)
  - `originalPrice = divideCents(750, 2) = 375` ($3.75)
  - `discountPercent = Math.round(((375 - 300) / 375) * 100) = 20%`
  - `displayPrice = "2/$6.00"`

### Anti-Patterns to Avoid
- **Unbounded `Promise.all` on HTTP calls:** Never fire hundreds of fetch requests simultaneously without a concurrency gate. Flipp will drop connections or return 429/503.
- **Float-based currency calculations:** Never calculate prices in floats (e.g. `3.99 * 100`). Always operate strictly on integer cents (`toCents`, `divideCents`, integer addition/subtraction).
- **Dropping deals because of complex wording:** Do not call `skip('buy_n_get_m')` or `skip('minimum_quantity')` when a base price or bundle price is present; derive the unit price and display the qualifier.
- **Partial flyer persistence:** Never write deals from an incomplete flyer. If an ingestion call aborts or the circuit breaker trips, throw so the transaction rolls back or the flyer is omitted, allowing a complete retry on the next run.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Currency & Cent Division | Custom float calculations | `divideCents` in `apps/service/src/deals/money.ts` | Float math (`0.1 + 0.2`) introduces rounding drift; `divideCents` uses half-up integer cent division. |
| Text Case & Whitespace Normalization | Custom regex pipelines in each parser | `buildCopy` in `apps/service/src/deals/price/price-copy.ts` | Centralizes number-word conversion ("one" -> 1) and whitespace collapsing. |
| Client Polling Orchestration | Manual `setInterval` loops in components | `useRefreshPoll` hook with `useEffect` and `setTimeout` | Prevents memory leaks, integrates cleanly with React unmounting, and stops polling when offline. |

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `deal` table rows in Postgres | None — Newly parsed deals populate `original_price` and `discount_percent` within the existing schema. No schema migration required. |
| Live service config | None | None — Verified by inspection of backend services. |
| OS-registered state | None | None — Verified by inspection of service setup. |
| Secrets/env vars | None | None — Existing `HESTIA_ORIGIN` and database URLs remain unchanged. |
| Build artifacts | None | None — Normal Vite and TSUP rebuilds. |

## Common Pitfalls

### Pitfall 1: Breaking Circuit Breaker Semantics with Concurrency
**What goes wrong:** In a multi-worker queue, if multiple requests fail at the same time, the failure counter could increment incorrectly or race, opening the breaker prematurely or late.  
**Why it happens:** Sharing mutable failure counters across asynchronous workers without synchronized state checks.  
**How to avoid:** Ensure `consecutiveFailures` is updated synchronously when each request settles, and check `this.isOpen` immediately before dispatching any request.

### Pitfall 2: Flawed Cent Rounding on Discounts
**What goes wrong:** A $9.49 BOGO item displays "49% off" instead of "50% off".  
**Why it happens:** Halving an odd cent amount ($9.49 -> $4.75 unit price). Using `Math.floor(((949 - 475) / 949) * 100)` yields `49.94%`, which floors to 49%.  
**How to avoid:** Use `Math.round` for `discountPercent` per D-03, and allow explicit `discountPercent` overrides on fixed promotions like BOGO (50%).

### Pitfall 3: Polling Hook Restarting on Every Render
**What goes wrong:** Client poll timer resets continually, never executing the refetch.  
**Why it happens:** Passing an unstable inline arrow function for `refetch` into `useEffect([refetch])`.  
**How to avoid:** TanStack Query's `refetch` must be stabilized or wrapped in `useCallback` (as already implemented in `FlyersScreen.tsx` and `DealResults.tsx`), and the polling effect must depend on `[isActive, attempt, refetch]`.

## In-Repo Values Verification & Line Range Citations

All discrete in-repo values below were verified by opening and reading the source files this session:

1. **Price Parsers Skip Reasons**  
   [VERIFIED: `apps/service/src/deals/price/parsers.ts:13-24`]  
   ```typescript
   export type SkipReason =
     | 'no_price'
     | 'unparseable'
     | 'rebate'
     | 'bogo_no_base'
     | 'buy_n_get_m'
     | 'minimum_quantity'
     | 'mix_and_match'
     | 'percent_off_no_base'
     | 'amount_off_no_original'
     | 'detail_unavailable';
   ```

2. **Price Units & Conditional Reasons**  
   [VERIFIED: `apps/service/src/deals/price/price-copy.ts:22-23`]  
   ```typescript
   export type PriceUnit = 'each' | 'lb' | 'oz';
   export type ConditionalReason = 'coupon' | 'loyalty_card';
   ```

3. **Shared Deal Schema Shape**  
   [VERIFIED: `packages/shared/src/api/deals.ts:24-30`]  
   ```typescript
     unitPrice: centsSchema,
     priceUnit: priceUnitSchema,
     originalPrice: centsSchema.nullable(),
     discountPercent: z.int().min(0).max(100).nullable(),
     displayPrice: z.string(),
     conditionalPrice: z.boolean(),
     conditionalReason: conditionalReasonSchema.nullable(),
   ```

4. **Default Request Queue Timing Constants**  
   [VERIFIED: `apps/service/src/deals/flipp/request-queue.ts:10-14`]  
   ```typescript
   export const MIN_GAP_MS = 500;
   const DEFAULT_ATTEMPTS = 3;
   const DEFAULT_BACKOFF_MS = 1_000;
   const DEFAULT_FAILURE_THRESHOLD = 5;
   const DEFAULT_OPEN_MS = 30 * 60 * 1_000;
   ```

5. **Discount Percent Calculation**  
   [VERIFIED: `apps/service/src/deals/money.ts:30-33`]  
   ```typescript
   export function discountPercent(unitPrice: number, originalPrice: number | null): number | null {
     if (originalPrice === null || originalPrice <= unitPrice) return null;
     return Math.floor(((originalPrice - unitPrice) / originalPrice) * 100);
   }
   ```

6. **Current Polling Timing Constants**  
   [VERIFIED: `apps/web/src/screens/deals/use-refresh-poll.ts:13-19`]  
   ```typescript
   export const FIRST_DELAY_MS = 3000;
   export const MAX_DELAY_MS = 60_000;
   export const MAX_ATTEMPTS = 10;

   export function refreshDelayMs(attempt: number): number {
     return Math.min(FIRST_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
   }
   ```

7. **DealCard Price Display Cluster**  
   [VERIFIED: `apps/web/src/screens/deals/DealCard.tsx:44-52`]  
   ```tsx
             <p aria-hidden className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
               <span className="text-h3 tabular-nums text-section">{unitPrice}</span>
               {deal.originalPrice !== null && (
                 <span className="text-body-sm tabular-nums text-muted line-through">
                   {formatUnitPrice(deal.originalPrice, deal.priceUnit)}
                 </span>
               )}
               {hasDisplayPrice && <span className="text-body-sm text-secondary">{displayPrice}</span>}
             </p>
   ```

8. **DealCard Discount Badge Rendering**  
   [VERIFIED: `apps/web/src/screens/deals/DealCard.tsx:57-59`]  
   ```tsx
           {deal.discountPercent !== null && (
             <Badge variant="section">{discountLabel(deal.discountPercent)}</Badge>
           )}
   ```

## Code Examples

### 1. Mathematical Parsing of Bundle Savings and Buy-N-Get-M
```typescript
// Source: Derived from apps/service/src/deals/price/parsers.ts and D-01/D-02
export function deriveBundleSavings(
  totalCents: number,
  count: number,
  savingsCents: number,
): { unitPrice: number; originalPrice: number; discountPercent: number } {
  const originalTotal = totalCents + savingsCents;
  const unitPrice = divideCents(totalCents, count);
  const originalPrice = divideCents(originalTotal, count);
  const discount = Math.round(((originalPrice - unitPrice) / originalPrice) * 100);
  return {
    unitPrice,
    originalPrice,
    discountPercent: Math.min(Math.max(discount, 1), 95),
  };
}
```

### 2. In-Memory LRU Item Cache
```typescript
// Source: apps/service/src/deals/flipp/flipp-deal-source.ts pattern
export class ItemDetailLruCache {
  private readonly maxItems = 2000;
  private readonly ttlMs = 6 * 60 * 60 * 1000; // 6 hours
  private readonly cache = new Map<string, { data: Record<string, unknown>; expiresAt: number }>();

  get(id: string): Record<string, unknown> | null {
    const entry = this.cache.get(id);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(id);
      return null;
    }
    // Re-insert to mark most recently used
    this.cache.delete(id);
    this.cache.set(id, entry);
    return entry.data;
  }

  set(id: string, data: Record<string, unknown>): void {
    if (this.cache.has(id)) this.cache.delete(id);
    else if (this.cache.size >= this.maxItems) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(id, { data, expiresAt: Date.now() + this.ttlMs });
  }
}
```

### 3. DealCard Refined Layout with Inline Badge
```tsx
// Source: Refinement of apps/web/src/screens/deals/DealCard.tsx
<p aria-hidden className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
  <span className="text-h3 tabular-nums text-section">{unitPrice}</span>
  {deal.discountPercent !== null && (
    <Badge variant="section">-{deal.discountPercent}%</Badge>
  )}
  {deal.originalPrice !== null && (
    <span className="text-body-sm tabular-nums text-muted line-through">
      {formatUnitPrice(deal.originalPrice, deal.priceUnit)}
    </span>
  )}
  {hasDisplayPrice && <span className="text-body-sm text-secondary">{displayPrice}</span>}
</p>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Strictly serialized queue (1 req at a time, 500ms delay) | Bounded concurrency worker pool (4–5 workers, 100–200ms pacing) | Phase 13 | Reduces postal code flyer ingestion time from 15+ minutes down to <2 minutes. |
| Outright skipping Buy-N-Get-M and Min-Qty deals | Mathematical derivation of effective unit price & quantity badges | Phase 13 | Eliminates missing deal cards and captures high-value volume promotions. |
| Exponential backoff polling up to 60s (giving up after 10 attempts) | Adaptive 4–5s client polling with 3-minute ceiling | Phase 13 | Responsive UI updates as deals finish syncing, eliminating premature timeouts. |
| Math.floor discount percentage | Math.round half-up discount percentage (1%-95%) | Phase 13 | Aligns visible discount badges with intuitive consumer arithmetic (e.g. 50% vs 49%). |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Flipp API endpoints remain stable at 4–5 concurrent requests with 100–200ms pacing without triggering HTTP 429. | Ingestion Concurrency | If Flipp applies stricter per-IP rate limits in certain regions, pacing can be dialed up to 250ms via `minGapMs` option. |

## Open Questions

1. **Quantity Badge Granularity**: When displaying "Must buy 3", should it replace the conditional badge or sit beside it?
   - What we know: `DealCard.tsx` has a flexible badge row that accepts multiple badges (`variant="warning"`, `variant="section"`).
   - Recommendation: Render the quantity qualifier as an additional `variant="warning"` badge in the badge row or inline in `displayPrice`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Service runtime & build | ✓ | 24.x | — |
| pnpm | Package management | ✓ | 10.34.5 | — |
| Postgres / Kysely | Deal storage | ✓ | 15+ | — |
| Vitest | Test runner | ✓ | 5.0.1 | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.1 [VERIFIED: package.json:46] |
| Config file | `apps/service/vitest.config.ts`, `apps/web/vite.config.ts` |
| Quick run command | `pnpm --filter @hestia/service test && pnpm --filter @hestia/web test` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEAL-01 | Deal card displays sale price primary, inline/prominent discount badge, and strikethrough original price | component | `pnpm --filter @hestia/web test apps/web/src/screens/deals/deal-card.test.tsx` | ✅ (needs updated assertions for inline badge) |
| DEAL-02 | Pricing engine derives unit price, original price, and discount % from complex flyer stories | unit | `pnpm --filter @hestia/service test apps/service/src/deals/price/parse-price.test.ts` | ✅ (needs new test cases for bundle math & Buy-N-Get-M) |
| DEAL-03 | Bounded queue executes with controlled concurrency; item detail LRU cache prevents duplicate fetches; client poll runs at 4-5s interval | unit | `pnpm --filter @hestia/service test apps/service/src/deals/flipp/request-queue.test.ts apps/service/src/deals/flipp/flipp-deal-source.test.ts` and `pnpm --filter @hestia/web test apps/web/src/screens/deals/use-refresh-poll.test.ts` | ✅ (needs updates for concurrency pool & polling intervals) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @hestia/service test && pnpm --filter @hestia/web test`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full test suite green before `/gsd-verify-work`

### Wave 0 Gaps
- None — Existing Vitest test suites exist in both `apps/service` and `apps/web`. Tests will be updated and extended alongside implementation.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Sanity thresholds on derived prices (reject `originalPrice <= unitPrice` or `originalPrice >= 10 * unitPrice`; clamp discount to 1%–95%). Integer cents prevent float injection. |
| Denial of Service / Rate Limiting | yes | Bounded concurrency pool (4–5 workers) and circuit breaker (5 failures -> 30-min open) protect upstream Flipp API from traffic spikes. |

### Known Threat Patterns for Deal Pricing & Ingestion

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Upstream Rate Limit Exhaustion | Denial of Service | Controlled concurrency pool (4–5 workers, 100–200ms gap) and 6-hour LRU cache. |
| Price Distortion / OCR Anomalies | Tampering / Integrity | Sanity filter `withoutImplausibleOriginal` drops case prices (>= 10x) and invalid discounts (> 95%). |
| Client Polling Storm | Denial of Service | 4–5s client polling with 3-minute hard ceiling and exponential backoff on server 503. |

## Sources

### Primary (HIGH confidence)
- `apps/service/src/deals/price/parsers.ts` — Price parser definitions and skip rules
- `apps/service/src/deals/price/parse-price.ts` — Parser chain coordinator and validity guards
- `apps/service/src/deals/flipp/request-queue.ts` — Rate discipline queue, concurrency management, and circuit breaker
- `apps/service/src/deals/flipp/flipp-deal-source.ts` — Flipp API wrapper and flyer/item listing
- `apps/web/src/screens/deals/DealCard.tsx` — Deal card component layout
- `apps/web/src/screens/deals/use-refresh-poll.ts` — Client-side deals sync polling logic

### Secondary (MEDIUM confidence)
- `.planning/phases/13-deal-pricing-engine-ingestion-performance/13-CONTEXT.md` — User decisions and architectural direction
- `.planning/research/PITFALLS.md` — Documented pitfalls on sequential HTTP deal loops

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Verified directly against root and package `package.json` files.
- Architecture: HIGH — Verified against live codebase components and existing data flow.
- Pitfalls: HIGH — Grounded in existing rate-limit implementations and documented project pitfalls.

**Research date:** 2026-11-09  
**Valid until:** 2026-12-09 (stable codebase architecture)

