import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { HttpGet, HttpResponse } from './request-queue.js';

/**
 * Serves the recorded Flipp responses in `e2e/fixtures/flipp/raw/` in place of the network, so
 * the wrapper can be exercised end to end without ever calling Flipp. The fixture generator uses
 * the same transport, which is what makes the committed normalized fixtures reproducible from the
 * raw captures.
 */

export const RAW_FIXTURE_DIR = fileURLToPath(
  new URL('../../../../../e2e/fixtures/flipp/raw/', import.meta.url),
);
export const NORMALIZED_FIXTURE_DIR = fileURLToPath(
  new URL('../../../../../e2e/fixtures/flipp/normalized/', import.meta.url),
);

/** The postal code the Phase 0 spike captured. */
export const FIXTURE_POSTAL_CODE = '27514';

/**
 * The instant the capture was taken: `refreshed_at` in `flyers-27514.json`, "2026-09-19
 * 02:38:27 -0400". The wrapper drops flyers that are not active now, so the fixtures only mean
 * anything against a fixed clock, and the only clock that makes every captured response
 * internally consistent is the one the spike ran at. Four of the 62 captured flyers are upcoming
 * at that instant — ALDI's 8131568 (starting 2026-09-23) and CVS's 8139694, Family Dollar's
 * 8141165, and Walgreens' 8130256 (all starting 2026-09-20) — which is the upcoming-flyer case
 * the wrapper has to drop.
 */
export const FIXTURE_NOW = new Date('2026-09-19T06:38:27.000Z');

/** The merchant flyers captured alongside their item rosters. Merchant ids are stable. */
export const FIXTURE_FLYERS = [
  { merchant: 'harris-teeter', merchantId: '2431', flyerId: '8132883' },
  { merchant: 'food-lion', merchantId: '2100', flyerId: '8128502' },
  { merchant: 'publix', merchantId: '2361', flyerId: '8128353' },
  { merchant: 'lowes-foods', merchantId: '2469', flyerId: '8132169' },
  { merchant: 'aldi', merchantId: '2353', flyerId: '8131738' },
  { merchant: 'cvs', merchantId: '2264', flyerId: '8139694' },
] as const;

/** The queries captured for 27514. */
export const FIXTURE_QUERIES = [
  'milk',
  'chicken',
  'harris teeter',
  'food lion',
  'publix',
  'lowes foods',
  'aldi',
  'cvs',
] as const;

function fixtureName(query: string): string {
  return query.replace(/\s+/g, '-');
}

function read(dir: string, file: string): unknown {
  return JSON.parse(readFileSync(`${dir}${dir.endsWith('/') ? '' : '/'}${file}`, 'utf8'));
}

function notFound(url: string): HttpResponse {
  return {
    status: 404,
    json: () => Promise.reject(new Error(`No fixture for ${url}`)),
  };
}

function ok(body: unknown): HttpResponse {
  return { status: 200, json: () => Promise.resolve(body) };
}

export interface FixtureTransportOptions {
  /**
   * Item ids whose detail the spike captured. `listFlyerItems` needs one detail request per
   * priced product, and only these five were recorded, so a flyer-items run is limited to a
   * roster of these items rather than inventing responses for the rest.
   */
  itemDetail?: Record<string, string>;
  /**
   * Where the raw captures live. Defaults to the checked-out repo's own copy, which is what every
   * Vitest caller wants; the E2E stack instead points this at the read-only mount the Compose
   * overlay gives the built image (`HEARTH_FLIPP_FIXTURE_DIR`), since the image never has the
   * source tree's `e2e/` directory beside it.
   */
  dir?: string;
}

/** Item detail fixtures, by item id. */
export const FIXTURE_ITEM_DETAIL: Record<string, string> = {
  '1040206756': 'item-harris-teeter-1040206756.json',
  '1039547929': 'item-food-lion-1039547929.json',
  '1039945367': 'item-publix-1039945367.json',
  '1039938734': 'item-lowes-foods-1039938734.json',
  '1041117892': 'item-cvs-1041117892.json',
};

/**
 * Cuts a captured roster down to the items the capture can actually answer for: the products
 * whose detail the spike recorded, plus the first empty-priced product and the first banner, so
 * the "skipped with no detail request" and "banners are not counted" rules still have a case.
 *
 * A flyer's full roster is 280-odd products and the spike recorded one detail per merchant.
 * Serving the whole roster would mean inventing 280 responses; answering 404 for them would
 * trip the circuit breaker on the fifth item and prove nothing about pricing.
 */
function rosterSubset(body: unknown, details: Record<string, string>): unknown {
  const roster = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const items = Array.isArray(roster['items'])
    ? (roster['items'] as Record<string, unknown>[])
    : [];
  const kept: Record<string, unknown>[] = [];
  let tookEmpty = false;
  let tookBanner = false;
  for (const item of items) {
    const id = String(item['id']);
    const priced = typeof item['price'] === 'string' && item['price'].trim() !== '';
    if (details[id] !== undefined) {
      kept.push(item);
    } else if (item['display_type'] === 1 && !priced && !tookEmpty) {
      kept.push(item);
      tookEmpty = true;
    } else if (item['display_type'] === 5 && !tookBanner) {
      kept.push(item);
      tookBanner = true;
    }
  }
  return { ...roster, items: kept };
}

/**
 * Maps a Flipp URL onto the recorded response for it. Anything the capture does not cover
 * answers 404, which is what the wrapper's own failure handling should see.
 */
export function fixtureTransport(options: FixtureTransportOptions = {}): HttpGet {
  const details = options.itemDetail ?? FIXTURE_ITEM_DETAIL;
  const dir = options.dir ?? RAW_FIXTURE_DIR;
  return (url: string) => {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const postalCode = parsed.searchParams.get('postal_code');

    if (path === '/flipp/items/search') {
      const query = parsed.searchParams.get('q') ?? '';
      if (postalCode !== FIXTURE_POSTAL_CODE) return Promise.resolve(notFound(url));
      const file = `search-${FIXTURE_POSTAL_CODE}-${fixtureName(query)}.json`;
      return Promise.resolve(
        (FIXTURE_QUERIES as readonly string[]).includes(query)
          ? ok(read(dir, file))
          : notFound(url),
      );
    }
    if (path === '/flipp/flyers') {
      return Promise.resolve(
        postalCode === FIXTURE_POSTAL_CODE
          ? ok(read(dir, `flyers-${FIXTURE_POSTAL_CODE}.json`))
          : notFound(url),
      );
    }
    if (path === '/flipp/merchants') {
      return Promise.resolve(ok(read(dir, `merchants-${FIXTURE_POSTAL_CODE}.json`)));
    }
    const flyerItems = /^\/flipp\/flyers\/(\d+)$/.exec(path);
    if (flyerItems !== null) {
      const entry = FIXTURE_FLYERS.find((flyer) => flyer.flyerId === flyerItems[1]);
      return Promise.resolve(
        entry === undefined
          ? notFound(url)
          : ok(
              rosterSubset(
                read(dir, `flyer-items-${entry.merchant}-${entry.flyerId}.json`),
                details,
              ),
            ),
      );
    }
    const itemDetail = /^\/flipp\/items\/(\d+)$/.exec(path);
    const detailFile = itemDetail === null ? undefined : details[itemDetail[1] ?? ''];
    if (detailFile !== undefined) return Promise.resolve(ok(read(dir, detailFile)));

    return Promise.resolve(notFound(url));
  };
}
