import { sql, type Kysely } from 'kysely';
import type { Database } from '../db.js';
import { listActivityCopy, type DroppedCopyReport } from '../notifications/copy.js';
import { planListBatch } from '../notifications/planners.js';

/*
 * List activity (Requirements, "Notifications" › "Rules" › "Batching over spam"). Each addition to a
 * list is folded into one `list_activity` row per recipient per list: the first addition opens the
 * batch, keyed by its own time, and each later addition before that row is sent updates its count
 * and send time. Once a batch is sent, the next addition opens a new one, so it is never resent.
 *
 * The row is written by the adding member's request. Row-level security lets a member read and
 * write the unsent batch rows of co-members, and the two helpers below answer the questions that
 * need another member's profile or settings.
 */

export interface ActivityList {
  id: string;
  household_id: string;
  name: string;
}

interface BatchPayload {
  count?: number;
  adders?: string[];
}

/**
 * Records `addedCount` items added to `list` by `actorId` at `at`. An addition of nothing is a no-op,
 * and so is a replayed offline add, which the caller does not report. A batch whose copy would go
 * over the limit is not written, and `report` names it.
 */
export async function recordListActivity(
  db: Kysely<Database>,
  list: ActivityList,
  actorId: string,
  addedCount: number,
  at: Date,
  report?: DroppedCopyReport,
): Promise<void> {
  if (addedCount <= 0) return;

  // Two additions to one list can each find no open batch and each open one, so the read of the
  // open batch and the write that follows are serialised per list. The lock is transaction-scoped:
  // it is taken inside the caller's withUserDb transaction, so it is released with that transaction
  // and every statement below still runs under the caller's row-level security.
  await sql`select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(${`list-activity:${list.id}`}, 0))`.execute(
    db,
  );

  const { rows: members } = await sql<{ user_id: string; display_name: string }>`
    select user_id, display_name from public.household_members(${list.household_id}::uuid)
  `.execute(db);
  const actorName = members.find((member) => member.user_id === actorId)?.display_name;

  // Every other member who has list activity on. The preference check reads each recipient's
  // setting, which the caller's own RLS would hide, so it goes through the shared rule.
  const { rows: recipients } = await sql<{ user_id: string }>`
    select m.user_id
    from public.household_member m
    where m.household_id = ${list.household_id}::uuid
      and m.user_id <> ${actorId}::uuid
      and public.notification_wanted(m.user_id, 'list_activity', null)
  `.execute(db);

  for (const { user_id: recipient } of recipients) {
    const { rows: open } = await sql<{
      id: string;
      occurrence_key: string;
      payload: BatchPayload & Record<string, unknown>;
      created_at: Date;
    }>`
      select id, occurrence_key, payload, created_at
      from public.notification
      where user_id = ${recipient}::uuid
        and type = 'list_activity'
        and target_id = ${list.id}::uuid
        and sent_at is null
      for update
    `.execute(db);
    const previous = open[0];

    const plan = planListBatch(
      previous === undefined
        ? null
        : { key: previous.occurrence_key, firstAt: previous.created_at },
      at,
    );
    const adders = [
      ...new Set([...(previous?.payload.adders ?? []), actorName ?? 'Former member']),
    ];
    const count = (previous?.payload.count ?? 0) + addedCount;
    const copy = listActivityCopy({ count, listName: list.name, adders });
    if (copy === null) {
      report?.({ type: 'list_activity', id: list.id });
      continue;
    }
    const payload = JSON.stringify({
      ...copy,
      target: 'lists',
      householdId: list.household_id,
      count,
      adders,
    });

    if (previous === undefined) {
      await sql`
        insert into public.notification (user_id, type, target_id, occurrence_key, payload, send_after)
        values (
          ${recipient}::uuid, 'list_activity', ${list.id}::uuid, ${plan.key}, ${payload}::jsonb,
          public.member_quiet_send_at(${recipient}::uuid, ${plan.sendAt}::timestamptz)
        )
        on conflict (user_id, type, target_id, occurrence_key) do nothing
      `.execute(db);
    } else {
      // Re-applied on every addition, so the batch's window is always the one the latest send time
      // implies, and a batch that started inside quiet hours still lands at the window's end.
      await sql`
        update public.notification
        set payload = ${payload}::jsonb,
          send_after = public.member_quiet_send_at(${recipient}::uuid, ${plan.sendAt}::timestamptz)
        where id = ${previous.id}::uuid and sent_at is null
      `.execute(db);
    }
  }
}
