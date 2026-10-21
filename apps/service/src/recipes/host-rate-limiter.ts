/**
 * Per-host rate discipline for recipe fetches (1 request per second per host). Recipe URLs come
 * from whatever site the user pastes, unlike Flipp's single fixed host, so the Flipp wrapper's
 * request queue (`deals/flipp/request-queue.ts`) does not generalize cleanly here: it serializes
 * every call through one queue and one circuit breaker, which would make fetching two different
 * recipe sites wait on each other for no reason. A small map keyed on hostname is enough for the
 * low, user-initiated volume this feature sees.
 */

const DEFAULT_MIN_GAP_MS = 1_000;
/** Entries older than this are almost certainly done rate-limiting anything; drop them. */
const PRUNE_AFTER_GAPS = 10;

export interface HostRateLimiterOptions {
  minGapMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class HostRateLimiter {
  private readonly minGapMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly lastRequestAt = new Map<string, number>();

  constructor(options: HostRateLimiterOptions = {}) {
    this.minGapMs = options.minGapMs ?? DEFAULT_MIN_GAP_MS;
    this.now = options.now ?? (() => Date.now());
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /**
   * Resolves once at least the minimum gap has passed since the last request to this host.
   * The reserved slot is recorded synchronously, before any `await`, so two concurrent callers
   * for the same host (two households importing from the same site at once) each claim a
   * distinct slot instead of both reading the same `last` value and sleeping the same amount —
   * which would let them fire together at the end of the wait.
   */
  async wait(host: string): Promise<void> {
    this.prune();
    const key = host.toLowerCase();
    const last = this.lastRequestAt.get(key);
    const now = this.now();
    const scheduledAt = last === undefined ? now : Math.max(now, last + this.minGapMs);
    this.lastRequestAt.set(key, scheduledAt);
    const delay = scheduledAt - now;
    if (delay > 0) await this.sleep(delay);
  }

  /** Bounds memory: a host not seen in a while can never still be within its own gap. */
  private prune(): void {
    const cutoff = this.now() - this.minGapMs * PRUNE_AFTER_GAPS;
    for (const [key, at] of this.lastRequestAt) {
      if (at < cutoff) this.lastRequestAt.delete(key);
    }
  }
}
