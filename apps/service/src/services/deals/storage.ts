import { sql, type Kysely } from 'kysely';
import { normalize } from '@hestia/matching';
import type { Deal } from '@hestia/shared';
import type { Database } from '../../db.js';
import type { NormalizedDeal } from '../../deals/deal-source.js';
import { fromCents, toCents } from '../money.js';
import type { RefreshBookkeeping } from './dormancy.js';

/**
 * Deal storage. `deal` rows are upserted on (`postal_code`, `external_id`), with `normalized_name`
 * from the matching package and `fetched_at` set to the time of the fetch, so a rerun of a job
 * changes nothing. `deal_query_cache` holds the ids one search returned, in the order the source
 * ranked them, so a cached search keeps its relevance order.
 *
 * Every function here takes a Kysely bound to a transaction: the caller's `withUserDb` one for a
 * request, or a job's `service_role` one. Nothing here chooses its own privileges.
 */

/** The columns a deals response needs, read back after an upsert or straight from the cache. */
const DEAL_COLUMNS = [
  'id',
  'external_id',
  'merchant_id',
  'merchant_name',
  'name',
  'normalized_name',
  'unit_price',
  'price_unit',
  'original_price',
  'discount_percent',
  'display_price',
  'conditional_price',
  'conditional_reason',
  'category',
  'image_url',
  'source_url',
  'flyer_id',
  'valid_from',
  'valid_to',
  'fetched_at',
] as const;

interface DealRow {
  id: string;
  external_id: string;
  merchant_id: string;
  merchant_name: string;
  name: string;
  normalized_name: string;
  unit_price: string;
  price_unit: Deal['priceUnit'];
  original_price: string | null;
  discount_percent: number | null;
  display_price: string;
  conditional_price: boolean;
  conditional_reason: Deal['conditionalReason'];
  category: string | null;
  image_url: string | null;
  source_url: string | null;
  flyer_id: string;
  valid_from: string;
  valid_to: string;
  fetched_at: Date | string;
}

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

/** Money leaves the database as a decimal string and becomes integer cents here, in one layer. */
export function toDeal(row: DealRow): Deal {
  const unitPrice = toCents(row.unit_price);
  if (unitPrice === null) throw new Error('a deal row has no unit price');
  return {
    id: row.id,
    externalId: row.external_id,
    merchantId: row.merchant_id,
    merchantName: row.merchant_name,
    name: row.name,
    normalizedName: row.normalized_name,
    unitPrice,
    priceUnit: row.price_unit,
    originalPrice: toCents(row.original_price),
    discountPercent: row.discount_percent,
    displayPrice: row.display_price,
    conditionalPrice: row.conditional_price,
    conditionalReason: row.conditional_reason,
    category: row.category,
    imageUrl: row.image_url,
    sourceUrl: row.source_url,
    flyerId: row.flyer_id,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    fetchedAt: iso(row.fetched_at),
  };
}

/**
 * Upserts one fetch's deals and returns their ids in the order given, which is the order the
 * search cache stores. `category` is never replaced with null, because flyer items carry no
 * category and would otherwise erase the one search found for the same item.
 */
export async function upsertDeals(
  db: Kysely<Database>,
  postalCode: string,
  deals: readonly NormalizedDeal[],
  fetchedAt: Date,
): Promise<string[]> {
  if (deals.length === 0) return [];

  const values = deals.map((deal) => ({
    external_id: deal.externalId,
    merchant_id: deal.merchantId,
    merchant_name: deal.merchantName,
    name: deal.name,
    normalized_name: normalize(deal.name),
    unit_price: fromCents(deal.unitPrice) ?? '0.00',
    price_unit: deal.priceUnit,
    original_price: fromCents(deal.originalPrice),
    discount_percent: deal.discountPercent,
    display_price: deal.displayPrice,
    conditional_price: deal.conditionalPrice,
    conditional_reason: deal.conditionalReason,
    category: deal.category,
    image_url: deal.imageUrl,
    source_url: deal.sourceUrl,
    flyer_id: deal.flyerId,
    postal_code: postalCode,
    valid_from: deal.validFrom,
    valid_to: deal.validTo,
    fetched_at: fetchedAt,
  }));

  const rows = await db
    .insertInto('deal')
    .values(values)
    .onConflict((conflict) =>
      conflict.columns(['postal_code', 'external_id']).doUpdateSet((eb) => ({
        merchant_id: eb.ref('excluded.merchant_id'),
        merchant_name: eb.ref('excluded.merchant_name'),
        name: eb.ref('excluded.name'),
        normalized_name: eb.ref('excluded.normalized_name'),
        unit_price: eb.ref('excluded.unit_price'),
        price_unit: eb.ref('excluded.price_unit'),
        original_price: eb.ref('excluded.original_price'),
        discount_percent: eb.ref('excluded.discount_percent'),
        display_price: eb.ref('excluded.display_price'),
        conditional_price: eb.ref('excluded.conditional_price'),
        conditional_reason: eb.ref('excluded.conditional_reason'),
        category: eb.fn.coalesce(eb.ref('excluded.category'), eb.ref('deal.category')),
        image_url: eb.ref('excluded.image_url'),
        source_url: eb.ref('excluded.source_url'),
        flyer_id: eb.ref('excluded.flyer_id'),
        valid_from: eb.ref('excluded.valid_from'),
        valid_to: eb.ref('excluded.valid_to'),
        fetched_at: eb.ref('excluded.fetched_at'),
      })),
    )
    .returning(['id', 'external_id'])
    .execute();

  const byExternalId = new Map(rows.map((row) => [row.external_id, row.id]));
  return deals
    .map((deal) => byExternalId.get(deal.externalId))
    .filter((id): id is string => id !== undefined);
}

/** Deals by id, in the order the ids are given, dropping any that pruning has since removed. */
export async function readDealsInOrder(
  db: Kysely<Database>,
  postalCode: string,
  ids: readonly string[],
): Promise<Deal[]> {
  if (ids.length === 0) return [];
  const rows = (await db
    .selectFrom('deal')
    .select(DEAL_COLUMNS)
    .where('postal_code', '=', postalCode)
    .where('id', 'in', ids)
    .execute()) as unknown as DealRow[];
  const byId = new Map(rows.map((row) => [row.id, toDeal(row)]));
  return ids.map((id) => byId.get(id)).filter((deal): deal is Deal => deal !== undefined);
}

/** Every stored deal for one flyer at one postal code. This is the flyer-items cache. */
export async function readFlyerDeals(
  db: Kysely<Database>,
  postalCode: string,
  flyerId: string,
): Promise<Deal[]> {
  const rows = (await db
    .selectFrom('deal')
    .select(DEAL_COLUMNS)
    .where('postal_code', '=', postalCode)
    .where('flyer_id', '=', flyerId)
    .orderBy('name')
    .execute()) as unknown as DealRow[];
  return rows.map(toDeal);
}

/** Stored deal counts per flyer, for the flyer grid's item count. */
export async function countDealsByFlyer(
  db: Kysely<Database>,
  postalCode: string,
): Promise<Map<string, number>> {
  const rows = await db
    .selectFrom('deal')
    .select(['flyer_id'])
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .where('postal_code', '=', postalCode)
    .groupBy('flyer_id')
    .execute();
  return new Map(rows.map((row) => [row.flyer_id, Number(row.count)]));
}

/** The flyer ids that already have deals, which is what makes a flyer "not new" and "not stale". */
export async function readKnownFlyerIds(
  db: Kysely<Database>,
  postalCode: string,
): Promise<Set<string>> {
  const rows = await db
    .selectFrom('deal')
    .select('flyer_id')
    .distinct()
    .where('postal_code', '=', postalCode)
    .execute();
  return new Set(rows.map((row) => row.flyer_id));
}

export interface QueryCacheEntry {
  dealIds: string[];
  cachedAt: Date;
}

export async function readQueryCache(
  db: Kysely<Database>,
  postalCode: string,
  normalizedQuery: string,
): Promise<QueryCacheEntry | undefined> {
  const row = await db
    .selectFrom('deal_query_cache')
    .select(['deal_ids', 'cached_at'])
    .where('postal_code', '=', postalCode)
    .where('normalized_query', '=', normalizedQuery)
    .executeTakeFirst();
  if (row === undefined) return undefined;
  return { dealIds: row.deal_ids, cachedAt: new Date(row.cached_at) };
}

export async function writeQueryCache(
  db: Kysely<Database>,
  postalCode: string,
  normalizedQuery: string,
  dealIds: readonly string[],
  cachedAt: Date,
): Promise<void> {
  await db
    .insertInto('deal_query_cache')
    .values({
      postal_code: postalCode,
      normalized_query: normalizedQuery,
      deal_ids: [...dealIds],
      cached_at: cachedAt,
    })
    .onConflict((conflict) =>
      conflict.columns(['postal_code', 'normalized_query']).doUpdateSet((eb) => ({
        deal_ids: eb.ref('excluded.deal_ids'),
        cached_at: eb.ref('excluded.cached_at'),
      })),
    )
    .execute();
}

export async function readRefreshBookkeeping(
  db: Kysely<Database>,
  postalCode: string,
): Promise<RefreshBookkeeping | undefined> {
  const row = await db
    .selectFrom('postal_code_refresh')
    .select(['last_refreshed_at', 'last_on_demand_at'])
    .where('postal_code', '=', postalCode)
    .executeTakeFirst();
  if (row === undefined) return undefined;
  return {
    lastRefreshedAt: row.last_refreshed_at === null ? null : new Date(row.last_refreshed_at),
    lastOnDemandAt: row.last_on_demand_at === null ? null : new Date(row.last_on_demand_at),
  };
}

export async function markRefreshed(
  db: Kysely<Database>,
  postalCode: string,
  at: Date,
): Promise<void> {
  await db
    .insertInto('postal_code_refresh')
    .values({ postal_code: postalCode, last_refreshed_at: at })
    .onConflict((conflict) =>
      conflict
        .column('postal_code')
        .doUpdateSet((eb) => ({ last_refreshed_at: eb.ref('excluded.last_refreshed_at') })),
    )
    .execute();
}

/**
 * Claims this UTC day's one on-demand refresh, atomically: the row is written only when
 * `last_on_demand_at` is not already in the current UTC day, so two concurrent requests for the
 * same dormant postal code queue one refresh between them. Returns whether the claim was taken.
 */
export async function claimOnDemandRefresh(
  db: Kysely<Database>,
  postalCode: string,
  at: Date,
): Promise<boolean> {
  const { rows } = await sql<{ postal_code: string }>`
    insert into public.postal_code_refresh (postal_code, last_on_demand_at)
    values (${postalCode}, ${at})
    on conflict (postal_code) do update
      set last_on_demand_at = excluded.last_on_demand_at
      where public.postal_code_refresh.last_on_demand_at is null
         or (public.postal_code_refresh.last_on_demand_at at time zone 'UTC')::date
            <> (excluded.last_on_demand_at at time zone 'UTC')::date
    returning postal_code
  `.execute(db);
  return rows.length > 0;
}
