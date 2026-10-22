import { sql, type Kysely, type Selectable } from 'kysely';
import { normalize } from '@hearth/matching';
import type {
  CreateListItemRequest,
  ListItem,
  PantryItem,
  ShoppingList,
  ShoppingListDetail,
  StoreGroup,
  UpdateListItemRequest,
} from '@hearth/shared';
import type { Database } from '../db.js';
import { fail } from '../problem.js';
import { markHouseholdActive } from './households.js';
import type { DroppedCopyReport } from '../notifications/copy.js';
import { recordListActivity } from './list-activity.js';
import { fromCents, toCents, toNumber } from './money.js';
import { toPantryItem } from './pantry.js';
import { repriceExpiredItems } from './repricing.js';
import { subtotal } from './subtotals.js';

/*
 * Shopping lists. Every function takes a Kysely bound to the caller's withUserDb transaction, so
 * RLS decides what it can see; a row RLS hides is reported as not found, never as forbidden.
 */

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

type ItemRow = Selectable<Database['shopping_list_item']>;
type ListRow = Selectable<Database['shopping_list']>;

function toItem(row: ItemRow): ListItem {
  return {
    id: row.id,
    listId: row.list_id,
    itemName: row.item_name,
    normalizedName: row.normalized_name,
    quantity: toNumber(row.quantity),
    quantityNote: row.quantity_note,
    status: row.status,
    addedBy: row.added_by,
    source: row.source,
    merchantId: row.merchant_id,
    merchantName: row.merchant_name,
    dealExternalId: row.deal_external_id,
    salePriceCents: toCents(row.sale_price),
    regularPriceCents: toCents(row.regular_price),
    dealValidTo: row.deal_valid_to,
    priceUnit: row.price_unit,
    conditionalPrice: row.conditional_price,
    priceCents: toCents(row.price),
    originalSalePriceCents: toCents(row.original_sale_price),
    repricedAt: row.repriced_at === null ? null : iso(row.repriced_at),
    contributingRecipeIds: row.contributing_recipe_ids,
    createdAt: iso(row.created_at),
  };
}

function toList(row: ListRow, items: readonly ListItem[]): ShoppingList {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    archivedAt: row.archived_at === null ? null : iso(row.archived_at),
    createdBy: row.created_by,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    itemCount: items.length,
    outstandingCount: items.filter((item) => item.status !== 'bought').length,
  };
}

/**
 * Items grouped by store, each group carrying its own subtotal. The unassigned "Anywhere" group
 * sorts last; the rest sort by merchant name.
 */
function groupByStore(items: readonly ListItem[]): StoreGroup[] {
  const groups = new Map<string, ListItem[]>();
  for (const item of items) {
    const key = item.merchantId ?? '';
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [item]);
    else group.push(item);
  }
  return [...groups.values()]
    .map((group) => {
      const first = group[0];
      if (first === undefined) throw new Error('a store group is never empty');
      return {
        merchantId: first.merchantId,
        merchantName: first.merchantName,
        ...subtotal(
          group.map((item) => ({
            priceCents: item.priceCents,
            priceUnit: item.priceUnit,
            quantity: item.quantity === null ? null : String(item.quantity),
          })),
        ),
        items: group,
      };
    })
    .sort((left, right) => {
      if (left.merchantId === null) return right.merchantId === null ? 0 : 1;
      if (right.merchantId === null) return -1;
      return (left.merchantName ?? '').localeCompare(right.merchantName ?? '');
    });
}

/** The list row, or 404. Reading it means RLS allowed it, so the household is the caller's. */
export async function requireList(db: Kysely<Database>, listId: string): Promise<ListRow> {
  const row = await db
    .selectFrom('shopping_list')
    .selectAll()
    .where('id', '=', listId)
    .executeTakeFirst();
  if (row === undefined) throw fail(404, 'List not found.');
  // The list's own path does not name its household, but working a list is household activity.
  await markHouseholdActive(db, row.household_id);
  return row;
}

async function itemsOf(db: Kysely<Database>, listId: string): Promise<ListItem[]> {
  const rows = await db
    .selectFrom('shopping_list_item')
    .selectAll()
    .where('list_id', '=', listId)
    .orderBy('created_at')
    .orderBy('id')
    .execute();
  return rows.map(toItem);
}

export async function detailOf(db: Kysely<Database>, row: ListRow): Promise<ShoppingListDetail> {
  const items = await itemsOf(db, row.id);
  return {
    ...toList(row, items),
    // A store subtotal covers needed and in-cart items; bought items sit in their own group.
    storeGroups: groupByStore(items.filter((item) => item.status !== 'bought')),
    bought: items.filter((item) => item.status === 'bought'),
  };
}

export async function listShoppingLists(
  db: Kysely<Database>,
  householdId: string,
  archived: boolean,
): Promise<ShoppingList[]> {
  const rows = await db
    .selectFrom('shopping_list')
    .selectAll()
    .where('household_id', '=', householdId)
    .where('archived_at', archived ? 'is not' : 'is', null)
    .orderBy('updated_at', 'desc')
    .orderBy('id')
    .execute();
  const counts = await db
    .selectFrom('shopping_list_item')
    .innerJoin('shopping_list', 'shopping_list.id', 'shopping_list_item.list_id')
    .where('shopping_list.household_id', '=', householdId)
    .select(['shopping_list_item.list_id', 'shopping_list_item.status'])
    .execute();
  return rows.map((row) => {
    const own = counts.filter((count) => count.list_id === row.id);
    return {
      ...toList(row, []),
      itemCount: own.length,
      outstandingCount: own.filter((count) => count.status !== 'bought').length,
    };
  });
}

export async function createList(
  db: Kysely<Database>,
  householdId: string,
  userId: string,
  name: string,
): Promise<ShoppingListDetail> {
  const row = await db
    .insertInto('shopping_list')
    .values({ household_id: householdId, name, created_by: userId })
    .returningAll()
    .executeTakeFirstOrThrow();
  return detailOf(db, row);
}

/**
 * A list as its detail screen shows it. Expired deal prices are corrected first, so a subtotal
 * is never quietly built on last week's sale price.
 */
export async function getList(db: Kysely<Database>, listId: string): Promise<ShoppingListDetail> {
  const row = await requireList(db, listId);
  await repriceExpiredItems(db, { kind: 'list', listId });
  return detailOf(db, await refreshed(db, row));
}

/** The list row again, since repricing bumps `updated_at` when it changes an item. */
export async function refreshed(db: Kysely<Database>, row: ListRow): Promise<ListRow> {
  const updated = await db
    .selectFrom('shopping_list')
    .selectAll()
    .where('id', '=', row.id)
    .executeTakeFirst();
  return updated ?? row;
}

export async function renameList(
  db: Kysely<Database>,
  listId: string,
  name: string,
): Promise<ShoppingListDetail> {
  await requireList(db, listId);
  const row = await db
    .updateTable('shopping_list')
    .set({ name })
    .where('id', '=', listId)
    .returningAll()
    .executeTakeFirstOrThrow();
  return detailOf(db, row);
}

/** Archiving hides a list from the main view and keeps it readable. */
export async function setListArchived(
  db: Kysely<Database>,
  listId: string,
  archived: boolean,
): Promise<ShoppingListDetail> {
  await requireList(db, listId);
  const row = await db
    .updateTable('shopping_list')
    .set({ archived_at: archived ? new Date() : null })
    .where('id', '=', listId)
    .returningAll()
    .executeTakeFirstOrThrow();
  return detailOf(db, row);
}

/** Deleting a list removes its items too, by cascade. The confirmation is the UI's. */
export async function deleteList(db: Kysely<Database>, listId: string): Promise<void> {
  await requireList(db, listId);
  await db.deleteFrom('shopping_list').where('id', '=', listId).execute();
}

interface NewItemValues {
  item_name: string;
  normalized_name: string;
  source: ListItem['source'];
  merchant_id: string | null;
  merchant_name: string | null;
  deal_external_id: string | null;
  sale_price: string | null;
  regular_price: string | null;
  deal_valid_to: string | null;
  price_unit: ListItem['priceUnit'];
  conditional_price: boolean;
  price: string | null;
}

/** The deal's own fields, copied once: a list item never holds a live reference to a deal. */
async function snapshotOfDeal(db: Kysely<Database>, dealId: string): Promise<NewItemValues> {
  const deal = await db.selectFrom('deal').selectAll().where('id', '=', dealId).executeTakeFirst();
  if (deal === undefined) throw fail(404, 'That deal is no longer available.');
  return {
    item_name: deal.name,
    // The deal's own normalized name, so repricing re-matches on exactly the key it was found by.
    normalized_name: deal.normalized_name,
    source: 'from_deal',
    merchant_id: deal.merchant_id,
    merchant_name: deal.merchant_name,
    deal_external_id: deal.external_id,
    sale_price: deal.unit_price,
    regular_price: deal.original_price,
    deal_valid_to: deal.valid_to,
    price_unit: deal.price_unit,
    conditional_price: deal.conditional_price,
    price: deal.unit_price,
  };
}

function manualValues(input: Extract<CreateListItemRequest, { source: 'manual' }>): NewItemValues {
  return {
    item_name: input.itemName,
    normalized_name: normalize(input.itemName),
    source: 'manual',
    merchant_id: input.merchantId ?? null,
    merchant_name: input.merchantName ?? null,
    deal_external_id: null,
    sale_price: null,
    regular_price: null,
    deal_valid_to: null,
    price_unit: input.priceUnit ?? 'each',
    conditional_price: false,
    price: fromCents(input.priceCents ?? null),
  };
}

/**
 * Adds an item. The id may be client-generated, and a replay of the same id changes nothing
 * rather than failing; `added_by` always comes from the caller's JWT.
 */
export async function addListItem(
  db: Kysely<Database>,
  listId: string,
  userId: string,
  input: CreateListItemRequest,
  report?: DroppedCopyReport,
): Promise<ShoppingListDetail> {
  const row = await requireList(db, listId);
  const values =
    input.source === 'manual' ? manualValues(input) : await snapshotOfDeal(db, input.dealId);

  const inserted = await db
    .insertInto('shopping_list_item')
    .values({
      ...(input.id === undefined ? {} : { id: input.id }),
      list_id: listId,
      added_by: userId,
      quantity: input.quantity ?? null,
      quantity_note: input.quantityNote ?? null,
      ...values,
    })
    .onConflict((conflict) => conflict.column('id').doNothing())
    .executeTakeFirst();
  // A replay of an id that already landed inserts nothing, so it is not a second addition.
  if (Number(inserted.numInsertedOrUpdatedRows ?? 0) > 0) {
    await recordListActivity(db, row, userId, 1, new Date(), report);
  }

  return detailOf(db, await refreshed(db, row));
}

/**
 * Sets an item's absolute values. Two members editing the same item is last-write-wins, with the
 * accepted quirk that a late offline "in cart" can move a bought item back.
 */
export async function updateListItem(
  db: Kysely<Database>,
  listId: string,
  itemId: string,
  input: UpdateListItemRequest,
): Promise<ShoppingListDetail> {
  const row = await requireList(db, listId);
  const result = await db
    .updateTable('shopping_list_item')
    .set({
      ...(input.itemName === undefined
        ? {}
        : { item_name: input.itemName, normalized_name: normalize(input.itemName) }),
      ...(input.quantity === undefined ? {} : { quantity: input.quantity }),
      ...(input.quantityNote === undefined ? {} : { quantity_note: input.quantityNote }),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.priceCents === undefined ? {} : { price: fromCents(input.priceCents) }),
      ...(input.priceUnit === undefined ? {} : { price_unit: input.priceUnit }),
      ...(input.merchantId === undefined
        ? {}
        : { merchant_id: input.merchantId, merchant_name: input.merchantName ?? null }),
    })
    .where('id', '=', itemId)
    .where('list_id', '=', listId)
    .executeTakeFirst();
  if (result.numUpdatedRows === 0n) throw fail(404, 'Item not found.');
  return detailOf(db, await refreshed(db, row));
}

export async function deleteListItem(
  db: Kysely<Database>,
  listId: string,
  itemId: string,
): Promise<void> {
  await requireList(db, listId);
  const result = await db
    .deleteFrom('shopping_list_item')
    .where('id', '=', itemId)
    .where('list_id', '=', listId)
    .executeTakeFirst();
  if (result.numDeletedRows === 0n) throw fail(404, 'Item not found.');
}

/**
 * The list's bought items become pantry items, merged on `normalized_name`. The pantry does not
 * track quantities, so a list quantity is not carried over, and the bought items stay on their
 * list.
 */
export async function addBoughtToPantry(
  db: Kysely<Database>,
  listId: string,
): Promise<PantryItem[]> {
  await requireList(db, listId);
  const { rows } = await sql<Parameters<typeof toPantryItem>[0]>`
    insert into public.pantry_item (household_id, item_name, normalized_name)
    select distinct on (i.normalized_name) l.household_id, i.item_name, i.normalized_name
    from public.shopping_list_item i
    join public.shopping_list l on l.id = i.list_id
    where i.list_id = ${listId} and i.status = 'bought'
    order by i.normalized_name, i.created_at, i.id
    on conflict (household_id, normalized_name) do update
      set item_name = excluded.item_name, last_updated = pg_catalog.now()
    returning id, household_id, item_name, normalized_name, quantity_note, last_updated
  `.execute(db);
  return rows.map(toPantryItem).sort((left, right) => left.itemName.localeCompare(right.itemName));
}
