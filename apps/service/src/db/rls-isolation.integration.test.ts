import { afterAll, describe, expect, it } from 'vitest';
import { closeTestDb, withTestDb, type Actor, type TestDb } from '../test/integration-db.js';
import { buildWorld, type World } from '../test/world.js';

/**
 * The isolation suite (Engineering Practices, "RLS testing is mandatory"): a member of household A
 * tries to read, insert, update, and delete every household-B resource, and the database refuses
 * each one, either by returning no rows or by raising insufficient_privilege.
 */

afterAll(closeTestDb);

interface Target {
  table: string;
  /** Column that identifies B's row. */
  key: string;
  value: (w: World) => string;
  /** An insert that would put a row into B. */
  insert: (w: World) => [string, unknown[]];
  /** Column to rewrite in the update attempt. */
  touch: string;
}

const targets: Target[] = [
  {
    table: 'household',
    key: 'id',
    value: (w) => w.b.id,
    insert: (w) => [
      `insert into public.household (name, postal_code, timezone, created_by)
       values ('Mine', '27601', 'UTC', $1)`,
      [w.a.admin.id],
    ],
    touch: 'name',
  },
  {
    table: 'household_member',
    key: 'household_id',
    value: (w) => w.b.id,
    insert: (w) => [
      `insert into public.household_member (household_id, user_id) values ($1, $2)`,
      [w.b.id, w.a.admin.id],
    ],
    touch: 'role',
  },
  {
    table: 'household_invite',
    key: 'id',
    value: (w) => w.b.rows.invite,
    insert: (w) => [
      `insert into public.household_invite (household_id, token_hash, code_hash, created_by)
       values ($1, repeat('c', 64), repeat('d', 64), $2)`,
      [w.b.id, w.a.admin.id],
    ],
    touch: 'revoked_at',
  },
  {
    table: 'household_favorite_store',
    key: 'id',
    value: (w) => w.b.rows.favoriteStore,
    insert: (w) => [
      `insert into public.household_favorite_store (household_id, merchant_id, merchant_name)
       values ($1, '2100', 'Food Lion')`,
      [w.b.id],
    ],
    touch: 'merchant_name',
  },
  {
    table: 'shopping_list',
    key: 'id',
    value: (w) => w.b.rows.list,
    insert: (w) => [
      `insert into public.shopping_list (household_id, name) values ($1, 'Sneaky')`,
      [w.b.id],
    ],
    touch: 'name',
  },
  {
    table: 'shopping_list_item',
    key: 'id',
    value: (w) => w.b.rows.listItem,
    insert: (w) => [
      `insert into public.shopping_list_item (list_id, item_name, normalized_name)
       values ($1, 'Eggs', 'egg')`,
      [w.b.rows.list],
    ],
    touch: 'status',
  },
  {
    table: 'pantry_item',
    key: 'id',
    value: (w) => w.b.rows.pantryItem,
    insert: (w) => [
      `insert into public.pantry_item (household_id, item_name, normalized_name)
       values ($1, 'Salt', 'salt')`,
      [w.b.id],
    ],
    touch: 'quantity_note',
  },
  {
    table: 'recipe',
    key: 'id',
    value: (w) => w.b.rows.recipe,
    insert: (w) => [
      `insert into public.recipe (household_id, title) values ($1, 'Soup')`,
      [w.b.id],
    ],
    touch: 'title',
  },
  {
    table: 'recipe_ingredient',
    key: 'id',
    value: (w) => w.b.rows.ingredient,
    insert: (w) => [
      `insert into public.recipe_ingredient (recipe_id, position, item_name, normalized_name)
       values ($1, 1, 'Egg', 'egg')`,
      [w.b.rows.recipe],
    ],
    touch: 'item_name',
  },
  {
    table: 'recipe_readiness',
    key: 'recipe_id',
    value: (w) => w.b.rows.recipe,
    insert: (w) => [
      `insert into public.recipe_readiness (recipe_id, household_id, on_sale_count,
         in_pantry_count, to_buy_count, readiness_percent)
       values ($1, $2, 0, 0, 1, 0)`,
      [w.b.rows.recipe, w.b.id],
    ],
    touch: 'readiness_percent',
  },
  {
    table: 'ingredient_match_override',
    key: 'id',
    value: (w) => w.b.rows.override,
    insert: (w) => [
      `insert into public.ingredient_match_override (household_id, ingredient_normalized_name,
         target_kind, target_normalized_name, decision)
       values ($1, 'milk', 'pantry', 'milk', 'force_match')`,
      [w.b.id],
    ],
    touch: 'decision',
  },
  {
    table: 'meal_plan_entry',
    key: 'id',
    value: (w) => w.b.rows.mealPlanEntry,
    insert: (w) => [
      `insert into public.meal_plan_entry (household_id, recipe_title, planned_date, meal_type)
       values ($1, 'Soup', current_date, 'lunch')`,
      [w.b.id],
    ],
    touch: 'meal_type',
  },
  {
    table: 'bill',
    key: 'id',
    value: (w) => w.b.rows.bill,
    insert: (w) => [
      `insert into public.bill (household_id, owner_user_id, name, amount, anchor_date, visibility)
       values ($1, $2, 'Fake', 1.00, current_date, 'household')`,
      [w.b.id, w.a.admin.id],
    ],
    touch: 'amount',
  },
  {
    table: 'bill_payment_log',
    key: 'id',
    value: (w) => w.b.rows.payment,
    insert: (w) => [
      `insert into public.bill_payment_log (bill_id, occurrence_date, is_skipped)
       values ($1, current_date, true)`,
      [w.b.rows.bill],
    ],
    touch: 'amount_paid',
  },
  {
    table: 'chore',
    key: 'id',
    value: (w) => w.b.rows.chore,
    insert: (w) => [
      `insert into public.chore (household_id, name, recurrence_unit, anchor_date)
       values ($1, 'Dust', 'week', current_date)`,
      [w.b.id],
    ],
    touch: 'name',
  },
  {
    table: 'chore_completion',
    key: 'id',
    value: (w) => w.b.rows.completion,
    insert: (w) => [
      `insert into public.chore_completion (chore_id, occurrence_date) values ($1, current_date)`,
      [w.b.rows.chore],
    ],
    touch: 'occurrence_date',
  },
  {
    table: 'errand',
    key: 'id',
    value: (w) => w.b.rows.errand,
    insert: (w) => [`insert into public.errand (household_id, name) values ($1, 'Bank')`, [w.b.id]],
    touch: 'name',
  },
  {
    table: 'notification_preference',
    key: 'id',
    value: (w) => w.b.rows.preference,
    insert: (w) => [
      `insert into public.notification_preference (user_id, notification_type, household_id,
         enabled)
       values ($1, 'weekly_meal_nudge', $2, true)`,
      [w.b.member.id, w.b.id],
    ],
    touch: 'enabled',
  },
  {
    table: 'push_subscription',
    key: 'id',
    value: (w) => w.b.rows.pushSubscription,
    insert: (w) => [
      `insert into public.push_subscription (user_id, endpoint, keys)
       values ($1, 'https://push.example.com/evil', '{}')`,
      [w.b.member.id],
    ],
    touch: 'endpoint',
  },
  {
    table: 'notification',
    key: 'id',
    value: (w) => w.b.rows.notification,
    insert: (w) => [
      `insert into public.notification (user_id, type, target_id, occurrence_key, payload)
       values ($1, 'list_activity', $2, 'batch-evil', '{}')`,
      [w.b.member.id, w.b.rows.list],
    ],
    touch: 'payload',
  },
  {
    table: 'profile',
    key: 'id',
    value: (w) => w.b.member.id,
    insert: (w) => [
      `insert into public.profile (id, email, display_name) values ($1, 'x@example.com', 'X')`,
      [w.b.member.id],
    ],
    touch: 'display_name',
  },
  {
    table: 'deal',
    key: 'id',
    value: (w) => w.b.rows.deal,
    insert: () => [
      `insert into public.deal (external_id, merchant_id, merchant_name, name, normalized_name,
         unit_price, price_unit, display_price, flyer_id, postal_code, valid_from, valid_to)
       values ('evil', '2431', 'Harris Teeter', 'Milk', 'milk', 0.01, 'each', '$0.01', 'f',
         '27601', current_date, current_date)`,
      [],
    ],
    touch: 'unit_price',
  },
  {
    table: 'deal_query_cache',
    key: 'postal_code',
    value: (w) => w.b.postalCode,
    insert: () => [
      `insert into public.deal_query_cache (postal_code, normalized_query) values ('27601', 'eggs')`,
      [],
    ],
    touch: 'deal_ids',
  },
  {
    table: 'postal_code_refresh',
    key: 'postal_code',
    value: (w) => w.b.postalCode,
    insert: () => [`insert into public.postal_code_refresh (postal_code) values ('27601')`, []],
    touch: 'last_on_demand_at',
  },
];

/** Either the statement is refused outright or it touches nothing. */
async function expectNoEffect(actor: Actor, text: string, params: unknown[]): Promise<void> {
  let rows: unknown[];
  try {
    rows = await actor.query(text, params);
  } catch (error) {
    expect((error as { code?: string }).code).toBe('42501');
    return;
  }
  expect(rows).toHaveLength(0);
}

async function countAsAdmin(db: TestDb, target: Target, world: World): Promise<number> {
  const rows = await db.admin.query<{ n: number }>(
    `select count(*)::int as n from public.${target.table} where ${target.key} = $1`,
    [target.value(world)],
  );
  return rows[0]?.n ?? 0;
}

describe('household isolation', () => {
  for (const role of ['admin', 'member'] as const) {
    describe(`household A's ${role}`, () => {
      for (const target of targets) {
        it(`cannot read, insert, update, or delete household B's ${target.table}`, () =>
          withTestDb(async (db) => {
            const world = await buildWorld(db);
            const attacker = db.as(world.a[role]);
            const before = await countAsAdmin(db, target, world);
            expect(before).toBeGreaterThan(0);

            const read = await attacker.query(
              `select * from public.${target.table} where ${target.key} = $1`,
              [target.value(world)],
            );
            expect(read).toHaveLength(0);

            const [insertText, insertParams] = target.insert(world);
            const insertError = await attacker.fails(insertText, insertParams);
            expect(insertError.code).toBe('42501');

            await expectNoEffect(
              attacker,
              `update public.${target.table} set ${target.touch} = ${target.touch}
               where ${target.key} = $1 returning 1`,
              [target.value(world)],
            );
            await expectNoEffect(
              attacker,
              `delete from public.${target.table} where ${target.key} = $1 returning 1`,
              [target.value(world)],
            );

            expect(await countAsAdmin(db, target, world)).toBe(before);
          }));
      }
    });
  }

  it("sees none of household B's rows in any table, only its own", () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const member = db.as(world.a.member);
      for (const target of targets) {
        const rows = await member.query(
          `select ${target.key}::text as k from public.${target.table}`,
        );
        const keys = rows.map((row) => row['k']);
        expect(keys, target.table).not.toContain(target.value(world));
      }
      const lists = await member.query<{ id: string }>('select id from public.shopping_list');
      expect(lists.map((row) => row.id)).toEqual([world.a.rows.list]);
    }));

  it('cannot move its own rows into household B', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const member = db.as(world.a.member);
      for (const [table, id] of [
        ['shopping_list', world.a.rows.list],
        ['recipe', world.a.rows.recipe],
        ['chore', world.a.rows.chore],
        ['errand', world.a.rows.errand],
        ['bill', world.a.rows.bill],
      ] as const) {
        const error = await member.fails(
          `update public.${table} set household_id = $1 where id = $2`,
          [world.b.id, id],
        );
        expect(error.code, table).toBe('42501');
      }
      const itemMove = await member.fails(
        'update public.shopping_list_item set list_id = $1 where id = $2',
        [world.b.rows.list, world.a.rows.listItem],
      );
      expect(itemMove.code).toBe('42501');
    }));

  it('cannot plan a meal in its household from a recipe of household B', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const error = await db.as(world.a.member).fails(
        `insert into public.meal_plan_entry (household_id, recipe_id, recipe_title, planned_date,
           meal_type)
         values ($1, $2, 'Stolen', current_date, 'dinner')`,
        [world.a.id, world.b.rows.recipe],
      );
      // The composite key keeps a snapshot in its recipe's household.
      expect(error.code).toBe('23503');
    }));

  it('loses access the moment the membership row is removed', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const removed = world.b.member;
      expect(
        await db
          .as(removed)
          .query('select id from public.shopping_list where id = $1', [world.b.rows.list]),
      ).toHaveLength(1);

      await db.as(world.b.admin).query(`select public.depart_household($1, $2, $3::jsonb, null)`, [
        world.b.id,
        removed.id,
        JSON.stringify({
          [world.b.rows.list]: world.b.admin.id,
          [world.b.rows.chore]: world.b.admin.id,
          [world.b.rows.errand]: world.b.admin.id,
          [world.b.rows.bill]: world.b.admin.id,
        }),
      ]);

      const asRemoved = db.as(removed);
      for (const target of targets) {
        if (['profile', 'notification_preference', 'push_subscription'].includes(target.table)) {
          continue;
        }
        const rows = await asRemoved.query(
          `select 1 from public.${target.table} where ${target.key} = $1`,
          [target.value(world)],
        );
        expect(rows, target.table).toHaveLength(0);
      }
      const write = await asRemoved.fails(
        `insert into public.shopping_list_item (list_id, item_name, normalized_name)
         values ($1, 'Late', 'late')`,
        [world.b.rows.list],
      );
      expect(write.code).toBe('42501');
      // Their own personal bill is still theirs.
      expect(
        await asRemoved.query('select id from public.bill where id = $1', [
          world.b.rows.personalBill,
        ]),
      ).toHaveLength(1);
    }));
});
