import { sql, type Kysely } from 'kysely';
import {
  occurrenceDate,
  occurrenceIndexAtOrAfter,
  occurrenceIndexAtOrBefore,
  type CalendarDate,
  type Recurrence,
  type RecurrenceUnit,
} from '@hestia/recurrence';
import type { Database } from '../db.js';
import type { JobDatabase, JobLogger } from './types.js';

/**
 * `log-autopay` — every 2 minutes. For each non-archived autopay bill, logs an automatic payment
 * for every occurrence that (a) has no log row yet, (b) is dated on or before today, and (c) is
 * dated on or after the bill's `created_at` date — never backfilling an occurrence from before the
 * bill existed (the no-backfill rule gets its own named integration test). "Today" and
 * `created_at`'s calendar date are both read in the household timezone: the bill's household's, or
 * for a personal bill its owner's active household's, else the owner's earliest household's. A
 * personal bill whose owner belongs to no household has no household timezone, so it is not dated
 * and is skipped; the app never shows such a bill.
 */

export interface AutopayBillRow {
  id: string;
  amount: string;
  recurrence_unit: RecurrenceUnit | null;
  interval: number;
  anchor_date: CalendarDate;
  /** "Today" in the bill's own timezone. */
  today: CalendarDate;
  /** `created_at`'s calendar date in the bill's own timezone. */
  created_date: CalendarDate;
}

/**
 * Every occurrence date this bill owes an automatic payment for right now. Pure, so the
 * no-backfill rule is a table-driven unit test rather than something only an integration test can
 * see.
 */
export function autopayOccurrences(
  row: Pick<
    AutopayBillRow,
    'recurrence_unit' | 'interval' | 'anchor_date' | 'today' | 'created_date'
  >,
): CalendarDate[] {
  if (row.recurrence_unit === null) {
    // A one-time bill: its only occurrence is the anchor date itself.
    const due = row.anchor_date <= row.today && row.anchor_date >= row.created_date;
    return due ? [row.anchor_date] : [];
  }
  const recurrence: Recurrence = {
    unit: row.recurrence_unit,
    interval: row.interval,
    anchorDate: row.anchor_date,
  };
  const lastIndex = occurrenceIndexAtOrBefore(recurrence, row.today);
  // No occurrence has arrived yet (the anchor itself is still in the future).
  if (lastIndex === null) return [];
  const firstIndex = occurrenceIndexAtOrAfter(recurrence, row.created_date);
  if (firstIndex > lastIndex) return [];
  const dates: CalendarDate[] = [];
  for (let index = firstIndex; index <= lastIndex; index += 1) {
    dates.push(occurrenceDate(recurrence, index));
  }
  return dates;
}

export interface LogAutopayOutcome {
  /** Non-archived autopay bills examined. */
  bills: number;
  /** Payment rows actually inserted (a rerun's already-logged occurrences do not count again). */
  inserted: number;
}

async function logAutopay(db: Kysely<Database>): Promise<LogAutopayOutcome> {
  const { rows } = await sql<AutopayBillRow>`
    select b.id, b.amount, b.recurrence_unit, b.interval, b.anchor_date,
      (pg_catalog.now() at time zone coalesce(h.timezone, ah.timezone, mh.timezone))::date::text as today,
      (b.created_at at time zone coalesce(h.timezone, ah.timezone, mh.timezone))::date::text as created_date
    from public.bill b
    left join public.household h on h.id = b.household_id
    join public.profile p on p.id = b.owner_user_id
    left join public.household ah on ah.id = p.active_household_id
    left join lateral (
      select hm.timezone from public.household_member m
      join public.household hm on hm.id = m.household_id
      where m.user_id = b.owner_user_id
      order by m.joined_at limit 1
    ) mh on true
    where b.autopay and b.archived_at is null
      and coalesce(h.timezone, ah.timezone, mh.timezone) is not null
  `.execute(db);

  let inserted = 0;
  for (const row of rows) {
    const dates = autopayOccurrences(row);
    if (dates.length === 0) continue;
    const result = await db
      .insertInto('bill_payment_log')
      .values(
        dates.map((occurrence) => ({
          bill_id: row.id,
          occurrence_date: occurrence,
          paid_date: occurrence,
          amount_paid: row.amount,
          is_auto: true,
          is_skipped: false,
          recorded_by: null,
        })),
      )
      // Idempotency: a rerun that finds every occurrence already logged inserts nothing, whether
      // another log-autopay run or a manual payment got there first.
      .onConflict((conflict) => conflict.columns(['bill_id', 'occurrence_date']).doNothing())
      .executeTakeFirst();
    inserted += Number(result.numInsertedOrUpdatedRows ?? 0);
  }
  return { bills: rows.length, inserted };
}

export interface LogAutopayDeps {
  database: JobDatabase;
  logger: JobLogger;
}

export async function runLogAutopay(deps: LogAutopayDeps): Promise<LogAutopayOutcome> {
  const outcome = await deps.database.asServiceRole((db) => logAutopay(db));
  deps.logger.info({ ...outcome }, 'log-autopay finished');
  return outcome;
}
