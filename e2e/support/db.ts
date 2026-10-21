import { compose, runChecked } from './compose.ts';
import { databaseUrl, readStackEnv } from './env.ts';

const FIELD_SEPARATOR = '';

/**
 * A read straight from the E2E stack's Postgres, as `postgres`. It is for the few assertions that
 * have no UI yet — personal bills outliving a deleted household, for one — never for arranging
 * what a journey should arrange for itself through the app.
 */
export function query(sql: string): string[][] {
  const output = runChecked('psql', [
    databaseUrl(readStackEnv()),
    '--no-psqlrc',
    '--tuples-only',
    '--no-align',
    '--field-separator',
    FIELD_SEPARATOR,
    '--set',
    'ON_ERROR_STOP=1',
    '--command',
    sql,
  ]);
  return output
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.split(FIELD_SEPARATOR));
}

/** The single value of a single-row, single-column query. */
export function queryValue(sql: string): string {
  const rows = query(sql);
  const row = rows[0];
  if (rows.length !== 1 || row?.length !== 1) throw new Error(`expected one value from: ${sql}`);
  return row[0] ?? '';
}

/**
 * Runs the owner CLI where it actually lives — a bin on the service container's PATH, reached
 * with `docker compose exec`.
 */
export function hearthAdmin(args: readonly string[]): {
  status: number;
  stdout: string;
  stderr: string;
} {
  return compose(['exec', '-T', 'hearth-service', 'hearth-admin', ...args]);
}
