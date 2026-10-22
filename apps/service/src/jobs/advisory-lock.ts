import { sql, type Kysely } from 'kysely';
import type { Database } from '../db.js';

/**
 * Job idempotency, first line: each job takes `pg_try_advisory_lock(hashtext('<job name>'))` on a
 * dedicated connection and skips the run if the lock is held. A restart mid-run, or two processes,
 * must not double-log or double-send.
 *
 * The lock is session-scoped, so it has to live on one connection for the whole run rather than
 * inside a transaction that commits half way through. `db.connection()` reserves exactly one.
 */

export interface LockOutcome<T> {
  ran: boolean;
  result: T | undefined;
}

export async function withJobLock<T>(
  db: Kysely<Database>,
  jobName: string,
  run: () => Promise<T>,
): Promise<LockOutcome<T>> {
  return db.connection().execute(async (connection) => {
    const { rows } = await sql<{
      locked: boolean;
    }>`select pg_try_advisory_lock(hashtext(${jobName})) as locked`.execute(connection);
    if (rows[0]?.locked !== true) return { ran: false, result: undefined };
    try {
      return { ran: true, result: await run() };
    } finally {
      // Releasing explicitly rather than relying on the connection closing: the pool keeps it.
      await sql`select pg_advisory_unlock(hashtext(${jobName}))`.execute(connection);
    }
  });
}
