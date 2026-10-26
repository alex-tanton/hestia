import { describe, expect, it } from 'vitest';
import type {
  Bill,
  BillDetail,
  BillPayment,
  Household,
  SubscriptionsResponse,
} from '@hestia/shared';
import {
  adminPool,
  as,
  household,
  signUp,
  uniqueName,
  uniquePostalCode,
  type HouseholdFixture,
  type SignedUpUser,
} from './test/service-stack.js';
import { app, expectStatus, registerStackHooks } from './test/stack-hooks.js';
import { currentInstant, dateInZone, daysBetween, householdDate } from './test/zone-dates.js';

/*
 * Bills, the payment log, skip, archive, confirm-usage, and the subscriptions view, against
 * `supabase start`. Every request goes through withUserDb, so RLS decides every isolation
 * assertion; the database-level RLS/trigger suite itself (personal-bill invisibility, the
 * household-move refusal) already lives in db/rls-isolation.integration.test.ts and
 * db/policies.integration.test.ts from Phase 1 — this file is about the service and route layer
 * built in this unit.
 *
 * Dates use generous offsets (well clear of "today") rather than exact boundaries, since none of
 * these tests are about timezone-edge precision — that is meal-plan.integration.test.ts's job.
 * "Today" is the default household's today (`homeDate`), not the UTC calendar's.
 */

registerStackHooks();

// The zone of the households these tests create: `household()` and `signUp()` in
// test/service-stack.ts default to it, and the service dates a bill by its household's zone.
const HOME_ZONE = 'America/New_York';

/** The default household's calendar date, `offsetDays` from its today (not the UTC calendar's). */
function homeDate(offsetDays: number): string {
  return householdDate(HOME_ZONE, offsetDays);
}

type Home = HouseholdFixture;

interface BillFields {
  name?: string;
  amountCents?: number;
  category?: string | null;
  anchorDate?: string;
  recurrenceUnit?: 'day' | 'week' | 'month' | 'year' | null;
  interval?: number;
  reminderDaysBefore?: number;
  autopay?: boolean;
  isSubscription?: boolean;
}

function billBody(overrides: BillFields = {}): Record<string, unknown> {
  return {
    name: 'Test Bill',
    amountCents: 15000,
    anchorDate: homeDate(-10),
    recurrenceUnit: 'month',
    interval: 1,
    ...overrides,
  };
}

async function createHouseholdBill(home: Home, overrides: BillFields = {}): Promise<Bill> {
  const response = await as(
    app,
    home.user,
    'POST',
    `/api/households/${home.household.id}/bills`,
    billBody(overrides),
  );
  expectStatus(response, 201);
  return response.json<Bill>();
}

async function createPersonalBill(home: Home, overrides: BillFields = {}): Promise<Bill> {
  const response = await as(app, home.user, 'POST', '/api/users/me/bills', billBody(overrides));
  expectStatus(response, 201);
  return response.json<Bill>();
}

describe('creating and listing bills', () => {
  it('GET /households/:id/bills includes the household’s bills plus the caller’s own personal bills', async () => {
    const home = await household(app);
    const hh = await createHouseholdBill(home, { name: 'Rent' });
    const personal = await createPersonalBill(home, { name: 'Streaming' });

    const response = await as(app, home.user, 'GET', `/api/households/${home.household.id}/bills`);
    expectStatus(response, 200);
    const bills = response.json<Bill[]>();
    const ids = bills.map((bill) => bill.id);
    expect(ids).toContain(hh.id);
    expect(ids).toContain(personal.id);
    expect(bills.find((bill) => bill.id === personal.id)?.visibility).toBe('personal');
    expect(bills.find((bill) => bill.id === personal.id)?.householdId).toBeNull();
  });

  it('sorts by soonest current occurrence first', async () => {
    const home = await household(app);
    const later = await createHouseholdBill(home, { name: 'Later', anchorDate: homeDate(20) });
    const soon = await createHouseholdBill(home, { name: 'Soon', anchorDate: homeDate(3) });

    const response = await as(app, home.user, 'GET', `/api/households/${home.household.id}/bills`);
    const bills = response.json<Bill[]>();
    const soonIndex = bills.findIndex((bill) => bill.id === soon.id);
    const laterIndex = bills.findIndex((bill) => bill.id === later.id);
    expect(soonIndex).toBeLessThan(laterIndex);
  });

  it('a bill anchored in the past with nothing paid is current and overdue', async () => {
    const home = await household(app);
    const bill = await createHouseholdBill(home, { anchorDate: homeDate(-10) });
    expect(bill.currentOccurrenceDate).toBe(homeDate(-10));
    expect(bill.isOverdue).toBe(true);
  });

  it('a bill anchored in the future is not overdue', async () => {
    const home = await household(app);
    const bill = await createHouseholdBill(home, { anchorDate: homeDate(15) });
    expect(bill.currentOccurrenceDate).toBe(homeDate(15));
    expect(bill.isOverdue).toBe(false);
  });
});

describe('updating a bill', () => {
  it('PATCH /bills/:id rejects an empty body and leaves the bill unchanged', async () => {
    const home = await household(app);
    const bill = await createHouseholdBill(home, { name: 'Rent', autopay: true });

    const response = await as(app, home.user, 'PATCH', `/api/bills/${bill.id}`, {});
    expectStatus(response, 400);

    const after = await as(app, home.user, 'GET', `/api/bills/${bill.id}`);
    expectStatus(after, 200);
    const detail = after.json<BillDetail>();
    expect(detail.name).toBe('Rent');
    expect(detail.autopay).toBe(true);
  });

  // Guards against the bug 1030b35 fixed: a legitimate partial PATCH silently reset category,
  // recurrenceUnit, interval, reminderDaysBefore, autopay, and isSubscription to their create-time
  // defaults, because the old schema re-applied `.default(...)` to absent keys. Every field
  // `billFieldsSchema` governs is given a distinguishable, non-default value here and re-read after
  // the PATCH, so a regression can't hide behind an assertion that only checks the field that was
  // actually meant to change.
  it('PATCH /bills/:id changing only the name leaves every other field unchanged, including the six that used to silently reset', async () => {
    const home = await household(app);
    const original = await createHouseholdBill(home, {
      name: 'Original Name',
      amountCents: 23456,
      anchorDate: homeDate(-12),
      category: 'Utilities',
      recurrenceUnit: 'week',
      interval: 3,
      reminderDaysBefore: 9,
      autopay: true,
      isSubscription: true,
    });

    const response = await as(app, home.user, 'PATCH', `/api/bills/${original.id}`, {
      name: 'Renamed Bill',
    });
    expectStatus(response, 200);

    const after = await as(app, home.user, 'GET', `/api/bills/${original.id}`);
    expectStatus(after, 200);
    const detail = after.json<BillDetail>();
    expect(detail.name).toBe('Renamed Bill');
    expect(detail.amountCents).toBe(original.amountCents);
    expect(detail.anchorDate).toBe(original.anchorDate);
    expect(detail.category).toBe(original.category);
    expect(detail.recurrenceUnit).toBe(original.recurrenceUnit);
    expect(detail.interval).toBe(original.interval);
    expect(detail.reminderDaysBefore).toBe(original.reminderDaysBefore);
    expect(detail.autopay).toBe(original.autopay);
    expect(detail.isSubscription).toBe(original.isSubscription);
    expect(detail.visibility).toBe(original.visibility);
    expect(detail.householdId).toBe(original.householdId);
  });

  // Same guard, from the other direction: explicitly setting one of the six previously-buggy
  // fields to a non-default value must persist exactly that value and touch nothing else.
  it('PATCH /bills/:id setting autopay to a non-default value persists it and changes nothing else', async () => {
    const home = await household(app);
    const original = await createHouseholdBill(home, {
      name: 'Static Name',
      amountCents: 9999,
      anchorDate: homeDate(-5),
      category: 'Insurance',
      recurrenceUnit: 'month',
      interval: 2,
      reminderDaysBefore: 5,
      autopay: false,
      isSubscription: false,
    });
    expect(original.autopay).toBe(false);

    const response = await as(app, home.user, 'PATCH', `/api/bills/${original.id}`, {
      autopay: true,
    });
    expectStatus(response, 200);

    const after = await as(app, home.user, 'GET', `/api/bills/${original.id}`);
    expectStatus(after, 200);
    const detail = after.json<BillDetail>();
    expect(detail.autopay).toBe(true);
    expect(detail.name).toBe(original.name);
    expect(detail.amountCents).toBe(original.amountCents);
    expect(detail.anchorDate).toBe(original.anchorDate);
    expect(detail.category).toBe(original.category);
    expect(detail.recurrenceUnit).toBe(original.recurrenceUnit);
    expect(detail.interval).toBe(original.interval);
    expect(detail.reminderDaysBefore).toBe(original.reminderDaysBefore);
    expect(detail.isSubscription).toBe(original.isSubscription);
  });
});

describe('pay and skip', () => {
  it('pay writes the log row for the current occurrence and advances it, anchored not shifted', async () => {
    const home = await household(app);
    const bill = await createHouseholdBill(home, { anchorDate: homeDate(-10) });

    const response = await as(app, home.user, 'POST', `/api/bills/${bill.id}/pay`, {});
    expectStatus(response, 201);
    const payment = response.json<BillPayment>();
    expect(payment.occurrenceDate).toBe(homeDate(-10));
    expect(payment.amountPaidCents).toBe(15000);
    expect(payment.isAuto).toBe(false);
    expect(payment.recordedBy).toBe(home.user.id);

    const detail = await as(app, home.user, 'GET', `/api/bills/${bill.id}`);
    const body = detail.json<BillDetail>();
    // Anchored on the 1st-of-type rule: the next occurrence is one month after the anchor, not
    // one month after whenever the payment happened to be recorded.
    expect(body.currentOccurrenceDate).not.toBe(homeDate(-10));
    expect(body.isOverdue).toBe(false);
    expect(body.payments.map((p) => p.id)).toContain(payment.id);
  });

  it('a payment may be recorded before the due date', async () => {
    const home = await household(app);
    const bill = await createHouseholdBill(home, { anchorDate: homeDate(5) });
    const response = await as(app, home.user, 'POST', `/api/bills/${bill.id}/pay`, {});
    expectStatus(response, 201);
    expect(response.json<BillPayment>().occurrenceDate).toBe(homeDate(5));
  });

  it('skip records that the occurrence will not be paid, and advances the current occurrence', async () => {
    const home = await household(app);
    const bill = await createHouseholdBill(home, { anchorDate: homeDate(-10) });

    const response = await as(app, home.user, 'POST', `/api/bills/${bill.id}/skip`, {});
    expectStatus(response, 201);
    const payment = response.json<BillPayment>();
    expect(payment.isSkipped).toBe(true);
    expect(payment.occurrenceDate).toBe(homeDate(-10));
    expect(payment.amountPaidCents).toBeNull();

    const detail = await as(app, home.user, 'GET', `/api/bills/${bill.id}`);
    expect(detail.json<BillDetail>().currentOccurrenceDate).not.toBe(homeDate(-10));
  });

  it('a second pay attempt on an already-resolved occurrence rejects rather than double-logging', async () => {
    const home = await household(app);
    // A one-time bill: paying its only occurrence twice must not silently succeed twice.
    const bill = await createHouseholdBill(home, {
      anchorDate: homeDate(-1),
      recurrenceUnit: null,
    });
    expectStatus(await as(app, home.user, 'POST', `/api/bills/${bill.id}/pay`, {}), 201);
    const again = await as(app, home.user, 'POST', `/api/bills/${bill.id}/pay`, {});
    // The bill has no further occurrence, so the server resolves the same current occurrence
    // again and the unique key refuses the duplicate.
    expectStatus(again, 409);
  });
});

describe('editing and deleting a payment', () => {
  it('PATCH corrects a recorded payment; DELETE reopens its occurrence', async () => {
    const home = await household(app);
    const bill = await createHouseholdBill(home, { anchorDate: homeDate(-10) });
    const pay = await as(app, home.user, 'POST', `/api/bills/${bill.id}/pay`, {});
    const payment = pay.json<BillPayment>();

    const patched = await as(
      app,
      home.user,
      'PATCH',
      `/api/bills/${bill.id}/payments/${payment.id}`,
      { amountPaidCents: 16000 },
    );
    expectStatus(patched, 200);
    expect(patched.json<BillPayment>().amountPaidCents).toBe(16000);

    expectStatus(
      await as(app, home.user, 'DELETE', `/api/bills/${bill.id}/payments/${payment.id}`),
      204,
    );
    const detail = await as(app, home.user, 'GET', `/api/bills/${bill.id}`);
    const body = detail.json<BillDetail>();
    expect(body.payments).toHaveLength(0);
    // Reopened: the occurrence that was just paid is current and overdue again.
    expect(body.currentOccurrenceDate).toBe(homeDate(-10));
    expect(body.isOverdue).toBe(true);
  });
});

describe('archive', () => {
  it('hides the bill from the list and the subscriptions view, and keeps its history', async () => {
    const home = await household(app);
    const bill = await createHouseholdBill(home, { isSubscription: true });
    await as(app, home.user, 'POST', `/api/bills/${bill.id}/pay`, {});

    expectStatus(await as(app, home.user, 'POST', `/api/bills/${bill.id}/archive`), 200);

    const list = await as(app, home.user, 'GET', `/api/households/${home.household.id}/bills`);
    expect(list.json<Bill[]>().map((b) => b.id)).not.toContain(bill.id);

    const subs = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/subscriptions`,
    );
    expect(subs.json<SubscriptionsResponse>().subscriptions.map((s) => s.id)).not.toContain(
      bill.id,
    );

    // Payment history survives archiving: the bill itself is still readable by id.
    const detail = await as(app, home.user, 'GET', `/api/bills/${bill.id}`);
    expectStatus(detail, 200);
    expect(detail.json<BillDetail>().payments).toHaveLength(1);
  });
});

describe('confirm-usage', () => {
  it('"Still using" resets the 60-day clock', async () => {
    const home = await household(app);
    const bill = await createPersonalBill(home, { isSubscription: true });
    await adminPool.query(
      `update public.bill set last_used_confirmed_at = now() - interval '70 days' where id = $1`,
      [bill.id],
    );

    const before = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/subscriptions`,
    );
    const beforeRow = before
      .json<SubscriptionsResponse>()
      .subscriptions.find((s) => s.id === bill.id);
    expect(beforeRow?.needsUsageConfirmation).toBe(true);

    expectStatus(await as(app, home.user, 'POST', `/api/bills/${bill.id}/confirm-usage`), 200);

    const after = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/subscriptions`,
    );
    const afterRow = after
      .json<SubscriptionsResponse>()
      .subscriptions.find((s) => s.id === bill.id);
    expect(afterRow?.needsUsageConfirmation).toBe(false);
  });
});

describe('subscriptions view', () => {
  it('normalizes to monthly cents, sorts descending, and totals correctly', async () => {
    const home = await household(app);
    // $12.00/week -> 1200 * 52 / 12 = 5200/month exactly.
    const weekly = await createPersonalBill(home, {
      name: 'Weekly thing',
      amountCents: 1200,
      recurrenceUnit: 'week',
      interval: 1,
      isSubscription: true,
    });
    // $186.00/year -> 18600 / 12 = 1550/month exactly.
    const yearly = await createHouseholdBill(home, {
      name: 'Yearly thing',
      amountCents: 18600,
      recurrenceUnit: 'year',
      interval: 1,
      isSubscription: true,
    });
    // $74.99/month -> 7499/month, the largest of the three.
    const monthly = await createHouseholdBill(home, {
      name: 'Monthly thing',
      amountCents: 7499,
      recurrenceUnit: 'month',
      interval: 1,
      isSubscription: true,
    });

    const response = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/subscriptions`,
    );
    expectStatus(response, 200);
    const body = response.json<SubscriptionsResponse>();

    const byId = new Map(body.subscriptions.map((s) => [s.id, s]));
    expect(byId.get(monthly.id)?.monthlyCents).toBe(7499);
    expect(byId.get(monthly.id)?.annualCents).toBe(7499 * 12);
    expect(byId.get(weekly.id)?.monthlyCents).toBe(5200);
    expect(byId.get(yearly.id)?.monthlyCents).toBe(1550);

    // Descending by monthly cost: monthly (7499) > weekly (5200) > yearly (1550).
    const ids = body.subscriptions.map((s) => s.id);
    expect(ids.indexOf(monthly.id)).toBeLessThan(ids.indexOf(weekly.id));
    expect(ids.indexOf(weekly.id)).toBeLessThan(ids.indexOf(yearly.id));

    expect(body.totalMonthlyCents).toBe(7499 + 5200 + 1550);
  });

  it('an empty household shows the empty state: no subscriptions and a zero total', async () => {
    const home = await household(app);
    const response = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/subscriptions`,
    );
    expectStatus(response, 200);
    expect(response.json<SubscriptionsResponse>()).toEqual({
      subscriptions: [],
      totalMonthlyCents: 0,
    });
  });
});

describe('a co-member sees and can act on a household bill they did not create', () => {
  it('lists, reads, and pays a housemate’s household bill (regression: profile is not the caller’s own row)', async () => {
    // `public.profile` RLS only ever exposes the caller's own row. The household/subscriptions
    // queries join it to resolve the bill's owning timezone, and an inner join there would
    // silently drop every bill owned by someone other than the caller — which every existing test
    // in this file missed, since each one both creates and reads as the same user.
    const admin = await signUp(app, 'CoAdminTwo');
    const createRes = await as(app, admin, 'POST', '/api/households', {
      name: uniqueName('Shared2'),
      postalCode: uniquePostalCode(),
      timezone: 'America/New_York',
    });
    expectStatus(createRes, 201);
    const hh = createRes.json<Household>();
    const member = await signUp(app, 'CoMemberTwo');
    await adminPool.query(
      `insert into public.household_member (household_id, user_id, role) values ($1, $2, 'member')`,
      [hh.id, member.id],
    );

    const created = await as(
      app,
      admin,
      'POST',
      `/api/households/${hh.id}/bills`,
      billBody({
        name: 'Admin’s bill',
        isSubscription: true,
      }),
    );
    expectStatus(created, 201);
    const bill = created.json<Bill>();

    const list = await as(app, member, 'GET', `/api/households/${hh.id}/bills`);
    expectStatus(list, 200);
    expect(list.json<Bill[]>().map((b) => b.id)).toContain(bill.id);

    const detail = await as(app, member, 'GET', `/api/bills/${bill.id}`);
    expectStatus(detail, 200);

    const subs = await as(app, member, 'GET', `/api/households/${hh.id}/subscriptions`);
    expectStatus(subs, 200);
    expect(subs.json<SubscriptionsResponse>().subscriptions.map((s) => s.id)).toContain(bill.id);

    const pay = await as(app, member, 'POST', `/api/bills/${bill.id}/pay`, {});
    expectStatus(pay, 201);
    expect(pay.json<BillPayment>().recordedBy).toBe(member.id);
  });
});

describe('RLS isolation: a stranger gets 404, never 403', () => {
  it('across every /bills/:id route and the household bills and subscriptions lists', async () => {
    const mine = await household(app, 'Alex');
    const stranger = await household(app, 'Blake');
    const bill = await createHouseholdBill(mine);
    const personal = await createPersonalBill(mine);

    expectStatus(
      await as(app, stranger.user, 'GET', `/api/households/${mine.household.id}/bills`),
      404,
    );
    expectStatus(
      await as(app, stranger.user, 'GET', `/api/households/${mine.household.id}/subscriptions`),
      404,
    );
    for (const target of [bill, personal]) {
      expectStatus(await as(app, stranger.user, 'GET', `/api/bills/${target.id}`), 404);
      expectStatus(
        await as(app, stranger.user, 'PATCH', `/api/bills/${target.id}`, { name: 'Stolen' }),
        404,
      );
      expectStatus(await as(app, stranger.user, 'POST', `/api/bills/${target.id}/pay`, {}), 404);
      expectStatus(await as(app, stranger.user, 'POST', `/api/bills/${target.id}/skip`), 404);
      expectStatus(await as(app, stranger.user, 'POST', `/api/bills/${target.id}/archive`), 404);
      expectStatus(
        await as(app, stranger.user, 'POST', `/api/bills/${target.id}/confirm-usage`),
        404,
      );
      expectStatus(await as(app, stranger.user, 'DELETE', `/api/bills/${target.id}`), 404);
    }

    // Both bills survive the stranger's attempts.
    expectStatus(await as(app, mine.user, 'GET', `/api/bills/${bill.id}`), 200);
    expectStatus(await as(app, mine.user, 'GET', `/api/bills/${personal.id}`), 200);
  });
});

/*
 * Regression guard (TIME-05): a bill's date is a date in its household's zone, never the UTC date.
 * The guard needs no clock pin. Pacific/Kiritimati (UTC+14) has a different calendar date from UTC
 * from 10:00Z onward, and Pacific/Pago_Pago (UTC-11) has a different one before 11:00Z, so at every
 * instant at least one of the two households straddles the UTC date. A helper that counts days on
 * the UTC calendar therefore anchors the "today" bill on the wrong day for one of them at any hour
 * of any day, and a zone-correct helper passes for both.
 */
describe.each(['Pacific/Kiritimati', 'Pacific/Pago_Pago'])(
  'one-off bills are dated by the household calendar in %s',
  (zone) => {
    async function homeIn(): Promise<Home> {
      const user = await signUp(app, 'Alex');
      const response = await as(app, user, 'POST', '/api/households', {
        name: uniqueName('Household'),
        postalCode: uniquePostalCode(),
        timezone: zone,
      });
      expectStatus(response, 201);
      return { user, household: response.json<Household>() };
    }

    async function listedBill(home: Home, id: string): Promise<Bill> {
      const response = await as(
        app,
        home.user,
        'GET',
        `/api/households/${home.household.id}/bills`,
      );
      expectStatus(response, 200);
      const found = response.json<Bill[]>().find((bill) => bill.id === id);
      if (found === undefined) throw new Error('the bill is listed for its household');
      return found;
    }

    it('a bill anchored at the household’s today is not overdue', async () => {
      const home = await homeIn();
      const today = householdDate(zone, 0);
      const bill = await createHouseholdBill(home, { anchorDate: today, recurrenceUnit: null });

      const listed = await listedBill(home, bill.id);
      expect(listed.currentOccurrenceDate).toBe(today);
      expect(listed.isOverdue).toBe(false);
    });

    it('a bill anchored at the household’s yesterday is overdue', async () => {
      const home = await homeIn();
      const yesterday = householdDate(zone, -1);
      const bill = await createHouseholdBill(home, { anchorDate: yesterday, recurrenceUnit: null });

      const listed = await listedBill(home, bill.id);
      expect(listed.currentOccurrenceDate).toBe(yesterday);
      expect(listed.isOverdue).toBe(true);
    });
  },
);

/*
 * Every date is read in the household timezone. The household here is Kiritimati (UTC+14) and the
 * owner's profile is Pago Pago (UTC-11), so their calendar dates are always a day or more apart: a
 * service that dated by the profile would classify these bills differently.
 */
describe('dates follow the household timezone, not the profile zone', () => {
  const HOUSEHOLD_ZONE = 'Pacific/Kiritimati';
  const PROFILE_ZONE = 'Pacific/Pago_Pago';
  const DAY_MS = 86_400_000;

  /**
   * An instant whose age in days is `ageDays` by the household's calendar but not by the profile's,
   * so the two zones would disagree about it. Found by stepping an hour at a time around the target.
   */
  function instantAged(ageDays: number): Date {
    const now = currentInstant();
    const householdToday = dateInZone(HOUSEHOLD_ZONE, now);
    const profileToday = dateInZone(PROFILE_ZONE, now);
    for (let hour = -96; hour <= 96; hour += 1) {
      const instant = new Date(now.getTime() - ageDays * DAY_MS + hour * 3_600_000);
      if (
        daysBetween(householdToday, dateInZone(HOUSEHOLD_ZONE, instant)) === ageDays &&
        daysBetween(profileToday, dateInZone(PROFILE_ZONE, instant)) !== ageDays
      ) {
        return instant;
      }
    }
    throw new Error('no instant at this age separates the two zones');
  }

  /** The household's yesterday, by its own calendar. */
  function householdYesterday(): string {
    return householdDate(HOUSEHOLD_ZONE, -1);
  }

  /** The profile zone's yesterday: the date a service dating by the profile would call yesterday. */
  function profileYesterday(): string {
    return householdDate(PROFILE_ZONE, -1);
  }

  async function farAwayHome(): Promise<Home> {
    const user = await signUp(app, 'Alex', PROFILE_ZONE);
    const response = await as(app, user, 'POST', '/api/households', {
      name: uniqueName('Household'),
      postalCode: uniquePostalCode(),
      timezone: HOUSEHOLD_ZONE,
    });
    expectStatus(response, 201);
    return { user, household: response.json<Household>() };
  }

  async function listedBill(home: Home, id: string): Promise<Bill> {
    const response = await as(app, home.user, 'GET', `/api/households/${home.household.id}/bills`);
    expectStatus(response, 200);
    const found = response.json<Bill[]>().find((bill) => bill.id === id);
    if (found === undefined) throw new Error('the bill is listed for its household');
    return found;
  }

  it('a household bill due yesterday by the household’s calendar is overdue, and the profile’s yesterday is another date', async () => {
    const home = await farAwayHome();
    const yesterday = householdYesterday();
    // The premise that makes this test bite: a profile- or UTC-dated service would name another day.
    expect(profileYesterday()).not.toBe(yesterday);
    const bill = await createHouseholdBill(home, { anchorDate: yesterday });

    const listed = await listedBill(home, bill.id);
    expect(listed.currentOccurrenceDate).toBe(yesterday);
    expect(listed.isOverdue).toBe(true);
  });

  it('a personal bill due yesterday by the household’s calendar is overdue too', async () => {
    // The profile zone is a day behind, so by the profile this bill is not due yet. It belongs to
    // no household, so its dates come from its owner's active household: the same household zone.
    const home = await farAwayHome();
    const yesterday = householdYesterday();
    const bill = await createPersonalBill(home, { name: 'Water', anchorDate: yesterday });

    const listed = await listedBill(home, bill.id);
    expect(listed.currentOccurrenceDate).toBe(yesterday);
    expect(listed.isOverdue).toBe(true);
  });

  it('a subscription confirmed 60 household days ago needs confirming; 59 days ago does not', async () => {
    const home = await farAwayHome();
    const sixty = await createPersonalBill(home, { name: 'Gym', isSubscription: true });
    const fiftyNine = await createPersonalBill(home, { name: 'Magazine', isSubscription: true });
    await adminPool.query('update public.bill set last_used_confirmed_at = $2 where id = $1', [
      sixty.id,
      instantAged(60).toISOString(),
    ]);
    await adminPool.query('update public.bill set last_used_confirmed_at = $2 where id = $1', [
      fiftyNine.id,
      instantAged(59).toISOString(),
    ]);

    const response = await as(
      app,
      home.user,
      'GET',
      `/api/households/${home.household.id}/subscriptions`,
    );
    expectStatus(response, 200);
    const subscriptions = response.json<SubscriptionsResponse>().subscriptions;
    expect(subscriptions.find((sub) => sub.id === sixty.id)?.needsUsageConfirmation).toBe(true);
    expect(subscriptions.find((sub) => sub.id === fiftyNine.id)?.needsUsageConfirmation).toBe(
      false,
    );
  });
});

describe('a personal bill whose owner belongs to no household', () => {
  /** A user with no household, and one personal bill of theirs dated in the far past. */
  async function soloBill(): Promise<{ user: SignedUpUser; billId: string }> {
    const user = await signUp(app, 'Solo', 'Pacific/Pago_Pago');
    const { rows } = await adminPool.query<{ id: string }>(
      `insert into public.bill (household_id, owner_user_id, name, amount, recurrence_unit,
         "interval", anchor_date, visibility)
       values (null, $1, 'Car Insurance', 128.00, 'month', 1, '2000-01-01', 'personal')
       returning id`,
      [user.id],
    );
    return { user, billId: rows[0]?.id ?? '' };
  }

  it('is not overdue, since there is no household date to be overdue against', async () => {
    const { user, billId } = await soloBill();

    const response = await as(app, user, 'GET', `/api/bills/${billId}`);
    expectStatus(response, 200);
    expect(response.json<Bill>().isOverdue).toBe(false);
  });

  it('refuses a payment with 409, names no household content, and writes nothing', async () => {
    const { user, billId } = await soloBill();

    const response = await as(app, user, 'POST', `/api/bills/${billId}/pay`, {});
    expectStatus(response, 409);
    expect(response.body).toContain('This bill cannot be paid until its owner joins a household.');
    const { rows } = await adminPool.query<{ n: string }>(
      'select count(*)::text as n from public.bill_payment_log where bill_id = $1',
      [billId],
    );
    expect(rows[0]?.n).toBe('0');
  });

  it('refuses a skip the same way', async () => {
    const { user, billId } = await soloBill();

    const response = await as(app, user, 'POST', `/api/bills/${billId}/skip`, {});
    expectStatus(response, 409);
  });
});

describe('moving a bill between its household and its owner', () => {
  /** A housemate added straight to the household, as the co-member test does. */
  async function addMember(hh: Household, name: string): Promise<SignedUpUser> {
    const member = await signUp(app, name);
    await adminPool.query(
      `insert into public.household_member (household_id, user_id, role) values ($1, $2, 'member')`,
      [hh.id, member.id],
    );
    return member;
  }

  function move(user: SignedUpUser, billId: string, body: Record<string, unknown>) {
    return as(app, user, 'POST', `/api/bills/${billId}/move`, body);
  }

  it('the owner moves a household bill to personal and back, keeping its anchor and history', async () => {
    const home = await household(app);
    const bill = await createHouseholdBill(home, { anchorDate: homeDate(-40) });
    expectStatus(await as(app, home.user, 'POST', `/api/bills/${bill.id}/pay`, {}), 201);
    const before = await as(app, home.user, 'GET', `/api/bills/${bill.id}`);
    expectStatus(before, 200);
    const paid = before.json<BillDetail>();
    expect(paid.payments).toHaveLength(1);

    const out = await move(home.user, bill.id, { visibility: 'personal' });
    expectStatus(out, 200);
    expect(out.json<Bill>()).toMatchObject({
      id: bill.id,
      householdId: null,
      ownerUserId: home.user.id,
      visibility: 'personal',
      anchorDate: paid.anchorDate,
      currentOccurrenceDate: paid.currentOccurrenceDate,
    });

    const back = await move(home.user, bill.id, {
      visibility: 'household',
      householdId: home.household.id,
    });
    expectStatus(back, 200);
    expect(back.json<Bill>()).toMatchObject({
      householdId: home.household.id,
      visibility: 'household',
      anchorDate: paid.anchorDate,
      currentOccurrenceDate: paid.currentOccurrenceDate,
    });

    const after = await as(app, home.user, 'GET', `/api/bills/${bill.id}`);
    expectStatus(after, 200);
    expect(after.json<BillDetail>().payments).toEqual(paid.payments);
  });

  it('a housemate sees the bill leave their view when it goes personal, and return when it comes back', async () => {
    const home = await household(app);
    const housemate = await addMember(home.household, 'Housemate');
    const bill = await createHouseholdBill(home);
    const householdBillIds = async (user: SignedUpUser) =>
      (await as(app, user, 'GET', `/api/households/${home.household.id}/bills`))
        .json<Bill[]>()
        .map((b) => b.id);

    expect(await householdBillIds(housemate)).toContain(bill.id);

    expectStatus(await move(home.user, bill.id, { visibility: 'personal' }), 200);
    expect(await householdBillIds(housemate)).not.toContain(bill.id);
    expectStatus(await as(app, housemate, 'GET', `/api/bills/${bill.id}`), 404);
    // The owner still sees their own personal bill, in the household context they open.
    expect(await householdBillIds(home.user)).toContain(bill.id);

    expectStatus(
      await move(home.user, bill.id, { visibility: 'household', householdId: home.household.id }),
      200,
    );
    expect(await householdBillIds(housemate)).toContain(bill.id);
  });

  it('a housemate who is not the owner cannot move a household bill, and it stays as it was', async () => {
    const home = await household(app);
    const housemate = await addMember(home.household, 'Housemate');
    const bill = await createHouseholdBill(home);

    const response = await move(housemate, bill.id, { visibility: 'personal' });
    expectStatus(response, 403);
    expect(response.json<{ detail: string }>().detail).toBe('Only the bill’s owner can move it.');

    const still = await as(app, home.user, 'GET', `/api/bills/${bill.id}`);
    expect(still.json<Bill>()).toMatchObject({
      householdId: home.household.id,
      visibility: 'household',
    });
  });

  it('a stranger cannot see a personal bill to move it: 404, never 403', async () => {
    const home = await household(app);
    const stranger = await signUp(app, 'Stranger');
    const bill = await createPersonalBill(home);

    expectStatus(
      await move(stranger, bill.id, { visibility: 'household', householdId: home.household.id }),
      404,
    );
  });

  it('an archived bill cannot be moved', async () => {
    const home = await household(app);
    const bill = await createHouseholdBill(home);
    expectStatus(await as(app, home.user, 'POST', `/api/bills/${bill.id}/archive`), 200);

    const response = await move(home.user, bill.id, { visibility: 'personal' });
    expectStatus(response, 409);
    expect(response.json<{ detail: string }>().detail).toBe('An archived bill cannot be moved.');
  });

  it('a personal bill cannot move into a household the owner does not belong to: 422', async () => {
    const owner = await household(app);
    const elsewhere = await household(app);
    const bill = await createPersonalBill(owner);

    const response = await move(owner.user, bill.id, {
      visibility: 'household',
      householdId: elsewhere.household.id,
    });
    expectStatus(response, 422);
    expect(
      await as(app, owner.user, 'GET', `/api/bills/${bill.id}`).then((r) => r.json<Bill>()),
    ).toMatchObject({ householdId: null, visibility: 'personal' });
  });

  it('a household bill never moves to another household the owner belongs to: 409', async () => {
    const home = await household(app);
    const other = await household(app);
    await adminPool.query(
      `insert into public.household_member (household_id, user_id, role) values ($1, $2, 'member')`,
      [other.household.id, home.user.id],
    );
    const bill = await createHouseholdBill(home);

    const response = await move(home.user, bill.id, {
      visibility: 'household',
      householdId: other.household.id,
    });
    expectStatus(response, 409);
    expect(
      await as(app, home.user, 'GET', `/api/bills/${bill.id}`).then((r) => r.json<Bill>()),
    ).toMatchObject({ householdId: home.household.id });
  });

  it('a body that names neither a valid visibility nor a household is a 400', async () => {
    const home = await household(app);
    const bill = await createHouseholdBill(home);

    expectStatus(await move(home.user, bill.id, { visibility: 'shared' }), 400);
    expectStatus(await move(home.user, bill.id, { visibility: 'household' }), 400);
  });
});
