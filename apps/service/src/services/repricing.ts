import { sql, type Kysely } from 'kysely';
import type { PriceUnit } from '@hearth/shared';
import type { Database } from '../db.js';
import { toCents } from './money.js';

/**
 * Expired deal repricing. An item added from a sale that ended before the shopping happens is
 * corrected, never left at the stale sale price.
 *
 * It applies to every item whose `deal_valid_to` has passed — in the household's timezone, which
 * owns the household's dates — and whose status is not bought. Each is re-matched against
 * currently valid deals by (the household's postal code, `merchant_id`, `normalized_name`),
 * taking the lowest `unit_price`; then the item's own `regular_price`; then the price is cleared.
 * A price is never guessed.
 *
 * Runs when a list is fetched and from the daily `refresh-deals` job, so it is deterministic and
 * writes only when something actually changes: re-running it over settled items is a no-op, which
 * keeps `shopping_list.updated_at` (and the realtime stream) quiet.
 */

/** The item columns repricing reads and writes; money stays as the column's decimal string. */
export interface RepricedItem {
  merchantId: string | null;
  merchantName: string | null;
  dealExternalId: string | null;
  salePrice: string | null;
  regularPrice: string | null;
  dealValidTo: string | null;
  priceUnit: PriceUnit;
  conditionalPrice: boolean;
  price: string | null;
  originalSalePrice: string | null;
}

export interface CurrentDeal {
  externalId: string;
  merchantId: string;
  merchantName: string;
  unitPrice: string;
  originalPrice: string | null;
  priceUnit: PriceUnit;
  conditionalPrice: boolean;
  validTo: string;
}

const SNAPSHOT_KEYS = [
  'merchantId',
  'merchantName',
  'dealExternalId',
  'salePrice',
  'regularPrice',
  'dealValidTo',
  'priceUnit',
  'conditionalPrice',
  'price',
  'originalSalePrice',
] as const satisfies readonly (keyof RepricedItem)[];

const MONEY_KEYS = new Set<keyof RepricedItem>([
  'salePrice',
  'regularPrice',
  'price',
  'originalSalePrice',
]);

function sameValue(key: keyof RepricedItem, left: unknown, right: unknown): boolean {
  if (!MONEY_KEYS.has(key)) return left === right;
  const asCents = (value: unknown): number | null =>
    typeof value === 'string' ? toCents(value) : null;
  return asCents(left) === asCents(right);
}

/**
 * The new state of an item whose deal has expired, or null when nothing changes. Pure, so the
 * three outcomes are a table-driven unit test.
 */
export function decideReprice(
  item: RepricedItem,
  deal: CurrentDeal | undefined,
): RepricedItem | null {
  // The sale price the item carried before the first repricing, shown struck through beside the
  // new one; a second repricing must not overwrite it with the fallback it already took.
  const originalSalePrice = item.originalSalePrice ?? item.salePrice;

  const next: RepricedItem =
    deal === undefined
      ? { ...item, price: item.regularPrice, originalSalePrice }
      : {
          merchantId: deal.merchantId,
          merchantName: deal.merchantName,
          dealExternalId: deal.externalId,
          salePrice: deal.unitPrice,
          regularPrice: deal.originalPrice,
          dealValidTo: deal.validTo,
          priceUnit: deal.priceUnit,
          conditionalPrice: deal.conditionalPrice,
          price: deal.unitPrice,
          originalSalePrice,
        };

  const changed = SNAPSHOT_KEYS.some((key) => !sameValue(key, item[key], next[key]));
  return changed ? next : null;
}

interface CandidateRow extends RepricedItem {
  id: string;
  normalizedName: string;
  postalCode: string;
  today: string;
}

export type RepriceScope = { kind: 'list'; listId: string } | { kind: 'all' };

/**
 * Reprices the expired items in one list, or in every household (the daily job's scope).
 * Returns how many items changed.
 */
export async function repriceExpiredItems(
  db: Kysely<Database>,
  scope: RepriceScope,
): Promise<number> {
  const listFilter = scope.kind === 'list' ? sql`and l.id = ${scope.listId}` : sql``;
  const { rows: candidates } = await sql<CandidateRow>`
    select i.id,
           i.normalized_name as "normalizedName",
           i.merchant_id as "merchantId",
           i.merchant_name as "merchantName",
           i.deal_external_id as "dealExternalId",
           i.sale_price as "salePrice",
           i.regular_price as "regularPrice",
           i.deal_valid_to as "dealValidTo",
           i.price_unit as "priceUnit",
           i.conditional_price as "conditionalPrice",
           i.price,
           i.original_sale_price as "originalSalePrice",
           h.postal_code as "postalCode",
           (pg_catalog.now() at time zone h.timezone)::date::text as today
    from public.shopping_list_item i
    join public.shopping_list l on l.id = i.list_id
    join public.household h on h.id = l.household_id
    where i.status <> 'bought'
      and i.deal_valid_to is not null
      and i.deal_valid_to < (pg_catalog.now() at time zone h.timezone)::date
      ${listFilter}
    order by i.id
  `.execute(db);

  let repriced = 0;
  for (const candidate of candidates) {
    const deal = await bestCurrentDeal(db, candidate);
    const next = decideReprice(candidate, deal);
    if (next === null) continue;
    await db
      .updateTable('shopping_list_item')
      .set({
        merchant_id: next.merchantId,
        merchant_name: next.merchantName,
        deal_external_id: next.dealExternalId,
        sale_price: next.salePrice,
        regular_price: next.regularPrice,
        deal_valid_to: next.dealValidTo,
        price_unit: next.priceUnit,
        conditional_price: next.conditionalPrice,
        price: next.price,
        original_sale_price: next.originalSalePrice,
        repriced_at: new Date(),
      })
      .where('id', '=', candidate.id)
      .execute();
    repriced += 1;
  }
  return repriced;
}

/** The cheapest still-valid deal for the item's store and normalized name, if there is one. */
async function bestCurrentDeal(
  db: Kysely<Database>,
  candidate: CandidateRow,
): Promise<CurrentDeal | undefined> {
  if (candidate.merchantId === null) return undefined;
  const row = await db
    .selectFrom('deal')
    .where('postal_code', '=', candidate.postalCode)
    .where('merchant_id', '=', candidate.merchantId)
    .where('normalized_name', '=', candidate.normalizedName)
    .where('valid_to', '>=', candidate.today)
    .select([
      'external_id',
      'merchant_id',
      'merchant_name',
      'unit_price',
      'original_price',
      'price_unit',
      'conditional_price',
      'valid_to',
    ])
    // Lowest unit price wins; the id breaks a tie, so a rerun picks the same deal.
    .orderBy('unit_price')
    .orderBy('external_id')
    .executeTakeFirst();
  if (row === undefined) return undefined;
  return {
    externalId: row.external_id,
    merchantId: row.merchant_id,
    merchantName: row.merchant_name,
    unitPrice: row.unit_price,
    originalPrice: row.original_price,
    priceUnit: row.price_unit,
    conditionalPrice: row.conditional_price,
    validTo: row.valid_to,
  };
}
