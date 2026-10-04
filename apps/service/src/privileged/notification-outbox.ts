import { sql } from 'kysely';
import { pushKeysSchema, type NotificationType } from '@hearth/shared';
import type {
  DispatchOutbox,
  DueNotification,
  ExpiredNotification,
  PushSubscriptionRecord,
} from '../jobs/dispatch-notifications.js';
import type { JobDatabase } from '../jobs/types.js';

/**
 * The dispatch job's SQL against other users' rows (Technical Architecture, "Scheduled jobs" ›
 * "Dispatch"). The outbox holds rows for every recipient and the job works on all of them in one
 * run, so it has to read and delete notifications and push subscriptions that belong to users other
 * than the one who would normally see them. Only `service_role` can do that under the RLS rule,
 * which is why this lives here, behind the same fence as the rest of the service-role work, rather
 * than in the job.
 *
 * Each call is its own service-role transaction. The advisory lock stops two runs working the same
 * rows; `claim` is still conditional on `sent_at is null`, so a row is stamped once no matter what
 * else reaches it. The claim is written before any device is sent the row, and `release` clears it
 * only when no device accepted.
 */
export function createNotificationOutbox(database: JobDatabase): DispatchOutbox {
  return {
    expireOverdue: () =>
      database.asServiceRole(async (db) => {
        // A row is retired only when it was never sent and its retry window has closed.
        const { rows } = await sql<ExpiredNotification>`
          delete from public.notification
          where sent_at is null and send_after + interval '24 hours' < pg_catalog.now()
          returning id, type
        `.execute(db);
        return rows;
      }),

    listDue: () =>
      database.asServiceRole(async (db): Promise<DueNotification[]> => {
        const { rows: due } = await sql<{
          id: string;
          user_id: string;
          type: NotificationType;
          payload: unknown;
        }>`
          select n.id, n.user_id, n.type, n.payload
          from public.notification n
          where n.sent_at is null and n.send_after <= pg_catalog.now()
          order by n.send_after, n.id
        `.execute(db);
        if (due.length === 0) return [];

        const userIds = [...new Set(due.map((row) => row.user_id))];
        const { rows: subscriptions } = await sql<{
          id: string;
          user_id: string;
          endpoint: string;
          keys: unknown;
        }>`
          select id, user_id, endpoint, keys
          from public.push_subscription
          where user_id = any(${userIds}::uuid[])
          order by created_at, endpoint
        `.execute(db);

        // Read in the same transaction as the due rows, so a subscription added mid-run is either
        // seen for every row or for none. Keys that fail the same schema the API writes with cannot
        // be used to encrypt a push, so they are left out rather than sent.
        const byUser = new Map<string, PushSubscriptionRecord[]>();
        for (const row of subscriptions) {
          const keys = pushKeysSchema.safeParse(row.keys);
          if (!keys.success) continue;
          const list = byUser.get(row.user_id) ?? [];
          list.push({ id: row.id, endpoint: row.endpoint, keys: keys.data });
          byUser.set(row.user_id, list);
        }

        return due.map((row) => ({
          id: row.id,
          type: row.type,
          payload: row.payload,
          subscriptions: byUser.get(row.user_id) ?? [],
        }));
      }),

    claim: (id) =>
      database.asServiceRole(async (db) => {
        const { rows } = await sql<{ id: string }>`
          update public.notification
          set sent_at = pg_catalog.now()
          where id = ${id}::uuid and sent_at is null
          returning id
        `.execute(db);
        return rows.length === 1;
      }),

    release: (id) =>
      database.asServiceRole(async (db) => {
        await sql`
          update public.notification
          set sent_at = null
          where id = ${id}::uuid
        `.execute(db);
      }),

    deleteUnsent: (id) =>
      database.asServiceRole(async (db) => {
        await sql`
          delete from public.notification
          where id = ${id}::uuid and sent_at is null
        `.execute(db);
      }),

    deleteSubscription: (id) =>
      database.asServiceRole(async (db) => {
        await sql`delete from public.push_subscription where id = ${id}::uuid`.execute(db);
      }),
  };
}
