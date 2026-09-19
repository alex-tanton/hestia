import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';

/** Schema types are generated from migrations in a later unit; nothing is queried by table yet. */
export type Database = Record<string, never>;

export interface DatabaseHandle {
  db: Kysely<Database>;
  /** Resolves when the database answers a trivial query, rejects otherwise. */
  ping: () => Promise<void>;
  close: () => Promise<void>;
}

export function createDatabase(connectionString: string): DatabaseHandle {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    // A health check must answer quickly even when Postgres is down.
    connectionTimeoutMillis: 3000,
  });
  const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });

  return {
    db,
    ping: async () => {
      await sql`select 1`.execute(db);
    },
    close: () => db.destroy(),
  };
}
