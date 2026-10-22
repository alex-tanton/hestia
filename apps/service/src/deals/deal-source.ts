import type { ConditionalReason, PriceUnit } from './price/price-copy.js';
import type { SkipReason } from './price/parsers.js';

/**
 * The deal-source contract. Everything that knows Flipp's response shape lives behind this, so an
 * upstream schema change is a one-file fix and the rest of the service — and every test double —
 * sees only these types.
 */
export interface DealSource {
  searchItems(postalCode: string, query: string): Promise<NormalizedDeal[]>;
  listFlyers(postalCode: string): Promise<Flyer[]>;
  listFlyerItems(flyerId: string): Promise<NormalizedDeal[]>;
  listMerchants(postalCode: string): Promise<Merchant[]>;
}

export interface NormalizedDeal {
  externalId: string;
  name: string;
  merchantId: string;
  merchantName: string;
  /** Integer cents, rounded half-up. */
  unitPrice: number;
  priceUnit: PriceUnit;
  /** Integer cents, or null when no original is known or the one given is implausible. */
  originalPrice: number | null;
  discountPercent: number | null;
  /** The original copy, e.g. "2/$5.00", so the UI can show it beside the computed unit price. */
  displayPrice: string;
  conditionalPrice: boolean;
  conditionalReason: ConditionalReason | null;
  category: string | null;
  flyerId: string;
  /** Calendar dates in the store's local offset, not instants. */
  validFrom: string;
  validTo: string;
  imageUrl: string | null;
  sourceUrl: string | null;
}

export interface Flyer {
  flyerId: string;
  merchantId: string;
  merchantName: string;
  validFrom: string;
  validTo: string;
  thumbnailUrl: string | null;
  logoUrl: string | null;
}

export interface Merchant {
  merchantId: string;
  name: string;
  logoUrl: string | null;
}

/**
 * Per-merchant skip counts since the last reset, for System health's "since last refresh"
 * figures. The shape `SkipRateRegistry.replace` takes, plus the reasons, which only the logs use.
 */
export interface MerchantSkipCount {
  merchantId: string;
  merchantName: string;
  fetched: number;
  skipped: number;
  reasons: Partial<Record<SkipReason, number>>;
}

/** What the refresh job reads off the wrapper after a run. */
export interface DealSourceStats {
  skipCounts(): MerchantSkipCount[];
  resetSkipCounts(): void;
}
