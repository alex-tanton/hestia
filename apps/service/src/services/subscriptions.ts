import { sql, type Kysely } from 'kysely';
import type { RecurrenceUnit, Subscription, SubscriptionsResponse } from '@hestia/shared';
import type { Database } from '../db.js';
import { toCents } from './money.js';

/*
 * The subscriptions view: bills flagged `is_subscription`, normalized to a monthly figure so wildly
 * different billing cycles compare directly. Every division rounds half-up to the cent, using
 * integer arithmetic throughout — never a floating-point dollar amount.
 */

/** `Math.round(numerator / denominator)`, done in integers so there is no float to round wrong. */
function divideRoundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

/**
 * The monthly-equivalent cost of one occurrence, from fixed conversion factors (weeks x 52/12,
 * years / 12, days x 365/12, rounded half-up). A one-time bill (`recurrenceUnit` null) has no
 * recurring cost; `is_subscription` and a null unit are not expected to coexist, but a caller that
 * somehow has both gets zero rather than a crash.
 */
export function monthlyCents(
  amountCents: number,
  unit: RecurrenceUnit | null,
  interval: number,
): number {
  if (unit === 'week') return divideRoundHalfUp(amountCents * 52, 12 * interval);
  if (unit === 'month') return divideRoundHalfUp(amountCents, interval);
  if (unit === 'year') return divideRoundHalfUp(amountCents, 12 * interval);
  if (unit === 'day') return divideRoundHalfUp(amountCents * 365, 12 * interval);
  return 0;
}

const DAYS_UNTIL_USAGE_PROMPT = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether the "Still using this?" prompt is due: 60+ *calendar* days since `confirmedDate`, both
 * already resolved in the bill's own timezone. Parsed as UTC-midnight plain dates so the
 * subtraction is an exact day count, never a DST-sensitive one.
 */
export function needsUsageConfirmation(today: string, confirmedDate: string): boolean {
  const days = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${confirmedDate}T00:00:00Z`)) / DAY_MS,
  );
  return days >= DAYS_UNTIL_USAGE_PROMPT;
}

interface SubscriptionRow {
  id: string;
  name: string;
  visibility: 'household' | 'personal';
  amount: string;
  recurrence_unit: RecurrenceUnit | null;
  interval: number;
  /** Null when the owner belongs to no household, so the subscription is not dated. */
  today: string | null;
  confirmed_date: string | null;
}

/**
 * The active household's subscriptions plus the caller's own personal ones, sorted by monthly cost
 * descending. "Today" and the 60-day clock are each read in the household timezone: the bill's own
 * household's, or for a personal bill its owner's active household's, else the owner's earliest.
 * `coalesce` picks the right one without branching; the profile's timezone is never a date zone.
 */
export async function getSubscriptions(
  db: Kysely<Database>,
  householdId: string,
  callerId: string,
): Promise<SubscriptionsResponse> {
  const { rows } = await sql<SubscriptionRow>`
    select b.id, b.name, b.visibility, b.amount, b.recurrence_unit, b.interval,
      (pg_catalog.now() at time zone coalesce(h.timezone, ah.timezone, mh.timezone))::date::text as today,
      (coalesce(b.last_used_confirmed_at, b.created_at)
         at time zone coalesce(h.timezone, ah.timezone, mh.timezone))::date::text as confirmed_date
    from public.bill b
    left join public.household h on h.id = b.household_id
    -- Left join: profile RLS only exposes the caller's own row, and a household subscription's
    -- owner is often a housemate, not the caller (bills.ts's BILL_CONTEXT_FROM has the full note).
    left join public.profile p on p.id = b.owner_user_id
    left join public.household ah on ah.id = p.active_household_id
    left join lateral (
      select hm.timezone from public.household_member m
      join public.household hm on hm.id = m.household_id
      where m.user_id = b.owner_user_id
      order by m.joined_at limit 1
    ) mh on true
    where b.is_subscription = true and b.archived_at is null
      and (
        (b.household_id = ${householdId} and b.visibility = 'household')
        or (b.household_id is null and b.owner_user_id = ${callerId})
      )
  `.execute(db);

  const subscriptions: Subscription[] = rows.map((row) => {
    const amountCents = toCents(row.amount) ?? 0;
    const monthly = monthlyCents(amountCents, row.recurrence_unit, row.interval);
    return {
      id: row.id,
      name: row.name,
      visibility: row.visibility,
      monthlyCents: monthly,
      annualCents: monthly * 12,
      // Undated (no household timezone) means no clock to measure the 60 days against: no prompt.
      needsUsageConfirmation:
        row.today === null || row.confirmed_date === null
          ? false
          : needsUsageConfirmation(row.today, row.confirmed_date),
    };
  });

  subscriptions.sort((a, b) => b.monthlyCents - a.monthlyCents || a.name.localeCompare(b.name));
  const totalMonthlyCents = subscriptions.reduce((sum, row) => sum + row.monthlyCents, 0);
  return { subscriptions, totalMonthlyCents };
}
