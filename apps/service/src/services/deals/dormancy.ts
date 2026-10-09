/**
 * Dormant postal codes (Technical Architecture, "Dormant postal codes"; Requirements, "Refresh").
 *
 * Dormancy governs only the flyer and flyer-item refresh. A keyword search that misses its cache
 * always fetches live, dormant or not.
 *
 * Two questions, answered in two places, because the two callers see different data:
 *
 * - **The daily job** picks its postal codes from `household.last_active_at` directly, as the
 *   specs define dormancy. It runs as `service_role`, so it can see every household.
 * - **A request** cannot: RLS shows a caller only the households they belong to, so
 *   `max(last_active_at)` across a postal code is not readable, and the caller's own household
 *   has just been stamped active by `mark_household_active`. What a request can read is
 *   `postal_code_refresh`, and the daily refresh sets `last_refreshed_at` for exactly the postal
 *   codes that are not dormant. A postal code the last daily run did not cover is therefore one
 *   that was dormant when that run decided its set, which is the question the request is asking.
 */

/** Requirements, "Refresh": activity within 14 days. */
export const ACTIVE_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1_000;

/**
 * A postal code is active for a run when any household at it has been active within 14 days.
 * Used by `refresh-deals` to build its set, and by the on-demand refresh to label the run.
 */
export function isPostalCodeActive(
  lastActiveAts: readonly Date[],
  now: Date,
  windowDays = ACTIVE_WINDOW_DAYS,
): boolean {
  const cutoff = now.getTime() - windowDays * DAY_MS;
  return lastActiveAts.some((at) => at.getTime() >= cutoff);
}

export interface PostalCodeActivity {
  postalCode: string;
  lastActiveAt: Date;
}

/** The postal codes a daily run covers: one entry per postal code, never one per household. */
export function selectActivePostalCodes(
  households: readonly PostalCodeActivity[],
  now: Date,
  windowDays = ACTIVE_WINDOW_DAYS,
): string[] {
  const byPostalCode = new Map<string, Date[]>();
  for (const household of households) {
    const stamps = byPostalCode.get(household.postalCode);
    if (stamps === undefined) byPostalCode.set(household.postalCode, [household.lastActiveAt]);
    else stamps.push(household.lastActiveAt);
  }
  return [...byPostalCode.entries()]
    .filter(([, stamps]) => isPostalCodeActive(stamps, now, windowDays))
    .map(([postalCode]) => postalCode)
    .sort((a, b) => a.localeCompare(b));
}

export interface RefreshBookkeeping {
  lastRefreshedAt: Date | null;
  lastOnDemandAt: Date | null;
}

/**
 * Whether the last daily run covered this postal code. A run that covered it stamped
 * `last_refreshed_at` within the last day, so anything older — or missing altogether, which is
 * the never-refreshed case — was outside that run's set.
 *
 * This is dormancy read from the other side, and it is the only reading available to anyone who
 * cannot trust `last_active_at`: a request, because RLS hides the other households at the postal
 * code and `mark_household_active` has already stamped the caller's own; and a refresh deciding
 * whether to notify, because the request that woke it has done the same before it runs.
 */
export function wasCoveredByLastRun(lastRefreshedAt: Date | null, now: Date): boolean {
  return lastRefreshedAt !== null && now.getTime() - lastRefreshedAt.getTime() < DAY_MS;
}

/** Dormancy as a request sees it: the last daily run did not cover this postal code. */
export function isDormantAtRequest(
  bookkeeping: RefreshBookkeeping | undefined,
  now: Date,
): boolean {
  return !wasCoveredByLastRun(bookkeeping?.lastRefreshedAt ?? null, now);
}

/** Whether two instants fall in the same UTC day. */
export function sameUtcDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

/**
 * A dormant postal code gets at most one on-demand refresh per UTC day. The limit holds whether
 * or not any deal rows exist, because it is `last_on_demand_at` that records the claim. This check
 * only decides whether a claim is worth attempting; the claim itself, committed first, is what
 * limits the refresh.
 */
export function shouldQueueOnDemandRefresh(
  bookkeeping: RefreshBookkeeping | undefined,
  now: Date,
): boolean {
  if (!isDormantAtRequest(bookkeeping, now)) return false;
  const lastOnDemandAt = bookkeeping?.lastOnDemandAt ?? null;
  return lastOnDemandAt === null || !sameUtcDay(lastOnDemandAt, now);
}
