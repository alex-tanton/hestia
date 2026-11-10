---
phase: 13-deal-pricing-engine-ingestion-performance
reviewed: 2026-11-09T19:59:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - apps/service/src/deals/money.ts
  - apps/service/src/deals/price/parsers.ts
  - apps/service/src/deals/price/parse-price.ts
  - apps/service/src/deals/price/parse-price.test.ts
  - apps/service/src/deals/flipp/request-queue.ts
  - apps/service/src/deals/flipp/request-queue.test.ts
  - apps/service/src/deals/flipp/flipp-deal-source.ts
  - apps/service/src/deals/flipp/flipp-deal-source.test.ts
  - apps/web/src/screens/deals/DealCard.tsx
  - apps/web/src/screens/deals/deal-card.test.tsx
  - apps/web/src/screens/deals/use-refresh-poll.ts
  - apps/web/src/screens/deals/refresh-poll.test.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-11-09T19:59:00Z  
**Depth:** standard  
**Files Reviewed:** 12  
**Status:** issues_found  

## Summary

The Phase 13 changes implement mathematical pricing derivations for bundles, Buy-N-Get-M, and minimum-quantity pricing (`parsers.ts`, `parse-price.ts`), bounded concurrency with rate discipline and in-memory LRU caching in the Flipp ingestion pipeline (`request-queue.ts`, `flipp-deal-source.ts`), prominent unit price anchoring with inline discount badges on the web client (`DealCard.tsx`), and fixed 4.5s refresh polling with a 3-minute ceiling (`use-refresh-poll.ts`).

While the core math and rate pacing implementations are cleanly structured, adversarial analysis identified several defects:
1. **Broken service test suite:** Plan 13-01's pricing engine improvements caused 3 test failures in `apps/service` across `normalized-fixtures.test.ts` (unregenerated committed fixtures) and `fixture-yield.test.ts` (hardcoded 19% skip-rate thresholds invalidated by improved parser yields).
2. **Weighted price unit loss:** Promotional parsers (`parseBuyNGetM`, `parseBogo`, `parseMinimumQuantity`) run before `parsePerWeight` and unconditionally hardcode `priceUnit: 'each'`, stripping `/lb` and `/oz` units from meats and produce.
3. **Missing network timeout:** `fetchGet` in `request-queue.ts` calls `fetch()` without an `AbortSignal.timeout()`, risking permanent ingestion freezes if requests stall.
4. **Circuit breaker trip on 404s:** All non-200 responses—including 404 Not Found on missing items—are retried 3 times with exponential backoff and count toward opening the 30-minute circuit breaker.
5. **Stuck retry in polling:** When `useRefreshPoll` reaches its 40-attempt ceiling, clicking "Try again" does not reset the attempt counter if the server is still refreshing.

---

## Narrative Findings (AI reviewer)

### CR-01: Regression in Service Test Suite: Outdated Normalized Fixtures & Hardcoded Yield Thresholds

**File:** `apps/service/src/deals/price/parsers.ts:81-165` (affecting `apps/service/src/deals/flipp/normalized-fixtures.test.ts:18` and `apps/service/src/deals/price/fixture-yield.test.ts:94`)  
**Issue:**  
Plan 13-01 improved the parser chain so that previously skipped items (such as minimum-quantity deals with shelf prices and multi-buy bundles with marketing savings) are now successfully parsed. However, the regression test artifacts were not updated to reflect these improvements:
1. `normalized-fixtures.test.ts` fails with `search-27514-harris-teeter.json is out of date` because the committed fixtures in `e2e/fixtures/flipp/normalized/` were not regenerated via `pnpm fixtures:normalize`.
2. `fixture-yield.test.ts` fails because the expected skip rates for Harris Teeter and Food Lion are hardcoded to `0.19` with a strict tolerance of `0.02`. Because more items are now parsed, the actual skip rate for Harris Teeter dropped to ~15.5% and Food Lion dropped to ~5%, causing assertion failures:
   ```text
   FAIL src/deals/flipp/normalized-fixtures.test.ts > match what the wrapper produces from the raw captures
   FAIL src/deals/price/fixture-yield.test.ts > skips about Harris Teeter% 0.19 of undefined items (actual 0.155)
   FAIL src/deals/price/fixture-yield.test.ts > skips about Food Lion% 0.19 of undefined items (actual 0.05)
   ```
Running `pnpm test` in `apps/service` fails with 3 broken tests.

**Fix:**  
Regenerate the committed normalized fixtures using `pnpm fixtures:normalize`, and update the expected skip-rate benchmarks in `apps/service/src/deals/price/fixture-yield.test.ts` to reflect the improved yield:
```typescript
// apps/service/src/deals/price/fixture-yield.test.ts
const expected: [merchant: string, skipRate: number][] = [
  ['Harris Teeter', 0.16],
  ['ALDI', 0],
  ['Food Lion', 0.05],
  ['Lowes Foods', 0.14],
  ['CVS Pharmacy', 0.78],
  ['Publix', 0.46],
];
```

---

### WR-01: Promotional Parsers Hardcode `priceUnit: 'each'`, Overriding Weighted Units (`/lb`, `/oz`)

**File:** `apps/service/src/deals/price/parsers.ts:88, 143, 159, 182`  
**Issue:**  
In `PRICE_PARSERS`, `parseMinimumQuantity`, `parseBuyNGetM`, and `parseBogo` are placed earlier in the chain than `parsePerWeight`. All three parsers hardcode `priceUnit: 'each'` in their return values without inspecting whether the item copy indicates pricing per weight (e.g. `copy.post` or `copy.pre` having `/lb`, `LB`, or `/oz`).

For example:
- A meat deal with copy `currentPrice: 499, postPriceText: "LB MUST BUY 2"` triggers `parseMinimumQuantity` and returns `{ unitPrice: 499, priceUnit: 'each' }`.
- A poultry deal with copy `currentPrice: 399, postPriceText: "LB", saleStory: "BUY 2 GET 1 FREE"` triggers `parseBuyNGetM` and returns `{ unitPrice: 266, priceUnit: 'each' }`.
- A seafood deal with copy `currentPrice: 999, postPriceText: "/lb", saleStory: "BOGO"` triggers `parseBogo` and returns `{ unitPrice: 500, priceUnit: 'each' }`.

Because these parsers match before `parsePerWeight` and return a terminal `PriceCore` with `priceUnit: 'each'`, items sold by weight are misrepresented in the database and UI as priced per item.

**Fix:**  
Extract a helper or inspect `copy.post` / `copy.pre` using the existing `WEIGHT_SUFFIX` regex before defaulting to `'each'`:
```typescript
function resolvePriceUnit(copy: Copy): PriceUnit {
  const suffix = WEIGHT_SUFFIX.exec(copy.post) ?? WEIGHT_SUFFIX.exec(copy.pre);
  if (suffix !== null) {
    return suffix[1]?.startsWith('o') === true ? 'oz' : 'lb';
  }
  if (WEIGHT_IN_STORY.test(copy.story)) {
    return copy.story.includes('per oz') ? 'oz' : 'lb';
  }
  return 'each';
}
```
Use `resolvePriceUnit(copy)` instead of `'each'` in `parseMinimumQuantity`, `parseBuyNGetM`, and `parseBogo`.

---

### WR-02: Missing Timeout in `fetchGet` Can Permanently Freeze Request Queue Workers

**File:** `apps/service/src/deals/flipp/request-queue.ts:81-84`  
**Issue:**  
`fetchGet` uses Node's global `fetch` without specifying an `AbortSignal.timeout`:
```typescript
export const fetchGet: HttpGet = async (url, headers) => {
  const response = await fetch(url, { headers, redirect: 'follow' });
  return { status: response.status, json: () => response.json() };
};
```
If Flipp's upstream server drops the connection, stalls indefinitely during TLS handshakes, or hangs without terminating the socket, `fetch` will remain in flight indefinitely. Since `FlippRequestQueue` caps concurrent executions at `concurrency: 4`, 4 hung connections will occupy all active worker slots (`activeWorkers === 4`). The queue will permanently cease draining new tasks, completely locking up ingestion until the process is restarted.

**Fix:**  
Add an explicit timeout via `AbortSignal.timeout(...)`:
```typescript
export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

export const fetchGet: HttpGet = async (url, headers) => {
  const response = await fetch(url, {
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS),
  });
  return { status: response.status, json: () => response.json() };
};
```

---

### WR-03: Non-Retryable 4xx Responses Trigger Retries and Trip 30-Minute Circuit Breaker

**File:** `apps/service/src/deals/flipp/request-queue.ts:201-244, 282-291`  
**Issue:**  
In `execute(url)`, any response status other than 200 is treated as a retryable failure:
```typescript
if (response.status === 200) {
  this.consecutiveFailures = 0;
  return await response.json();
}
lastError = new FlippRequestError(url, response.status);
```
When Flipp returns a 404 (e.g. an item detail URL that has expired or been removed from the catalog), the queue retries the request 3 times with exponential backoff (1s, 2s). When all 3 attempts fail with 404, `recordFailure` increments `consecutiveFailures`.

If a flyer roster contains 5 items that have been removed upstream (resulting in 404s), the queue will make 15 fruitless requests, reach `failureThreshold: 5`, and trip the circuit breaker (`this.openUntil = now + 30 minutes`). This halts all Flipp requests for 30 minutes across all households due to client-side 404s rather than service unavailability.

**Fix:**  
Do not retry 4xx client errors (e.g. 400, 404, 410) and do not count them as consecutive outages toward the circuit breaker:
```typescript
const isClientError = response.status >= 400 && response.status < 500;
if (isClientError) {
  throw new FlippRequestError(url, response.status);
}
```

---

### WR-04: `useRefreshPoll` Fails to Resume Polling on Manual "Try Again" When Refresh Is Ongoing

**File:** `apps/web/src/screens/deals/use-refresh-poll.ts:39-63`  
**Issue:**  
When polling reaches `MAX_ATTEMPTS` (40 attempts / ~3 minutes), `hasGivenUp` becomes `true` and polling ceases. The UI (`DealFreshness.tsx`) displays a "Try again" button that invokes `refetch()`.

However, in `useRefreshPoll`, the `attempt` state is only reset when `isRefreshing` transitions to `false`:
```typescript
  if (wasRefreshing !== isRefreshing) {
    setWasRefreshing(isRefreshing);
    if (!isRefreshing) setAttempt(0);
  }
```
If the user clicks "Try again" while the server background refresh is still running (`isRefreshing` remains `true`):
1. `refetch()` executes once.
2. The server responds with `refreshing: true`.
3. `wasRefreshing !== isRefreshing` is false (both are `true`).
4. `attempt` remains at 40 (`attempt < MAX_ATTEMPTS` is false).
5. `isActive` remains `false`, and `hasGivenUp` remains `true`.

The hook does not resume polling, leaving the user with a single static fetch and no ongoing polling updates.

**Fix:**  
Provide a way to reset the attempt count on manual retry, or reset `attempt` if `refetch` is triggered while `attempt >= MAX_ATTEMPTS`:
```typescript
export function useRefreshPoll(
  isRefreshing: boolean,
  refetch: () => void,
  isOnline = true,
): RefreshPoll & { reset: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [wasRefreshing, setWasRefreshing] = useState(isRefreshing);

  if (wasRefreshing !== isRefreshing) {
    setWasRefreshing(isRefreshing);
    if (!isRefreshing) setAttempt(0);
  }

  const reset = useCallback(() => setAttempt(0), []);

  const isActive = isRefreshing && isOnline && attempt < MAX_ATTEMPTS;

  useEffect(() => {
    if (!isActive) return;
    const timer = setTimeout(() => {
      setAttempt((current) => current + 1);
      refetch();
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [isActive, attempt, refetch]);

  return { isPolling: isActive, hasGivenUp: isRefreshing && attempt >= MAX_ATTEMPTS, reset };
}
```

---

### IN-01: Unreachable Dead Code in `toCents`

**File:** `apps/service/src/deals/money.ts:16`  
**Issue:**  
Line 14 parses strings with `Number(value.trim())`. For any whitespace-only or empty string, `Number("")` evaluates to `0`.  
Line 15 checks `if (!Number.isFinite(numeric) || numeric <= 0) return null;`, which evaluates to `true` for `0` and immediately returns `null`.  
Line 16 (`if (typeof value === 'string' && value.trim() === '') return null;`) can never be reached.

**Fix:**  
Remove the dead check at line 16.

---

### IN-02: Missing "at least" Matching in `BUNDLE_SAVINGS_DOLLARS`

**File:** `apps/service/src/deals/price/parsers.ts:220-221`  
**Issue:**  
`BUNDLE_SAVINGS_CENTS` includes `(?:at least\s+)?` to match marketing copy such as `"save at least 98¢ on 2"`. However, `BUNDLE_SAVINGS_DOLLARS` omitted this qualifier:
```typescript
const BUNDLE_SAVINGS_DOLLARS =
  /(?:\bsave\s+\$ ?(\d+(?:\.\d{1,2})?)(?:\s*(?:on|off|for)\s*(\d+))?|\$ ?(\d+(?:\.\d{1,2})?)\s*off(?:\s*(?:on|off|for)\s*(\d+))?)/i;
```
If flyer copy reads `"save at least $2.00 on 2"`, `BUNDLE_SAVINGS_DOLLARS` fails to match, causing `parseMultiBuy` to miss the bundle savings derivation and omit the calculated discount.

**Fix:**  
Add `(?:at least\s+)?` to `BUNDLE_SAVINGS_DOLLARS`:
```typescript
const BUNDLE_SAVINGS_DOLLARS =
  /(?:\bsave\s+(?:at least\s+)?\$ ?(\d+(?:\.\d{1,2})?)(?:\s*(?:on|off|for)\s*(\d+))?|\$ ?(\d+(?:\.\d{1,2})?)\s*off(?:\s*(?:on|off|for)\s*(\d+))?)/i;
```

---

_Reviewed: 2026-11-09T19:59:00Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: standard_
