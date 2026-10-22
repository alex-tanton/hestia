import { sql, type Kysely } from 'kysely';
import type { Database } from '../db.js';

/**
 * Database work as `service_role`, which bypasses RLS. Sanctioned only for scheduled jobs, and `system_health()` after the caller
 * has been checked as the server owner. Never for a user's data request. ESLint keeps every
 * module except main.ts and the CLI from importing this one.
 */
export async function withServiceRoleDb<T>(
  db: Kysely<Database>,
  fn: (trx: Kysely<Database>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await sql`set local role service_role`.execute(trx);
    return fn(trx);
  });
}

export interface SystemHealthRow {
  newest_deal_fetched_at: string | null;
  newest_notification_sent_at: string | null;
  recent_errors: {
    fingerprint: string;
    message: string;
    count: number;
    first_seen: string;
    last_seen: string;
  }[];
}

/** `public.system_health()`: aggregates only, including every household's recent errors. */
export async function readSystemHealth(db: Kysely<Database>): Promise<SystemHealthRow> {
  return withServiceRoleDb(db, async (trx) => {
    const { rows } = await sql<{
      health: SystemHealthRow;
    }>`select public.system_health() as health`.execute(trx);
    const row = rows[0];
    if (row === undefined) throw new Error('system_health returned no row');
    return row.health;
  });
}
