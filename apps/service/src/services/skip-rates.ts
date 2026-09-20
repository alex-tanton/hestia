import type { MerchantSkipRate } from '@hearth/shared';

/**
 * Per-merchant skip rates from the most recent deal refresh (Technical Architecture, "Health
 * checks"). In memory: a restart forgets them until the next refresh, which is acceptable for a
 * diagnostic. The Phase 2 refresh job fills it; until then it is empty.
 */
export class SkipRateRegistry {
  private rates = new Map<string, MerchantSkipRate>();

  /** Replaces the figures with one refresh's, per merchant. */
  replace(
    counts: readonly {
      merchantId: string;
      merchantName: string;
      fetched: number;
      skipped: number;
    }[],
  ): void {
    this.rates = new Map(
      counts.map((count) => [
        count.merchantId,
        {
          ...count,
          skipRate: count.fetched === 0 ? 0 : Math.min(1, count.skipped / count.fetched),
        },
      ]),
    );
  }

  list(): MerchantSkipRate[] {
    return [...this.rates.values()].sort((a, b) => b.skipRate - a.skipRate);
  }
}
