import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RAW_FIXTURE_DIR } from '../flipp/fixture-transport.js';
import { toCents } from '../money.js';
import { parsePrice } from './parse-price.js';
import type { SkipReason } from './parsers.js';

/**
 * The chain over every captured search item, merchant by merchant. The Phase 0 spike measured
 * these skip rates by hand; holding the parsers to them turns a parser regression into a failing
 * test rather than a quiet drop in yield (Technical Architecture, "Price normalization").
 */

interface RawItem {
  item_type?: string;
  merchant_name?: string;
  current_price?: number | null;
  original_price?: number | null;
  pre_price_text?: string | null;
  post_price_text?: string | null;
  sale_story?: string | null;
  name?: string;
}

const QUERIES = [
  'milk',
  'chicken',
  'harris-teeter',
  'food-lion',
  'publix',
  'lowes-foods',
  'aldi',
  'cvs',
];

interface Tally {
  fetched: number;
  skipped: number;
  reasons: Map<SkipReason, number>;
  unparseable: string[];
}

function run(): Map<string, Tally> {
  const byMerchant = new Map<string, Tally>();
  for (const query of QUERIES) {
    const body: unknown = JSON.parse(
      readFileSync(`${RAW_FIXTURE_DIR}search-27514-${query}.json`, 'utf8'),
    );
    const items = ((body as { items?: RawItem[] }).items ?? []).filter(
      (item) => item.item_type === 'flyer',
    );
    for (const item of items) {
      const merchant = item.merchant_name ?? 'unknown';
      let tally = byMerchant.get(merchant);
      if (tally === undefined) {
        tally = { fetched: 0, skipped: 0, reasons: new Map(), unparseable: [] };
        byMerchant.set(merchant, tally);
      }
      tally.fetched += 1;
      const result = parsePrice({
        currentPrice: toCents(item.current_price),
        originalPrice: toCents(item.original_price),
        prePriceText: item.pre_price_text ?? null,
        postPriceText: item.post_price_text ?? null,
        saleStory: item.sale_story ?? null,
      });
      if (!('skipped' in result)) continue;
      tally.skipped += 1;
      tally.reasons.set(result.skipped, (tally.reasons.get(result.skipped) ?? 0) + 1);
      if (result.skipped === 'unparseable') tally.unparseable.push(item.name ?? '');
    }
  }
  return byMerchant;
}

const tallies = run();

describe('parser yield over the 27514 captures', () => {
  // The spike's figures, which the chain has to reproduce within a point or two.
  const expected: [merchant: string, skipRate: number][] = [
    ['Harris Teeter', 0.19],
    ['ALDI', 0],
    ['Food Lion', 0.19],
    ['Lowes Foods', 0.14],
    ['CVS Pharmacy', 0.78],
    ['Publix', 0.46],
  ];

  it.each(expected)('skips about %s%% of %s items', (merchant, skipRate) => {
    const tally = tallies.get(merchant);
    expect(tally, `no captured items for ${merchant}`).toBeDefined();
    expect(tally?.fetched ?? 0).toBeGreaterThan(100);
    const actual = (tally?.skipped ?? 0) / (tally?.fetched ?? 1);
    expect(Math.abs(actual - skipRate)).toBeLessThanOrEqual(0.02);
  });

  it('leaves no priced item unparseable', () => {
    // Every skip has to name a rule from the Requirements table; "unparseable" means the chain
    // met a price shape nobody has written a parser for yet.
    const stragglers = [...tallies.values()].flatMap((tally) => tally.unparseable);
    expect(stragglers).toEqual([]);
  });

  it('never skips an ALDI item: its flyer is plain shelf prices throughout', () => {
    expect(tallies.get('ALDI')?.skipped).toBe(0);
  });

  it('attributes every skip to a documented reason', () => {
    const allowed = new Set<SkipReason>([
      'no_price',
      'rebate',
      'bogo_no_base',
      'buy_n_get_m',
      'minimum_quantity',
      'mix_and_match',
      'percent_off_no_base',
      'amount_off_no_original',
    ]);
    for (const tally of tallies.values()) {
      for (const reason of tally.reasons.keys()) expect(allowed.has(reason)).toBe(true);
    }
  });
});
