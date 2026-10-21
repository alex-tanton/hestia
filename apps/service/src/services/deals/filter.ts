import { DEAL_PAGE_SIZE, type Deal, type DealSort } from '@hearth/shared';

/**
 * Deal filtering, sorting, and pagination (50 per page). Pure, over deals already read from `deal`,
 * because the set a request filters is the cached one — filtering must never decide whether to
 * fetch.
 */

export interface DealFilters {
  /** Merchant ids the result is limited to; empty means every merchant in the set. */
  merchantIds?: readonly string[];
  category?: string | undefined;
  /** Integer cents, inclusive. */
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
}

export function filterDeals(deals: readonly Deal[], filters: DealFilters): Deal[] {
  const merchantIds =
    filters.merchantIds === undefined || filters.merchantIds.length === 0
      ? undefined
      : new Set(filters.merchantIds);
  const category = filters.category?.toLowerCase();
  return deals.filter((deal) => {
    if (merchantIds !== undefined && !merchantIds.has(deal.merchantId)) return false;
    if (category !== undefined && deal.category?.toLowerCase() !== category) return false;
    if (filters.minPrice !== undefined && deal.unitPrice < filters.minPrice) return false;
    if (filters.maxPrice !== undefined && deal.unitPrice > filters.maxPrice) return false;
    return true;
  });
}

/**
 * `relevance` keeps the order the deals arrive in, which for a search is the order the source
 * ranked them and for a flyer is the stored order. `price` is by unit price ascending, with the
 * incoming order breaking ties so the sort is stable across pages.
 */
export function sortDeals(deals: readonly Deal[], sort: DealSort): Deal[] {
  if (sort === 'relevance') return [...deals];
  return deals
    .map((deal, index) => ({ deal, index }))
    .sort((a, b) => a.deal.unitPrice - b.deal.unitPrice || a.index - b.index)
    .map((entry) => entry.deal);
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize = DEAL_PAGE_SIZE,
): Paged<T> {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length,
    hasMore: start + pageSize < items.length,
  };
}

/** Filter, sort, then page, in that order, so `total` counts what matches rather than what fits. */
export function selectDeals(
  deals: readonly Deal[],
  options: DealFilters & { sort: DealSort; page: number; pageSize?: number },
): Paged<Deal> {
  const filtered = filterDeals(deals, options);
  return paginate(sortDeals(filtered, options.sort), options.page, options.pageSize);
}
