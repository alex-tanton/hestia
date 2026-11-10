import { afterAll, describe, expect, it } from 'vitest';
import { closeTestDb, withTestDb } from '../test/integration-db.js';
import { addMember, buildWorld, createHousehold } from '../test/world.js';

afterAll(closeTestDb);

const ids = (rows: { id: string }[]): string[] => rows.map((row) => row.id).sort();

describe('every table', () => {
  it('has RLS enabled, and a policy unless it is app_error', () =>
    withTestDb(async (db) => {
      const tables = await db.admin.query<{ name: string; rls: boolean; policies: number }>(
        `select c.relname as name, c.relrowsecurity as rls,
           (select count(*)::int from pg_policies p
            where p.schemaname = 'public' and p.tablename = c.relname) as policies
         from pg_class c
         where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
         order by c.relname`,
      );
      expect(tables).toHaveLength(26);
      for (const table of tables) {
        expect(table.rls, table.name).toBe(true);
        // app_error is deliberately policy-less: RLS denies everything, record_app_error writes.
        if (table.name === 'app_error') expect(table.policies).toBe(0);
        else expect(table.policies, table.name).toBeGreaterThan(0);
      }
    }));

  it('publishes exactly the realtime tables', () =>
    withTestDb(async (db) => {
      const rows = await db.admin.query<{ tablename: string }>(
        `select tablename from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' order by 1`,
      );
      expect(rows.map((row) => row.tablename)).toEqual([
        'chore_completion',
        'errand',
        'shopping_list',
        'shopping_list_item',
      ]);
    }));

  it('grants anon nothing but record_app_error', () =>
    withTestDb(async (db) => {
      const tablePrivileges = await db.admin.query(
        `select table_name, privilege_type from information_schema.role_table_grants
         where table_schema = 'public' and grantee in ('anon', 'PUBLIC')`,
      );
      expect(tablePrivileges).toEqual([]);
      const columnPrivileges = await db.admin.query(
        `select table_name from information_schema.column_privileges
         where table_schema = 'public' and grantee in ('anon', 'PUBLIC')`,
      );
      expect(columnPrivileges).toEqual([]);
      const functions = await db.admin.query<{ name: string }>(
        `select p.proname as name from pg_proc p
         where p.pronamespace = 'public'::regnamespace
           and has_function_privilege('anon', p.oid, 'execute')
         order by 1`,
      );
      expect(functions.map((f) => f.name)).toEqual(['record_app_error']);
    }));
});

describe('anon', () => {
  it('can record an error and nothing else', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      await db.anon.query('select public.record_app_error($1, $2)', ['a'.repeat(64), 'boom']);
      expect((await db.anon.fails('select * from public.app_error')).code).toBe('42501');
      expect((await db.anon.fails('select * from public.shopping_list')).code).toBe('42501');
      expect((await db.anon.fails('select * from public.profile')).code).toBe('42501');
      expect(
        (await db.anon.fails('select public.create_household($1, $2, $3)', ['X', '27514', 'UTC']))
          .code,
      ).toBe('42501');
      expect((await db.anon.fails('select public.redeem_invite($1)', ['K7M2Q9XA'])).code).toBe(
        '42501',
      );
      expect((await db.anon.fails('select public.system_health()')).code).toBe('42501');
      expect(
        (await db.anon.fails('select public.is_household_member($1)', [world.a.id])).code,
      ).toBe('42501');
    }));
});

describe('app_error', () => {
  it('upserts by fingerprint and truncates the message to 500 characters', () =>
    withTestDb(async (db) => {
      const user = await db.createUser('Reporter');
      const fingerprint = 'f'.repeat(64);
      await db.anon.query('select public.record_app_error($1, $2)', [fingerprint, 'x'.repeat(900)]);
      await db
        .as(user)
        .query('select public.record_app_error($1, $2)', [fingerprint, 'second message']);
      const rows = await db.admin.query<{
        count: number;
        len: number;
        first_seen: Date;
        last_seen: Date;
      }>(
        `select count, char_length(message) as len, first_seen, last_seen
         from public.app_error where fingerprint = $1`,
        [fingerprint],
      );
      expect(rows).toEqual([expect.objectContaining({ count: 2, len: 500 })]);
    }));

  it('is not directly readable or writable by a signed-in user', () =>
    withTestDb(async (db) => {
      const user = await db.createUser('Curious');
      const reader = db.as(user);
      expect((await reader.fails('select * from public.app_error')).code).toBe('42501');
      expect(
        (
          await reader.fails(
            `insert into public.app_error (fingerprint, message) values (repeat('e', 64), 'x')`,
          )
        ).code,
      ).toBe('42501');
    }));
});

describe('system_health', () => {
  it('returns only aggregates: newest fetch, newest send, and the top 10 errors of 24 hours', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      // Start from no errors, whatever a seeded development database holds (rolled back after).
      await db.admin.query('delete from public.app_error');
      for (let i = 0; i < 12; i += 1) {
        await db.admin.query(
          `insert into public.app_error (fingerprint, message, count, last_seen)
           values ($1, 'error', $2, now())`,
          [String(i).padStart(64, '0'), i + 1],
        );
      }
      await db.admin.query(
        `insert into public.app_error (fingerprint, message, count, first_seen, last_seen)
         values (repeat('9', 64), 'old', 1000, now() - interval '3 days', now() - interval '2 days')`,
      );
      await db.admin.query(
        `update public.notification set sent_at = now() - interval '1 hour' where id = $1`,
        [world.a.rows.notification],
      );
      // Recent errors are server-wide, so no signed-in user may call it, not even the owner's
      // own session; the service calls it as service_role once it has checked the owner.
      expect((await db.as(world.a.admin).fails('select public.system_health()')).code).toBe(
        '42501',
      );
      const rows = await db.asRoles(['service_role']).query<{
        health: {
          newest_deal_fetched_at: string;
          newest_notification_sent_at: string;
          recent_errors: { count: number }[];
        };
      }>('select public.system_health() as health');
      const health = rows[0]?.health;
      expect(health?.newest_deal_fetched_at).toBeTruthy();
      expect(health?.newest_notification_sent_at).toBeTruthy();
      expect(health?.recent_errors.map((e) => e.count)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
    }));
});

describe('hestia_service', () => {
  it('is a NOINHERIT role that is a member of exactly the three API roles', () =>
    withTestDb(async (db) => {
      const role = await db.admin.query(
        `select rolinherit, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls
         from pg_roles where rolname = 'hestia_service'`,
      );
      expect(role).toEqual([
        {
          rolinherit: false,
          rolsuper: false,
          rolcreaterole: false,
          rolcreatedb: false,
          rolbypassrls: false,
        },
      ]);
      const memberships = await db.admin.query<{ rolname: string }>(
        `select r.rolname from pg_auth_members m
         join pg_roles r on r.oid = m.roleid
         where m.member = 'hestia_service'::regrole order by 1`,
      );
      expect(memberships.map((m) => m.rolname)).toEqual(['anon', 'authenticated', 'service_role']);
    }));

  it('has no privileges of its own, and can switch into each API role', () =>
    withTestDb(async (db) => {
      // The local postgres role cannot SET ROLE hestia_service, so this reads the catalog rather
      // than impersonating it. NOINHERIT means these checks see only what it holds directly.
      const held = await db.admin.query<{ name: string }>(
        `select c.relname as name from pg_class c
         where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
           and (has_table_privilege('hestia_service', c.oid, 'select')
             or has_table_privilege('hestia_service', c.oid, 'insert')
             or has_table_privilege('hestia_service', c.oid, 'update')
             or has_table_privilege('hestia_service', c.oid, 'delete'))`,
      );
      expect(held).toEqual([]);
      const functions = await db.admin.query<{ name: string }>(
        `select p.proname as name from pg_proc p
         where p.pronamespace = 'public'::regnamespace
           and has_function_privilege('hestia_service', p.oid, 'execute')`,
      );
      expect(functions).toEqual([]);
      const switchable = await db.admin.query(
        `select pg_has_role('hestia_service', 'anon', 'set') as anon,
                pg_has_role('hestia_service', 'authenticated', 'set') as authenticated,
                pg_has_role('hestia_service', 'service_role', 'set') as service_role`,
      );
      expect(switchable).toEqual([{ anon: true, authenticated: true, service_role: true }]);
    }));
});

describe('bill visibility', () => {
  it('keeps personal bills visible only to their owner, in every household', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      // The A member's personal bill; the A admin shares household A with them.
      const owner = world.a.member;
      await addMember(db, world.b.id, owner);
      const coMembers = [world.a.admin, world.b.admin, world.b.member];

      for (const other of coMembers) {
        const actor = db.as(other);
        expect(
          await actor.query('select id from public.bill where id = $1', [
            world.a.rows.personalBill,
          ]),
        ).toHaveLength(0);
        expect(
          await actor.query('select id from public.bill_payment_log where id = $1', [
            world.a.rows.personalPayment,
          ]),
        ).toHaveLength(0);
        expect(
          await actor.query('update public.bill set amount = 0 where id = $1 returning id', [
            world.a.rows.personalBill,
          ]),
        ).toHaveLength(0);
        expect(
          await actor.query('delete from public.bill where id = $1 returning id', [
            world.a.rows.personalBill,
          ]),
        ).toHaveLength(0);
      }

      const mine = await db.as(owner).query<{ id: string }>('select id from public.bill');
      expect(ids(mine)).toEqual(
        [world.a.rows.bill, world.a.rows.personalBill, world.b.rows.bill].sort(),
      );
    }));

  it('refuses a personal bill in someone else’s name and a household bill without a household', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const actor = db.as(world.a.member);
      expect(
        (
          await actor.fails(
            `insert into public.bill (owner_user_id, name, amount, anchor_date, visibility)
             values ($1, 'Theirs', 1, current_date, 'personal')`,
            [world.a.admin.id],
          )
        ).code,
      ).toBe('42501');
      // A household bill with no household matches no policy.
      expect(
        (
          await actor.fails(
            `insert into public.bill (owner_user_id, name, amount, anchor_date, visibility)
             values ($1, 'Orphan', 1, current_date, 'household')`,
            [world.a.member.id],
          )
        ).code,
      ).toBe('42501');
      // A personal bill that names a household passes the owner policy; the check refuses it.
      expect(
        (
          await actor.fails(
            `insert into public.bill (household_id, owner_user_id, name, amount, anchor_date,
               visibility)
             values ($1, $2, 'Mixed', 1, current_date, 'personal')`,
            [world.a.id, world.a.member.id],
          )
        ).code,
      ).toBe('23514');
    }));

  it('lets only the owner switch visibility, and never moves a bill to another household', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const { bill } = world.a.rows;
      const owner = db.as(world.a.member);
      const coMember = db.as(world.a.admin);

      // A co-member cannot take the household bill, and its payment history, as their own.
      expect(
        (
          await coMember.fails(
            `update public.bill
             set visibility = 'personal', household_id = null, owner_user_id = $2
             where id = $1`,
            [bill, world.a.admin.id],
          )
        ).code,
      ).toBe('42501');
      expect(
        (
          await coMember.fails(
            `update public.bill set visibility = 'personal', household_id = null where id = $1`,
            [bill],
          )
        ).code,
      ).toBe('42501');

      // The owner may, and may bring it back.
      await owner.query(
        `update public.bill set visibility = 'personal', household_id = null where id = $1`,
        [bill],
      );
      expect(await coMember.query('select id from public.bill where id = $1', [bill])).toEqual([]);
      await owner.query(
        `update public.bill set visibility = 'household', household_id = $2 where id = $1`,
        [bill, world.a.id],
      );
      expect(await coMember.query('select id from public.bill where id = $1', [bill])).toHaveLength(
        1,
      );

      // Even an owner who belongs to both households cannot move it from one to the other.
      await addMember(db, world.b.id, world.a.member);
      expect(
        (
          await owner.fails('update public.bill set household_id = $2 where id = $1', [
            bill,
            world.b.id,
          ])
        ).code,
      ).toBe('42501');
    }));
});

describe('assignments', () => {
  it('name only members of the household, while history keeps a departed member', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const actor = db.as(world.a.admin);
      const outsider = world.b.member.id;

      for (const [text, params] of [
        [
          `insert into public.chore (household_id, name, recurrence_unit, anchor_date, assigned_to)
           values ($1, 'Mop', 'week', current_date, $2)`,
          [world.a.id, outsider],
        ],
        [
          `insert into public.chore (household_id, name, recurrence_unit, anchor_date,
             rotation_order)
           values ($1, 'Dishes', 'day', current_date, array[$3::uuid, $2::uuid])`,
          [world.a.id, outsider, world.a.member.id],
        ],
        [
          `insert into public.errand (household_id, name, assigned_to) values ($1, 'Bank', $2)`,
          [world.a.id, outsider],
        ],
        [
          `insert into public.bill (household_id, owner_user_id, name, amount, anchor_date,
             visibility)
           values ($1, $2, 'Water', 40, current_date, 'household')`,
          [world.a.id, outsider],
        ],
        ['update public.chore set assigned_to = $2 where id = $1', [world.a.rows.chore, outsider]],
        [
          'update public.errand set assigned_to = $2 where id = $1',
          [world.a.rows.errand, outsider],
        ],
        ['update public.bill set owner_user_id = $2 where id = $1', [world.a.rows.bill, outsider]],
      ] as const) {
        expect((await actor.fails(text, [...params])).code, text).toBe('22023');
      }

      // In a household the caller is not in, every attempt is refused alike, so the refusal
      // cannot reveal whether the named user belongs there.
      for (const assignee of [world.b.member.id, world.a.member.id]) {
        expect(
          (
            await actor.fails(
              `insert into public.errand (household_id, name, assigned_to) values ($1, 'X', $2)`,
              [world.b.id, assignee],
            )
          ).code,
        ).toBe('42501');
      }

      // Moving a chore into another of the caller's households rechecks its assignee there.
      await addMember(db, world.b.id, world.a.admin);
      expect(
        (
          await actor.fails('update public.chore set household_id = $2 where id = $1', [
            world.a.rows.chore,
            world.b.id,
          ])
        ).code,
      ).toBe('22023');

      // Once the assignee has left, an unrelated edit to their done errand still works.
      await db.admin.query(
        `update public.errand set status = 'done', completed_at = now(), completed_by = $2
         where id = $1`,
        [world.a.rows.errand, world.a.member.id],
      );
      await db.admin.query(
        'delete from public.household_member where household_id = $1 and user_id = $2',
        [world.a.id, world.a.member.id],
      );
      expect(
        await actor.query(
          `update public.errand set name = 'Post office run' where id = $1
                           returning id`,
          [world.a.rows.errand],
        ),
      ).toHaveLength(1);
    }));
});

describe('timezones', () => {
  it('must be names Postgres can resolve, for households and profiles alike', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      expect(
        (
          await db
            .as(world.a.admin)
            .fails(`update public.household set timezone = 'Mars/Olympus' where id = $1`, [
              world.a.id,
            ])
        ).code,
      ).toBe('22023');
      expect(
        (
          await db
            .as(world.a.member)
            .fails(`update public.profile set timezone = 'Nowhere/Town' where id = $1`, [
              world.a.member.id,
            ])
        ).code,
      ).toBe('22023');
      await db
        .as(world.a.member)
        .query(`update public.profile set timezone = 'America/Chicago' where id = $1`, [
          world.a.member.id,
        ]);
    }));
});

describe('schema constraints', () => {
  it('requires a payment row to be exactly one of paid or skipped', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const actor = db.as(world.a.member);
      const insert = (paid: string | null, amount: number | null, skipped: boolean) =>
        actor.fails(
          `insert into public.bill_payment_log (bill_id, occurrence_date, paid_date, amount_paid,
             is_skipped)
           values ($1, current_date + 1, $2, $3, $4)`,
          [world.a.rows.bill, paid, amount, skipped],
        );
      expect((await insert(null, null, false)).code).toBe('23514');
      expect((await insert('2026-09-01', 10, true)).code).toBe('23514');
      expect((await insert('2026-09-01', null, false)).code).toBe('23514');
      await actor.query(
        `insert into public.bill_payment_log (bill_id, occurrence_date, is_skipped)
         values ($1, current_date + 1, true)`,
        [world.a.rows.bill],
      );
      expect((await insert(null, null, true)).code).toBe('23505');
    }));

  it('rejects an assignee on a rotating chore and a duplicate completion', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const actor = db.as(world.a.member);
      expect(
        (
          await actor.fails(
            `insert into public.chore (household_id, name, recurrence_unit, anchor_date,
               rotation_order, assigned_to)
             values ($1, 'Both', 'week', current_date, array[$2::uuid], $2)`,
            [world.a.id, world.a.member.id],
          )
        ).code,
      ).toBe('23514');
      const duplicate = await actor.fails(
        `insert into public.chore_completion (chore_id, occurrence_date)
         select chore_id, occurrence_date from public.chore_completion where id = $1`,
        [world.a.rows.completion],
      );
      expect(duplicate.code).toBe('23505');
    }));

  it('dedupes the outbox and preferences with nulls treated as equal', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const user = world.a.member;
      await db.as(user).query(
        `insert into public.notification_preference (user_id, notification_type, enabled)
         values ($1, 'bill_due', false)`,
        [user.id],
      );
      expect(
        (
          await db.as(user).fails(
            `insert into public.notification_preference (user_id, notification_type, enabled)
             values ($1, 'bill_due', true)`,
            [user.id],
          )
        ).code,
      ).toBe('23505');
      expect(
        (
          await db.admin.fails(
            `insert into public.notification (user_id, type, target_id, occurrence_key, payload)
             select user_id, type, target_id, occurrence_key, payload
             from public.notification where id = $1`,
            [world.a.rows.notification],
          )
        ).code,
      ).toBe('23505');
    }));

  it('bumps shopping_list.updated_at on any change to the list or its items', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const actor = db.as(world.a.member);
      const stamp = async (): Promise<string> => {
        const rows = await db.admin.query<{ t: string }>(
          `select updated_at::text as t from public.shopping_list where id = $1`,
          [world.a.rows.list],
        );
        return rows[0]?.t ?? '';
      };
      const reset = () =>
        db.admin.query(`update public.shopping_list set updated_at = '2000-01-01' where id = $1;`, [
          world.a.rows.list,
        ]);
      // The BEFORE UPDATE trigger stamps now() over the reset, so disable it for the reset.
      await db.admin.query('alter table public.shopping_list disable trigger shopping_list_touch');
      await reset();
      await db.admin.query('alter table public.shopping_list enable trigger shopping_list_touch');
      expect(await stamp()).toMatch(/^2000-01-01/);

      await actor.query(`update public.shopping_list_item set status = 'bought' where id = $1`, [
        world.a.rows.listItem,
      ]);
      expect(await stamp()).not.toMatch(/^2000-01-01/);
    }));

  it('keeps the meal plan entry and its title when the recipe is deleted', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      await db
        .as(world.a.member)
        .query('delete from public.recipe where id = $1', [world.a.rows.recipe]);
      const entries = await db.admin.query(
        'select recipe_id, recipe_title, household_id from public.meal_plan_entry where id = $1',
        [world.a.rows.mealPlanEntry],
      );
      expect(entries).toEqual([
        { recipe_id: null, recipe_title: 'Fried Rice', household_id: world.a.id },
      ]);
    }));
});

describe('profile', () => {
  it('is created by the auth.users trigger and follows email changes', () =>
    withTestDb(async (db) => {
      const user = await db.createUser('Morgan Reed', { timezone: 'America/Chicago' });
      const noZone = await db.createUser('No Zone', { timezone: 'Not/AZone' });
      const rows = await db.admin.query(
        'select email, display_name, timezone from public.profile where id = any($1) order by display_name',
        [[user.id, noZone.id]],
      );
      expect(rows).toEqual([
        { email: user.email, display_name: 'Morgan Reed', timezone: 'America/Chicago' },
        { email: noZone.email, display_name: 'No Zone', timezone: 'UTC' },
      ]);

      await db.admin.query(`update auth.users set email = 'new@example.com' where id = $1`, [
        user.id,
      ]);
      const changed = await db.as(user).query('select email from public.profile');
      expect(changed).toEqual([{ email: 'new@example.com' }]);
    }));

  it('lets a user edit their own settings but not their email or someone else’s row', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const me = db.as(world.a.member);
      expect(await me.query('select id from public.profile')).toEqual([{ id: world.a.member.id }]);
      await me.query(
        `update public.profile set display_name = 'Avery', timezone = 'America/Denver',
           quiet_hours_start = '22:00', quiet_hours_end = '07:00'`,
      );
      expect((await me.fails(`update public.profile set email = 'x@example.com'`)).code).toBe(
        '42501',
      );
      // The active household must be one the user belongs to.
      expect(
        (await me.fails('update public.profile set active_household_id = $1', [world.b.id])).code,
      ).toBe('42501');
      expect((await me.fails(`update public.profile set quiet_hours_end = null`)).code).toBe(
        '23514',
      );
    }));

  it('shows co-members only their id, name, role, and join date through household_members', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const rows = await db
        .as(world.a.member)
        .query<{ user_id: string; display_name: string; role: string }>(
          'select user_id, display_name, role from public.household_members($1) order by role',
          [world.a.id],
        );
      expect(rows).toEqual([
        { user_id: world.a.admin.id, display_name: 'Ada Admin', role: 'admin' },
        { user_id: world.a.member.id, display_name: 'Avery Member', role: 'member' },
      ]);
      expect(
        (
          await db
            .as(world.a.member)
            .fails('select * from public.household_members($1)', [world.b.id])
        ).code,
      ).toBe('42501');
    }));
});

describe('admin-only household actions', () => {
  it('lets only the admin edit name, postal code, and timezone, and nothing else directly', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const member = db.as(world.a.member);
      const admin = db.as(world.a.admin);

      expect(
        await member.query(`update public.household set name = 'Mine' where id = $1 returning id`, [
          world.a.id,
        ]),
      ).toHaveLength(0);
      expect(
        await admin.query(
          `update public.household set name = 'Renamed', postal_code = '27601',
             timezone = 'America/Chicago' where id = $1 returning name`,
          [world.a.id],
        ),
      ).toEqual([{ name: 'Renamed' }]);
      expect(
        (
          await admin.fails(`update public.household set created_by = $1 where id = $2`, [
            world.a.member.id,
            world.a.id,
          ])
        ).code,
      ).toBe('42501');
      expect(
        (await admin.fails('delete from public.household where id = $1', [world.a.id])).code,
      ).toBe('42501');
    }));

  it('changes membership only through the lifecycle functions', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const admin = db.as(world.a.admin);
      expect(
        (
          await admin.fails(
            `update public.household_member set role = 'admin' where user_id = $1`,
            [world.a.member.id],
          )
        ).code,
      ).toBe('42501');
      expect(
        (
          await admin.fails('delete from public.household_member where user_id = $1', [
            world.a.member.id,
          ])
        ).code,
      ).toBe('42501');
      const outsider = await db.createUser('Outsider');
      expect(
        (
          await db.as(outsider).fails(
            `insert into public.household_member (household_id, user_id, role)
             values ($1, $2, 'admin')`,
            [world.a.id, outsider.id],
          )
        ).code,
      ).toBe('42501');
    }));

  it('lets any member mark the household active, once per UTC day', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      await db.admin.query(
        `update public.household set last_active_at = now() - interval '3 days' where id = $1`,
        [world.a.id],
      );
      await db.as(world.a.member).query('select public.mark_household_active($1)', [world.a.id]);
      const rows = await db.admin.query<{ fresh: boolean }>(
        'select last_active_at = now() as fresh from public.household where id = $1',
        [world.a.id],
      );
      expect(rows).toEqual([{ fresh: true }]);
      expect(
        (await db.as(world.a.member).fails('select public.mark_household_active($1)', [world.b.id]))
          .code,
      ).toBe('42501');
    }));
});

describe('invites', () => {
  it('are read, created, and revoked only by the admin', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const admin = db.as(world.a.admin);
      const member = db.as(world.a.member);

      expect(ids(await admin.query('select id from public.household_invite'))).toEqual([
        world.a.rows.invite,
      ]);
      expect(await member.query('select id from public.household_invite')).toEqual([]);

      const created = await admin.query<{ id: string }>(
        `insert into public.household_invite (household_id, token_hash, code_hash)
         values ($1, repeat('1', 64), repeat('2', 64)) returning id`,
        [world.a.id],
      );
      expect(created).toHaveLength(1);
      expect(
        (
          await member.fails(
            `insert into public.household_invite (household_id, token_hash, code_hash)
             values ($1, repeat('3', 64), repeat('4', 64))`,
            [world.a.id],
          )
        ).code,
      ).toBe('42501');

      expect(
        await member.query(
          'update public.household_invite set revoked_at = now() where id = $1 returning id',
          [world.a.rows.invite],
        ),
      ).toHaveLength(0);
      expect(
        await admin.query(
          'update public.household_invite set revoked_at = now() where id = $1 returning id',
          [world.a.rows.invite],
        ),
      ).toHaveLength(1);
      // Revoking is the only update; an invite cannot be un-revoked or extended.
      expect(
        await admin.query(
          'update public.household_invite set revoked_at = null where id = $1 returning id',
          [world.a.rows.invite],
        ),
      ).toHaveLength(0);
      expect(
        (
          await admin.fails('update public.household_invite set revoked_at = null where id = $1', [
            created[0]?.id,
          ])
        ).code,
      ).toBe('42501');
      expect(
        (
          await admin.fails(
            `update public.household_invite set expires_at = now() + interval '1 year'
             where id = $1`,
            [world.a.rows.invite],
          )
        ).code,
      ).toBe('42501');
      // Only the household and the hashes are the admin's to choose. A created_at in the future
      // would satisfy the seven-day check and still mint an invite that lasts for years.
      for (const [column, value] of [
        ['expires_at', `now() + interval '30 days'`],
        ['created_at', `now() + interval '5 years'`],
        ['revoked_at', 'now()'],
        ['created_by', `'${world.a.member.id}'::uuid`],
      ] as const) {
        expect(
          (
            await admin.fails(
              `insert into public.household_invite (household_id, token_hash, code_hash, ${column})
               values ($1, repeat('5', 64), repeat('6', 64), ${value})`,
              [world.a.id],
            )
          ).code,
          column,
        ).toBe('42501');
      }
      // A revoked invite stays revoked as it was: its revocation time is not rewritten.
      expect(
        await admin.query(
          `update public.household_invite set revoked_at = now() + interval '1 day'
           where id = $1 returning id`,
          [world.a.rows.invite],
        ),
      ).toHaveLength(0);
      expect(
        (
          await admin.fails('delete from public.household_invite where id = $1', [
            world.a.rows.invite,
          ])
        ).code,
      ).toBe('42501');
    }));
});

describe('notifications written by requests', () => {
  it('let a member enqueue and batch list_activity and chore_rotation rows for co-members', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const actor = db.as(world.a.admin);
      const recipient = world.a.member.id;
      await actor.query(
        `insert into public.notification (user_id, type, target_id, occurrence_key, payload,
           send_after)
         values ($1, 'list_activity', $2, 'batch-2', '{"count":1}', now() + interval '5 minutes')
         on conflict (user_id, type, target_id, occurrence_key)
         do update set payload = excluded.payload`,
        [recipient, world.a.rows.list],
      );
      await actor.query(
        `insert into public.notification (user_id, type, target_id, occurrence_key, payload)
         values ($1, 'list_activity', $2, 'batch-2', '{"count":2}')
         on conflict (user_id, type, target_id, occurrence_key)
         do update set payload = excluded.payload`,
        [recipient, world.a.rows.list],
      );
      await actor.query(
        `insert into public.notification (user_id, type, target_id, occurrence_key, payload)
         values ($1, 'chore_rotation', $2, '2026-09-19', '{}')`,
        [recipient, world.a.rows.chore],
      );
      // Undoing the completion deletes its unsent rotation row.
      expect(
        await actor.query(
          `delete from public.notification where type = 'chore_rotation' and target_id = $1
           returning id`,
          [world.a.rows.chore],
        ),
      ).toHaveLength(1);

      const own = await db
        .as(world.a.member)
        .query<{ payload: unknown }>(
          `select payload from public.notification where occurrence_key = 'batch-2'`,
        );
      expect(own).toEqual([{ payload: { count: 2 } }]);
    }));

  it('refuse other types, sent rows, targets in other households, and outside recipients', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const actor = db.as(world.a.admin);
      const insert = (user: string, type: string, target: string) =>
        actor.fails(
          `insert into public.notification (user_id, type, target_id, occurrence_key, payload)
           values ($1, $2, $3, 'k', '{}')`,
          [user, type, target],
        );
      expect((await insert(world.a.member.id, 'bill_due', world.a.rows.bill)).code).toBe('42501');
      expect((await insert(world.b.member.id, 'list_activity', world.a.rows.list)).code).toBe(
        '42501',
      );
      expect((await insert(world.a.member.id, 'list_activity', world.b.rows.list)).code).toBe(
        '42501',
      );
      expect(
        (
          await actor.fails(
            `insert into public.notification (user_id, type, target_id, occurrence_key, payload,
               sent_at)
             values ($1, 'list_activity', $2, 'sent', '{}', now())`,
            [world.a.member.id, world.a.rows.list],
          )
        ).code,
      ).toBe('42501');

      await db.admin.query('update public.notification set sent_at = now() where id = $1', [
        world.a.rows.notification,
      ]);
      expect(
        await actor.query(
          `update public.notification set payload = '{}' where id = $1 returning id`,
          [world.a.rows.notification],
        ),
      ).toHaveLength(0);
      expect(
        await actor.query('delete from public.notification where id = $1 returning id', [
          world.a.rows.notification,
        ]),
      ).toHaveLength(0);
    }));
});

describe('deals', () => {
  it('are shared by every household at the postal code, and only those', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const neighbour = await db.createUser('Neighbour');
      await createHousehold(db, neighbour, 'Next Door', '27514');

      const read = await db.as(neighbour).query<{ id: string }>('select id from public.deal');
      expect(ids(read)).toEqual([world.a.rows.deal]);
      await db.as(neighbour).query(
        `insert into public.postal_code_refresh (postal_code, last_on_demand_at)
         values ('27514', now())
         on conflict (postal_code) do update set last_on_demand_at = excluded.last_on_demand_at`,
      );
      // Pruning is a job; members never delete deals.
      expect((await db.as(neighbour).fails('delete from public.deal')).code).toBe('42501');
    }));
});
