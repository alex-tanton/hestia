import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseHandle } from './db.js';
import { billOccurrence } from './services/bills.js';
import { runLogAutopay } from './jobs/log-autopay.js';
import type { JobDatabase, JobLogger } from './jobs/types.js';
import { withServiceRoleDb } from './privileged/service-role-db.js';
import { adminPool, enableServiceLogin, seedAuthUser, stackConfig } from './test/service-stack.js';
import { addDays, currentInstant, dateInZone } from './test/zone-dates.js';

/*
 * `log-autopay` against `supabase start`. It runs as `service_role`, one of the sanctioned uses, so
 * it can see every household's autopay bills at once. Dates below use a weekly bill rather than a
 * monthly one specifically so the arithmetic is plain day offsets, with nothing left to the reader
 * to also verify against month-end clamping — that belongs to packages/recurrence's own suite, not
 * this job's.
 */

let handle: DatabaseHandle;
let jobDb: JobDatabase;

const POSTAL_CODE = '27599';

beforeAll(async () => {
  await enableServiceLogin();
  handle = createDatabase(stackConfig().serviceDatabaseUrl);
  jobDb = { asServiceRole: (fn) => withServiceRoleDb(handle.db, fn), pool: handle.db };
});

afterAll(async () => {
  await adminPool.query(
    `delete from public.household_member where household_id in
       (select id from public.household where postal_code = $1)`,
    [POSTAL_CODE],
  );
  await adminPool.query('delete from public.household where postal_code = $1', [POSTAL_CODE]);
  await handle.close();
  await adminPool.end();
});

function makeLogger(): JobLogger {
  const noop = (): void => undefined;
  const self: JobLogger = { info: noop, warn: noop, error: noop, child: () => self };
  return self;
}

/*
 * Every "today" in this file is the household's local date, not UTC: the job decides what is due
 * by household timezone, so a UTC date would disagree with it for the hours a US-Eastern day is
 * still ahead of UTC's (roughly 20:00-24:00 EDT).
 */
const HOUSEHOLD_TZ = 'America/New_York';

/** Today's date (YYYY-MM-DD) in a timezone, the household's unless another is named. */
function householdToday(zone: string = HOUSEHOLD_TZ): string {
  return dateInZone(zone, currentInstant());
}

/** A fresh household and its admin, directly as `postgres` (no HTTP layer needed for this job). */
async function createHousehold(
  zones: { householdTz?: string; profileTz?: string } = {},
): Promise<{ householdId: string; userId: string }> {
  const householdTz = zones.householdTz ?? HOUSEHOLD_TZ;
  const { id: userId } = await seedAuthUser(adminPool, {
    displayName: 'Autopay Tester',
    timezone: zones.profileTz ?? HOUSEHOLD_TZ,
  });
  const { rows } = await adminPool.query<{ id: string }>(
    `insert into public.household (name, postal_code, timezone, created_by)
     values ($1, $2, $4, $3) returning id`,
    [`Autopay ${userId.slice(0, 6)}`, POSTAL_CODE, userId, householdTz],
  );
  const householdId = rows[0]?.id ?? '';
  await adminPool.query(
    `insert into public.household_member (household_id, user_id, role) values ($1, $2, 'admin')`,
    [householdId, userId],
  );
  return { householdId, userId };
}

async function insertAutopayBill(fields: {
  /** Null for a personal bill, which its owner's household dates. */
  householdId: string | null;
  ownerId: string;
  unit: 'day' | 'week' | 'month' | 'year';
  interval?: number;
  anchorDaysAgo: number;
  createdDaysAgo: number;
  archived?: boolean;
  autopay?: boolean;
  /** The household timezone that dates the bill; the household's own unless named. */
  zone?: string;
}): Promise<string> {
  const { rows } = await adminPool.query<{ id: string }>(
    `insert into public.bill (household_id, owner_user_id, name, amount, recurrence_unit,
       "interval", anchor_date, visibility, autopay, created_at, archived_at)
     values ($1, $2, 'Autopay Test Bill', 20.00, $3, $4,
       (now() at time zone $9)::date - ($5 || ' days')::interval, $10, $6,
       now() - ($7 || ' days')::interval,
       case when $8 then now() else null end)
     returning id`,
    [
      fields.householdId,
      fields.ownerId,
      fields.unit,
      fields.interval ?? 1,
      fields.anchorDaysAgo,
      fields.autopay ?? true,
      fields.createdDaysAgo,
      fields.archived ?? false,
      fields.zone ?? HOUSEHOLD_TZ,
      fields.householdId === null ? 'personal' : 'household',
    ],
  );
  return rows[0]?.id ?? '';
}

async function paymentDates(billId: string): Promise<string[]> {
  const { rows } = await adminPool.query<{ occurrence_date: string }>(
    'select occurrence_date::text as occurrence_date from public.bill_payment_log where bill_id = $1 order by occurrence_date',
    [billId],
  );
  return rows.map((row) => row.occurrence_date);
}

describe('log-autopay', () => {
  it('logs every occurrence from the anchor through today when the bill is as old as its anchor', async () => {
    const { householdId, userId } = await createHousehold();
    const billId = await insertAutopayBill({
      householdId,
      ownerId: userId,
      unit: 'week',
      anchorDaysAgo: 21, // occurrences at -21, -14, -7, 0 (today)
      createdDaysAgo: 21,
    });

    const outcome = await runLogAutopay({ database: jobDb, logger: makeLogger() });
    expect(outcome.inserted).toBeGreaterThanOrEqual(4);

    const dates = await paymentDates(billId);
    expect(dates).toHaveLength(4);
    const { rows: logged } = await adminPool.query<{
      is_auto: boolean;
      amount_paid: string;
      recorded_by: string | null;
    }>('select is_auto, amount_paid, recorded_by from public.bill_payment_log where bill_id = $1', [
      billId,
    ]);
    for (const row of logged) {
      expect(row.is_auto).toBe(true);
      expect(row.amount_paid).toBe('20.00');
      expect(row.recorded_by).toBeNull();
    }
  });

  it('never backfills an occurrence dated before created_at, and that occurrence stays overdue', async () => {
    const { householdId, userId } = await createHousehold();
    // Anchor 42 days ago, weekly: occurrences at -42, -35, -28, -21, -14, -7, 0. Created 20 days
    // ago: -21 is one day too early (stays unlogged); -14 is the first one on or after created_at.
    const billId = await insertAutopayBill({
      householdId,
      ownerId: userId,
      unit: 'week',
      anchorDaysAgo: 42,
      createdDaysAgo: 20,
    });

    await runLogAutopay({ database: jobDb, logger: makeLogger() });
    const dates = await paymentDates(billId);

    const today = householdToday();
    const dayOffset = (n: number): string => addDays(today, -n);
    expect(dates).toStrictEqual([dayOffset(14), dayOffset(7), dayOffset(0)]);
    expect(dates).not.toContain(dayOffset(21));
    expect(dates).not.toContain(dayOffset(28));
    expect(dates).not.toContain(dayOffset(42));

    // The bill's current occurrence is its EARLIEST unresolved one, not the latest un-backfilled
    // one: since the job never touches anything before created_at, occurrences -42, -35, -28, and
    // -21 are all still unresolved, and the earliest of those — the anchor itself — is what stays
    // current and overdue until a person pays or skips it by hand.
    const resolvedDates = new Set(dates);
    const state = billOccurrence(
      { recurrence_unit: 'week', interval: 1, anchor_date: dayOffset(42), today: dayOffset(0) },
      resolvedDates,
    );
    expect(state).toEqual({ date: dayOffset(42), overdue: true });
  });

  it('is idempotent: a rerun inserts nothing new (the unique (bill_id, occurrence_date) key)', async () => {
    const { householdId, userId } = await createHousehold();
    const billId = await insertAutopayBill({
      householdId,
      ownerId: userId,
      unit: 'week',
      anchorDaysAgo: 7,
      createdDaysAgo: 7,
    });

    await runLogAutopay({ database: jobDb, logger: makeLogger() });
    const first = await paymentDates(billId);

    const second = await runLogAutopay({ database: jobDb, logger: makeLogger() });
    const after = await paymentDates(billId);

    expect(after).toStrictEqual(first);
    expect(second.inserted).toBe(0);
  });

  it('dates a personal bill’s "today" by its owner’s household, not the owner’s profile zone', async () => {
    // Kiritimati is UTC+14 and Pago Pago UTC-11: the owner's profile is always at least a day
    // behind the household. A bill anchored on the household's today has an occurrence that is due
    // now for the household and in the future for the profile, so only the household logs it.
    const household = 'Pacific/Kiritimati';
    const { userId } = await createHousehold({
      householdTz: household,
      profileTz: 'Pacific/Pago_Pago',
    });
    const billId = await insertAutopayBill({
      householdId: null,
      ownerId: userId,
      unit: 'month',
      anchorDaysAgo: 0,
      createdDaysAgo: 0,
      zone: household,
    });

    await runLogAutopay({ database: jobDb, logger: makeLogger() });

    expect(await paymentDates(billId)).toStrictEqual([householdToday(household)]);
  });

  it('skips archived bills and non-autopay bills', async () => {
    const { householdId, userId } = await createHousehold();
    const archived = await insertAutopayBill({
      householdId,
      ownerId: userId,
      unit: 'week',
      anchorDaysAgo: 7,
      createdDaysAgo: 7,
      archived: true,
    });
    const manual = await insertAutopayBill({
      householdId,
      ownerId: userId,
      unit: 'week',
      anchorDaysAgo: 7,
      createdDaysAgo: 7,
      autopay: false,
    });

    await runLogAutopay({ database: jobDb, logger: makeLogger() });

    expect(await paymentDates(archived)).toStrictEqual([]);
    expect(await paymentDates(manual)).toStrictEqual([]);
  });
});
