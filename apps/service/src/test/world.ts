import type { TestDb, TestUser } from './integration-db.js';

/**
 * Two households with a row in every household-scoped table, the fixture the isolation suite
 * attacks. Households are created through create_household, the way the service creates them;
 * everything else is inserted directly.
 */
export interface Household {
  id: string;
  admin: TestUser;
  member: TestUser;
  postalCode: string;
  rows: HouseholdRows;
}

export interface HouseholdRows {
  favoriteStore: string;
  list: string;
  listItem: string;
  pantryItem: string;
  recipe: string;
  ingredient: string;
  override: string;
  mealPlanEntry: string;
  bill: string;
  payment: string;
  personalBill: string;
  personalPayment: string;
  chore: string;
  completion: string;
  errand: string;
  invite: string;
  preference: string;
  pushSubscription: string;
  notification: string;
  deal: string;
}

export interface World {
  a: Household;
  b: Household;
}

async function one(db: TestDb, text: string, params: unknown[]): Promise<string> {
  const rows = await db.admin.query<{ id: string }>(text, params);
  const row = rows[0];
  if (row === undefined) throw new Error(`no row returned by: ${text}`);
  return row.id;
}

export async function createHousehold(
  db: TestDb,
  admin: TestUser,
  name: string,
  postalCode: string,
  timezone = 'America/New_York',
): Promise<string> {
  const rows = await db
    .as(admin)
    .query<{ id: string }>('select public.create_household($1, $2, $3) as id', [
      name,
      postalCode,
      timezone,
    ]);
  const row = rows[0];
  if (row === undefined) throw new Error('create_household returned nothing');
  return row.id;
}

export async function addMember(
  db: TestDb,
  householdId: string,
  user: TestUser,
  joinedAt?: string,
): Promise<void> {
  await db.admin.query(
    `insert into public.household_member (household_id, user_id, role, joined_at)
     values ($1, $2, 'member', coalesce($3::timestamptz, now()))`,
    [householdId, user.id, joinedAt ?? null],
  );
}

const hex64 = (seed: string): string => seed.repeat(64).slice(0, 64);

async function populate(
  db: TestDb,
  householdId: string,
  admin: TestUser,
  member: TestUser,
  postalCode: string,
  tag: string,
): Promise<HouseholdRows> {
  const q = (text: string, params: unknown[]): Promise<string> => one(db, text, params);

  const favoriteStore = await q(
    `insert into public.household_favorite_store (household_id, merchant_id, merchant_name)
     values ($1, '2431', 'Harris Teeter') returning id`,
    [householdId],
  );
  const list = await q(
    `insert into public.shopping_list (household_id, name, created_by)
     values ($1, 'Groceries', $2) returning id`,
    [householdId, member.id],
  );
  const listItem = await q(
    `insert into public.shopping_list_item (list_id, item_name, normalized_name, added_by)
     values ($1, 'Milk', 'milk', $2) returning id`,
    [list, member.id],
  );
  const pantryItem = await q(
    `insert into public.pantry_item (household_id, item_name, normalized_name)
     values ($1, 'Rice', 'rice') returning id`,
    [householdId],
  );
  const recipe = await q(
    `insert into public.recipe (household_id, title, created_by)
     values ($1, 'Fried Rice', $2) returning id`,
    [householdId, admin.id],
  );
  const ingredient = await q(
    `insert into public.recipe_ingredient (recipe_id, position, item_name, normalized_name)
     values ($1, 0, 'Rice', 'rice') returning id`,
    [recipe],
  );
  await db.admin.query(
    `insert into public.recipe_readiness
       (recipe_id, household_id, on_sale_count, in_pantry_count, to_buy_count, readiness_percent)
     values ($1, $2, 0, 1, 0, 100)`,
    [recipe, householdId],
  );
  const override = await q(
    `insert into public.ingredient_match_override
       (household_id, ingredient_normalized_name, target_kind, target_normalized_name, decision,
        created_by)
     values ($1, 'cheese', 'deal', 'feta cheese', 'force_no_match', $2) returning id`,
    [householdId, admin.id],
  );
  const mealPlanEntry = await q(
    `insert into public.meal_plan_entry
       (household_id, recipe_id, recipe_title, planned_date, meal_type, added_by)
     values ($1, $2, 'Fried Rice', current_date, 'dinner', $3) returning id`,
    [householdId, recipe, admin.id],
  );
  const bill = await q(
    `insert into public.bill
       (household_id, owner_user_id, name, amount, recurrence_unit, anchor_date, visibility)
     values ($1, $2, 'Rent', 1850.00, 'month', current_date - 60, 'household') returning id`,
    [householdId, member.id],
  );
  const payment = await q(
    `insert into public.bill_payment_log (bill_id, occurrence_date, paid_date, amount_paid,
       recorded_by)
     values ($1, current_date - 60, current_date - 60, 1850.00, $2) returning id`,
    [bill, member.id],
  );
  const personalBill = await q(
    `insert into public.bill (owner_user_id, name, amount, recurrence_unit, anchor_date,
       visibility, is_subscription)
     values ($1, 'Streaming ${tag}', 11.99, 'month', current_date - 30, 'personal', true)
     returning id`,
    [member.id],
  );
  const personalPayment = await q(
    `insert into public.bill_payment_log (bill_id, occurrence_date, paid_date, amount_paid,
       is_auto)
     values ($1, current_date - 30, current_date - 30, 11.99, true) returning id`,
    [personalBill],
  );
  const chore = await q(
    `insert into public.chore (household_id, name, recurrence_unit, anchor_date, assigned_to,
       created_by)
     values ($1, 'Trash', 'week', current_date - 14, $2, $3) returning id`,
    [householdId, member.id, admin.id],
  );
  const completion = await q(
    `insert into public.chore_completion (chore_id, occurrence_date, completed_by)
     values ($1, current_date - 14, $2) returning id`,
    [chore, member.id],
  );
  const errand = await q(
    `insert into public.errand (household_id, name, added_by, assigned_to)
     values ($1, 'Post office', $2, $3) returning id`,
    [householdId, admin.id, member.id],
  );
  const invite = await q(
    `insert into public.household_invite (household_id, token_hash, code_hash, created_by)
     values ($1, $2, $3, $4) returning id`,
    [householdId, hex64(`${tag}1`), hex64(`${tag}2`), admin.id],
  );
  const preference = await q(
    `insert into public.notification_preference (user_id, notification_type, household_id,
       enabled)
     values ($1, 'weekly_meal_nudge', $2, true) returning id`,
    [member.id, householdId],
  );
  const pushSubscription = await q(
    `insert into public.push_subscription (user_id, endpoint, keys)
     values ($1, 'https://push.example.com/${tag}', '{"p256dh":"x","auth":"y"}') returning id`,
    [member.id],
  );
  const notification = await q(
    `insert into public.notification (user_id, type, target_id, occurrence_key, payload)
     values ($1, 'list_activity', $2, 'batch-1', $3) returning id`,
    [member.id, list, JSON.stringify({ householdId, title: 'x', body: 'y' })],
  );
  const deal = await q(
    `insert into public.deal (external_id, merchant_id, merchant_name, name, normalized_name,
       unit_price, price_unit, display_price, flyer_id, postal_code, valid_from, valid_to)
     values ('item-${tag}', '2431', 'Harris Teeter', 'Milk', 'milk', 3.99, 'each', '$3.99',
       'flyer-${tag}', $1, current_date - 1, current_date + 5) returning id`,
    [postalCode],
  );
  await db.admin.query(
    `insert into public.deal_query_cache (postal_code, normalized_query, deal_ids)
     values ($1, 'milk', array[$2::uuid])`,
    [postalCode, deal],
  );
  await db.admin.query(
    `insert into public.postal_code_refresh (postal_code, last_refreshed_at) values ($1, now())`,
    [postalCode],
  );

  return {
    favoriteStore,
    list,
    listItem,
    pantryItem,
    recipe,
    ingredient,
    override,
    mealPlanEntry,
    bill,
    payment,
    personalBill,
    personalPayment,
    chore,
    completion,
    errand,
    invite,
    preference,
    pushSubscription,
    notification,
    deal,
  };
}

export async function buildWorld(db: TestDb): Promise<World> {
  const aAdmin = await db.createUser('Ada Admin');
  const aMember = await db.createUser('Avery Member');
  const bAdmin = await db.createUser('Blake Admin');
  const bMember = await db.createUser('Bo Member');

  const aId = await createHousehold(db, aAdmin, 'House A', '27514');
  await addMember(db, aId, aMember);
  const bId = await createHousehold(db, bAdmin, 'House B', '27601');
  await addMember(db, bId, bMember);

  return {
    a: {
      id: aId,
      admin: aAdmin,
      member: aMember,
      postalCode: '27514',
      rows: await populate(db, aId, aAdmin, aMember, '27514', 'a'),
    },
    b: {
      id: bId,
      admin: bAdmin,
      member: bMember,
      postalCode: '27601',
      rows: await populate(db, bId, bAdmin, bMember, '27601', 'b'),
    },
  };
}
