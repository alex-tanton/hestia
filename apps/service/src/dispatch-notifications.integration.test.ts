import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseHandle } from './db.js';
import { runDispatchNotifications, type DispatchOutbox } from './jobs/dispatch-notifications.js';
import { readinessNotBuiltYet } from './jobs/refresh-deals.js';
import { createScheduler } from './jobs/scheduler.js';
import type { JobDatabase, JobLogger } from './jobs/types.js';
import { createNotificationOutbox } from './privileged/notification-outbox.js';
import { withServiceRoleDb } from './privileged/service-role-db.js';
import { FakeDealSource } from './test/fixture-deal-source.js';
import { recordingJobLogger, type JobLogLine } from './test/job-logger.js';
import { RecordingPushTransport } from './test/push-double.js';
import { adminPool, enableServiceLogin, seedAuthUser, stackConfig } from './test/service-stack.js';

/*
 * The dispatch send step against `supabase start` (Technical Architecture, "Scheduled jobs" ›
 * "Dispatch" and "Idempotency"). The job runs as `service_role`, so it sees
 * every recipient, and the push transport is always the recording double: no push endpoint is ever
 * contacted from here.
 *
 * The job works on every due row in the database, not only this file's, so each assertion reads
 * back the rows and endpoints this file created rather than totals.
 */

let handle: DatabaseHandle;
let jobDb: JobDatabase;
let outbox: DispatchOutbox;
let transport: RecordingPushTransport;
let lines: JobLogLine[];
let logger: JobLogger;
const userIds: string[] = [];
/** The household every queued row names, so a test can assert the push body carries it. */
const HOUSEHOLD_ID = randomUUID();

const KEYS = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA', auth: 'tBHItJI5svbpez7KI4CCXg' };

beforeAll(async () => {
  await enableServiceLogin();
  handle = createDatabase(stackConfig().serviceDatabaseUrl);
  jobDb = {
    asServiceRole: (fn) => withServiceRoleDb(handle.db, fn),
    pool: handle.db,
  };
  outbox = createNotificationOutbox(jobDb);
});

afterAll(async () => {
  // Deleting the users cascades to their profiles, subscriptions, and outbox rows. Personal bills
  // reference their owner without cascading, so they go first.
  if (userIds.length > 0) {
    await adminPool.query('delete from public.bill where owner_user_id = any($1::uuid[])', [
      userIds,
    ]);
    await adminPool.query('delete from auth.users where id = any($1::uuid[])', [userIds]);
  }
  await handle.close();
  await adminPool.end();
});

beforeEach(() => {
  transport = new RecordingPushTransport();
  lines = [];
  logger = recordingJobLogger(lines);
});

/** A user with one push subscription per endpoint, created directly as `postgres`. */
async function seedUser(endpoints: string[]): Promise<string> {
  const { id: userId } = await seedAuthUser(adminPool, { displayName: 'Dispatch Tester' });
  userIds.push(userId);
  for (const endpoint of endpoints) {
    await adminPool.query(
      `insert into public.push_subscription (user_id, endpoint, keys) values ($1, $2, $3)`,
      [userId, endpoint, JSON.stringify(KEYS)],
    );
  }
  return userId;
}

function endpointOf(name: string): string {
  return `https://push.example.com/${name}-${randomUUID()}`;
}

/**
 * One outbox row. `sendAfter` is a SQL expression, so the test states its timing relative to the
 * database clock the job itself reads.
 */
async function queue(
  userId: string,
  options: {
    sendAfter: string;
    title?: string;
    body?: string;
  },
): Promise<string> {
  // A `bill_due` row is only sent while its bill exists and the occurrence is unpaid, so each row
  // gets its own personal bill, unpaid for the occurrence named in its key.
  const bill = await adminPool.query<{ id: string }>(
    `insert into public.bill (owner_user_id, name, amount, recurrence_unit, anchor_date, visibility)
     values ($1, 'Rent', 1850.00, 'month', '2020-01-01', 'personal') returning id`,
    [userId],
  );
  const { rows } = await adminPool.query<{ id: string }>(
    `insert into public.notification (user_id, type, target_id, occurrence_key, payload, send_after)
     values ($1, 'bill_due', $2, '2020-01-01/due', $3, ${options.sendAfter}) returning id`,
    [
      userId,
      bill.rows[0]?.id ?? '',
      JSON.stringify({
        title: options.title ?? 'Rent is due',
        body: options.body ?? 'Due on the 1st.',
        target: 'bills',
        householdId: HOUSEHOLD_ID,
      }),
    ],
  );
  return rows[0]?.id ?? '';
}

async function sentAt(id: string): Promise<Date | null> {
  const { rows } = await adminPool.query<{ sent_at: Date | null }>(
    'select sent_at from public.notification where id = $1',
    [id],
  );
  return rows[0]?.sent_at ?? null;
}

async function exists(id: string): Promise<boolean> {
  const { rows } = await adminPool.query('select 1 from public.notification where id = $1', [id]);
  return rows.length > 0;
}

async function subscriptionEndpoints(userId: string): Promise<string[]> {
  const { rows } = await adminPool.query<{ endpoint: string }>(
    'select endpoint from public.push_subscription where user_id = $1 order by endpoint',
    [userId],
  );
  return rows.map((row) => row.endpoint);
}

function pushesTo(endpoints: string[]): string[] {
  return transport.sent.map((one) => one.endpoint).filter((e) => endpoints.includes(e));
}

async function runOnce() {
  return runDispatchNotifications({ outbox, transport, logger });
}

describe('sending due rows', () => {
  it('sends a due row to every device of its recipient and stamps sent_at', async () => {
    const first = endpointOf('phone');
    const second = endpointOf('laptop');
    const userId = await seedUser([first, second]);
    const id = await queue(userId, { sendAfter: `now() - interval '1 minute'` });

    await runOnce();

    expect(await sentAt(id)).not.toBeNull();
    expect(pushesTo([first, second]).sort()).toStrictEqual([first, second].sort());
    const message: unknown = JSON.parse(
      transport.sent.find((one) => one.endpoint === first)?.message ?? '',
    );
    expect(message).toStrictEqual({
      title: 'Rent is due',
      body: 'Due on the 1st.',
      url: '/bills',
      householdId: HOUSEHOLD_ID,
    });
  });

  it('leaves a row whose send_after is still in the future unsent', async () => {
    const endpoint = endpointOf('later');
    const userId = await seedUser([endpoint]);
    const id = await queue(userId, { sendAfter: `now() + interval '1 hour'` });

    await runOnce();

    expect(await sentAt(id)).toBeNull();
    expect(pushesTo([endpoint])).toStrictEqual([]);
  });

  it('sends nothing on a rerun and writes sent_at only once', async () => {
    const endpoint = endpointOf('once');
    const userId = await seedUser([endpoint]);
    const id = await queue(userId, { sendAfter: `now() - interval '1 minute'` });

    await runOnce();
    const stampedAt = await sentAt(id);
    expect(stampedAt).not.toBeNull();
    expect(pushesTo([endpoint])).toHaveLength(1);

    const rerun = await runOnce();

    expect(pushesTo([endpoint])).toHaveLength(1);
    expect(await sentAt(id)).toStrictEqual(stampedAt);
    expect(rerun.sent).toBe(0);
  });

  it('refuses to send a row whose copy is over 60 characters, and deletes it unsent', async () => {
    const endpoint = endpointOf('long');
    const userId = await seedUser([endpoint]);
    const id = await queue(userId, {
      sendAfter: `now() - interval '1 minute'`,
      title: 'x'.repeat(61),
    });

    await runOnce();

    expect(await exists(id)).toBe(false);
    expect(pushesTo([endpoint])).toStrictEqual([]);
    expect(
      lines.some((line) => line.message === 'notification copy rejected; deleted unsent'),
    ).toBe(true);
  });
});

describe('subscriptions and retries', () => {
  it('deletes a device the push service reports gone, keeps one that fails otherwise, and stamps on the accepted one', async () => {
    const gone = endpointOf('gone');
    const accepted = endpointOf('accepted');
    const failing = endpointOf('failing');
    const userId = await seedUser([gone, accepted, failing]);
    transport.outcomes.set(gone, { kind: 'gone' });
    transport.outcomes.set(failing, { kind: 'failed', statusCode: 500 });
    const id = await queue(userId, { sendAfter: `now() - interval '1 minute'` });

    await runOnce();

    expect(await subscriptionEndpoints(userId)).toStrictEqual([accepted, failing].sort());
    expect(await sentAt(id)).not.toBeNull();
  });

  it('keeps a row unsent when no device accepts it, then deletes it once its retry window has passed', async () => {
    const endpoint = endpointOf('down');
    const userId = await seedUser([endpoint]);
    transport.outcomes.set(endpoint, { kind: 'failed', statusCode: 503 });
    const retrying = await queue(userId, { sendAfter: `now() - interval '2 hours'` });

    await runOnce();
    expect(await exists(retrying)).toBe(true);
    expect(await sentAt(retrying)).toBeNull();

    // Moving send_after past the 24-hour window stands in for the clock running on; the next run
    // then deletes the row rather than retrying it.
    await adminPool.query(
      `update public.notification set send_after = now() - interval '25 hours' where id = $1`,
      [retrying],
    );
    transport.outcomes.clear();
    await runOnce();
    expect(await exists(retrying)).toBe(false);
  });

  it('deletes a row more than 24 hours past its send_after without sending it, warning with type and id only', async () => {
    const endpoint = endpointOf('stale');
    const userId = await seedUser([endpoint]);
    const id = await queue(userId, { sendAfter: `now() - interval '25 hours'` });

    const outcome = await runOnce();

    expect(await exists(id)).toBe(false);
    expect(pushesTo([endpoint])).toStrictEqual([]);
    expect(outcome.expired).toBeGreaterThanOrEqual(1);
    const warning = lines.find(
      (line) =>
        line.message === 'notification retry window passed; deleted unsent' &&
        line.data['id'] === id,
    );
    expect(warning?.data).toStrictEqual({ type: 'bill_due', id });
  });
});

describe('claim before send', () => {
  it('does not push any device again when a write fails mid-run', async () => {
    const accepting = endpointOf('accepting');
    const gone = endpointOf('gone-mid-run');
    const userId = await seedUser([accepting, gone]);
    transport.outcomes.set(gone, { kind: 'gone' });
    const id = await queue(userId, { sendAfter: `now() - interval '1 minute'` });
    // The write that removes a device the push service reports gone fails, as if the database
    // dropped the connection mid-run. Whichever device the run reached first, the row is already
    // claimed, so the next run must not push either device again.
    const failingWrites: DispatchOutbox = {
      ...outbox,
      deleteSubscription: () => Promise.reject(new Error('simulated write failure')),
    };

    await expect(
      runDispatchNotifications({ outbox: failingWrites, transport, logger }),
    ).rejects.toThrow('simulated write failure');
    for (const endpoint of [accepting, gone]) {
      expect(pushesTo([endpoint]).length).toBeLessThanOrEqual(1);
    }
    expect(await sentAt(id)).not.toBeNull();

    transport.reset();
    await runOnce();

    expect(pushesTo([accepting, gone])).toStrictEqual([]);
    expect(await sentAt(id)).not.toBeNull();
  });

  it('releases a claim no device accepted, so a later run sends it once', async () => {
    const endpoint = endpointOf('released');
    const userId = await seedUser([endpoint]);
    transport.outcomes.set(endpoint, { kind: 'failed', statusCode: 503 });
    const id = await queue(userId, { sendAfter: `now() - interval '1 minute'` });

    await runOnce();
    expect(await sentAt(id)).toBeNull();

    transport.outcomes.clear();
    await runOnce();
    await runOnce();

    expect(await sentAt(id)).not.toBeNull();
    expect(pushesTo([endpoint])).toHaveLength(2);
  });
});

describe('stamping a row', () => {
  it('stamps a row once: a second claim of a stamped row changes nothing and reports taken', async () => {
    const endpoint = endpointOf('stamped-once');
    const userId = await seedUser([endpoint]);
    const id = await queue(userId, { sendAfter: `now() - interval '1 minute'` });

    expect(await outbox.claim(id)).toBe('claimed');
    const stampedAt = await sentAt(id);
    expect(stampedAt).not.toBeNull();

    expect(await outbox.claim(id)).toBe('taken');
    expect(await sentAt(id)).toStrictEqual(stampedAt);
  });
});

describe('the advisory lock', () => {
  it('skips the run while another connection holds it, and sends once it is free', async () => {
    const endpoint = endpointOf('locked');
    const userId = await seedUser([endpoint]);
    const id = await queue(userId, { sendAfter: `now() - interval '1 minute'` });
    const scheduler = createScheduler({
      database: jobDb,
      logger,
      dispatch: { outbox, transport },
      refresh: {
        source: new FakeDealSource(),
        publishSkipRates: () => undefined,
        repriceExpiredItems: () => Promise.resolve(0),
        recomputeReadiness: readinessNotBuiltYet,
      },
    });

    const holder = await adminPool.connect();
    try {
      await holder.query(`select pg_advisory_lock(hashtext('dispatch-notifications'))`);
      await expect(scheduler.run('dispatch-notifications')).resolves.toBe(false);
      expect(pushesTo([endpoint])).toStrictEqual([]);
      expect(await sentAt(id)).toBeNull();
    } finally {
      await holder.query(`select pg_advisory_unlock(hashtext('dispatch-notifications'))`);
      holder.release();
    }

    await expect(scheduler.run('dispatch-notifications')).resolves.toBe(true);
    expect(await sentAt(id)).not.toBeNull();
    await scheduler.stop();
  });
});
