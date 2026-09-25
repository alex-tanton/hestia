import type { Kysely } from 'kysely';
import { normalize } from '@hearth/matching';
import type { CreatePantryItemRequest, PantryItem, UpdatePantryItemRequest } from '@hearth/shared';
import type { Database } from '../db.js';
import { markHouseholdActive } from './households.js';
import { fail } from '../problem.js';

/*
 * The pantry (Requirements, "Pantry"): a lightweight inventory that feeds readiness scoring and
 * stops duplicate buying. It is unique on (household_id, normalized_name), so adding something
 * already there updates it rather than duplicating it.
 */

export interface PantryRow {
  id: string;
  household_id: string;
  item_name: string;
  normalized_name: string;
  quantity_note: string | null;
  last_updated: Date | string;
}

export function toPantryItem(row: PantryRow): PantryItem {
  return {
    id: row.id,
    householdId: row.household_id,
    itemName: row.item_name,
    normalizedName: row.normalized_name,
    quantityNote: row.quantity_note,
    lastUpdated: (row.last_updated instanceof Date
      ? row.last_updated
      : new Date(row.last_updated)
    ).toISOString(),
  };
}

export async function listPantry(db: Kysely<Database>, householdId: string): Promise<PantryItem[]> {
  const rows = await db
    .selectFrom('pantry_item')
    .selectAll()
    .where('household_id', '=', householdId)
    .orderBy('item_name')
    .orderBy('id')
    .execute();
  return rows.map(toPantryItem);
}

export async function addPantryItem(
  db: Kysely<Database>,
  householdId: string,
  input: CreatePantryItemRequest,
): Promise<PantryItem> {
  const row = await db
    .insertInto('pantry_item')
    .values({
      household_id: householdId,
      item_name: input.itemName,
      normalized_name: normalize(input.itemName),
      quantity_note: input.quantityNote ?? null,
    })
    .onConflict((conflict) =>
      conflict.columns(['household_id', 'normalized_name']).doUpdateSet({
        item_name: input.itemName,
        quantity_note: input.quantityNote ?? null,
        last_updated: new Date(),
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow();
  return toPantryItem(row);
}

/** The pantry row, or 404; reading it means RLS allowed it. */
async function requirePantryItem(db: Kysely<Database>, id: string): Promise<PantryItem> {
  const row = await db
    .selectFrom('pantry_item')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  if (row === undefined) throw fail(404, 'Pantry item not found.');
  await markHouseholdActive(db, row.household_id);
  return toPantryItem(row);
}

export async function updatePantryItem(
  db: Kysely<Database>,
  id: string,
  input: UpdatePantryItemRequest,
): Promise<PantryItem> {
  await requirePantryItem(db, id);
  const row = await db
    .updateTable('pantry_item')
    .set({
      ...(input.itemName === undefined
        ? {}
        : { item_name: input.itemName, normalized_name: normalize(input.itemName) }),
      ...(input.quantityNote === undefined ? {} : { quantity_note: input.quantityNote }),
      last_updated: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();
  return toPantryItem(row);
}

export async function deletePantryItem(db: Kysely<Database>, id: string): Promise<void> {
  await requirePantryItem(db, id);
  await db.deleteFrom('pantry_item').where('id', '=', id).execute();
}
