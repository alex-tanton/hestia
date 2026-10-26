import { sql, type Kysely } from 'kysely';
import type { Database } from '../db.js';

/**
 * The only way a request handler reaches the database.
 *
 * The pool connects as hestia_service, which is NOINHERIT and holds no rights of its own. Each
 * call opens a transaction that switches to `authenticated` and installs the verified claims,
 * both transaction-local, so auth.uid() is the caller, every RLS policy applies, and nothing
 * survives into the next request that reuses the connection. `fn` gets a Kysely bound to that
 * transaction; the transaction commits when `fn` resolves and rolls back when it throws.
 */
export async function withUserDb<T>(
  db: Kysely<Database>,
  claims: Readonly<Record<string, unknown>>,
  fn: (trx: Kysely<Database>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await sql`set local role authenticated`.execute(trx);
    await sql`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`.execute(
      trx,
    );
    return fn(trx);
  });
}

/**
 * The same, as `anon`, for the one thing anon may do: record an error through
 * `public.record_app_error`.
 */
export async function withAnonDb<T>(
  db: Kysely<Database>,
  fn: (trx: Kysely<Database>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await sql`set local role anon`.execute(trx);
    await sql`select set_config('request.jwt.claims', ${JSON.stringify({ role: 'anon' })}, true)`.execute(
      trx,
    );
    return fn(trx);
  });
}
