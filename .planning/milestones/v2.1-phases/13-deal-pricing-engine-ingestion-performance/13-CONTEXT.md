# Phase 13: Deal Pricing Engine & Ingestion Performance - Context

**Gathered:** 2026-11-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Display prominent primary sale prices, savings percentage badges (e.g. "-25%"), and secondary strikethrough original prices by deriving pricing math from complex flyer sale stories and pre/post price text. Accelerate the deal ingestion pipeline from 15+ minutes down to under 2 minutes for active postal codes through bounded concurrency and in-memory caching without risking upstream rate limiting.

</domain>

<decisions>
## Implementation Decisions

### Sale Story Pricing Math
- **D-01:** Per-unit mathematical derivation for bundle savings — Distribute bundle savings across bundle quantity (e.g., "2/$6.00 with $1.50 off on 2" -> unitPrice = $3.00, originalPrice = $3.75, discount = 20%). Preserve original bundle story in `displayPrice`. — **Reversibility:** costly — touches price parser chain in `apps/service/src/deals/price/parsers.ts` and downstream card display.
- **D-02:** Derive effective unit price with quantity badges for "Buy N Get M" and "Must Buy N" — Replace outright skips (`skip('buy_n_get_m')`, `skip('minimum_quantity')`) with mathematical derivation of effective unit price (e.g., "Buy 2 Get 1 Free" at $3.00 -> $2.00/ea effective unit price, $3.00 original price, 33% off) and attach a "Must buy 3" / promo badge so deals are displayed accurately without being dropped. — **Reversibility:** costly — modifies price parser outcomes and conditional badge mappings.
- **D-03:** Half-up cent rounding with rounded discount percent — Round calculated unit prices and original prices to integer cents using standard half-up (`Math.round`, consistent with `divideCents`), and compute `discountPercent` as `Math.round((original - unit) / original * 100)` clamped to 1-99%. — **Reversibility:** reversible — pure arithmetic logic within money/price utilities.
- **D-04:** Liberal 1%-95% discount validation threshold — Allow calculated discounts up to 95% off to accommodate genuine grocery clearance and liquidation specials, while rejecting invalid bounds where `originalPrice <= unitPrice` or `originalPrice >= 10 * unitPrice` (preventing OCR/case-pricing errors). — **Reversibility:** reversible — threshold check in price parsing sanity filter.

### Ingestion Concurrency & Pipeline Performance
- **D-05:** Bounded concurrency pool (4-5 concurrent workers, 100-200ms pacing) — Upgrade `FlippRequestQueue` from strictly serialized 1-by-1 (500ms delay) to a bounded concurrency pool with 4-5 concurrent workers and 100-200ms pacing. Reduces per-flyer fetch from 100s to ~15-20s, allowing an 8-flyer postal code ingestion to finish in under 2 minutes while maintaining respectful, non-burst traffic against Flipp endpoints. — **Reversibility:** costly — modifies central HTTP request queue and concurrency semantics in `apps/service/src/deals/flipp/request-queue.ts`.
- **D-06:** Atomic per-flyer persistence with concurrent item resolution — Resolve all items in a flyer concurrently via the worker pool, then execute a single atomic Postgres batch upsert (`upsertDeals`) per flyer. Keeps the all-or-nothing consistency model so partially-fetched flyers are never persisted. — **Reversibility:** reversible — execution structure in `listFlyerItems` / `refreshPostalCode`.
- **D-07:** In-memory LRU item-detail cache (6-hour TTL, ~2,000 items) — Cache individual `/flipp/items/{id}` responses in memory with a 6-hour TTL and bounded LRU capacity (~2,000 items, <10MB footprint). Avoids duplicate network calls when multiple households or neighboring postal codes share flyers, or during retried runs. — **Reversibility:** reversible — in-memory cache wrapper in service deal source.
- **D-08:** Adaptive 4-5s client polling with 3-minute ceiling — Update deals client polling in PWA (`apps/web/src/lib/api/deals.ts` and `DealFreshness.tsx`) to poll every 4-5 seconds while `refreshing: true` (with a 3-minute maximum timeout), displaying a clear freshness sync indicator and automatically updating the screen as soon as flyers are stored. — **Reversibility:** reversible — client polling interval configuration.

### Builder's Discretion
- DealCard layout refinement: Builder may position the discount badge inline next to the strikethrough original price in `DealCard.tsx` if it improves visual hierarchy, or retain it in the lower badge row alongside conditional qualifiers.
- Incomplete regular price fallback: When regular price is not provided and cannot be derived from sale stories, display clean unit price with no strikethrough or discount badge.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone & Phase Scope
- `.planning/ROADMAP.md` §Phase 13 — Scope, dependencies, and success criteria for Deal Pricing Engine & Ingestion Performance
- `.planning/REQUIREMENTS.md` §Deal Pricing & Ingestion Performance — Requirements DEAL-01, DEAL-02, DEAL-03
- `.planning/research/PITFALLS.md` §Pitfall 2 — Sequential rate-limited HTTP loops in deal ingestion and client poll timeout

### Pricing Engine & Ingestion Files
- `apps/service/src/deals/flipp/flipp-deal-source.ts` — Flipp wrapper, search, flyer listing, and item detail fetching
- `apps/service/src/deals/flipp/request-queue.ts` — Rate discipline queue, concurrency management, and circuit breaker
- `apps/service/src/deals/price/parse-price.ts` — Price parsing chain executor and validity guards
- `apps/service/src/deals/price/parsers.ts` — Price parser implementations (BOGO, multi-buy, amount off, etc.)
- `apps/service/src/deals/money.ts` — Money and cent division arithmetic helpers
- `apps/service/src/jobs/refresh-deals.ts` — Daily background deals refresh job and flyer planning
- `apps/service/src/services/deals/deals.ts` — Deals service, search, and on-demand refresh triggers
- `apps/service/src/services/deals/storage.ts` — Database upsert and query caching operations

### Web UI & Display Files
- `apps/web/src/screens/deals/DealCard.tsx` — Deal card component with unit price, strikethrough original price, and discount badge
- `apps/web/src/screens/deals/DealFreshness.tsx` — Deal freshness banner and sync indicator
- `apps/web/src/lib/api/deals.ts` — Deal query hooks and polling configuration
- `packages/shared/src/api/deals.ts` — Shared Deal and Freshness Zod schemas

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/service/src/deals/money.ts`: Pure integer-cents arithmetic (`toCents`, `divideCents`, `discountPercent`).
- `apps/service/src/deals/price/price-copy.ts`: Pre-price, post-price, and sale story text normalization helpers (`buildCopy`).
- `apps/web/src/components/ui/Badge.tsx`: Reusable badge component used for discount badges (`variant="section"`) and qualifiers (`variant="warning"`).
- `apps/web/src/lib/money.ts`: Client-side money formatting utilities (`formatUnitPrice`, `formatCents`).

### Established Patterns
- Integer cents representation across the database and API boundary (`centsSchema`).
- Circuit breaker pattern in `request-queue.ts` preventing cascade failures when upstream services are down.
- Accessible pricing representation in `DealCard.tsx`: Price cluster is `aria-hidden` with a comprehensive screen-reader sentence (`dealSentence`) in a hidden paragraph.

### Integration Points
- `apps/service/src/deals/flipp/request-queue.ts`: Queue concurrency refactoring to support bounded worker pool.
- `apps/service/src/deals/price/parsers.ts`: Parser chain updates to convert skips into derived pricing.
- `apps/service/src/deals/flipp/flipp-deal-source.ts`: Item detail in-memory caching and concurrent item resolution.
- `apps/web/src/screens/deals/DealCard.tsx`: Strikethrough original price and discount badge layout.
- `apps/web/src/lib/api/deals.ts`: Polling intervals for active refresh status.

</code_context>

<specifics>
## Specific Ideas

- Derived pricing examples:
  - "Save $1.50 on 2" with "2/$6.00": Unit price $3.00, regular price $3.75, discount 20%, displayPrice "2/$6.00".
  - "Save at least 98¢ on 2" with "2/$6.00": Unit price $3.00, regular price $3.49, discount 14%, displayPrice "2/$6.00".
  - "Buy 2 Get 1 Free" at $3.00 base price: Unit price $2.00, regular price $3.00, discount 33%, with "Must buy 3" / promo tag.
  - "Sale! $1.00 OFF" over was $4.99: Unit price $3.99, regular price $4.99, discount 20%.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-Deal Pricing Engine & Ingestion Performance*
*Context gathered: 2026-11-09*

