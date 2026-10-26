import { randomUUID } from 'node:crypto';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Household, NotificationType, ShoppingListDetail } from '@hestia/shared';
import { createDatabase, type DatabaseHandle } from './db.js';
import { runDispatchNotifications } from './jobs/dispatch-notifications.js';
import type { JobDatabase, JobLogger } from './jobs/types.js';
import { createNotificationOutbox } from './privileged/notification-outbox.js';
import { withServiceRoleDb } from './privileged/service-role-db.js';
import { notificationDefaults } from './services/notifications.js';
import { RecordingPushTransport } from './test/push-double.js';
import {
  adminPool,
  as,
  enableServiceLogin,
  signUp,
  startStack,
  stackConfig,
  uniqueName,
  type SignedUpUser,
  type Stack,
} from './test/service-stack.js';

/*
 * The notification producers against `supabase start`. Users are real GoTrue sign-ups and every
 * list, chore, and departure goes through the HTTP routes. Scheduled reminders are enqueued at a
 * fixed clock so each send time is exact: 2026-10-04 is a Sunday, so 2026-10-03 is the Saturday for
 * the nudge.
 *
 * The push transport is always the recording double, so no push endpoint is contacted from here.
 */

/** Sunday 2026-10-04 at 10:00 in New York, after every 09:00 send time that day. */
const NOW = new Date('2026-10-04T14:00:00Z');
/** 07:00 in New York on the same day, before the 08:00 meal reminder. */
const BEFORE_MEAL_REMINDER = new Date('2026-10-04T11:00:00Z');
/** Saturday 2026-10-03 at 10:00 in New York: the nudge day, for a household with an empty week. */
const SATURDAY = new Date('2026-10-03T14:00:00Z');
/**
 * Saturday 2026-10-10 at 10:00 in Auckland (NZDT, UTC+13), when Los Angeles is still Friday 14:00.
 * The nudge's 09:00 send time that day is 20:00 UTC on the 9th.
 */
const AUCKLAND_SATURDAY = new Date('2026-10-09T21:00:00Z');
const NEW_YORK = 'America/New_York';

let stack: Stack;
let app: FastifyInstance;
let handle: DatabaseHandle;
let jobDb: JobDatabase;
let transport: RecordingPushTransport;
let outbox: ReturnType<typeof createNotificationOutbox>;
const userIds: string[] = [];
const householdIds: string[] = [];

const KEYS = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA', auth: 'tBHItJI5svbpez7KI4CCXg' };

const logger: JobLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => logger,
};

beforeAll(async () => {
  await enableServiceLogin();
  stack = await startStack();
  handle = createDatabase(stackConfig().serviceDatabaseUrl);
  jobDb = {
    asServiceRole: (fn) => withServiceRoleDb(handle.db, fn),
    pool: handle.db,
  };
  outbox = createNotificationOutbox(jobDb);
});

afterAll(async () => {
  // Households go first, which cascades their lists, chores, and bills. Personal bills reference
  // their owner without cascading, so they go before the users do.
  if (householdIds.length > 0) {
    await adminPool.query('delete from public.household where id = any($1::uuid[])', [
      householdIds,
    ]);
  }
  if (userIds.length > 0) {
    await adminPool.query('delete from public.bill where owner_user_id = any($1::uuid[])', [
      userIds,
    ]);
    await adminPool.query('delete from auth.users where id = any($1::uuid[])', [userIds]);
  }
  await handle.close();
  await stack.close();
});

beforeEach(async () => {
  app = await stack.newApp();
  transport = new RecordingPushTransport();
});

function expectOk(response: LightMyRequestResponse): void {
  expect(response.statusCode, response.body).toBeLessThan(300);
}

interface Home {
  id: string;
  alex: SignedUpUser;
  sam: SignedUpUser;
  jordan: SignedUpUser;
}

/** A household with Alex as admin and Sam and Jordan as members, all in New York. */
async function makeHome(householdTz = NEW_YORK, samTz = NEW_YORK): Promise<Home> {
  const alex = await signUp(app, 'Alex', householdTz);
  const sam = await signUp(app, 'Sam', samTz);
  const jordan = await signUp(app, 'Jordan', NEW_YORK);
  userIds.push(alex.id, sam.id, jordan.id);
  const created = await as(app, alex, 'POST', '/api/households', {
    name: uniqueName('Oak Street'),
    postalCode: '27514',
    timezone: householdTz,
  });
  expectOk(created);
  const id = created.json<Household>().id;
  householdIds.push(id);
  for (const member of [sam, jordan]) {
    await adminPool.query(
      `insert into public.household_member (household_id, user_id, role) values ($1, $2, 'member')`,
      [id, member.id],
    );
  }
  return { id, alex, sam, jordan };
}

async function setPreference(
  userId: string,
  type: NotificationType,
  enabled: boolean,
  householdId: string | null = null,
): Promise<void> {
  await adminPool.query(
    `insert into public.notification_preference (user_id, notification_type, household_id, enabled)
     values ($1, $2, $3, $4)
     on conflict (user_id, notification_type, household_id) do update set enabled = excluded.enabled`,
    [userId, type, householdId, enabled],
  );
}

async function setQuietHours(userId: string, start: string, end: string): Promise<void> {
  await adminPool.query(
    'update public.profile set quiet_hours_start = $2, quiet_hours_end = $3 where id = $1',
    [userId, start, end],
  );
}

async function addDevice(userId: string, name: string): Promise<string> {
  const endpoint = `https://push.example.com/${name}-${randomUUID()}`;
  await adminPool.query(
    `insert into public.push_subscription (user_id, endpoint, keys) values ($1, $2, $3)`,
    [userId, endpoint, JSON.stringify(KEYS)],
  );
  return endpoint;
}

interface OutboxRow {
  id: string;
  target_id: string;
  occurrence_key: string;
  payload: { title: string; body: string; count?: number };
  send_after: Date;
  sent_at: Date | null;
}

async function rowsFor(
  userId: string,
  type: NotificationType,
  targetId?: string,
): Promise<OutboxRow[]> {
  const { rows } = await adminPool.query<OutboxRow>(
    `select id, target_id, occurrence_key, payload, send_after, sent_at from public.notification
     where user_id = $1 and type = $2 and ($3::uuid is null or target_id = $3::uuid)
     order by occurrence_key, send_after`,
    [userId, type, targetId ?? null],
  );
  return rows;
}

/** Stands in for the clock running on: every unsent row of the type is due now. */
async function passTime(userId: string, type: NotificationType): Promise<void> {
  await adminPool.query(
    `update public.notification set send_after = now() - interval '1 minute'
     where user_id = $1 and type = $2 and sent_at is null`,
    [userId, type],
  );
}

async function sendDue(): Promise<void> {
  await runDispatchNotifications({ outbox, transport, logger, now: () => NOW });
}

function pushesTo(endpoint: string): { title: string }[] {
  return transport.sent
    .filter((one) => one.endpoint === endpoint)
    .map((one) => ({ title: (JSON.parse(one.message) as { title: string }).title }));
}

async function enqueueAt(now: Date): Promise<number> {
  return (await outbox.enqueueScheduled(now)).inserted;
}

/** A household bill, created directly as `postgres` the way the seed does. */
async function insertBill(options: {
  householdId: string | null;
  owner: string;
  name: string;
  amount: string;
  autopay?: boolean;
  anchor?: string;
  reminderDaysBefore?: number;
  archived?: boolean;
}): Promise<string> {
  const { rows } = await adminPool.query<{ id: string }>(
    `insert into public.bill (household_id, owner_user_id, name, amount, autopay, recurrence_unit,
       "interval", anchor_date, reminder_days_before, visibility, archived_at)
     values ($1, $2, $3, $4, $5, 'month', 1, $6, $7, $8, case when $9 then now() else null end)
     returning id`,
    [
      options.householdId,
      options.owner,
      options.name,
      options.amount,
      options.autopay ?? false,
      options.anchor ?? '2026-01-07',
      options.reminderDaysBefore ?? 3,
      options.householdId === null ? 'personal' : 'household',
      options.archived ?? false,
    ],
  );
  return rows[0]?.id ?? '';
}

describe('list activity batches', () => {
  async function groceryList(home: Home): Promise<string> {
    const created = await as(app, home.alex, 'POST', `/api/households/${home.id}/lists`, {
      name: 'Grocery List',
    });
    expectOk(created);
    return created.json<ShoppingListDetail>().id;
  }

  async function addItem(
    user: SignedUpUser,
    listId: string,
    name: string,
  ): Promise<LightMyRequestResponse> {
    return as(app, user, 'POST', `/api/lists/${listId}/items`, {
      source: 'manual',
      itemName: name,
    });
  }

  it('turns five adds into one row per other member, one push, and a count', async () => {
    const home = await makeHome();
    const listId = await groceryList(home);
    const alexDevice = await addDevice(home.alex.id, 'alex');
    for (let index = 1; index <= 5; index += 1) {
      expectOk(await addItem(home.sam, listId, `Item ${String(index)}`));
    }

    const alexRows = await rowsFor(home.alex.id, 'list_activity', listId);
    expect(alexRows).toHaveLength(1);
    expect(alexRows[0]?.payload).toMatchObject({
      title: '5 items added to Grocery List',
      body: 'by Sam',
      count: 5,
    });
    expect(await rowsFor(home.jordan.id, 'list_activity', listId)).toHaveLength(1);
    expect(await rowsFor(home.sam.id, 'list_activity', listId)).toHaveLength(0);

    await passTime(home.alex.id, 'list_activity');
    await sendDue();
    expect(pushesTo(alexDevice)).toStrictEqual([{ title: '5 items added to Grocery List' }]);
  });

  it('opens a new batch after the last one is sent, and sends it again the same day', async () => {
    const home = await makeHome();
    const listId = await groceryList(home);
    const alexDevice = await addDevice(home.alex.id, 'alex');
    expectOk(await addItem(home.sam, listId, 'Milk'));
    await passTime(home.alex.id, 'list_activity');
    await sendDue();

    expectOk(await addItem(home.sam, listId, 'Eggs'));

    const rows = await rowsFor(home.alex.id, 'list_activity', listId);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.occurrence_key).not.toBe(rows[1]?.occurrence_key);
    expect(rows[1]?.payload.title).toBe('1 item added to Grocery List');

    await passTime(home.alex.id, 'list_activity');
    await sendDue();
    expect(pushesTo(alexDevice)).toStrictEqual([
      { title: '1 item added to Grocery List' },
      { title: '1 item added to Grocery List' },
    ]);
  });

  it('keeps one batch across adds while it is unsent, and resends nothing already sent', async () => {
    const home = await makeHome();
    const listId = await groceryList(home);
    expectOk(await addItem(home.sam, listId, 'Milk'));
    expectOk(await addItem(home.jordan, listId, 'Bread'));

    const rows = await rowsFor(home.alex.id, 'list_activity', listId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toMatchObject({
      title: '2 items added to Grocery List',
      body: 'by Sam and Jordan',
    });
  });

  it('counts a replayed offline add once', async () => {
    const home = await makeHome();
    const listId = await groceryList(home);
    const id = randomUUID();
    const body = { id, source: 'manual', itemName: 'Milk' };
    expectOk(await as(app, home.sam, 'POST', `/api/lists/${listId}/items`, body));
    expectOk(await as(app, home.sam, 'POST', `/api/lists/${listId}/items`, body));

    const rows = await rowsFor(home.alex.id, 'list_activity', listId);
    expect(rows[0]?.payload.count).toBe(1);
  });

  it('serialises two concurrent adds to a list with no open batch into one batch', async () => {
    const home = await makeHome();
    const listId = await groceryList(home);
    const alexDevice = await addDevice(home.alex.id, 'alex');

    // Both requests start before either has a batch to join, so each would open one unless the
    // read of the open batch and the write that follows are serialised per list.
    const responses = await Promise.all([
      addItem(home.sam, listId, 'Milk'),
      addItem(home.jordan, listId, 'Bread'),
    ]);
    for (const response of responses) expectOk(response);

    const alexRows = await rowsFor(home.alex.id, 'list_activity', listId);
    expect(alexRows).toHaveLength(1);
    expect(alexRows[0]?.payload).toMatchObject({
      title: '2 items added to Grocery List',
      count: 2,
    });

    await passTime(home.alex.id, 'list_activity');
    await sendDue();
    expect(pushesTo(alexDevice)).toStrictEqual([{ title: '2 items added to Grocery List' }]);
  });

  it('lands a batch that starts inside quiet hours at the end of the window', async () => {
    const home = await makeHome();
    const listId = await groceryList(home);
    await setQuietHours(home.jordan.id, '00:00', '23:59');
    expectOk(await addItem(home.sam, listId, 'Milk'));

    const [row] = await rowsFor(home.jordan.id, 'list_activity', listId);
    const { rows } = await adminPool.query<{ local: string }>(
      `select to_char(send_after at time zone 'America/New_York', 'HH24:MI') as local
       from public.notification where id = $1`,
      [row?.id ?? ''],
    );
    expect(rows[0]?.local).toBe('23:59');
  });
});

describe('bill_due', () => {
  it('reaches the owner only, and the Spectrum fixture carries the autopay label', async () => {
    const home = await makeHome();
    const spectrum = await insertBill({
      householdId: home.id,
      owner: home.alex.id,
      name: 'Spectrum Internet',
      amount: '74.99',
      autopay: true,
    });

    await enqueueAt(NOW);

    const alex = await rowsFor(home.alex.id, 'bill_due', spectrum);
    expect(alex).toHaveLength(1);
    expect(alex[0]?.occurrence_key).toBe('2026-10-07/advance');
    expect(alex[0]?.payload).toStrictEqual({
      title: 'Spectrum Internet due Wednesday',
      body: '$74.99 · autopay',
      target: 'bills',
      householdId: home.id,
    });
    expect(await rowsFor(home.jordan.id, 'bill_due', spectrum)).toHaveLength(0);
    expect(await rowsFor(home.sam.id, 'bill_due', spectrum)).toHaveLength(0);
  });

  it('reaches an opted-in member too, once the household-bills setting is on', async () => {
    const home = await makeHome();
    const spectrum = await insertBill({
      householdId: home.id,
      owner: home.alex.id,
      name: 'Spectrum Internet',
      amount: '74.99',
      autopay: true,
    });
    await adminPool.query(
      'update public.profile set household_bill_reminders = true where id = $1',
      [home.jordan.id],
    );

    await enqueueAt(NOW);

    expect(await rowsFor(home.jordan.id, 'bill_due', spectrum)).toHaveLength(1);
    expect(await rowsFor(home.sam.id, 'bill_due', spectrum)).toHaveLength(0);
  });

  it('sends a personal bill to its owner only', async () => {
    const home = await makeHome();
    const adobe = await insertBill({
      householdId: null,
      owner: home.sam.id,
      name: 'Adobe Creative Cloud',
      amount: '59.99',
      autopay: true,
    });

    await enqueueAt(NOW);

    expect(await rowsFor(home.sam.id, 'bill_due', adobe)).toHaveLength(1);
    expect(await rowsFor(home.alex.id, 'bill_due', adobe)).toHaveLength(0);
    expect(await rowsFor(home.jordan.id, 'bill_due', adobe)).toHaveLength(0);
  });

  it('sends nothing for an archived bill', async () => {
    const home = await makeHome();
    const retired = await insertBill({
      householdId: home.id,
      owner: home.alex.id,
      name: 'Old Phone Plan',
      amount: '45.00',
      archived: true,
    });

    await enqueueAt(NOW);

    expect(await rowsFor(home.alex.id, 'bill_due', retired)).toHaveLength(0);
  });

  it('sends nothing for an occurrence already paid, and writes nothing on a rerun', async () => {
    const home = await makeHome();
    const water = await insertBill({
      householdId: home.id,
      owner: home.jordan.id,
      name: 'Water and Sewer',
      amount: '58.40',
    });
    await adminPool.query(
      `insert into public.bill_payment_log (bill_id, occurrence_date, paid_date, amount_paid, recorded_by)
       values ($1, '2026-10-07', '2026-10-06', 58.40, $2)`,
      [water, home.jordan.id],
    );

    await enqueueAt(NOW);
    const rerun = await enqueueAt(NOW);

    expect(await rowsFor(home.jordan.id, 'bill_due', water)).toHaveLength(0);
    expect(rerun).toBe(0);
  });

  it('does not send a reminder whose bill was paid after it was written', async () => {
    const home = await makeHome();
    const spectrum = await insertBill({
      householdId: home.id,
      owner: home.alex.id,
      name: 'Spectrum Internet',
      amount: '74.99',
      autopay: true,
    });
    const alexDevice = await addDevice(home.alex.id, 'alex');
    await enqueueAt(NOW);
    expect(await rowsFor(home.alex.id, 'bill_due', spectrum)).toHaveLength(1);

    await adminPool.query(
      `insert into public.bill_payment_log (bill_id, occurrence_date, paid_date, amount_paid, recorded_by)
       values ($1, '2026-10-07', '2026-10-06', 74.99, $2)`,
      [spectrum, home.alex.id],
    );
    await passTime(home.alex.id, 'bill_due');
    await sendDue();

    expect(await rowsFor(home.alex.id, 'bill_due', spectrum)).toHaveLength(0);
    expect(pushesTo(alexDevice)).toStrictEqual([]);
  });

  it('drops a reminder whose title would be over the 60-character copy limit, and enqueues nothing for it', async () => {
    // notificationCopySchema (packages/shared) caps title and body at 60 characters; billRows' own
    // payloadOf(...) returns null rather than truncating, and the producer must not enqueue a row
    // at all for it (the builder answers null, and the producer does not enqueue the row).
    const home = await makeHome();
    const longName = 'A'.repeat(70);
    const tooLong = await insertBill({
      householdId: home.id,
      owner: home.alex.id,
      name: longName,
      amount: '10.00',
    });

    const outcome = await outbox.enqueueScheduled(NOW);

    expect(outcome.dropped).toContainEqual({ type: 'bill_due', id: tooLong });
    expect(await rowsFor(home.alex.id, 'bill_due', tooLong)).toHaveLength(0);
  });
});

describe('chore_due and errands', () => {
  it('reminds the assignee of a chore due today, and not once it is completed', async () => {
    const home = await makeHome();
    const trash = await adminPool.query<{ id: string }>(
      `insert into public.chore (household_id, name, recurrence_unit, anchor_date, assigned_to, created_by)
       values ($1, 'Take out trash', 'week', '2026-09-27', $2, $3) returning id`,
      [home.id, home.sam.id, home.alex.id],
    );
    const trashId = trash.rows[0]?.id ?? '';
    const bathroom = await adminPool.query<{ id: string }>(
      `insert into public.chore (household_id, name, recurrence_unit, anchor_date, assigned_to, created_by)
       values ($1, 'Clean bathroom', 'week', '2026-09-27', $2, $3) returning id`,
      [home.id, home.jordan.id, home.alex.id],
    );
    const bathroomId = bathroom.rows[0]?.id ?? '';
    await adminPool.query(
      `insert into public.chore_completion (chore_id, occurrence_date, completed_by)
       values ($1, '2026-10-04', $2)`,
      [bathroomId, home.jordan.id],
    );

    await enqueueAt(NOW);

    const trashRows = await rowsFor(home.sam.id, 'chore_due', trashId);
    expect(trashRows).toHaveLength(1);
    expect(trashRows[0]?.payload).toMatchObject({
      title: 'Take out trash',
      body: 'Your turn this week',
    });
    expect(await rowsFor(home.jordan.id, 'chore_due', bathroomId)).toHaveLength(0);
  });

  it('reminds the member whose turn it is on a rotating chore', async () => {
    const home = await makeHome();
    const fridge = await adminPool.query<{ id: string }>(
      `insert into public.chore (household_id, name, recurrence_unit, anchor_date, rotation_order,
         rotation_offset, created_by)
       values ($1, 'Clean fridge', 'week', '2026-09-27', array[$2, $3, $4]::uuid[], 2, $5)
       returning id`,
      [home.id, home.alex.id, home.sam.id, home.jordan.id, home.alex.id],
    );
    const fridgeId = fridge.rows[0]?.id ?? '';

    await enqueueAt(NOW);

    expect(await rowsFor(home.sam.id, 'chore_due', fridgeId)).toHaveLength(0);
    expect(await rowsFor(home.jordan.id, 'chore_due', fridgeId)).toHaveLength(1);
  });

  it('reminds an errand’s assignee on its due date, and not once it is done', async () => {
    const home = await makeHome();
    const errand = await adminPool.query<{ id: string }>(
      `insert into public.errand (household_id, name, due_date, assigned_to, added_by)
       values ($1, 'Renew car registration', '2026-10-04', $2, $3) returning id`,
      [home.id, home.jordan.id, home.alex.id],
    );
    const errandId = errand.rows[0]?.id ?? '';

    await enqueueAt(NOW);

    const rows = await rowsFor(home.jordan.id, 'chore_due', errandId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toMatchObject({ title: 'Renew car registration', body: 'Due today' });
  });

  it('does not send a chore reminder whose chore was completed after it was written', async () => {
    const home = await makeHome();
    const trash = await adminPool.query<{ id: string }>(
      `insert into public.chore (household_id, name, recurrence_unit, anchor_date, assigned_to, created_by)
       values ($1, 'Take out trash', 'week', '2026-09-27', $2, $3) returning id`,
      [home.id, home.sam.id, home.alex.id],
    );
    const trashId = trash.rows[0]?.id ?? '';
    const samDevice = await addDevice(home.sam.id, 'sam');
    await enqueueAt(NOW);
    expect(await rowsFor(home.sam.id, 'chore_due', trashId)).toHaveLength(1);

    await adminPool.query(
      `insert into public.chore_completion (chore_id, occurrence_date, completed_by)
       values ($1, '2026-10-04', $2)`,
      [trashId, home.sam.id],
    );
    await passTime(home.sam.id, 'chore_due');
    await sendDue();

    expect(await rowsFor(home.sam.id, 'chore_due', trashId)).toHaveLength(0);
    expect(pushesTo(samDevice)).toStrictEqual([]);
  });

  it('drops a chore reminder whose name alone is over the 60-character copy limit', async () => {
    const home = await makeHome();
    const longName = 'B'.repeat(70);
    const longChore = await adminPool.query<{ id: string }>(
      `insert into public.chore (household_id, name, recurrence_unit, anchor_date, assigned_to, created_by)
       values ($1, $2, 'week', '2026-09-27', $3, $4) returning id`,
      [home.id, longName, home.sam.id, home.alex.id],
    );
    const longChoreId = longChore.rows[0]?.id ?? '';

    const outcome = await outbox.enqueueScheduled(NOW);

    expect(outcome.dropped).toContainEqual({ type: 'chore_due', id: longChoreId });
    expect(await rowsFor(home.sam.id, 'chore_due', longChoreId)).toHaveLength(0);
  });

  it('drops an errand reminder whose name alone is over the 60-character copy limit', async () => {
    const home = await makeHome();
    const longName = 'C'.repeat(70);
    const longErrand = await adminPool.query<{ id: string }>(
      `insert into public.errand (household_id, name, due_date, assigned_to, added_by)
       values ($1, $2, '2026-10-04', $3, $4) returning id`,
      [home.id, longName, home.jordan.id, home.alex.id],
    );
    const longErrandId = longErrand.rows[0]?.id ?? '';

    const outcome = await outbox.enqueueScheduled(NOW);

    expect(outcome.dropped).toContainEqual({ type: 'chore_due', id: longErrandId });
    expect(await rowsFor(home.jordan.id, 'chore_due', longErrandId)).toHaveLength(0);
  });
});

describe('meal_reminder', () => {
  it('sends at 08:00 in the household timezone, to opted-in members only', async () => {
    const home = await makeHome();
    await setPreference(home.alex.id, 'meal_reminder', true);
    for (const [title, meal] of [
      ['Baked Ziti', 'dinner'],
      ['Greek Salad', 'lunch'],
    ] as const) {
      await adminPool.query(
        `insert into public.meal_plan_entry (household_id, recipe_title, planned_date, meal_type, added_by)
         values ($1, $2, '2026-10-04', $3, $4)`,
        [home.id, title, meal, home.alex.id],
      );
    }

    await enqueueAt(BEFORE_MEAL_REMINDER);
    expect(await rowsFor(home.alex.id, 'meal_reminder', home.id)).toHaveLength(0);

    await enqueueAt(NOW);
    const alex = await rowsFor(home.alex.id, 'meal_reminder', home.id);
    expect(alex).toHaveLength(1);
    expect(alex[0]?.occurrence_key).toBe('2026-10-04');
    expect(alex[0]?.payload).toMatchObject({
      title: 'Today: Greek Salad for lunch',
      body: 'Plus 1 more meal planned',
    });
    expect(alex[0]?.send_after).toStrictEqual(new Date('2026-10-04T12:00:00Z'));
    expect(await rowsFor(home.sam.id, 'meal_reminder', home.id)).toHaveLength(0);
  });

  it('drops the reminder when "Today: <title> for <meal>" alone is over the 60-character limit', async () => {
    const home = await makeHome();
    await setPreference(home.alex.id, 'meal_reminder', true);
    const longTitle = 'D'.repeat(50);
    await adminPool.query(
      `insert into public.meal_plan_entry (household_id, recipe_title, planned_date, meal_type, added_by)
       values ($1, $2, '2026-10-04', 'dinner', $3)`,
      [home.id, longTitle, home.alex.id],
    );

    const outcome = await outbox.enqueueScheduled(NOW);

    expect(outcome.dropped).toContainEqual({ type: 'meal_reminder', id: home.id });
    expect(await rowsFor(home.alex.id, 'meal_reminder', home.id)).toHaveLength(0);
  });
});

describe('weekly_meal_nudge', () => {
  it('goes to members opted in for that household on a Saturday with an empty week', async () => {
    const home = await makeHome();
    await setPreference(home.alex.id, 'weekly_meal_nudge', true, home.id);

    await enqueueAt(SATURDAY);

    const alex = await rowsFor(home.alex.id, 'weekly_meal_nudge', home.id);
    expect(alex).toHaveLength(1);
    expect(alex[0]?.occurrence_key).toBe('2026-10-04');
    expect(alex[0]?.payload.title).toBe("Next week isn't planned");
    expect(await rowsFor(home.sam.id, 'weekly_meal_nudge', home.id)).toHaveLength(0);
  });

  it('dates and sends in the household timezone, for a member in a distant zone', async () => {
    const home = await makeHome('Pacific/Auckland', 'America/Los_Angeles');
    await setPreference(home.sam.id, 'weekly_meal_nudge', true, home.id);

    await enqueueAt(AUCKLAND_SATURDAY);

    const sam = await rowsFor(home.sam.id, 'weekly_meal_nudge', home.id);
    expect(sam).toHaveLength(1);
    expect(sam[0]?.occurrence_key).toBe('2026-10-11');
    expect(sam[0]?.send_after).toStrictEqual(new Date('2026-10-09T20:00:00Z'));
  });

  it('skips a member who has left, and removes their opt-in on departure', async () => {
    const home = await makeHome();
    await setPreference(home.alex.id, 'weekly_meal_nudge', true, home.id);
    await setPreference(home.sam.id, 'weekly_meal_nudge', true, home.id);
    await enqueueAt(SATURDAY);
    expect(await rowsFor(home.sam.id, 'weekly_meal_nudge', home.id)).toHaveLength(1);

    const left = await as(app, home.sam, 'POST', `/api/households/${home.id}/leave`, {});
    expectOk(left);

    const { rows: prefs } = await adminPool.query<{ n: number }>(
      `select count(*)::int as n from public.notification_preference
       where user_id = $1 and household_id = $2`,
      [home.sam.id, home.id],
    );
    expect(prefs[0]?.n).toBe(0);
    expect(await rowsFor(home.sam.id, 'weekly_meal_nudge', home.id)).toHaveLength(0);

    await enqueueAt(SATURDAY);
    expect(await rowsFor(home.sam.id, 'weekly_meal_nudge', home.id)).toHaveLength(0);
    expect(await rowsFor(home.alex.id, 'weekly_meal_nudge', home.id)).toHaveLength(1);
  });
});

describe('chore rotation', () => {
  async function rotatingChore(home: Home): Promise<string> {
    const created = await as(app, home.alex, 'POST', `/api/households/${home.id}/chores`, {
      name: 'Take out trash',
      recurrenceUnit: 'week',
      interval: 1,
      anchorDate: '2026-09-27',
      assignment: {
        type: 'rotation',
        rotationOrder: [home.alex.id, home.sam.id, home.jordan.id],
      },
    });
    expectOk(created);
    return created.json<{ id: string }>().id;
  }

  it('hands the turn on with the chore named, and the member it rotates from', async () => {
    const home = await makeHome();
    const choreId = await rotatingChore(home);

    expectOk(await as(app, home.alex, 'POST', `/api/chores/${choreId}/complete`, {}));

    const rows = await rowsFor(home.sam.id, 'chore_rotation', choreId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toMatchObject({
      title: 'Take out trash is yours',
      body: 'Starting today, rotating from Alex',
    });
    expect(await rowsFor(home.alex.id, 'chore_rotation', choreId)).toHaveLength(0);
  });

  it('applies the new holder’s quiet hours, since the request writes the row', async () => {
    const home = await makeHome();
    await setQuietHours(home.sam.id, '00:00', '23:59');
    const choreId = await rotatingChore(home);

    expectOk(await as(app, home.alex, 'POST', `/api/chores/${choreId}/complete`, {}));

    const [row] = await rowsFor(home.sam.id, 'chore_rotation', choreId);
    const { rows } = await adminPool.query<{ local: string }>(
      `select to_char(send_after at time zone 'America/New_York', 'HH24:MI') as local
       from public.notification where id = $1`,
      [row?.id ?? ''],
    );
    expect(rows[0]?.local).toBe('23:59');
  });
});

describe('the defaults the database applies', () => {
  it('match the defaults the service reports, for every type', async () => {
    const home = await makeHome();
    for (const [type, expected] of Object.entries(notificationDefaults)) {
      const { rows } = await adminPool.query<{ wanted: boolean }>(
        `select public.notification_wanted($1, $2::public.notification_type, null) as wanted`,
        [home.alex.id, type],
      );
      expect(rows[0]?.wanted, type).toBe(expected);
    }
  });
});

describe('household timezone for personal items', () => {
  /**
   * The household is Kiritimati (UTC+14) and Alex's profile is Pago Pago (UTC-11). At 20:00 UTC on
   * Oct 4 it is 10:00 on Oct 5 in Kiritimati, after that day's 09:00, and still Oct 4 in Pago Pago.
   */
  const KIRITIMATI_MORNING = new Date('2026-10-04T20:00:00Z');

  it('a personal bill due today by the household calendar is sent at 09:00 household time', async () => {
    const home = await makeHome('Pacific/Kiritimati');
    await adminPool.query(
      `update public.profile set timezone = 'Pacific/Pago_Pago' where id = $1`,
      [home.alex.id],
    );
    const water = await insertBill({
      householdId: null,
      owner: home.alex.id,
      name: 'Water',
      amount: '30.00',
      anchor: '2026-10-05',
      reminderDaysBefore: 0,
    });

    await enqueueAt(KIRITIMATI_MORNING);

    const rows = await rowsFor(home.alex.id, 'bill_due', water);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.occurrence_key.startsWith('2026-10-05/')).toBe(true);
    // 09:00 on Oct 5 in Kiritimati is 19:00 UTC on Oct 4: nothing in Pago Pago's calendar.
    expect(rows[0]?.send_after.toISOString()).toBe('2026-10-04T19:00:00.000Z');
  });
});
