import { sql, type Kysely } from 'kysely';
import { currentBillOccurrence, type CalendarDate, type Recurrence } from '@hearth/recurrence';
import type {
  Bill,
  BillDetail,
  BillPayment,
  CreateBillRequest,
  PayBillRequest,
  UpdateBillPaymentRequest,
  UpdateBillRequest,
} from '@hearth/shared';
import type { Database } from '../db.js';
import { fail } from '../problem.js';
import { markHouseholdActive } from './households.js';
import { fromCents, toCents } from './money.js';

/*
 * Bills, the payment log, skip, archive, and "Still using this?" (Requirements, "Bills and
 * subscriptions"; Technical Architecture, "API surface" — "Bills"). Every function takes a Kysely
 * bound to the caller's withUserDb transaction, so RLS decides what it can see; a row RLS hides is
 * reported as not found, never as forbidden, and no function here re-implements the household or
 * personal visibility check the database already enforces.
 *
 * "Today" and a bill's dates are read in the same query as the bill (Requirements, "Timezone",
 * non-negotiable 8): every date is read in the household timezone. A household bill's is its own
 * household's; a personal bill's is its owner's active household's, since a personal bill belongs
 * to no household: its owner's active household's, or the owner's earliest household's if none is
 * active. `coalesce` picks the right one without branching. The profile's timezone is never a date
 * zone.
 */

interface BillRow {
  id: string;
  household_id: string | null;
  owner_user_id: string;
  name: string;
  amount: string;
  category: string | null;
  recurrence_unit: 'day' | 'week' | 'month' | 'year' | null;
  interval: number;
  anchor_date: string;
  reminder_days_before: number;
  autopay: boolean;
  visibility: 'household' | 'personal';
  is_subscription: boolean;
  last_used_confirmed_at: Date | string | null;
  archived_at: Date | string | null;
  created_at: Date | string;
  /**
   * The household timezone that dates this bill: its household's, or its owner's active household's
   * (else the owner's earliest). Null only when the owner belongs to no household at all.
   */
  timezone: string | null;
  /** "Today" in that timezone, as a calendar date; null exactly when `timezone` is. */
  today: CalendarDate | null;
}

const BILL_CONTEXT_COLUMNS = sql`
  b.id, b.household_id, b.owner_user_id, b.name, b.amount, b.category, b.recurrence_unit,
  b.interval, b.anchor_date, b.reminder_days_before, b.autopay, b.visibility, b.is_subscription,
  b.last_used_confirmed_at, b.archived_at, b.created_at,
  coalesce(h.timezone, ah.timezone, mh.timezone) as timezone,
  (pg_catalog.now() at time zone coalesce(h.timezone, ah.timezone, mh.timezone))::date::text as today
`;

// `profile` RLS only ever lets a caller see their own row (`own_read`: `id = auth.uid()`), so this
// must be a left join: for a household bill the owner is often someone else, and an inner join
// would silently drop every such bill for every caller but its own owner. A personal bill's owner
// is always the caller (RLS already guarantees that), so `ah` resolves for it. For a household bill
// `h` is always present and `ah` is never read.
const BILL_CONTEXT_FROM = sql`
  from public.bill b
  left join public.household h on h.id = b.household_id
  left join public.profile p on p.id = b.owner_user_id
  left join public.household ah on ah.id = p.active_household_id
    left join lateral (
      select hm.timezone from public.household_member m
      join public.household hm on hm.id = m.household_id
      where m.user_id = b.owner_user_id
      order by m.joined_at limit 1
    ) mh on true
`;

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

/**
 * The earliest occurrence with no payment or skip row, and whether it is overdue. With no household
 * timezone there is no "today", so the bill is not dated: it is not overdue, and the anchor stands
 * in only because the wire schema requires a date. Paying or skipping it is refused (see `payBill`).
 */
export function billOccurrence(
  row: Pick<BillRow, 'recurrence_unit' | 'interval' | 'anchor_date' | 'today'>,
  resolvedDates: ReadonlySet<CalendarDate>,
): { date: CalendarDate; overdue: boolean } {
  if (row.today === null) return { date: row.anchor_date, overdue: false };
  if (row.recurrence_unit === null) {
    // A one-time bill (PRD, "Data model › Bills"): its only occurrence is the anchor date itself.
    const resolved = resolvedDates.has(row.anchor_date);
    return { date: row.anchor_date, overdue: !resolved && row.anchor_date < row.today };
  }
  const recurrence: Recurrence = {
    unit: row.recurrence_unit,
    interval: row.interval,
    anchorDate: row.anchor_date,
  };
  const state = currentBillOccurrence(recurrence, resolvedDates, row.today);
  return { date: state.occurrenceDate, overdue: state.isOverdue };
}

async function resolvedDatesOf(db: Kysely<Database>, billId: string): Promise<Set<CalendarDate>> {
  const rows = await db
    .selectFrom('bill_payment_log')
    .select('occurrence_date')
    .where('bill_id', '=', billId)
    .execute();
  return new Set(rows.map((row) => row.occurrence_date));
}

async function toBill(db: Kysely<Database>, row: BillRow): Promise<Bill> {
  const resolvedDates = await resolvedDatesOf(db, row.id);
  const occurrence = billOccurrence(row, resolvedDates);
  const amountCents = toCents(row.amount);
  if (amountCents === null) throw new Error('bill.amount was null; the column is not-null');
  return {
    id: row.id,
    householdId: row.household_id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    amountCents,
    category: row.category,
    recurrenceUnit: row.recurrence_unit,
    interval: row.interval,
    anchorDate: row.anchor_date,
    reminderDaysBefore: row.reminder_days_before,
    autopay: row.autopay,
    visibility: row.visibility,
    isSubscription: row.is_subscription,
    lastUsedConfirmedAt:
      row.last_used_confirmed_at === null ? null : iso(row.last_used_confirmed_at),
    archivedAt: row.archived_at === null ? null : iso(row.archived_at),
    createdAt: iso(row.created_at),
    currentOccurrenceDate: occurrence.date,
    isOverdue: occurrence.overdue,
  };
}

function toPayment(row: {
  id: string;
  bill_id: string;
  occurrence_date: string;
  paid_date: string | null;
  amount_paid: string | null;
  is_auto: boolean;
  is_skipped: boolean;
  recorded_by: string | null;
  created_at: Date | string;
}): BillPayment {
  return {
    id: row.id,
    billId: row.bill_id,
    occurrenceDate: row.occurrence_date,
    paidDate: row.paid_date,
    amountPaidCents: toCents(row.amount_paid),
    isAuto: row.is_auto,
    isSkipped: row.is_skipped,
    recordedBy: row.recorded_by,
    createdAt: iso(row.created_at),
  };
}

async function requireBillRow(db: Kysely<Database>, id: string): Promise<BillRow> {
  const { rows } = await sql<BillRow>`
    select ${BILL_CONTEXT_COLUMNS} ${BILL_CONTEXT_FROM} where b.id = ${id}
  `.execute(db);
  const row = rows[0];
  if (row === undefined) throw fail(404, 'Bill not found.');
  if (row.household_id !== null) await markHouseholdActive(db, row.household_id);
  return row;
}

/** The household's bills (visibility 'household') plus the caller's own personal bills, not
 * archived, soonest current-occurrence first (Requirements, "Bills"). */
export async function listBills(
  db: Kysely<Database>,
  householdId: string,
  callerId: string,
): Promise<Bill[]> {
  const { rows } = await sql<BillRow>`
    select ${BILL_CONTEXT_COLUMNS} ${BILL_CONTEXT_FROM}
    where b.archived_at is null
      and (
        (b.household_id = ${householdId} and b.visibility = 'household')
        or (b.household_id is null and b.owner_user_id = ${callerId})
      )
  `.execute(db);
  const bills = await Promise.all(rows.map((row) => toBill(db, row)));
  return bills.sort(
    (a, b) =>
      a.currentOccurrenceDate.localeCompare(b.currentOccurrenceDate) || a.id.localeCompare(b.id),
  );
}

/**
 * The household_id/visibility pair for a new bill, kept as one pure function so the database's
 * own `bill_personal_iff_no_household` constraint (`visibility = 'personal'` exactly when
 * `household_id` is null) has a single place in the service that could violate it — and therefore
 * a single place a unit test needs to cover, for both directions, rather than trusting each call
 * site to pair the two fields correctly on its own.
 */
export function billScope(
  kind: 'household' | 'personal',
  householdId: string | null,
): { householdId: string | null; visibility: 'household' | 'personal' } {
  if (kind === 'household') {
    if (householdId === null) throw new Error('a household bill needs a household id');
    return { householdId, visibility: 'household' };
  }
  return { householdId: null, visibility: 'personal' };
}

async function insertBill(
  db: Kysely<Database>,
  values: {
    householdId: string | null;
    ownerUserId: string;
    visibility: 'household' | 'personal';
    input: CreateBillRequest;
  },
): Promise<Bill> {
  const { input } = values;
  const row = await db
    .insertInto('bill')
    .values({
      household_id: values.householdId,
      owner_user_id: values.ownerUserId,
      visibility: values.visibility,
      name: input.name,
      amount: fromCents(input.amountCents) ?? '0',
      category: input.category,
      recurrence_unit: input.recurrenceUnit,
      interval: input.interval,
      anchor_date: input.anchorDate,
      reminder_days_before: input.reminderDaysBefore,
      autopay: input.autopay,
      is_subscription: input.isSubscription,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return toBill(db, await requireBillRow(db, row.id));
}

/** POST /households/:id/bills (admin or member — any household member may add a shared bill). */
export function createHouseholdBill(
  db: Kysely<Database>,
  householdId: string,
  ownerUserId: string,
  input: CreateBillRequest,
): Promise<Bill> {
  const scope = billScope('household', householdId);
  return insertBill(db, { ...scope, ownerUserId, input });
}

/** POST /users/me/bills — a personal bill, outside any household. */
export function createPersonalBill(
  db: Kysely<Database>,
  ownerUserId: string,
  input: CreateBillRequest,
): Promise<Bill> {
  const scope = billScope('personal', null);
  return insertBill(db, { ...scope, ownerUserId, input });
}

async function paymentsOf(db: Kysely<Database>, billId: string): Promise<BillPayment[]> {
  const rows = await db
    .selectFrom('bill_payment_log')
    .selectAll()
    .where('bill_id', '=', billId)
    .orderBy('occurrence_date', 'desc')
    .execute();
  return rows.map(toPayment);
}

export async function getBill(db: Kysely<Database>, id: string): Promise<BillDetail> {
  const row = await requireBillRow(db, id);
  const [bill, payments] = await Promise.all([toBill(db, row), paymentsOf(db, id)]);
  return { ...bill, payments };
}

export async function updateBill(
  db: Kysely<Database>,
  id: string,
  input: UpdateBillRequest,
): Promise<Bill> {
  await requireBillRow(db, id);
  const changes = {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.amountCents === undefined ? {} : { amount: fromCents(input.amountCents) ?? '0' }),
    ...(input.category === undefined ? {} : { category: input.category }),
    ...(input.recurrenceUnit === undefined ? {} : { recurrence_unit: input.recurrenceUnit }),
    ...(input.interval === undefined ? {} : { interval: input.interval }),
    ...(input.anchorDate === undefined ? {} : { anchor_date: input.anchorDate }),
    ...(input.reminderDaysBefore === undefined
      ? {}
      : { reminder_days_before: input.reminderDaysBefore }),
    ...(input.autopay === undefined ? {} : { autopay: input.autopay }),
    ...(input.isSubscription === undefined ? {} : { is_subscription: input.isSubscription }),
  };
  if (Object.keys(changes).length > 0) {
    await db.updateTable('bill').set(changes).where('id', '=', id).execute();
  }
  return toBill(db, await requireBillRow(db, id));
}

export async function deleteBill(db: Kysely<Database>, id: string): Promise<void> {
  await requireBillRow(db, id);
  await db.deleteFrom('bill').where('id', '=', id).execute();
}

/**
 * Records a payment for the bill's current occurrence (Requirements, "Bills": "Recording a
 * payment or a skip writes the log row for the current occurrence"). The occurrence is always the
 * one the server computes, never one the client names, so a payment can never land on the wrong
 * date. A race with another payment, or with `log-autopay`, surfaces as 409 (the unique
 * (bill_id, occurrence_date) key, mapped globally from 23505).
 */
export async function payBill(
  db: Kysely<Database>,
  id: string,
  userId: string,
  input: PayBillRequest,
): Promise<BillPayment> {
  const row = await requireBillRow(db, id);
  const today = requireHouseholdToday(row);
  const resolvedDates = await resolvedDatesOf(db, id);
  const occurrence = billOccurrence(row, resolvedDates);
  const amountCents = input.amountPaidCents ?? toCents(row.amount) ?? 0;
  const paymentRow = await db
    .insertInto('bill_payment_log')
    .values({
      bill_id: id,
      occurrence_date: occurrence.date,
      paid_date: input.paidDate ?? today,
      amount_paid: fromCents(amountCents) ?? '0',
      is_auto: false,
      is_skipped: false,
      recorded_by: userId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return toPayment(paymentRow);
}

/**
 * A bill with no household timezone has no current occurrence to record, so paying or skipping it
 * is refused. The message names no household content.
 */
function requireHouseholdToday(row: BillRow): CalendarDate {
  if (row.today === null) {
    throw fail(409, 'This bill cannot be paid until its owner joins a household.');
  }
  return row.today;
}

/** Skips the bill's current occurrence: it will not be paid (PRD, "Bills": "a waived month"). */
export async function skipBill(
  db: Kysely<Database>,
  id: string,
  userId: string,
): Promise<BillPayment> {
  const row = await requireBillRow(db, id);
  requireHouseholdToday(row);
  const resolvedDates = await resolvedDatesOf(db, id);
  const occurrence = billOccurrence(row, resolvedDates);
  const paymentRow = await db
    .insertInto('bill_payment_log')
    .values({
      bill_id: id,
      occurrence_date: occurrence.date,
      paid_date: null,
      amount_paid: null,
      is_auto: false,
      is_skipped: true,
      recorded_by: userId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return toPayment(paymentRow);
}

/** Archiving hides a bill from every view and stops its reminders; history is kept (PRD, "Bills"). */
export async function archiveBill(db: Kysely<Database>, id: string): Promise<Bill> {
  await requireBillRow(db, id);
  await db
    .updateTable('bill')
    .set({ archived_at: new Date() })
    .where('id', '=', id)
    .where('archived_at', 'is', null)
    .execute();
  return toBill(db, await requireBillRow(db, id));
}

/** "Still using this?" → Still using: resets the 60-day usage clock (PRD, "Subscriptions view"). */
export async function confirmBillUsage(db: Kysely<Database>, id: string): Promise<Bill> {
  await requireBillRow(db, id);
  await db
    .updateTable('bill')
    .set({ last_used_confirmed_at: new Date() })
    .where('id', '=', id)
    .execute();
  return toBill(db, await requireBillRow(db, id));
}

async function requirePaymentRow(db: Kysely<Database>, billId: string, paymentId: string) {
  const row = await db
    .selectFrom('bill_payment_log')
    .selectAll()
    .where('id', '=', paymentId)
    .where('bill_id', '=', billId)
    .executeTakeFirst();
  if (row === undefined) throw fail(404, 'Payment not found.');
  const bill = await requireBillRow(db, billId);
  return { row, bill };
}

/** Any member who can see the bill may correct one of its payments (PRD, "Bills": autopay note). */
export async function updateBillPayment(
  db: Kysely<Database>,
  billId: string,
  paymentId: string,
  input: UpdateBillPaymentRequest,
): Promise<BillPayment> {
  const { row } = await requirePaymentRow(db, billId, paymentId);
  if (row.is_skipped) throw fail(409, 'A skipped occurrence has no payment amount to edit.');
  const changes = {
    ...(input.paidDate === undefined ? {} : { paid_date: input.paidDate }),
    ...(input.amountPaidCents === undefined
      ? {}
      : { amount_paid: fromCents(input.amountPaidCents) ?? '0' }),
  };
  const updated =
    Object.keys(changes).length === 0
      ? row
      : await db
          .updateTable('bill_payment_log')
          .set(changes)
          .where('id', '=', paymentId)
          .returningAll()
          .executeTakeFirstOrThrow();
  return toPayment(updated);
}

/** Deleting a payment reopens its occurrence; the next-due date recomputes on its own. */
export async function deleteBillPayment(
  db: Kysely<Database>,
  billId: string,
  paymentId: string,
): Promise<void> {
  await requirePaymentRow(db, billId, paymentId);
  await db.deleteFrom('bill_payment_log').where('id', '=', paymentId).execute();
}

export type { BillRow };
