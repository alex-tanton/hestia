import type { Kysely } from 'kysely';
import type { AddFavoriteStoreRequest, FavoriteStore } from '@hestia/shared';
import type { Database } from '../../db.js';
import { fail } from '../../problem.js';

/**
 * Favorite stores. Favorites scope the default deal search, the flyer list, the daily flyer-item
 * refresh, readiness matching, and `flyer_refresh`; browsing every merchant near the postal code
 * stays available regardless. Any member may edit them.
 *
 * Stored by Flipp's merchant id, which is stable week to week, unlike its item ids.
 */

export async function listFavoriteStores(
  db: Kysely<Database>,
  householdId: string,
): Promise<FavoriteStore[]> {
  const rows = await db
    .selectFrom('household_favorite_store')
    .select(['id', 'merchant_id', 'merchant_name'])
    .where('household_id', '=', householdId)
    .orderBy('merchant_name')
    .execute();
  return rows.map((row) => ({
    id: row.id,
    merchantId: row.merchant_id,
    merchantName: row.merchant_name,
  }));
}

export async function favoriteMerchantIds(
  db: Kysely<Database>,
  householdId: string,
): Promise<string[]> {
  const rows = await db
    .selectFrom('household_favorite_store')
    .select('merchant_id')
    .where('household_id', '=', householdId)
    .execute();
  return rows.map((row) => row.merchant_id);
}

/** Adding a store the household already favorites returns the existing row rather than failing. */
export async function addFavoriteStore(
  db: Kysely<Database>,
  householdId: string,
  input: AddFavoriteStoreRequest,
): Promise<FavoriteStore> {
  const row = await db
    .insertInto('household_favorite_store')
    .values({
      household_id: householdId,
      merchant_id: input.merchantId,
      merchant_name: input.merchantName,
    })
    .onConflict((conflict) =>
      conflict
        .columns(['household_id', 'merchant_id'])
        .doUpdateSet((eb) => ({ merchant_name: eb.ref('excluded.merchant_name') })),
    )
    .returning(['id', 'merchant_id', 'merchant_name'])
    .executeTakeFirst();
  if (row === undefined) throw fail(404, 'Household not found.');
  return { id: row.id, merchantId: row.merchant_id, merchantName: row.merchant_name };
}

/** By merchant id, because that is what the merchant list and the flyer rows carry. */
export async function removeFavoriteStore(
  db: Kysely<Database>,
  householdId: string,
  merchantId: string,
): Promise<void> {
  const deleted = await db
    .deleteFrom('household_favorite_store')
    .where('household_id', '=', householdId)
    .where('merchant_id', '=', merchantId)
    .returning('id')
    .executeTakeFirst();
  if (deleted === undefined) throw fail(404, 'That store is not one of your favorites.');
}
