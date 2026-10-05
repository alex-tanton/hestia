import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  Bill,
  BillDetail,
  BillPayment,
  Household,
  SubscriptionsResponse,
} from '@hearth/shared';
import {
  adminPool,
  as,
  signUp,
  startStack,
  uniqueName,
  type SignedUpUser,
  type Stack,
} from './test/service-stack.js';

/*
 * Bills, the payment log, skip, archive, confirm-usage, and the subscriptions view, against
 * `supabase start` (Technical Architecture, "API surface" — "Bills"). Every request goes through
 * withUserDb, so RLS decides every isolation assertion; the database-level RLS/trigger suite
 * itself (personal-bill invisibility, the household-move refusal) already lives in
 * db/rls-isolation.integration.test.ts and db/policies.integration.test.ts from Phase 1 — this
 * file is about the service and route layer built in this unit.
 *
 * Dates use generous offsets (well clear of "today") rather than exact boundaries, since none of
 * these tests are about timezone-edge precision — that is meal-plan.integration.test.ts's job.
 */

let stack: Stack;
let app: FastifyInstance;

beforeAll(async () => {
  stack = await startStack();
});

beforeEach(async () => {
  app = await stack.newApp();
});

afterAll(async () => {
  await stack.close();
});

let postalCounter = 71;
function nextPostalCode(): string {
  postalCounter += 1;
  return `277${String(postalCounter)}`;
}

function expectStatus(response: LightMyRequestResponse, status: number): void {
  expect(response.statusCode, response.body).toBe(status);
}

function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

interface Home {
  user: SignedUpUser;
  household: Household;
}

async function household(name = 'Alex', postalCode = nextPostalCode()): Promise<Home> {
  const user = await signUp(app, name);
  const response = await as(app, user, 'POST', '/api/households', {
    name: uniqueName('Household'),
    postalCode,
    timezone: 'America/New_York',
  });
  expectStatus(response, 201);
  return { user, household: response.json<Household>() };
}

interface BillFields {
  name?: string;
  amountCents?: number;
  anchorDate?: string;
  recurrenceUnit?: 'day' | 'week' | 'month' | 'year' | null;
  interval?: number;
  autopay?: boolean;
  isSubscription?: boolean;
}

function billBody(overrides: BillFields = {}): Record<string, unknown> {
  return {
    name: 'Test Bill',
    amountCents: 15000,
    anchorDate: isoDate(-10),
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
    const home = await household();
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
    const home = await household();
    const later = await createHouseholdBill(home, { name: 'Later', anchorDate: isoDate(20) });
    const soon = await createHouseholdBill(home, { name: 'Soon', anchorDate: isoDate(3) });

    const response = await as(app, home.user, 'GET', `/api/households/${home.household.id}/bills`);
    const bills = response.json<Bill[]>();
    const soonIndex = bills.findIndex((bill) => bill.id === soon.id);
    const laterIndex = bills.findIndex((bill) => bill.id === later.id);
    expect(soonIndex).toBeLessThan(laterIndex);
  });

  it('a bill anchored in the past with nothing paid is current and overdue', async () => {
    const home = await household();
    const bill = await createHouseholdBill(home, { anchorDate: isoDate(-10) });
    expect(bill.currentOccurrenceDate).toBe(isoDate(-10));
    expect(bill.isOverdue).toBe(true);
  });

  it('a bill anchored in the future is not overdue', async () => {
    const home = await household();
    const bill = await createHouseholdBill(home, { anchorDate: isoDate(15) });
    expect(bill.currentOccurrenceDate).toBe(isoDate(15));
    expect(bill.isOverdue).toBe(false);
  });
});

describe('pay and skip', () => {
  it('pay writes the log row for the current occurrence and advances it, anchored not shifted', async () => {
    const home = await household();
    const bill = await createHouseholdBill(home, { anchorDate: isoDate(-10) });

    const response = await as(app, home.user, 'POST', `/api/bills/${bill.id}/pay`, {});
    expectStatus(response, 201);
    const payment = response.json<BillPayment>();
    expect(payment.occurrenceDate).toBe(isoDate(-10));
    expect(payment.amountPaidCents).toBe(15000);
    expect(payment.isAuto).toBe(false);
    expect(payment.recordedBy).toBe(home.user.id);

    const detail = await as(app, home.user, 'GET', `/api/bills/${bill.id}`);
    const body = detail.json<BillDetail>();
    // Anchored on the 1st-of-type rule: the next occurrence is one month after the anchor, not
    // one month after whenever the payment happened to be recorded.
    expect(body.currentOccurrenceDate).not.toBe(isoDate(-10));
    expect(body.isOverdue).toBe(false);
    expect(body.payments.map((p) => p.id)).toContain(payment.id);
  });

  it('a payment may be recorded before the due date', async () => {
    const home = await household();
    const bill = await createHouseholdBill(home, { anchorDate: isoDate(5) });
    const response = await as(app, home.user, 'POST', `/api/bills/${bill.id}/pay`, {});
    expectStatus(response, 201);
    expect(response.json<BillPayment>().occurrenceDate).toBe(isoDate(5));
  });

  it('skip records that the occurrence will not be paid, and advances the current occurrence', async () => {
    const home = await household();
    const bill = await createHouseholdBill(home, { anchorDate: isoDate(-10) });

    const response = await as(app, home.user, 'POST', `/api/bills/${bill.id}/skip`, {});
    expectStatus(response, 201);
    const payment = response.json<BillPayment>();
    expect(payment.isSkipped).toBe(true);
    expect(payment.occurrenceDate).toBe(isoDate(-10));
    expect(payment.amountPaidCents).toBeNull();

    const detail = await as(app, home.user, 'GET', `/api/bills/${bill.id}`);
    expect(detail.json<BillDetail>().currentOccurrenceDate).not.toBe(isoDate(-10));
  });

  it('a second pay attempt on an already-resolved occurrence rejects rather than double-logging', async () => {
    const home = await household();
    // A one-time bill: paying its only occurrence twice must not silently succeed twice.
    const bill = await createHouseholdBill(home, { anchorDate: isoDate(-1), recurrenceUnit: null });
    expectStatus(await as(app, home.user, 'POST', `/api/bills/${bill.id}/pay`, {}), 201);
    const again = await as(app, home.user, 'POST', `/api/bills/${bill.id}/pay`, {});
    // The bill has no further occurrence, so the server resolves the same current occurrence
    // again and the unique key refuses the duplicate.
    expectStatus(again, 409);
  });
});

describe('editing and deleting a payment', () => {
  it('PATCH corrects a recorded payment; DELETE reopens its occurrence', async () => {
    const home = await household();
    const bill = await createHouseholdBill(home, { anchorDate: isoDate(-10) });
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
    expect(body.currentOccurrenceDate).toBe(isoDate(-10));
    expect(body.isOverdue).toBe(true);
  });
});

describe('archive', () => {
  it('hides the bill from the list and the subscriptions view, and keeps its history', async () => {
    const home = await household();
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

    // Payment history survives archiving (PRD, "Bills"): the bill itself is still readable by id.
    const detail = await as(app, home.user, 'GET', `/api/bills/${bill.id}`);
    expectStatus(detail, 200);
    expect(detail.json<BillDetail>().payments).toHaveLength(1);
  });
});

describe('confirm-usage', () => {
  it('"Still using" resets the 60-day clock', async () => {
    const home = await household();
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
    const home = await household();
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
    const home = await household();
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
      postalCode: nextPostalCode(),
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
    const mine = await household('Alex');
    const stranger = await household('Blake');
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
 * Every date is read in the household timezone (non-negotiable 8). The household here is Kiritimati
 * (UTC+14) and the owner's profile is Pago Pago (UTC-11), so their calendar dates are always a day
 * or more apart: a service that dated by the profile would classify these bills differently.
 */
describe('dates follow the household timezone, not the profile zone', () => {
  const HOUSEHOLD_ZONE = 'Pacific/Kiritimati';
  const PROFILE_ZONE = 'Pacific/Pago_Pago';
  const DAY_MS = 86_400_000;

  /** The calendar date (YYYY-MM-DD) an instant falls on in a timezone. */
  function dateIn(zone: string, instant: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant);
  }

  /** Whole days from one calendar date to another. */
  function daysBetween(later: string, earlier: string): number {
    return Math.round(
      (Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / DAY_MS,
    );
  }

  /**
   * An instant whose age in days is `ageDays` by the household's calendar but not by the profile's,
   * so the two zones would disagree about it. Found by stepping an hour at a time around the target.
   */
  function instantAged(ageDays: number): Date {
    const now = new Date();
    const householdToday = dateIn(HOUSEHOLD_ZONE, now);
    const profileToday = dateIn(PROFILE_ZONE, now);
    for (let hour = -96; hour <= 96; hour += 1) {
      const instant = new Date(now.getTime() - ageDays * DAY_MS + hour * 3_600_000);
      if (
        daysBetween(householdToday, dateIn(HOUSEHOLD_ZONE, instant)) === ageDays &&
        daysBetween(profileToday, dateIn(PROFILE_ZONE, instant)) !== ageDays
      ) {
        return instant;
      }
    }
    throw new Error('no instant at this age separates the two zones');
  }

  /** The household's yesterday, by its own calendar. */
  function householdYesterday(): string {
    const today = dateIn(HOUSEHOLD_ZONE, new Date());
    return new Date(Date.parse(`${today}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
  }

  /** The profile zone's yesterday: the date a service dating by the profile would call yesterday. */
  function profileYesterday(): string {
    const today = dateIn(PROFILE_ZONE, new Date());
    return new Date(Date.parse(`${today}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
  }

  async function farAwayHome(): Promise<Home> {
    const user = await signUp(app, 'Alex', PROFILE_ZONE);
    const response = await as(app, user, 'POST', '/api/households', {
      name: uniqueName('Household'),
      postalCode: nextPostalCode(),
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
