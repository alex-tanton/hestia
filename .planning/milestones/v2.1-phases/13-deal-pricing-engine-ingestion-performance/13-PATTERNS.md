# Phase 13: Deal Pricing Engine & Ingestion Performance - Code Patterns

**Phase:** 13 - deal-pricing-engine-ingestion-performance  
**Researched:** 2026-11-09  
**Status:** Approved for planning  

This document specifies the concrete code patterns, architectural analogs, and verbatim code excerpts that downstream planning and implementation agents must follow for Phase 13.

---

## 1. File Classification & Architectural Analogs Map

| Target File | Role | Data Flow | Closest Analog | Purpose / Key Changes |
|-------------|------|-----------|----------------|-----------------------|
| `apps/service/src/deals/price/parsers.ts` | Service / Domain Logic | Request-Response (Pure Functional) | Existing `apps/service/src/deals/price/parsers.ts` (`parseBogo`, `parseMultiBuy`, `parseAmountOff`) | Derive pricing math for bundle savings (D-01), Buy-N-Get-M (D-02), and minimum quantity (D-02) instead of skipping. |
| `apps/service/src/deals/price/parse-price.ts` | Service Coordinator | Request-Response (Validation Pipeline) | Existing `apps/service/src/deals/price/parse-price.ts` (`withoutImplausibleOriginal`, `parsePrice`) | Enforce 1%-95% discount validation threshold, sanity bounds (`originalPrice <= unitPrice`, `originalPrice >= 10 * unitPrice`) (D-04). |
| `apps/service/src/deals/money.ts` | Utility | Request-Response (Pure Numeric Arithmetic) | Existing `apps/service/src/deals/money.ts` (`divideCents`, `discountPercent`) | Switch `discountPercent` calculation to half-up cent rounding (`Math.round`) clamped to 1-95% (D-03). |
| `apps/service/src/deals/flipp/request-queue.ts` | Service / Middleware | Request-Response (Worker Pool & Pacing) | Existing `apps/service/src/deals/flipp/request-queue.ts` (`FlippRequestQueue`, `waitForGap`) | Refactor single-promise tail into a bounded concurrency worker pool (4-5 workers, 100-200ms pacing) with synchronized circuit breaker (D-05). |
| `apps/service/src/deals/flipp/flipp-deal-source.ts` | Service Adapter | Streaming / Async I/O & Caching | Existing `apps/service/src/deals/flipp/flipp-deal-source.ts` (`listFlyerItems`, `activeFlyers`) & `apps/service/src/services/deals/cache.ts` | In-memory LRU item-detail cache (6-hr TTL, ~2,000 items) (D-07); concurrent item resolution in `listFlyerItems` (D-06). |
| `apps/web/src/screens/deals/DealCard.tsx` | Component | Request-Response (Props to DOM) | Existing `apps/web/src/screens/deals/DealCard.tsx` | Refine pricing cluster: primary sale price, inline `-X%` discount badge beside strikethrough original price, clean fallback when regular price missing (DEAL-01, Builder's Discretion). |
| `apps/web/src/screens/deals/use-refresh-poll.ts` | Custom Hook / Controller | Event-Driven (Timer / Reactive Polling) | Existing `apps/web/src/screens/deals/use-refresh-poll.ts` | Replace exponential backoff with adaptive 4-5s client polling with 3-minute hard ceiling (D-08, DEAL-03). |
| `apps/service/src/deals/price/parse-price.test.ts` | Test | Request-Response | Existing `apps/service/src/deals/price/parse-price.test.ts` | Add test cases for bundle savings math, Buy-N-Get-M derivation, minimum quantity pricing, and 1%-95% thresholds. |
| `apps/service/src/deals/flipp/request-queue.test.ts` | Test | Request-Response (Fake Timers) | Existing `apps/service/src/deals/flipp/request-queue.test.ts` | Test worker pool concurrency limit (4-5 concurrent tasks), 100-200ms gap pacing, retry backoff, and circuit breaker trip. |
| `apps/service/src/deals/flipp/flipp-deal-source.test.ts` | Test | Streaming / Async I/O (Mock Transport) | Existing `apps/service/src/deals/flipp/flipp-deal-source.test.ts` | Test item-detail LRU cache hit/eviction/TTL, concurrent item resolution, and atomic flyer abort on breaker trip. |
| `apps/web/src/screens/deals/deal-card.test.tsx` | Test | Component DOM Testing | Existing `apps/web/src/screens/deals/deal-card.test.tsx` | Verify primary sale price, inline discount badge, strikethrough original price, and screen reader announcements. |
| `apps/web/src/screens/deals/refresh-poll.test.ts` | Test | Event-Driven Hook Testing | Existing `apps/web/src/screens/deals/refresh-poll.test.ts` | Test 4-5s polling frequency, 3-minute timeout ceiling, offline pause, and refresh resolution stop. |

---

## 2. Pattern Assignments & Code to Copy From

### 2.1. Price Parsers (`apps/service/src/deals/price/parsers.ts`)

#### Target Role & Data Flow
- **Role:** Domain Logic / Parser Chain / Rule Engine
- **Data Flow:** Pure functional transformation. Receives normalized `Copy` and outputs `ParserOutcome | null`.

#### Decisions Implemented
- **D-01:** Per-unit mathematical derivation for bundle savings ("2/$6.00 with $1.50 off on 2" -> unitPrice $3.00, originalPrice $3.75, discount 20%, displayPrice "2/$6.00").
- **D-02:** Derive effective unit price for "Buy N Get M" and "Must Buy N" instead of returning `skip('buy_n_get_m')` or `skip('minimum_quantity')`.

#### Existing Analog
- `apps/service/src/deals/price/parsers.ts` [lines 1-45, 134-146, 166-203]

#### Concrete Code Excerpts to Copy

```typescript
// Imports & Types Analog: apps/service/src/deals/price/parsers.ts:1-45
import { divideCents } from '../money.js';
import type { Copy, PriceUnit } from './price-copy.js';

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

export interface PriceCore {
  unitPrice: number;
  priceUnit: PriceUnit;
  originalPrice: number | null;
  discountPercent?: number | undefined;
}

export type ParserOutcome = { skip: SkipReason } | PriceCore;
export type PriceParser = (copy: Copy) => ParserOutcome | null;

function skip(reason: SkipReason): { skip: SkipReason } {
  return { skip: reason };
}
```

```typescript
// BOGO & Half-Up Analog: apps/service/src/deals/price/parsers.ts:134-146
export const parseBogo: PriceParser = (copy) => {
  const isBogo = /\bbogo\b|\bb1g1\b/.test(copy.offer) || BUY_1_GET_1_FREE.test(copy.offer);
  if (!isBogo) return null;

  const base = copy.price.currentPrice ?? copy.price.originalPrice;
  if (base === null) return skip('bogo_no_base');
  return {
    unitPrice: divideCents(base, 2),
    priceUnit: 'each',
    originalPrice: base,
    discountPercent: 50,
  };
};
```

```typescript
// Multi-Buy & Bundle Division Analog: apps/service/src/deals/price/parsers.ts:189-203
export const parseMultiBuy: PriceParser = (copy) => {
  const total = copy.price.currentPrice;
  if (total === null) return null;
  const match = /(\d+) ?(?:\/|for\b)/.exec(copy.pre);
  if (match === null) return null;

  const count = Number(match[1]);
  if (!Number.isInteger(count) || count < 2) return null;
  const original = copy.price.originalPrice;
  return {
    unitPrice: divideCents(total, count),
    priceUnit: 'each',
    originalPrice: original === null ? null : divideCents(original, count),
  };
};
```

#### New Pattern Implementation Guidance
1. **Bundle Savings Derivation in `parseMultiBuy` (D-01):**
   - Check if `copy.offer` or `copy.story` specifies bundle savings (e.g. `save \$?(\d+(?:\.\d{1,2})?) on (\d+)` or `save at least (\d+)¢ on (\d+)`).
   - If savings amount is identified and match matches bundle `count`:
     - `savingsCents = Math.round(Number(match[1]) * 100)` (or cents value)
     - `originalTotal = total + savingsCents`
     - `originalPrice = divideCents(originalTotal, count)`
     - `unitPrice = divideCents(total, count)`
     - `discountPercent = Math.round(((originalPrice - unitPrice) / originalPrice) * 100)`
2. **Buy N Get M Derivation in `parseBuyNGetM` (D-02):**
   - Match `BUY (\d+) GET (\d+) FREE` (e.g., BUY 2 GET 1 FREE).
   - If `base = copy.price.currentPrice ?? copy.price.originalPrice` is available:
     - `paidCount = N`, `totalCount = N + M`
     - `totalPaid = paidCount * base`
     - `unitPrice = divideCents(totalPaid, totalCount)`
     - `originalPrice = base`
     - `discountPercent = Math.round(((originalPrice - unitPrice) / originalPrice) * 100)`
   - If base price is absent, return `skip('buy_n_get_m')`.
3. **Minimum Quantity Pricing in `parseMinimumQuantity` (D-02):**
   - Real copy: "MUST BUY 2" over $2.50.
   - If `currentPrice` exists, return `unitPrice = currentPrice`, `originalPrice = copy.price.originalPrice`. Do not skip.

---

### 2.2. Price Sanity & Coordinator (`apps/service/src/deals/price/parse-price.ts`)

#### Target Role & Data Flow
- **Role:** Service Coordinator / Validation Pipeline
- **Data Flow:** Receives raw `PriceCopy`, coordinates parser chain, enforces sanity constraints, produces canonical `PriceResult`.

#### Decisions Implemented
- **D-04:** Liberal 1%-95% discount validation threshold.
- Sanity bounds: reject `originalPrice <= unitPrice` (no saving) and `originalPrice >= 10 * unitPrice` (case pricing OCR mismatch).

#### Existing Analog
- `apps/service/src/deals/price/parse-price.ts` [lines 26-67]

#### Concrete Code Excerpts to Copy

```typescript
// Sanity Guard Analog: apps/service/src/deals/price/parse-price.ts:26-37
export function withoutImplausibleOriginal(core: PriceCore): PriceCore {
  if (core.originalPrice !== null && core.originalPrice >= core.unitPrice * 10) {
    return { ...core, originalPrice: null };
  }
  return core;
}
```

```typescript
// Parser Chain Coordinator Analog: apps/service/src/deals/price/parse-price.ts:43-67
export function parsePrice(price: PriceCopy): PriceResult {
  const copy = buildCopy(price);

  for (const parser of PRICE_PARSERS) {
    const outcome = parser(copy);
    if (outcome === null) continue;
    if ('skip' in outcome) return { skipped: outcome.skip };

    const core = withoutImplausibleOriginal(outcome);
    if (core.unitPrice <= 0) return { skipped: 'unparseable' };
    const reason = detectQualifier(copy);
    return {
      parser: parser.name,
      parsed: {
        unitPrice: core.unitPrice,
        priceUnit: core.priceUnit,
        originalPrice: core.originalPrice,
        discountPercent:
          core.discountPercent ?? discountPercent(core.unitPrice, core.originalPrice),
        displayPrice: formatDisplayPrice(price),
        conditionalPrice: reason !== null,
        conditionalReason: reason,
      },
    };
  }

  return { skipped: price.currentPrice === null ? 'no_price' : 'unparseable' };
}
```

#### New Pattern Implementation Guidance
- Extend `withoutImplausibleOriginal` or sanitize the discount percent:
  - If `core.originalPrice !== null`:
    - If `core.originalPrice <= core.unitPrice`, drop original (`originalPrice: null`).
    - If `core.originalPrice >= core.unitPrice * 10`, drop original (`originalPrice: null`).
    - If calculated discount exceeds 95% (e.g. `(original - unit) / original > 0.95`), treat as implausible OCR error and drop original (`originalPrice: null`).
  - Clamp resulting `discountPercent` to `1` minimum and `95` maximum when non-null.

---

### 2.3. Money Arithmetic & Cent Helpers (`apps/service/src/deals/money.ts`)

#### Target Role & Data Flow
- **Role:** Utility
- **Data Flow:** Pure integer math. No float operations cross module boundary.

#### Decisions Implemented
- **D-03:** Half-up cent rounding with rounded discount percent (`Math.round` instead of `Math.floor`), clamped to 1-95%.

#### Existing Analog
- `apps/service/src/deals/money.ts` [lines 20-33]

#### Concrete Code Excerpts to Copy

```typescript
// Integer Cent Arithmetic Analog: apps/service/src/deals/money.ts:20-33
export function divideCents(cents: number, divisor: number): number {
  if (divisor <= 0) throw new RangeError('divisor must be positive');
  return Math.round(cents / divisor);
}

/**
 * `(original − unit) ÷ original × 100`, rounded half-up. Null when there is no original,
 * or when it does not beat the unit price — a "discount" of 0% or less is noise, not a saving.
 */
export function discountPercent(unitPrice: number, originalPrice: number | null): number | null {
  if (originalPrice === null || originalPrice <= unitPrice) return null;
  const pct = Math.round(((originalPrice - unitPrice) / originalPrice) * 100);
  if (pct < 1 || pct > 95) return null;
  return pct;
}
```

---

### 2.4. Bounded Concurrency Rate-Disciplined Queue (`apps/service/src/deals/flipp/request-queue.ts`)

#### Target Role & Data Flow
- **Role:** Service Middleware / Concurrency Controller
- **Data Flow:** Asynchronous Request-Response worker pool. Queues inbound HTTP requests, regulates dispatch interval with gap pacing, tracks consecutive failures, trips circuit breaker upon threshold.

#### Decisions Implemented
- **D-05:** Bounded concurrency pool (4-5 concurrent workers, 100-200ms pacing). Replaces strictly serialized 1-by-1 chain (`MIN_GAP_MS = 500`).

#### Existing Analog
- `apps/service/src/deals/flipp/request-queue.ts` [lines 10-48, 98-205]

#### Concrete Code Excerpts to Copy

```typescript
// Queue Configuration & Defaults Analog: apps/service/src/deals/flipp/request-queue.ts:10-48
export const MIN_GAP_MS = 150; // Refactored from 500ms to 100-200ms range per D-05
const DEFAULT_CONCURRENCY = 4;  // Bounded worker pool size per D-05
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = 1_000;
const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_OPEN_MS = 30 * 60 * 1_000;

export interface RequestQueueOptions {
  get: HttpGet;
  userAgent: string;
  logger?: QueueLogger;
  concurrency?: number;
  minGapMs?: number;
  attempts?: number;
  backoffMs?: number;
  failureThreshold?: number;
  openMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}
```

```typescript
// Circuit Breaker State & Error Analog: apps/service/src/deals/flipp/request-queue.ts:51-76
export class CircuitOpenError extends Error {
  readonly openUntil: number;

  constructor(openUntil: number) {
    super('The Flipp circuit breaker is open');
    this.name = 'CircuitOpenError';
    this.openUntil = openUntil;
  }
}
```

```typescript
// Request Execution Loop & Exponential Backoff Analog: apps/service/src/deals/flipp/request-queue.ts:142-182
private async execute(url: string): Promise<unknown> {
  if (this.isOpen) throw new CircuitOpenError(this.openUntil ?? 0);
  this.openUntil = null;

  let lastError: FlippRequestError | null = null;
  for (let attempt = 1; attempt <= this.options.attempts; attempt += 1) {
    if (attempt > 1) {
      const backoffMs = this.options.backoffMs * 2 ** (attempt - 2);
      this.options.logger?.warn(
        { url: redact(url), attempt, backoffMs, status: lastError?.status ?? null },
        'backing off before retrying a Flipp request',
      );
      await this.options.sleep(backoffMs);
    }
    await this.waitForGap();
    const previousStartedAt = this.lastStartedAt;
    this.lastStartedAt = this.options.now();
    const gapMs = Number.isFinite(previousStartedAt)
      ? this.lastStartedAt - previousStartedAt
      : null;
    try {
      const response = await this.options.get(url, { 'User-Agent': this.options.userAgent });
      this.options.logger?.info?.(
        { url: redact(url), attempt, status: response.status, gapMs },
        'flipp request',
      );
      if (response.status === 200) {
        this.consecutiveFailures = 0;
        return await response.json();
      }
      lastError = new FlippRequestError(url, response.status);
    } catch (error: unknown) {
      lastError = new FlippRequestError(url, null, error);
    }
  }

  this.recordFailure(url, lastError);
  throw lastError ?? new FlippRequestError(url, null);
}
```

#### Bounded Worker Pool Pattern Guidance
To transition from serialized tail to 4-5 concurrent workers with rate pacing:
- Keep an internal task queue: `Array<{ url: string; resolve: (val: unknown) => void; reject: (err: unknown) => void }>`
- Track active workers: `activeWorkers: number = 0`
- Maintain token/gap schedule: `lastDispatchedAt` updated before dispatching any request, so worker calls `waitForGap()` before triggering HTTP transport.
- Synchronized circuit breaker: If breaker trips, all pending tasks in the queue reject immediately with `CircuitOpenError`, and future calls reject until `openUntil` expires.

---

### 2.5. Deal Source with In-Memory LRU Cache & Concurrent Resolution (`apps/service/src/deals/flipp/flipp-deal-source.ts`)

#### Target Role & Data Flow
- **Role:** Service Adapter / Deal Ingestion Source
- **Data Flow:** High-throughput streaming fetch. Roster items resolved concurrently via worker pool; individual items cached in LRU cache to eliminate duplicate network traffic across households or retry runs.

#### Decisions Implemented
- **D-06:** Atomic per-flyer persistence with concurrent item resolution.
- **D-07:** In-memory LRU item-detail cache (6-hour TTL, ~2,000 items).

#### Existing Analog
- `apps/service/src/deals/flipp/flipp-deal-source.ts` [lines 43-53, 218-301, 342-357]
- `apps/service/src/services/deals/cache.ts` [lines 20-30, 46-60]

#### Concrete Code Excerpts to Copy

```typescript
// In-Memory LRU Cache Pattern: Pure TypeScript native Map (apps/service/src/deals/flipp/flipp-deal-source.ts)
export interface DetailCacheEntry {
  data: Record<string, unknown>;
  expiresAt: number;
}

export class ItemDetailLruCache {
  private readonly maxItems: number;
  private readonly ttlMs: number;
  private readonly cache = new Map<string, DetailCacheEntry>();

  constructor(maxItems = 2_000, ttlMs = 6 * 60 * 60 * 1_000) {
    this.maxItems = maxItems;
    this.ttlMs = ttlMs;
  }

  get(id: string, now = Date.now()): Record<string, unknown> | null {
    const entry = this.cache.get(id);
    if (!entry) return null;
    if (now > entry.expiresAt) {
      this.cache.delete(id);
      return null;
    }
    // Re-insert to keep MRU order
    this.cache.delete(id);
    this.cache.set(id, entry);
    return entry.data;
  }

  set(id: string, data: Record<string, unknown>, now = Date.now()): void {
    if (this.cache.has(id)) {
      this.cache.delete(id);
    } else if (this.cache.size >= this.maxItems) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(id, { data, expiresAt: now + this.ttlMs });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
```

```typescript
// Atomic Flyer Items Fetch & Concurrent Resolution: apps/service/src/deals/flipp/flipp-deal-source.ts:218-301
// Refactored to resolve candidate items concurrently:
const candidates = asArray(roster['items'])
  .map((raw) => asRecord(raw))
  .filter((item) => {
    const displayType = item['display_type'];
    return typeof displayType === 'number' && PRODUCT_DISPLAY_TYPES.has(displayType);
  });

// Concurrent resolution via Promise.all with item-detail LRU cache check:
const results = await Promise.all(
  candidates.map(async (item) => {
    const externalId = asId(item['id']);
    if (externalId === null) return null;
    if (toCents(item['price']) === null) {
      return { attempt: { merchantId: null, merchantName: null, skipped: 'no_price' as const } };
    }

    // Check LRU cache before queueing network request:
    let detail = this.detailCache.get(externalId);
    if (detail === null) {
      try {
        const res = asRecord(
          await this.queue.request(`${BASE_URL}/flipp/items/${encodeURIComponent(externalId)}`),
        );
        detail = asRecord(res['item']);
        this.detailCache.set(externalId, detail);
      } catch (error: unknown) {
        if (error instanceof CircuitOpenError || this.queue.isOpen) throw error;
        return {
          attempt: { merchantId: null, merchantName: null, skipped: 'detail_unavailable' as const },
        };
      }
    }
    // Parse price and normalize deal...
  }),
);
```

#### Gotchas & Safeguards
- **Circuit Breaker Fast-Fail:** If any item detail request throws `CircuitOpenError`, `Promise.all` immediately rejects, flyer is aborted, and no partial flyer deals are written (`upsertDeals` is never called for that flyer).
- **LRU Memory Bound:** Max items capped at 2,000 ensures memory footprint stays well under 10MB on self-hosted instances.

---

### 2.6. Deal Card Presentation (`apps/web/src/screens/deals/DealCard.tsx`)

#### Target Role & Data Flow
- **Role:** Presentation UI Component
- **Data Flow:** React props (`DealCardProps`) -> Formatted accessible DOM.

#### Decisions Implemented
- **DEAL-01:** Sale price as primary, discount percent badge (e.g. `"-25%"`), strikethrough original price as secondary.
- **Builder's Discretion:** Position discount badge inline beside strikethrough original price for immediate visual connection. Clean fallback when original price is missing.

#### Existing Analog
- `apps/web/src/screens/deals/DealCard.tsx` [lines 23-68]

#### Concrete Code Excerpts to Copy

```tsx
// DealCard Layout & Hierarchy Analog: apps/web/src/screens/deals/DealCard.tsx:23-68
export function DealCard({ householdId, deal }: DealCardProps): ReactElement {
  const nameId = useId();
  const sentenceId = useId();
  const unitPrice = formatUnitPrice(deal.unitPrice, deal.priceUnit);
  const displayPrice = deal.displayPrice.trim();
  const hasDisplayPrice = displayPrice !== '' && displayPrice !== unitPrice;

  return (
    <Card as="article" aria-labelledby={`${nameId} ${sentenceId}`} className="flex flex-col gap-3">
      <p id={sentenceId} className="sr-only">
        {dealSentence(deal)}
      </p>
      <div className="flex items-start gap-3">
        <DealImage url={deal.imageUrl} className="size-16" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 id={nameId} className="text-h3 text-primary">
            {deal.name}
          </h3>
          <p className="text-body-sm text-secondary">{deal.merchantName}</p>
          
          {/* Primary price cluster with inline discount badge & strikethrough original */}
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
        </div>
      </div>

      <div aria-hidden className="flex flex-wrap items-center gap-2">
        {deal.conditionalPrice && deal.conditionalReason !== null && (
          <Badge variant="warning">{CONDITIONAL_LABEL[deal.conditionalReason]}</Badge>
        )}
        {deal.category !== null && <Badge variant="neutral">{deal.category}</Badge>}
        <span className="text-caption text-muted">{validityLabel(deal)}</span>
      </div>

      <AddToList householdId={householdId} deal={deal} />
    </Card>
  );
}
```

---

### 2.7. Adaptive Refresh Polling Hook (`apps/web/src/screens/deals/use-refresh-poll.ts`)

#### Target Role & Data Flow
- **Role:** Custom React Hook / Controller
- **Data Flow:** Event-Driven. Monitors `isRefreshing` state, polls every 4-5s while refreshing, halts after 3-minute ceiling.

#### Decisions Implemented
- **D-08:** Adaptive 4-5s client polling with 3-minute ceiling. Replaces exponential backoff (which stalled out after 10 attempts / 3 minutes without completing ingestion).

#### Existing Analog
- `apps/web/src/screens/deals/use-refresh-poll.ts` [lines 13-65]
- `apps/web/src/screens/deals/refresh-poll.test.ts` [lines 11-92]

#### Concrete Code Excerpts to Copy

```typescript
// Polling Constants & Hook Analog: apps/web/src/screens/deals/use-refresh-poll.ts:13-65
export const POLL_INTERVAL_MS = 4_500; // 4.5s fixed interval per D-08
export const MAX_POLL_MS = 180_000;     // 3-minute hard ceiling per D-08
export const MAX_ATTEMPTS = Math.floor(MAX_POLL_MS / POLL_INTERVAL_MS); // ~40 attempts

export function refreshDelayMs(): number {
  return POLL_INTERVAL_MS;
}

export interface RefreshPoll {
  isPolling: boolean;
  hasGivenUp: boolean;
}

export function useRefreshPoll(
  isRefreshing: boolean,
  refetch: () => void,
  isOnline = true,
): RefreshPoll {
  const [attempt, setAttempt] = useState(0);
  const [wasRefreshing, setWasRefreshing] = useState(isRefreshing);

  if (wasRefreshing !== isRefreshing) {
    setWasRefreshing(isRefreshing);
    if (!isRefreshing) setAttempt(0);
  }

  const isActive = isRefreshing && isOnline && attempt < MAX_ATTEMPTS;

  useEffect(() => {
    if (!isActive) return;
    const timer = setTimeout(() => {
      setAttempt((current) => current + 1);
      refetch();
    }, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [isActive, attempt, refetch]);

  return { isPolling: isActive, hasGivenUp: isRefreshing && attempt >= MAX_ATTEMPTS };
}
```

---

## 3. Test Patterns & Test Suite Strategy

### 3.1. Pricing Engine Unit Tests (`apps/service/src/deals/price/parse-price.test.ts`)
- **Analog:** `apps/service/src/deals/price/parse-price.test.ts:34-250`
- **Pattern:** Pure input/output assertions against `parsePrice(copy({...}))`.
- **Test cases to add:**
  - Multi-buy with bundle savings: `"save $1.50 on 2"` with `2/$6.00` -> `unitPrice: 300, originalPrice: 375, discountPercent: 20`.
  - Multi-buy with cents savings: `"save at least 98¢ on 2"` with `2/$6.00` -> `unitPrice: 300, originalPrice: 349, discountPercent: 14`.
  - Buy 2 Get 1 Free: `currentPrice: 300` -> `unitPrice: 200, originalPrice: 300, discountPercent: 33`.
  - Must Buy 2: `currentPrice: 250, prePriceText: 'MUST BUY 2'` -> `unitPrice: 250`, deal parsed rather than skipped.
  - Implausible discounts: reject discount > 95% or original <= unit.

### 3.2. Bounded Concurrency Queue Tests (`apps/service/src/deals/flipp/request-queue.test.ts`)
- **Analog:** `apps/service/src/deals/flipp/request-queue.test.ts:23-96`
- **Pattern:** Fake transport recording `{ url, headers, at }` with `vi.useFakeTimers({ now: 0 })`.
- **Test cases to add:**
  - Verifies at most 4 concurrent requests are active simultaneously.
  - Verifies minimum gap pacing between dispatches (100-200ms).
  - Verifies circuit breaker trips after 5 consecutive failures and blocks subsequent requests.

### 3.3. Deal Source LRU & Flyer Resolution Tests (`apps/service/src/deals/flipp/flipp-deal-source.test.ts`)
- **Analog:** `apps/service/src/deals/flipp/flipp-deal-source.test.ts:21-87`
- **Pattern:** In-memory `fixtureTransport()` recording requested URLs.
- **Test cases to add:**
  - Item detail LRU cache: Calling `listFlyerItems` across overlapping flyers or repeated runs verifies cached `/flipp/items/{id}` hits without extra network requests.
  - Eviction: After 2,000 items, oldest entries are evicted in LRU order.
  - Atomic flyer abort: If a detail request fails and trips the circuit breaker, the flyer throws and aborts.

### 3.4. Deal Card Component Tests (`apps/web/src/screens/deals/deal-card.test.tsx`)
- **Analog:** `apps/web/src/screens/deals/deal-card.test.tsx:22-82`
- **Pattern:** `renderScreen(<DealCard householdId={...} deal={...} />)` and Testing Library queries (`screen.getByRole`, `screen.getByText`).
- **Test cases to add:**
  - Verify primary unit price is rendered in text-section.
  - Verify `-X%` badge is rendered inline next to strikethrough original price.
  - Verify card without original price renders clean unit price without strikethrough or discount badge.

### 3.5. Refresh Polling Hook Tests (`apps/web/src/screens/deals/refresh-poll.test.ts`)
- **Analog:** `apps/web/src/screens/deals/refresh-poll.test.ts:11-92`
- **Pattern:** `renderHook(() => useRefreshPoll(isRefreshing, refetch))` with `vi.advanceTimersByTime(POLL_INTERVAL_MS)`.
- **Test cases to update:**
  - Verify fixed 4.5s polling beat.
  - Verify poll stops immediately when `isRefreshing` flips to false.
  - Verify poll times out and sets `hasGivenUp: true` after 3 minutes (~40 attempts).

---

## 4. Verification Commands

To verify all pattern implementations during execution:

```powershell
# Run backend service unit and integration tests
pnpm --filter @hestia/service test --run

# Run web frontend unit and component tests
pnpm --filter @hestia/web test src/screens/deals/deal-card.test.tsx src/screens/deals/refresh-poll.test.ts --run

# Run entire repository test suite
pnpm test
```
