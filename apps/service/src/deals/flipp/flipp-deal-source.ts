import type {
  DealSource,
  DealSourceStats,
  Flyer,
  Merchant,
  MerchantSkipCount,
  NormalizedDeal,
} from '../deal-source.js';
import { toCents } from '../money.js';
import { parsePrice } from '../price/parse-price.js';
import type { SkipReason } from '../price/parsers.js';
import { CircuitOpenError, FlippRequestQueue, type QueueLogger } from './request-queue.js';

/**
 * The Flipp wrapper: one module, one file, everything that knows Flipp's response shape.
 * Base URL `https://backflipp.wishabi.com`; every call is an unauthenticated GET returning JSON —
 * no key, cookie, token, or Referer.
 *
 * | Mode        | Path                     | Parameters                                  | Fields read |
 * | ----------- | ------------------------ | ------------------------------------------- | ----------- |
 * | search      | /flipp/items/search      | postal_code, q (required); locale=en-us      | items[] with item_type "flyer": id, flyer_id, name, merchant_id, merchant_name, merchant_logo, current_price, original_price, pre_price_text, post_price_text, sale_story, _L1, _L2, clean_image_url, valid_from, valid_to |
 * | flyers      | /flipp/flyers            | postal_code (required); locale=en-us         | flyers[]: id, merchant_id, merchant, merchant_logo, valid_from, valid_to, thumbnail_url |
 * | flyer items | /flipp/flyers/{flyerId}  | locale=en-us                                 | items[]: id, name, display_type, price; pages[] ignored |
 * | item detail | /flipp/items/{itemId}    | none                                         | item: name, merchant, merchant_id, pre_price_text, current_price, price_text, original_price, sale_story, image_url, ttm_url, valid_from, valid_to |
 * | merchants   | /flipp/merchants         | locale=en-us                                 | merchants[]: id, name, us_based |
 *
 * Item detail is not a `DealSource` mode; it is how `listFlyerItems` prices a flyer.
 * `flyers-ng.flippback.com` serves equivalent data with the same gaps and is not used.
 *
 * The quirks absorbed here, so nothing outside this file sees them, are commented at the method
 * that deals with each.
 */

const BASE_URL = 'https://backflipp.wishabi.com';
const LOCALE = 'en-us';
const FLYERS_TTL_MS = 12 * 60 * 60 * 1_000;
const MERCHANTS_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
/** Above this, a merchant's skip rate usually means a format change rather than odd deals. */
const SKIP_RATE_WARNING = 0.4;
/** display_type 1 and 25 are products; 5 is a banner and 7 a navigation link. */
const PRODUCT_DISPLAY_TYPES = new Set([1, 25]);

export interface FlippDealSourceOptions {
  queue: FlippRequestQueue;
  logger?: QueueLogger;
  now?: () => Date;
}

interface CachedFlyers {
  flyers: Flyer[];
  fetchedAt: number;
}

/** One item's outcome, before it is attributed to a merchant. */
interface Attempt {
  merchantId: string | null;
  merchantName: string | null;
  skipped: SkipReason | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Flipp's ids are numbers in JSON; the schema stores them as opaque text. */
function asId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return asText(value);
}

/**
 * Some image URLs come back as http://. The CSP allows f.wishabi.net and images.wishabi.net
 * over https only, so an http URL would be blocked in the browser.
 */
function https(value: unknown): string | null {
  const url = asText(value);
  return url === null ? null : url.replace(/^http:\/\//i, 'https://');
}

/**
 * `validFrom` and `validTo` are calendar dates in the store's local offset. Flyers, flyer
 * items, and item detail already carry that offset ("2026-09-22T23:59:59-04:00"), so the date
 * is the first ten characters — converting to UTC first would move it a day.
 */
function calendarDate(value: unknown): string | null {
  const text = asText(value);
  if (text === null) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match?.[1] ?? null;
}

function instant(value: unknown): number | null {
  const text = asText(value);
  if (text === null) return null;
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
}

export class FlippDealSource implements DealSource, DealSourceStats {
  private readonly queue: FlippRequestQueue;
  private readonly logger: QueueLogger | undefined;
  private readonly now: () => Date;
  private readonly flyerCache = new Map<string, CachedFlyers>();
  /** Every flyer seen in any postal code, so `listFlyerItems` can name a flyer's merchant. */
  private readonly flyersById = new Map<string, Flyer>();
  private merchantCache: { merchants: Map<string, string>; fetchedAt: number } | null = null;
  private readonly counts = new Map<string, MerchantSkipCount>();
  /**
   * In-flight coalescing: a cold cache key already being fetched hands every other caller the same
   * promise rather than enqueueing another request. Cleared on settle, success or failure, so the
   * next caller after a failure gets a fresh attempt rather than a cached rejection (rate
   * discipline: a cache never lets a burst of callers each pay for their own fetch).
   */
  private readonly flyersInFlight = new Map<string, Promise<Map<string, Flyer>>>();
  private merchantsInFlight: Promise<Map<string, string>> | null = null;

  constructor(options: FlippDealSourceOptions) {
    this.queue = options.queue;
    this.logger = options.logger;
    this.now = options.now ?? (() => new Date());
  }

  /**
   * Keyword search. Two quirks: the response is capped at 150 items with no pagination (page
   * and offset parameters are ignored and the true total appears only in `facets`), and it
   * mixes in upcoming flyers. Search timestamps are UTC while flyers carry the store's local
   * offset, so an item takes its calendar dates from its flyer, matched by `flyer_id`, and an
   * item whose flyer is not in the postal code's flyers response is dropped — there is nothing
   * to date it with.
   */
  async searchItems(postalCode: string, query: string): Promise<NormalizedDeal[]> {
    const flyers = await this.activeFlyers(postalCode);
    const body = asRecord(
      await this.queue.request(
        `${BASE_URL}/flipp/items/search?postal_code=${encodeURIComponent(postalCode)}&q=${encodeURIComponent(query)}&locale=${LOCALE}`,
      ),
    );

    const deals: NormalizedDeal[] = [];
    const attempts: Attempt[] = [];
    for (const raw of asArray(body['items'])) {
      const item = asRecord(raw);
      // `ecom_items` and every other key are ignored; so is any item that is not a flyer item.
      if (item['item_type'] !== 'flyer') continue;

      const flyerId = asId(item['flyer_id']);
      const flyer = flyerId === null ? undefined : flyers.get(flyerId);
      if (flyer === undefined) continue;

      const externalId = asId(item['id']);
      const name = asText(item['name']);
      if (externalId === null || name === null) continue;

      const merchantId = asId(item['merchant_id']) ?? flyer.merchantId;
      // Merchant names can carry trailing spaces ("Costco ").
      const merchantName = asText(item['merchant_name']) ?? flyer.merchantName;
      const result = parsePrice({
        currentPrice: toCents(item['current_price']),
        originalPrice: toCents(item['original_price']),
        prePriceText: asText(item['pre_price_text']),
        postPriceText: asText(item['post_price_text']),
        saleStory: asText(item['sale_story']),
      });
      attempts.push({
        merchantId,
        merchantName,
        skipped: 'skipped' in result ? result.skipped : null,
      });
      if ('skipped' in result) continue;

      deals.push({
        externalId,
        name,
        merchantId,
        merchantName,
        ...result.parsed,
        // Category is the subcategory where there is one, the top category otherwise.
        category: asText(item['_L2']) ?? asText(item['_L1']),
        flyerId: flyer.flyerId,
        validFrom: flyer.validFrom,
        validTo: flyer.validTo,
        imageUrl: https(item['clean_image_url']),
        // Search has no source URL; only item detail carries one.
        sourceUrl: null,
      });
    }

    this.record(attempts);
    return deals;
  }

  /** Every flyer active at the postal code right now. Cached in memory for 12 hours. */
  async listFlyers(postalCode: string): Promise<Flyer[]> {
    return [...(await this.activeFlyers(postalCode)).values()];
  }

  /**
   * One flyer's items. The listing cannot be priced on its own: it has a bare `price` string
   * and no pre- or post-price text, sale story, original price, merchant, or category, so
   * "6.0" may really be "2/$6.00 with VIC card". The listing is therefore only a roster, and
   * each priced product costs one `/flipp/items/{id}` request through the same queue.
   *
   * A product with an empty `price` counts as skipped and costs no request. Banners and
   * navigation links are ignored and not counted. Nothing is written for a flyer the breaker
   * cuts short — the call throws, so the next run fetches the flyer whole rather than leaving
   * it half-stored.
   */
  async listFlyerItems(flyerId: string): Promise<NormalizedDeal[]> {
    const roster = asRecord(
      await this.queue.request(
        `${BASE_URL}/flipp/flyers/${encodeURIComponent(flyerId)}?locale=${LOCALE}`,
      ),
    );
    const flyer = this.flyersById.get(flyerId);

    const deals: NormalizedDeal[] = [];
    const attempts: Attempt[] = [];
    for (const raw of asArray(roster['items'])) {
      const item = asRecord(raw);
      const displayType = item['display_type'];
      if (typeof displayType !== 'number' || !PRODUCT_DISPLAY_TYPES.has(displayType)) continue;

      const externalId = asId(item['id']);
      if (externalId === null) continue;
      if (toCents(item['price']) === null) {
        attempts.push({ merchantId: null, merchantName: null, skipped: 'no_price' });
        continue;
      }

      let detail: Record<string, unknown>;
      try {
        detail = asRecord(
          asRecord(
            await this.queue.request(`${BASE_URL}/flipp/items/${encodeURIComponent(externalId)}`),
          )['item'],
        );
      } catch (error: unknown) {
        // A single failed detail is one skipped item, but a failure that opened the breaker ends
        // the flyer: nothing is written, so the next run fetches it whole.
        if (error instanceof CircuitOpenError || this.queue.isOpen) throw error;
        attempts.push({ merchantId: null, merchantName: null, skipped: 'detail_unavailable' });
        continue;
      }

      const name = asText(detail['name']) ?? asText(item['name']);
      const merchantId = asId(detail['merchant_id']) ?? flyer?.merchantId ?? null;
      const merchantName = asText(detail['merchant']) ?? flyer?.merchantName ?? null;
      const result = parsePrice({
        currentPrice: toCents(detail['current_price']),
        originalPrice: toCents(detail['original_price']),
        prePriceText: asText(detail['pre_price_text']),
        // Item detail calls the post-price text `price_text` ("WITH CARD", "EA").
        postPriceText: asText(detail['price_text']),
        saleStory: asText(detail['sale_story']),
      });
      attempts.push({
        merchantId,
        merchantName,
        skipped: 'skipped' in result ? result.skipped : null,
      });
      if ('skipped' in result || name === null || merchantId === null || merchantName === null) {
        continue;
      }

      const validFrom =
        calendarDate(detail['valid_from']) ?? calendarDate(item['valid_from']) ?? flyer?.validFrom;
      const validTo =
        calendarDate(detail['valid_to']) ?? calendarDate(item['valid_to']) ?? flyer?.validTo;
      if (validFrom === undefined || validTo === undefined) continue;

      deals.push({
        externalId,
        name,
        merchantId,
        merchantName,
        ...result.parsed,
        // Flyer items have no category, and an upsert never replaces a non-null one with null.
        category: null,
        flyerId: asId(item['flyer_id']) ?? flyerId,
        validFrom,
        validTo,
        imageUrl: https(detail['image_url']) ?? https(item['cutout_image_url']),
        sourceUrl: asText(detail['ttm_url']),
      });
    }

    // A flyer fetched without its postal code's flyers response, and whose every detail request
    // failed, has no merchant to attribute to; the counts still have to be visible somewhere.
    this.record(attempts, flyer ?? { merchantId: flyerId, merchantName: `Flyer ${flyerId}` });
    return deals;
  }

  /**
   * The merchant directory is global: it ignores `postal_code`, lists about 2,500 US and
   * Canadian retailers, and has no logos. What a household can actually shop is the subset with
   * an active flyer at its postal code, so that is what comes back, with the logo taken from
   * the flyer. Cached in memory for 7 days, one copy for every postal code.
   */
  async listMerchants(postalCode: string): Promise<Merchant[]> {
    const [directory, flyers] = await Promise.all([
      this.merchantDirectory(),
      this.activeFlyers(postalCode),
    ]);

    const merchants = new Map<string, Merchant>();
    for (const flyer of flyers.values()) {
      if (merchants.has(flyer.merchantId)) continue;
      const name = directory.get(flyer.merchantId);
      if (name === undefined) continue;
      merchants.set(flyer.merchantId, {
        merchantId: flyer.merchantId,
        name,
        logoUrl: flyer.logoUrl,
      });
    }
    return [...merchants.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Per-merchant counts since the last reset, for System health. */
  skipCounts(): MerchantSkipCount[] {
    return [...this.counts.values()].sort((a, b) => b.skipped - a.skipped);
  }

  resetSkipCounts(): void {
    this.counts.clear();
  }

  /**
   * "Active" means valid_from ≤ now ≤ valid_to. Both search and the flyers response include
   * upcoming flyers, which would otherwise show next week's prices as though they were today's.
   */
  private async activeFlyers(postalCode: string): Promise<Map<string, Flyer>> {
    const at = this.now().getTime();
    const cached = this.flyerCache.get(postalCode);
    if (cached !== undefined && at - cached.fetchedAt < FLYERS_TTL_MS) {
      return new Map(cached.flyers.map((flyer) => [flyer.flyerId, flyer]));
    }

    const inFlight = this.flyersInFlight.get(postalCode);
    if (inFlight !== undefined) return inFlight;

    const fetching = this.fetchActiveFlyers(postalCode, at).finally(() => {
      this.flyersInFlight.delete(postalCode);
    });
    this.flyersInFlight.set(postalCode, fetching);
    return fetching;
  }

  private async fetchActiveFlyers(postalCode: string, at: number): Promise<Map<string, Flyer>> {
    const body = asRecord(
      await this.queue.request(
        `${BASE_URL}/flipp/flyers?postal_code=${encodeURIComponent(postalCode)}&locale=${LOCALE}`,
      ),
    );
    const flyers: Flyer[] = [];
    for (const raw of asArray(body['flyers'])) {
      const entry = asRecord(raw);
      const flyerId = asId(entry['id']);
      const merchantId = asId(entry['merchant_id']);
      const merchantName = asText(entry['merchant']);
      const validFrom = calendarDate(entry['valid_from']);
      const validTo = calendarDate(entry['valid_to']);
      const from = instant(entry['valid_from']);
      const to = instant(entry['valid_to']);
      if (flyerId === null || merchantId === null || merchantName === null) continue;
      if (validFrom === null || validTo === null || from === null || to === null) continue;
      if (from > at || to < at) continue;

      flyers.push({
        flyerId,
        merchantId,
        merchantName,
        validFrom,
        validTo,
        thumbnailUrl: https(entry['thumbnail_url']),
        logoUrl: https(entry['merchant_logo']),
      });
    }
    flyers.sort(
      (a, b) => a.merchantName.localeCompare(b.merchantName) || a.flyerId.localeCompare(b.flyerId),
    );

    this.flyerCache.set(postalCode, { flyers, fetchedAt: at });
    for (const flyer of flyers) this.flyersById.set(flyer.flyerId, flyer);
    return new Map(flyers.map((flyer) => [flyer.flyerId, flyer]));
  }

  private async merchantDirectory(): Promise<Map<string, string>> {
    const at = this.now().getTime();
    if (this.merchantCache !== null && at - this.merchantCache.fetchedAt < MERCHANTS_TTL_MS) {
      return this.merchantCache.merchants;
    }

    if (this.merchantsInFlight !== null) return this.merchantsInFlight;

    const fetching = this.fetchMerchantDirectory(at).finally(() => {
      this.merchantsInFlight = null;
    });
    this.merchantsInFlight = fetching;
    return fetching;
  }

  private async fetchMerchantDirectory(at: number): Promise<Map<string, string>> {
    const body = asRecord(await this.queue.request(`${BASE_URL}/flipp/merchants?locale=${LOCALE}`));
    const merchants = new Map<string, string>();
    for (const raw of asArray(body['merchants'])) {
      const entry = asRecord(raw);
      const merchantId = asId(entry['id']);
      const name = asText(entry['name']);
      // The directory carries Canadian retailers too — the other "Walmart" is Walmart Canada.
      if (merchantId === null || name === null || entry['us_based'] !== true) continue;
      merchants.set(merchantId, name);
    }
    this.merchantCache = { merchants, fetchedAt: at };
    return merchants;
  }

  /**
   * Attributes one fetch's outcomes to merchants and logs a warning for any merchant that
   * skipped more than 40% of its items. Items skipped before their merchant was known — an
   * empty listing price costs no detail request — fall to the flyer's merchant.
   */
  private record(
    attempts: readonly Attempt[],
    lastResort: { merchantId: string; merchantName: string } | null = null,
  ): void {
    const fallback =
      attempts.find((attempt) => attempt.merchantId !== null && attempt.merchantName !== null) ??
      lastResort;
    const touched = new Set<string>();
    for (const attempt of attempts) {
      const merchantId = attempt.merchantId ?? fallback?.merchantId ?? null;
      const merchantName = attempt.merchantName ?? fallback?.merchantName ?? null;
      if (merchantId === null || merchantName === null) continue;

      let row = this.counts.get(merchantId);
      if (row === undefined) {
        row = { merchantId, merchantName, fetched: 0, skipped: 0, reasons: {} };
        this.counts.set(merchantId, row);
      }
      row.fetched += 1;
      touched.add(merchantId);
      if (attempt.skipped !== null) {
        row.skipped += 1;
        row.reasons[attempt.skipped] = (row.reasons[attempt.skipped] ?? 0) + 1;
      }
    }

    for (const merchantId of touched) {
      const row = this.counts.get(merchantId);
      if (row === undefined || row.fetched === 0) continue;
      if (row.skipped / row.fetched <= SKIP_RATE_WARNING) continue;
      this.logger?.warn(
        { ...row, skipRate: row.skipped / row.fetched },
        'High Flipp skip rate for merchant; check for a price-format change',
      );
    }
  }
}
