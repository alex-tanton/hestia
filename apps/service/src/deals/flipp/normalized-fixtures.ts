import type { Flyer, Merchant, NormalizedDeal } from '../deal-source.js';
import { FlippDealSource } from './flipp-deal-source.js';
import {
  FIXTURE_FLYERS,
  FIXTURE_NOW,
  FIXTURE_POSTAL_CODE,
  FIXTURE_QUERIES,
  fixtureTransport,
} from './fixture-transport.js';
import { FlippRequestQueue, buildUserAgent } from './request-queue.js';

/**
 * Builds the normalized fixtures from the raw captures (both fixture kinds are checked in, and
 * refreshed deliberately so an upstream change shows up as a diff). One function, shared by the
 * generator script and the test that asserts the committed files still match, so the two can never
 * drift.
 */

export interface NormalizedFixtures {
  readonly files: { readonly name: string; readonly body: unknown }[];
  readonly skipCounts: unknown;
}

export async function buildNormalizedFixtures(): Promise<NormalizedFixtures> {
  const source = new FlippDealSource({
    // No gap and no backoff: the transport is the recorded fixtures, not the network.
    queue: new FlippRequestQueue({
      get: fixtureTransport(),
      userAgent: buildUserAgent('https://hestia.invalid'),
      minGapMs: 0,
      attempts: 1,
    }),
    now: () => FIXTURE_NOW,
  });

  const files: { name: string; body: unknown }[] = [];

  const flyers: Flyer[] = await source.listFlyers(FIXTURE_POSTAL_CODE);
  files.push({ name: `flyers-${FIXTURE_POSTAL_CODE}.json`, body: flyers });

  const merchants: Merchant[] = await source.listMerchants(FIXTURE_POSTAL_CODE);
  files.push({ name: `merchants-${FIXTURE_POSTAL_CODE}.json`, body: merchants });

  for (const query of FIXTURE_QUERIES) {
    const deals: NormalizedDeal[] = await source.searchItems(FIXTURE_POSTAL_CODE, query);
    files.push({
      name: `search-${FIXTURE_POSTAL_CODE}-${query.replace(/\s+/g, '-')}.json`,
      body: deals,
    });
  }

  for (const flyer of FIXTURE_FLYERS) {
    const deals = await source.listFlyerItems(flyer.flyerId);
    files.push({ name: `flyer-items-${flyer.merchant}-${flyer.flyerId}.json`, body: deals });
  }

  return { files, skipCounts: source.skipCounts() };
}

export function serializeFixture(body: unknown): string {
  return `${JSON.stringify(body, null, 2)}\n`;
}
