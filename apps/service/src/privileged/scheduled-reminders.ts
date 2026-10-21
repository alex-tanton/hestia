import { sql, type Kysely } from 'kysely';
import type { CalendarDate, Recurrence } from '@hearth/recurrence';
import type { NotificationCopy, NotificationType } from '@hearth/shared';
import { deriveChoreState } from '../chores/occurrence.js';
import type { Database } from '../db.js';
import {
  billReminderCopy,
  choreDueCopy,
  errandDueCopy,
  mealReminderCopy,
  weeklyNudgeCopy,
  type DroppedCopy,
} from '../notifications/copy.js';
import {
  addCalendarDays,
  billRemindersDueToday,
  isSaturday,
  localDate,
  weekdayOf,
} from '../notifications/planners.js';

/*
 * The scheduled producers (dispatch step 1): every reminder whose send time has arrived for today
 * is written into the outbox. Each candidate is found here, decided by the planners, and written
 * once by `writeRows`, which applies the recipient's quiet hours in SQL and keeps only rows that
 * are due, still wanted, and addressed to a current member. The outbox's unique key makes a rerun a no-op.
 *
 * Every item is dated in the household's timezone and sent at the household's clock, personal bills
 * included: a personal bill is dated by its owner's active household (else the owner's earliest),
 * since it belongs to no household. Only quiet hours use the recipient's own timezone, and
 * `writeRows` applies them in SQL.
 */

interface ScheduledRow {
  userId: string;
  type: NotificationType;
  targetId: string;
  occurrenceKey: string;
  payload: Record<string, unknown>;
  householdId: string | null;
  /** The calendar date on which the send happens, in `timezone`. */
  localDate: CalendarDate;
  localTime: '08:00' | '09:00';
  timezone: string;
}

/** The outbox payload for a copy, or null when the copy is over the limit and the row must not be written. */
function payloadOf(
  copy: NotificationCopy | null,
  target: 'bills' | 'chores' | 'meals',
  householdId: string | null,
): Record<string, unknown> | null {
  if (copy === null) return null;
  return {
    title: copy.title,
    body: copy.body,
    target,
    ...(householdId === null ? {} : { householdId }),
  };
}

function recurrenceOf(row: {
  recurrence_unit: Recurrence['unit'] | null;
  interval: number;
  anchor_date: CalendarDate;
}): Recurrence | null {
  if (row.recurrence_unit === null) return null;
  return { unit: row.recurrence_unit, interval: row.interval, anchorDate: row.anchor_date };
}

interface BillRow {
  id: string;
  name: string;
  amount: string;
  autopay: boolean;
  recurrence_unit: Recurrence['unit'] | null;
  interval: number;
  anchor_date: CalendarDate;
  reminder_days_before: number;
  household_id: string | null;
  owner_user_id: string;
  tz: string;
}

/**
 * A bill's recipients: its owner, plus for a household bill every member who turned on "Remind me
 * about all household bills". Membership is re-checked when the row is written.
 */
async function billRecipients(db: Kysely<Database>, bill: BillRow): Promise<string[]> {
  if (bill.household_id === null) return [bill.owner_user_id];
  const { rows } = await sql<{ user_id: string }>`
    select m.user_id
    from public.household_member m
    join public.profile p on p.id = m.user_id
    where m.household_id = ${bill.household_id}::uuid
      and (m.user_id = ${bill.owner_user_id}::uuid or p.household_bill_reminders)
  `.execute(db);
  return rows.map((row) => row.user_id);
}

async function billRows(
  db: Kysely<Database>,
  now: Date,
  dropped: DroppedCopy[],
): Promise<ScheduledRow[]> {
  const { rows: bills } = await sql<BillRow>`
    select b.id, b.name, b.amount::text as amount, b.autopay, b.recurrence_unit, b.interval,
      b.anchor_date::text as anchor_date, b.reminder_days_before, b.household_id,
      b.owner_user_id, coalesce(h.timezone, ah.timezone, mh.timezone) as tz
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
    where b.archived_at is null
      and coalesce(h.timezone, ah.timezone, mh.timezone) is not null
  `.execute(db);

  const out: ScheduledRow[] = [];
  for (const bill of bills) {
    const today = localDate(now, bill.tz);
    const dues = billRemindersDueToday({
      recurrence: recurrenceOf(bill),
      anchorDate: bill.anchor_date,
      today,
      reminderDaysBefore: bill.reminder_days_before,
    });
    if (dues.length === 0) continue;
    const recipients = await billRecipients(db, bill);

    for (const due of dues) {
      const { rows: paid } = await sql<{ one: number }>`
        select 1 as one from public.bill_payment_log
        where bill_id = ${bill.id}::uuid and occurrence_date = ${due.occurrenceDate}::date
      `.execute(db);
      if (paid.length > 0) continue;

      const payload = payloadOf(
        billReminderCopy({
          name: bill.name,
          amount: bill.amount,
          autopay: bill.autopay,
          kind: due.kind,
          weekday: weekdayOf(due.occurrenceDate),
        }),
        'bills',
        bill.household_id,
      );
      if (payload === null) {
        dropped.push({ type: 'bill_due', id: bill.id });
        continue;
      }
      for (const userId of recipients) {
        out.push({
          userId,
          type: 'bill_due',
          targetId: bill.id,
          occurrenceKey: `${due.occurrenceDate}/${due.kind}`,
          payload,
          householdId: bill.household_id,
          localDate: today,
          localTime: '09:00',
          timezone: bill.tz,
        });
      }
    }
  }
  return out;
}

async function choreRows(
  db: Kysely<Database>,
  now: Date,
  dropped: DroppedCopy[],
): Promise<ScheduledRow[]> {
  const { rows: chores } = await sql<{
    id: string;
    name: string;
    household_id: string;
    recurrence_unit: Recurrence['unit'];
    interval: number;
    anchor_date: CalendarDate;
    rotation_order: string[] | null;
    rotation_offset: number;
    assigned_to: string | null;
    tz: string;
  }>`
    select c.id, c.name, c.household_id, c.recurrence_unit, c."interval",
      c.anchor_date::text as anchor_date, c.rotation_order, c.rotation_offset, c.assigned_to,
      h.timezone as tz
    from public.chore c
    join public.household h on h.id = c.household_id
    where c.assigned_to is not null or c.rotation_order is not null
  `.execute(db);
  if (chores.length === 0) return [];

  const { rows: completions } = await sql<{ chore_id: string; occurrence_date: CalendarDate }>`
    select cc.chore_id, cc.occurrence_date::text as occurrence_date
    from public.chore_completion cc
    where cc.chore_id = any(${sql.val(chores.map((chore) => chore.id))}::uuid[])
  `.execute(db);
  const byChore = new Map<string, Set<CalendarDate>>();
  for (const row of completions) {
    const set = byChore.get(row.chore_id) ?? new Set<CalendarDate>();
    set.add(row.occurrence_date);
    byChore.set(row.chore_id, set);
  }

  const out: ScheduledRow[] = [];
  for (const chore of chores) {
    const today = localDate(now, chore.tz);
    const completed = byChore.get(chore.id) ?? new Set<CalendarDate>();
    const state = deriveChoreState(
      { unit: chore.recurrence_unit, interval: chore.interval, anchorDate: chore.anchor_date },
      completed,
      completed.size,
      today,
      chore.rotation_order,
      chore.rotation_offset,
    );
    // Only the occurrence that is due today; an overdue one is not nagged about. Nothing is sent
    // for overdue chores.
    if (state.dueDate !== today) continue;
    const recipient = chore.assigned_to ?? state.currentTurn;
    if (recipient === null) continue;

    const payload = payloadOf(choreDueCopy(chore.name), 'chores', chore.household_id);
    if (payload === null) {
      dropped.push({ type: 'chore_due', id: chore.id });
      continue;
    }
    out.push({
      userId: recipient,
      type: 'chore_due',
      targetId: chore.id,
      occurrenceKey: today,
      payload,
      householdId: chore.household_id,
      localDate: today,
      localTime: '09:00',
      timezone: chore.tz,
    });
  }
  return out;
}

async function errandRows(
  db: Kysely<Database>,
  now: Date,
  dropped: DroppedCopy[],
): Promise<ScheduledRow[]> {
  const { rows } = await sql<{
    id: string;
    name: string;
    assigned_to: string;
    household_id: string;
    due_date: CalendarDate;
    tz: string;
  }>`
    select e.id, e.name, e.assigned_to, e.household_id, e.due_date::text as due_date,
      h.timezone as tz
    from public.errand e
    join public.household h on h.id = e.household_id
    where e.status = 'open' and e.assigned_to is not null and e.due_date is not null
  `.execute(db);

  const out: ScheduledRow[] = [];
  for (const row of rows) {
    if (row.due_date !== localDate(now, row.tz)) continue;
    const payload = payloadOf(errandDueCopy(row.name), 'chores', row.household_id);
    if (payload === null) {
      dropped.push({ type: 'chore_due', id: row.id });
      continue;
    }
    out.push({
      userId: row.assigned_to,
      type: 'chore_due',
      targetId: row.id,
      occurrenceKey: row.due_date,
      payload,
      householdId: row.household_id,
      localDate: row.due_date,
      localTime: '09:00',
      timezone: row.tz,
    });
  }
  return out;
}

async function mealRows(
  db: Kysely<Database>,
  now: Date,
  dropped: DroppedCopy[],
): Promise<ScheduledRow[]> {
  // The day's first meal, by meal order and then entry order, is the one the reminder names.
  const { rows: entries } = await sql<{
    household_id: string;
    tz: string;
    recipe_title: string;
    meal_type: string;
    planned_date: CalendarDate;
  }>`
    select e.household_id, h.timezone as tz, e.recipe_title, e.meal_type::text as meal_type,
      e.planned_date::text as planned_date
    from public.meal_plan_entry e
    join public.household h on h.id = e.household_id
    where e.planned_date = (${now}::timestamptz at time zone h.timezone)::date
    order by e.household_id,
      case e.meal_type when 'breakfast' then 0 when 'lunch' then 1 else 2 end,
      e.created_at, e.id
  `.execute(db);

  const byHousehold = new Map<string, typeof entries>();
  for (const entry of entries) {
    const list = byHousehold.get(entry.household_id) ?? [];
    list.push(entry);
    byHousehold.set(entry.household_id, list);
  }

  const out: ScheduledRow[] = [];
  for (const [householdId, planned] of byHousehold) {
    const first = planned[0];
    if (first === undefined) continue;
    const payload = payloadOf(
      mealReminderCopy({
        recipeTitle: first.recipe_title,
        mealType: first.meal_type,
        moreCount: planned.length - 1,
      }),
      'meals',
      householdId,
    );
    if (payload === null) {
      dropped.push({ type: 'meal_reminder', id: householdId });
      continue;
    }
    const { rows: members } = await sql<{ user_id: string }>`
      select user_id from public.household_member where household_id = ${householdId}::uuid
    `.execute(db);
    for (const member of members) {
      out.push({
        userId: member.user_id,
        type: 'meal_reminder',
        targetId: householdId,
        occurrenceKey: first.planned_date,
        payload,
        householdId,
        localDate: first.planned_date,
        localTime: '08:00',
        timezone: first.tz,
      });
    }
  }
  return out;
}

/**
 * The Saturday nudge: on a household's Saturday, when the coming Sunday-to-Saturday week has no
 * meals planned. The key is the coming Sunday. The nudge is dated and sent in the household's
 * timezone: Saturday 09:00 household time, for every recipient.
 */
async function nudgeRows(
  db: Kysely<Database>,
  now: Date,
  dropped: DroppedCopy[],
): Promise<ScheduledRow[]> {
  const { rows: households } = await sql<{ id: string; tz: string }>`
    select h.id, h.timezone as tz from public.household h
  `.execute(db);

  const out: ScheduledRow[] = [];
  for (const household of households) {
    const today = localDate(now, household.tz);
    if (!isSaturday(today)) continue;
    const sunday = addCalendarDays(today, 1);
    const saturday = addCalendarDays(today, 7);

    const { rows: planned } = await sql<{ one: number }>`
      select 1 as one from public.meal_plan_entry
      where household_id = ${household.id}::uuid
        and planned_date between ${sunday}::date and ${saturday}::date
      limit 1
    `.execute(db);
    if (planned.length > 0) continue;

    const { rows: sale } = await sql<{ n: number }>`
      select count(*)::int as n from public.recipe_readiness
      where household_id = ${household.id}::uuid and on_sale_count > 0
    `.execute(db);
    const payload = payloadOf(weeklyNudgeCopy(sale[0]?.n ?? 0), 'meals', household.id);
    if (payload === null) {
      dropped.push({ type: 'weekly_meal_nudge', id: household.id });
      continue;
    }

    const { rows: members } = await sql<{ user_id: string }>`
      select m.user_id
      from public.household_member m
      where m.household_id = ${household.id}::uuid
    `.execute(db);
    for (const member of members) {
      out.push({
        userId: member.user_id,
        type: 'weekly_meal_nudge',
        targetId: household.id,
        occurrenceKey: sunday,
        payload,
        householdId: household.id,
        localDate: today,
        localTime: '09:00',
        timezone: household.tz,
      });
    }
  }
  return out;
}

/**
 * Writes every row that is due and still wanted. The send time is the local date and time in the
 * row's timezone, shifted past the recipient's quiet hours. A row whose send time has not arrived is
 * left for a later run, which is what keeps downtime from producing a backlog. A row whose recipient
 * is no longer a member, or has turned the type off, is never written.
 */
async function writeRows(db: Kysely<Database>, rows: ScheduledRow[], now: Date): Promise<number> {
  if (rows.length === 0) return 0;
  const json = JSON.stringify(
    rows.map((row) => ({
      user_id: row.userId,
      type: row.type,
      target_id: row.targetId,
      occurrence_key: row.occurrenceKey,
      payload: row.payload,
      household_id: row.householdId,
      local_date: row.localDate,
      local_time: row.localTime,
      timezone: row.timezone,
    })),
  );
  const result = await sql<{ id: string }>`
    insert into public.notification (user_id, type, target_id, occurrence_key, payload, send_after)
    select r.user_id, r.type::public.notification_type, r.target_id, r.occurrence_key, r.payload,
      public.after_quiet_hours((r.local_date + r.local_time) at time zone r.timezone,
        p.timezone, p.quiet_hours_start, p.quiet_hours_end)
    from jsonb_to_recordset(${json}::jsonb) as r(
      user_id uuid, type text, target_id uuid, occurrence_key text, payload jsonb,
      household_id uuid, local_date date, local_time time, timezone text
    )
    join public.profile p on p.id = r.user_id
    where (r.local_date + r.local_time) at time zone r.timezone <= ${now}::timestamptz
      and (
        r.household_id is null
        or exists (
          select 1 from public.household_member m
          where m.household_id = r.household_id and m.user_id = r.user_id
        )
      )
      and public.notification_wanted(
        r.user_id,
        r.type::public.notification_type,
        case when r.type = 'weekly_meal_nudge' then r.household_id end
      )
    on conflict (user_id, type, target_id, occurrence_key) do nothing
    returning id
  `.execute(db);
  return result.rows.length;
}

export interface ScheduledOutcome {
  /** Rows written into the outbox. */
  inserted: number;
  /** Candidates whose copy was over the limit, so no row was written; type and id only. */
  dropped: DroppedCopy[];
}

/** Every scheduled reminder due at `now`, written into the outbox. */
export async function enqueueScheduledNotifications(
  db: Kysely<Database>,
  now: Date,
): Promise<ScheduledOutcome> {
  const dropped: DroppedCopy[] = [];
  const rows = [
    ...(await billRows(db, now, dropped)),
    ...(await choreRows(db, now, dropped)),
    ...(await errandRows(db, now, dropped)),
    ...(await mealRows(db, now, dropped)),
    ...(await nudgeRows(db, now, dropped)),
  ];
  return { inserted: await writeRows(db, rows, now), dropped };
}
