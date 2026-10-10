import { createHash } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestDb, withTestDb, type TestDb, type TestUser } from '../test/integration-db.js';
import { addMember, buildWorld, createHousehold, type World } from '../test/world.js';

afterAll(closeTestDb);

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

async function membership(
  db: TestDb,
  householdId: string,
): Promise<{ user_id: string; role: string }[]> {
  return db.admin.query(
    `select user_id, role::text from public.household_member where household_id = $1
     order by role, joined_at, user_id`,
    [householdId],
  );
}

async function activeHousehold(db: TestDb, user: TestUser): Promise<string | null> {
  const rows = await db.admin.query<{ id: string | null }>(
    'select active_household_id as id from public.profile where id = $1',
    [user.id],
  );
  return rows[0]?.id ?? null;
}

/** Reassigns everything the member owns in household B to B's other member. */
function reassignAll(world: World, to: TestUser): string {
  return JSON.stringify({
    [world.b.rows.list]: to.id,
    [world.b.rows.chore]: to.id,
    [world.b.rows.errand]: to.id,
    [world.b.rows.bill]: to.id,
  });
}

describe('create_household', () => {
  it('makes the caller admin and switches them to the new household', () =>
    withTestDb(async (db) => {
      const user = await db.createUser('Founder');
      const id = await createHousehold(db, user, '  Oak Street ', '27514', 'America/New_York');
      expect(await membership(db, id)).toEqual([{ user_id: user.id, role: 'admin' }]);
      expect(await activeHousehold(db, user)).toBe(id);
      const household = await db.admin.query(
        'select name, postal_code, timezone, created_by from public.household where id = $1',
        [id],
      );
      expect(household).toEqual([
        {
          name: 'Oak Street',
          postal_code: '27514',
          timezone: 'America/New_York',
          created_by: user.id,
        },
      ]);
    }));

  it('rejects a signed-out caller and invalid input', () =>
    withTestDb(async (db) => {
      const user = await db.createUser('Founder');
      const noClaims = db.asRoles(['authenticated']);
      expect(
        (await noClaims.fails('select public.create_household($1, $2, $3)', ['X', '27514', 'UTC']))
          .code,
      ).toBe('42501');
      for (const args of [
        [' ', '27514', 'UTC'],
        ['X', '2751', 'UTC'],
        ['X', '27514', 'Mars/Olympus'],
      ]) {
        expect(
          (await db.as(user).fails('select public.create_household($1, $2, $3)', args)).code,
        ).toBe('22023');
      }
    }));
});

describe('transfer_admin', () => {
  it('swaps the roles', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      await db
        .as(world.a.admin)
        .query('select public.transfer_admin($1, $2)', [world.a.id, world.a.member.id]);
      expect(await membership(db, world.a.id)).toEqual([
        { user_id: world.a.member.id, role: 'admin' },
        { user_id: world.a.admin.id, role: 'member' },
      ]);
    }));

  it('refuses a non-admin, an admin of another household, and a non-member target', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const call = (caller: TestUser, hid: string, target: string) =>
        db.as(caller).fails('select public.transfer_admin($1, $2)', [hid, target]);
      expect((await call(world.a.member, world.a.id, world.a.member.id)).code).toBe('42501');
      expect((await call(world.b.admin, world.a.id, world.b.admin.id)).code).toBe('42501');
      expect((await call(world.a.admin, world.a.id, world.b.member.id)).code).toBe('P0002');
      expect(await membership(db, world.a.id)).toEqual([
        { user_id: world.a.admin.id, role: 'admin' },
        { user_id: world.a.member.id, role: 'member' },
      ]);
    }));
});

describe('redeem_invite', () => {
  const token = 'dGhpcy1pcy1hLXRlc3QtdG9rZW4tZm9yLWhlYXJ0aA';

  async function invite(
    db: TestDb,
    world: World,
    code: string,
    options: { createdDaysAgo?: number; revoked?: boolean; token?: string } = {},
  ): Promise<void> {
    await db.admin.query(
      `insert into public.household_invite (household_id, token_hash, code_hash, created_by,
         created_at, expires_at, revoked_at)
       values ($1, $2, $3, $4, now() - make_interval(days => $5),
         now() - make_interval(days => $5) + interval '168 hours',
         case when $6 then now() end)`,
      [
        world.a.id,
        sha256(options.token ?? `${code}-token`),
        sha256(code),
        world.a.admin.id,
        options.createdDaysAgo ?? 2,
        options.revoked ?? false,
      ],
    );
  }

  const redeem = (db: TestDb, user: TestUser, input: string) =>
    db.as(user).query<{ id: string }>('select public.redeem_invite($1) as id', [input]);

  it('joins by link token or code and makes the household active', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      await invite(db, world, 'W7M2Q9XA', { token });
      const byLink = await db.createUser('By Link');
      const byCode = await db.createUser('By Code');

      expect(await redeem(db, byLink, token)).toEqual([{ id: world.a.id }]);
      expect(await redeem(db, byCode, 'W7M2Q9XA')).toEqual([{ id: world.a.id }]);
      expect(await activeHousehold(db, byLink)).toBe(world.a.id);
      expect((await membership(db, world.a.id)).map((m) => m.user_id)).toEqual(
        expect.arrayContaining([byLink.id, byCode.id]),
      );
      expect((await membership(db, world.a.id)).find((m) => m.user_id === byCode.id)?.role).toBe(
        'member',
      );
    }));

  it('reads lowercase, spaced, hyphenated, and I/L/O-for-1/0 codes the Crockford way', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      await invite(db, world, 'W7M2Q9XA');
      await invite(db, world, 'AB10CD11');
      const user = await db.createUser('Typist');
      for (const typed of ['w7m2q9xa', ' W7M2-Q9XA ', 'w7m2 q9xa']) {
        expect(await redeem(db, user, typed)).toEqual([{ id: world.a.id }]);
      }
      expect(await redeem(db, user, 'abiOcdLi')).toEqual([{ id: world.a.id }]);
    }));

  it('is a no-op for an existing member and keeps an admin an admin', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      await invite(db, world, 'W7M2Q9XA');
      await redeem(db, world.a.admin, 'W7M2Q9XA');
      await redeem(db, world.a.member, 'W7M2Q9XA');
      expect(await membership(db, world.a.id)).toEqual([
        { user_id: world.a.admin.id, role: 'admin' },
        { user_id: world.a.member.id, role: 'member' },
      ]);
    }));

  it('refuses expired, revoked, unknown, U-containing, and empty input', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      await invite(db, world, 'EXP1RED0', { createdDaysAgo: 9 });
      await invite(db, world, 'REV0KED1', { revoked: true });
      await invite(db, world, 'W7M2Q9XA');
      const user = await db.createUser('Hopeful');
      const code = async (input: string) =>
        (await db.as(user).fails('select public.redeem_invite($1)', [input])).code;

      expect(await code('EXP1RED0')).toBe('HR001');
      expect(await code('REV0KED1')).toBe('HR001');
      expect(await code('W7M2Q9XB')).toBe('HR002');
      expect(await code('W7M2Q9XU')).toBe('HR002');
      expect(await code('')).toBe('HR002');
      expect(await code('W7M2Q9X')).toBe('HR002');
      expect(await activeHousehold(db, user)).toBeNull();
    }));

  it('stops working the moment it is revoked', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      await invite(db, world, 'W7M2Q9XA', { token });
      await db
        .as(world.a.admin)
        .query(`update public.household_invite set revoked_at = now() where code_hash = $1`, [
          sha256('W7M2Q9XA'),
        ]);
      const user = await db.createUser('Late');
      expect((await db.as(user).fails('select public.redeem_invite($1)', [token])).code).toBe(
        'HR001',
      );
    }));

  it('refuses a signed-out caller', () =>
    withTestDb(async (db) => {
      expect(
        (await db.asRoles(['authenticated']).fails('select public.redeem_invite($1)', ['W7M2Q9XA']))
          .code,
      ).toBe('42501');
    }));
});

describe('departure_preview', () => {
  it('lists what the member owns and, for information, the rotations they leave', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const third = await db.createUser('Third');
      await addMember(db, world.b.id, third);
      await db.admin.query(
        `insert into public.chore (household_id, name, recurrence_unit, anchor_date,
           rotation_order, rotation_offset, created_by)
         values ($1, 'Dishes', 'day', current_date, array[$2, $3, $4]::uuid[], 0, $2)`,
        [world.b.id, world.b.admin.id, world.b.member.id, third.id],
      );
      // One completion: the turn is at index 1, the departing member, so it passes to Third.
      await db.admin.query(
        `insert into public.chore_completion (chore_id, occurrence_date, completed_by)
         select id, current_date, $2 from public.chore where name = 'Dishes' and household_id = $1`,
        [world.b.id, world.b.admin.id],
      );

      for (const caller of [world.b.member, world.b.admin]) {
        const rows = await db
          .as(caller)
          .query<{ preview: Record<string, unknown> }>(
            'select public.departure_preview($1, $2) as preview',
            [world.b.id, world.b.member.id],
          );
        const preview = rows[0]?.preview;
        expect(preview).toMatchObject({
          is_last_member: false,
          lists: [{ id: world.b.rows.list, name: 'Groceries' }],
          chores: [{ id: world.b.rows.chore, name: 'Trash' }],
          errands: [{ id: world.b.rows.errand, name: 'Post office' }],
          bills: [{ id: world.b.rows.bill, name: 'Rent' }],
          // public.rebase_rotation (functions.sql): rotation_order=[admin, member, third],
          // rotation_offset=0, completion_count=1, removed=member. cur = (0+1) mod 3 = 1, which is
          // member's own index (i=cur=1), so next_cur = cur mod (n-1) = 1 mod 2 = 1 and
          // new_offset = ((1-1) mod 2 + 2) mod 2 = 0, over the rebased order [admin, third].
          // turn_holder = new_order[(new_offset + completion_count) mod 2]
          //             = new_order[(0+1) mod 2] = new_order[1] = third.id.
          rotations: [{ chore_name: 'Dishes', next_turn_user_id: third.id }],
        });
      }
    }));

  it('reports counts for the typed-name confirmation when the member is the last one', () =>
    withTestDb(async (db) => {
      const user = await db.createUser('Solo');
      const hid = await createHousehold(db, user, 'Solo House', '27705');
      await db.admin.query(
        `insert into public.shopping_list (household_id, name, created_by)
         values ($1, 'A', $2), ($1, 'B', $2)`,
        [hid, user.id],
      );
      const rows = await db
        .as(user)
        .query<{ preview: Record<string, unknown> }>(
          'select public.departure_preview($1, $2) as preview',
          [hid, user.id],
        );
      expect(rows[0]?.preview).toMatchObject({
        is_last_member: true,
        household_name: 'Solo House',
        deletion_counts: { lists: 2, recipes: 0, chores: 0 },
        lists: [],
      });
    }));

  it('refuses another member, an outsider, and a non-member target', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const third = await db.createUser('Third');
      await addMember(db, world.b.id, third);
      const preview = (caller: TestUser, target: string) =>
        db.as(caller).fails('select public.departure_preview($1, $2)', [world.b.id, target]);
      expect((await preview(third, world.b.member.id)).code).toBe('42501');
      expect((await preview(world.a.admin, world.b.member.id)).code).toBe('42501');
      expect((await preview(world.b.admin, world.a.member.id)).code).toBe('P0002');
    }));
});

describe('depart_household', () => {
  const depart = (
    db: TestDb,
    caller: TestUser,
    hid: string,
    user: TestUser,
    reassignments: string | null,
    confirm: string | null = null,
  ) =>
    db
      .as(caller)
      .query<{ result: { household_deleted: boolean; promoted_user_id: string | null } }>(
        'select public.depart_household($1, $2, $3::jsonb, $4) as result',
        [hid, user.id, reassignments, confirm],
      );

  it('applies every reassignment, removes the member, and keeps their history', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      await depart(
        db,
        world.b.member,
        world.b.id,
        world.b.member,
        reassignAll(world, world.b.admin),
      );

      expect(await membership(db, world.b.id)).toEqual([
        { user_id: world.b.admin.id, role: 'admin' },
      ]);
      const owners = await db.admin.query(
        `select (select created_by from public.shopping_list where id = $1) as list,
                (select assigned_to from public.chore where id = $2) as chore,
                (select assigned_to from public.errand where id = $3) as errand,
                (select owner_user_id from public.bill where id = $4) as bill`,
        [world.b.rows.list, world.b.rows.chore, world.b.rows.errand, world.b.rows.bill],
      );
      expect(owners).toEqual([
        {
          list: world.b.admin.id,
          chore: world.b.admin.id,
          errand: world.b.admin.id,
          bill: world.b.admin.id,
        },
      ]);
      // Historical records keep the departed member's id.
      const history = await db.admin.query(
        `select (select completed_by from public.chore_completion where id = $1) as completed_by,
                (select recorded_by from public.bill_payment_log where id = $2) as recorded_by,
                (select added_by from public.shopping_list_item where id = $3) as added_by`,
        [world.b.rows.completion, world.b.rows.payment, world.b.rows.listItem],
      );
      expect(history).toEqual([
        {
          completed_by: world.b.member.id,
          recorded_by: world.b.member.id,
          added_by: world.b.member.id,
        },
      ]);
      // The departed member's unsent notification about the household is gone.
      expect(
        await db.admin.query('select id from public.notification where id = $1', [
          world.b.rows.notification,
        ]),
      ).toEqual([]);
      expect(await activeHousehold(db, world.b.member)).toBeNull();
    }));

  it('fails, changing nothing, if anything is left unassigned or reassigned wrongly', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const partial = JSON.stringify({ [world.b.rows.list]: world.b.admin.id });
      const leave = (reassignments: string | null) =>
        db
          .as(world.b.admin)
          .fails('select public.depart_household($1, $2, $3::jsonb, null)', [
            world.b.id,
            world.b.member.id,
            reassignments,
          ]);

      expect((await leave(null)).code).toBe('HR003');
      expect((await leave(partial)).code).toBe('HR003');
      const toDeparting = JSON.parse(reassignAll(world, world.b.member)) as Record<string, string>;
      expect((await leave(JSON.stringify(toDeparting))).code).toBe('22023');
      expect((await leave(reassignAll(world, world.a.admin))).code).toBe('22023');
      expect(
        (
          await leave(
            JSON.stringify({
              ...(JSON.parse(reassignAll(world, world.b.admin)) as Record<string, string>),
              [world.a.rows.list]: world.b.admin.id,
            }),
          )
        ).code,
      ).toBe('22023');
      expect((await leave('[]')).code).toBe('22023');
      expect((await membership(db, world.b.id)).map((m) => m.user_id)).toContain(world.b.member.id);
    }));

  it('refuses a caller who is neither the member nor the admin', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const third = await db.createUser('Third');
      await addMember(db, world.b.id, third);
      const attempt = (caller: TestUser) =>
        db
          .as(caller)
          .fails('select public.depart_household($1, $2, $3::jsonb, null)', [
            world.b.id,
            world.b.member.id,
            reassignAll(world, world.b.admin),
          ]);
      expect((await attempt(third)).code).toBe('42501');
      expect((await attempt(world.a.admin)).code).toBe('42501');
      expect(
        (
          await db
            .asRoles(['authenticated'])
            .fails('select public.depart_household($1, $2, null, null)', [
              world.b.id,
              world.b.member.id,
            ])
        ).code,
      ).toBe('42501');
      expect(
        (
          await db
            .as(world.b.admin)
            .fails('select public.depart_household($1, $2, null, null)', [
              world.b.id,
              world.a.member.id,
            ])
        ).code,
      ).toBe('P0002');
    }));

  it('promotes the longest-tenured remaining member when the admin leaves', () =>
    withTestDb(async (db) => {
      const admin = await db.createUser('Admin');
      const newer = await db.createUser('Newer');
      const older = await db.createUser('Older');
      const hid = await createHousehold(db, admin, 'Tenure', '27514');
      await addMember(db, hid, newer, '2026-03-01T00:00:00Z');
      await addMember(db, hid, older, '2026-01-01T00:00:00Z');

      const rows = await depart(db, admin, hid, admin, '{}');
      expect(rows[0]?.result).toEqual({ household_deleted: false, promoted_user_id: older.id });
      expect(await membership(db, hid)).toEqual([
        { user_id: older.id, role: 'admin' },
        { user_id: newer.id, role: 'member' },
      ]);
    }));

  it('moves the departed user to their longest-held remaining household', () =>
    withTestDb(async (db) => {
      const world = await buildWorld(db);
      const c = await createHousehold(db, world.b.member, 'Later', '27705');
      await db.admin.query(
        `update public.household_member set joined_at = now() - interval '1 day'
         where household_id = $1 and user_id = $2`,
        [c, world.b.member.id],
      );
      await db.admin.query(
        `update public.household_member set joined_at = now() - interval '9 days'
         where household_id = $1 and user_id = $2`,
        [world.b.id, world.b.member.id],
      );
      const d = await createHousehold(db, world.a.admin, 'Newest', '27705');
      await addMember(db, d, world.b.member);
      await db.admin.query('update public.profile set active_household_id = $1 where id = $2', [
        world.b.id,
        world.b.member.id,
      ]);

      await depart(
        db,
        world.b.admin,
        world.b.id,
        world.b.member,
        reassignAll(world, world.b.admin),
      );
      expect(await activeHousehold(db, world.b.member)).toBe(c);
    }));

  describe('rotation rebasing', () => {
    // Four members, one completion. With rotation_offset o the turn index is (o + 1) mod 4.
    async function setup(db: TestDb, offset: number) {
      const users = [
        await db.createUser('R0'),
        await db.createUser('R1'),
        await db.createUser('R2'),
        await db.createUser('R3'),
      ] as const;
      const hid = await createHousehold(db, users[0], 'Rota', '27514');
      for (const user of users.slice(1)) await addMember(db, hid, user);
      const chores = await db.admin.query<{ id: string }>(
        `insert into public.chore (household_id, name, recurrence_unit, anchor_date,
           rotation_order, rotation_offset, created_by)
         values ($1, 'Rota', 'week', current_date - 7, $2::uuid[], $3, $4) returning id`,
        [hid, users.map((u) => u.id), offset, users[0].id],
      );
      const chore = chores[0]?.id ?? '';
      await db.admin.query(
        `insert into public.chore_completion (chore_id, occurrence_date, completed_by)
         values ($1, current_date - 7, $2)`,
        [chore, users[0].id],
      );
      return { users, hid, chore };
    }

    async function turn(db: TestDb, chore: string) {
      const rows = await db.admin.query<{
        rotation_order: string[] | null;
        rotation_offset: number;
        holder: string | null;
      }>(
        `select rotation_order, rotation_offset,
           rotation_order[(rotation_offset + (select count(*) from public.chore_completion
             where chore_id = c.id)) % cardinality(rotation_order) + 1] as holder
         from public.chore c where id = $1`,
        [chore],
      );
      const row = rows[0];
      if (row === undefined) throw new Error('chore missing');
      return row;
    }

    it('keeps the turn when an earlier member leaves (i < cur)', () =>
      withTestDb(async (db) => {
        const { users, hid, chore } = await setup(db, 1); // turn at index 2 (R2)
        await depart(db, users[1], hid, users[1], '{}');
        const after = await turn(db, chore);
        expect(after.rotation_order).toEqual([users[0].id, users[2].id, users[3].id]);
        expect(after.holder).toBe(users[2].id);
        expect(after.rotation_offset).toBe(0); // (1 - 1) mod 3
      }));

    it('keeps the turn when a later member leaves (i > cur)', () =>
      withTestDb(async (db) => {
        const { users, hid, chore } = await setup(db, 0); // turn at index 1 (R1)
        await depart(db, users[3], hid, users[3], '{}');
        const after = await turn(db, chore);
        expect(after.rotation_order).toEqual([users[0].id, users[1].id, users[2].id]);
        expect(after.holder).toBe(users[1].id);
        expect(after.rotation_offset).toBe(0);
      }));

    it('passes the turn to the next member when the current one leaves (i = cur)', () =>
      withTestDb(async (db) => {
        const { users, hid, chore } = await setup(db, 1); // turn at index 2 (R2)
        await depart(db, users[2], hid, users[2], '{}');
        const after = await turn(db, chore);
        expect(after.rotation_order).toEqual([users[0].id, users[1].id, users[3].id]);
        expect(after.holder).toBe(users[3].id);
        expect(after.rotation_offset).toBe(1);
      }));

    it('wraps to the first member when the current last-positioned one leaves', () =>
      withTestDb(async (db) => {
        const { users, hid, chore } = await setup(db, 2); // turn at index 3 (R3)
        await depart(db, users[3], hid, users[3], '{}');
        const after = await turn(db, chore);
        expect(after.holder).toBe(users[0].id);
        expect(after.rotation_offset).toBe(2); // (0 - 1) mod 3
      }));

    it('sets the order to null when its last member leaves', () =>
      withTestDb(async (db) => {
        const world = await buildWorld(db);
        const rows = await db.admin.query<{ id: string }>(
          `insert into public.chore (household_id, name, recurrence_unit, anchor_date,
             rotation_order, rotation_offset, created_by)
           values ($1, 'Solo rota', 'week', current_date, array[$2]::uuid[], 0, $2)
           returning id`,
          [world.b.id, world.b.member.id],
        );
        await depart(
          db,
          world.b.member,
          world.b.id,
          world.b.member,
          reassignAll(world, world.b.admin),
        );
        const after = await db.admin.query(
          'select rotation_order, rotation_offset from public.chore where id = $1',
          [rows[0]?.id],
        );
        expect(after).toEqual([{ rotation_order: null, rotation_offset: 0 }]);
      }));
  });

  describe('the last member', () => {
    async function solo(db: TestDb) {
      const world = await buildWorld(db);
      // Leave B with only its member, who then leaves.
      await db.admin.query(
        'delete from public.household_member where household_id = $1 and user_id = $2',
        [world.b.id, world.b.admin.id],
      );
      await db.admin.query(
        `update public.household_member set role = 'admin' where household_id = $1`,
        [world.b.id],
      );
      return world;
    }

    it('cannot delete the household without the exact household name', () =>
      withTestDb(async (db) => {
        const world = await solo(db);
        for (const typed of [null, 'house b', 'House B ']) {
          const error = await db
            .as(world.b.member)
            .fails('select public.depart_household($1, $2, null, $3)', [
              world.b.id,
              world.b.member.id,
              typed,
            ]);
          expect(error.code).toBe('HR004');
        }
        expect(await membership(db, world.b.id)).toHaveLength(1);
      }));

    it('deletes the household and all its data, but not personal bills or other households', () =>
      withTestDb(async (db) => {
        const world = await solo(db);
        const rows = await depart(db, world.b.member, world.b.id, world.b.member, null, 'House B');
        expect(rows[0]?.result.household_deleted).toBe(true);

        for (const table of [
          'household_favorite_store',
          'shopping_list',
          'pantry_item',
          'recipe',
          'recipe_readiness',
          'ingredient_match_override',
          'meal_plan_entry',
          'chore',
          'errand',
          'household_invite',
          'household_member',
          'notification_preference',
        ]) {
          const left = await db.admin.query(
            `select 1 from public.${table} where household_id = $1`,
            [world.b.id],
          );
          expect(left, table).toEqual([]);
        }
        const children = await db.admin.query<{ n: number }>(
          `select (select count(*) from public.shopping_list_item where id = $1)
                + (select count(*) from public.recipe_ingredient where id = $2)
                + (select count(*) from public.chore_completion where id = $3)
                + (select count(*) from public.bill where id = $4)
                + (select count(*) from public.bill_payment_log where id = $5) as n`,
          [
            world.b.rows.listItem,
            world.b.rows.ingredient,
            world.b.rows.completion,
            world.b.rows.bill,
            world.b.rows.payment,
          ],
        );
        expect(Number(children[0]?.n)).toBe(0);
        expect(
          await db.admin.query('select 1 from public.household where id = $1', [world.b.id]),
        ).toEqual([]);

        const personal = await db
          .as(world.b.member)
          .query('select id from public.bill where id = $1', [world.b.rows.personalBill]);
        expect(personal).toHaveLength(1);
        expect(
          await db.admin.query('select 1 from public.household where id = $1', [world.a.id]),
        ).toHaveLength(1);
        expect(await activeHousehold(db, world.b.member)).toBeNull();
      }));
  });
});
