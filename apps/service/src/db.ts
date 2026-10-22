import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';

import type { DB } from './db/types.js';

/** Generated from the migrated schema by `pnpm db:types`. */
export type Database = DB;

// A `date` column is a calendar date in the timezone that owns it. pg would turn it into a JS Date
// at local midnight, which shifts it; keep the YYYY-MM-DD string the generated types promise.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

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
