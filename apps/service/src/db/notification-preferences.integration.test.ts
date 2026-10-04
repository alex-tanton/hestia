import { afterAll, describe, expect, it } from 'vitest';
import { closeTestDb, withTestDb } from '../test/integration-db.js';
import { createHousehold } from '../test/world.js';

/*
 * Row-level security on notification_preference and push_subscription, as the authenticated
 * role. Each test is one rolled-back transaction (Engineering Practices, "Integration test
 * database").
 */

afterAll(async () => {
  await closeTestDb();
});

describe('notification_preference RLS', () => {
  it('lets a user write the weekly meal nudge only for a household they belong to', () =>
    withTestDb(async (db) => {
      const alex = await db.createUser('Alex');
      const casey = await db.createUser('Casey');
      const alexHome = await createHousehold(db, alex, 'Alex Home', '27514');
      const caseyHome = await createHousehold(db, casey, 'Casey Home', '27515');

      const own = await db.as(alex).query<{ id: string }>(
        `insert into public.notification_preference
           (user_id, notification_type, household_id, enabled)
         values ($1, 'weekly_meal_nudge', $2, true) returning id`,
        [alex.id, alexHome],
      );
      expect(own).toHaveLength(1);

      const error = await db.as(alex).fails(
        `insert into public.notification_preference
           (user_id, notification_type, household_id, enabled)
         values ($1, 'weekly_meal_nudge', $2, true)`,
        [alex.id, caseyHome],
      );
      expect(error.code).toBe('42501');
    }));

  it('hides and blocks another user’s preference rows', () =>
    withTestDb(async (db) => {
      const alex = await db.createUser('Alex');
      const casey = await db.createUser('Casey');
      await db.admin.query(
        `insert into public.notification_preference (user_id, notification_type, enabled)
         values ($1, 'bill_due', false)`,
        [alex.id],
      );

      expect(
        await db
          .as(casey)
          .query('select id from public.notification_preference where user_id = $1', [alex.id]),
      ).toEqual([]);

      const updated = await db.as(casey).query<{ id: string }>(
        `update public.notification_preference set enabled = true
         where user_id = $1 returning id`,
        [alex.id],
      );
      expect(updated).toEqual([]);

      const stored = await db.admin.query<{ enabled: boolean }>(
        'select enabled from public.notification_preference where user_id = $1',
        [alex.id],
      );
      expect(stored).toEqual([{ enabled: false }]);
    }));
});

describe('push_subscription RLS', () => {
  it('refuses to store a subscription under another user’s id', () =>
    withTestDb(async (db) => {
      const alex = await db.createUser('Alex');
      const casey = await db.createUser('Casey');
      const error = await db.as(casey).fails(
        `insert into public.push_subscription (user_id, endpoint, keys)
         values ($1, 'https://push.example.com/send/x', '{}')`,
        [alex.id],
      );
      expect(error.code).toBe('42501');
    }));

  it('hides another user’s subscriptions from reads', () =>
    withTestDb(async (db) => {
      const alex = await db.createUser('Alex');
      const casey = await db.createUser('Casey');
      await db.admin.query(
        `insert into public.push_subscription (user_id, endpoint, keys)
         values ($1, 'https://push.example.com/send/x', '{}')`,
        [alex.id],
      );
      expect(
        await db
          .as(casey)
          .query('select id from public.push_subscription where user_id = $1', [alex.id]),
      ).toEqual([]);
    }));
});
