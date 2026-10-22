import { describe, expect, it } from 'vitest';
import type { Deal } from '@hearth/shared';
import { filterDeals, paginate, selectDeals, sortDeals } from './filter.js';

/** Deal search and browse, paginated at 50 per page. */

let counter = 0;

function deal(overrides: Partial<Deal> = {}): Deal {
  counter += 1;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    externalId: `item-${String(counter)}`,
    merchantId: '2100',
    merchantName: 'Food Lion',
    name: 'Broccoli Crowns',
    normalizedName: 'broccoli',
    unitPrice: 199,
    priceUnit: 'lb',
    originalPrice: null,
    discountPercent: null,
    displayPrice: 'MVP $1.99 LB',
    conditionalPrice: true,
    conditionalReason: 'loyalty_card',
    category: 'Food Items',
    imageUrl: null,
    sourceUrl: null,
    flyerId: '8128502',
    validFrom: '2026-09-23',
    validTo: '2026-09-29',
    fetchedAt: '2026-09-25T06:00:00.000Z',
    ...overrides,
  };
}

describe('filterDeals', () => {
  const deals = [
    deal({ merchantId: '2100', unitPrice: 199, category: 'Food Items' }),
    deal({ merchantId: '2431', unitPrice: 350, category: 'Food Items' }),
    deal({ merchantId: '2264', unitPrice: 479, category: 'Personal Care' }),
  ];

  it('keeps everything when no filter is given', () => {
    expect(filterDeals(deals, {})).toHaveLength(3);
    expect(filterDeals(deals, { merchantIds: [] })).toHaveLength(3);
  });

  it('filters by store', () => {
    expect(
      filterDeals(deals, { merchantIds: ['2100', '2431'] }).map((d) => d.merchantId),
    ).toStrictEqual(['2100', '2431']);
  });

  it('filters by category, ignoring case', () => {
    expect(filterDeals(deals, { category: 'personal care' })).toHaveLength(1);
  });

  it('filters by an inclusive price range in integer cents', () => {
    expect(
      filterDeals(deals, { minPrice: 199, maxPrice: 350 }).map((d) => d.unitPrice),
    ).toStrictEqual([199, 350]);
    expect(filterDeals(deals, { minPrice: 200 }).map((d) => d.unitPrice)).toStrictEqual([350, 479]);
    expect(filterDeals(deals, { maxPrice: 199 }).map((d) => d.unitPrice)).toStrictEqual([199]);
  });

  it('applies every filter together', () => {
    expect(filterDeals(deals, { merchantIds: ['2100', '2264'], maxPrice: 400 })).toHaveLength(1);
  });

  it('excludes an uncategorised deal from a category filter rather than guessing', () => {
    expect(filterDeals([deal({ category: null })], { category: 'Food Items' })).toStrictEqual([]);
  });
});

describe('sortDeals', () => {
  it('leaves relevance order alone, which is how the source ranked it', () => {
    const deals = [deal({ unitPrice: 900 }), deal({ unitPrice: 100 })];
    expect(sortDeals(deals, 'relevance').map((d) => d.unitPrice)).toStrictEqual([900, 100]);
  });

  it('sorts by unit price ascending', () => {
    const deals = [deal({ unitPrice: 900 }), deal({ unitPrice: 100 }), deal({ unitPrice: 450 })];
    expect(sortDeals(deals, 'price').map((d) => d.unitPrice)).toStrictEqual([100, 450, 900]);
  });

  it('is stable on ties, so pages do not shuffle between requests', () => {
    const first = deal({ unitPrice: 199, externalId: 'a' });
    const second = deal({ unitPrice: 199, externalId: 'b' });
    expect(sortDeals([first, second], 'price').map((d) => d.externalId)).toStrictEqual(['a', 'b']);
  });

  it('does not mutate the input', () => {
    const deals = [deal({ unitPrice: 900 }), deal({ unitPrice: 100 })];
    sortDeals(deals, 'price');
    expect(deals[0]?.unitPrice).toBe(900);
  });
});

describe('paginate', () => {
  const deals = Array.from({ length: 120 }, (_, index) => deal({ unitPrice: index + 1 }));

  it('pages at 50 by default', () => {
    const page = paginate(deals, 1);
    expect(page.pageSize).toBe(50);
    expect(page.items).toHaveLength(50);
    expect(page.total).toBe(120);
    expect(page.hasMore).toBe(true);
  });

  it('reports the last page as having no more', () => {
    const page = paginate(deals, 3);
    expect(page.items).toHaveLength(20);
    expect(page.hasMore).toBe(false);
  });

  it('returns nothing past the end rather than failing', () => {
    expect(paginate(deals, 9).items).toStrictEqual([]);
  });

  it('counts what matched, not what fitted on the page', () => {
    expect(selectDeals(deals, { maxPrice: 60, sort: 'price', page: 1 }).total).toBe(60);
  });
});

describe('selectDeals', () => {
  it('filters, then sorts, then pages, in that order', () => {
    const deals = [
      deal({ merchantId: '2100', unitPrice: 900 }),
      deal({ merchantId: '2431', unitPrice: 100 }),
      deal({ merchantId: '2100', unitPrice: 450 }),
    ];
    const page = selectDeals(deals, {
      merchantIds: ['2100'],
      sort: 'price',
      page: 1,
      pageSize: 1,
    });
    expect(page.items.map((d) => d.unitPrice)).toStrictEqual([450]);
    expect(page.total).toBe(2);
    expect(page.hasMore).toBe(true);
  });
});
