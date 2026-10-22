import type { Kysely } from 'kysely';
import type { Database } from '../db.js';

/**
 * What a job needs from the outside, so the jobs themselves hold no privilege of their own.
 *
 * Scheduled jobs are one of the sanctioned service-role uses: they legitimately operate across
 * households, so no caller's claims would let them do their work. The capability is built in
 * `privileged/` and handed in here as two functions, which keeps the ESLint fence around
 * `privileged/` intact and keeps every job unit-testable.
 */
export interface JobDatabase {
  /** One transaction as `service_role`. */
  asServiceRole: <T>(fn: (db: Kysely<Database>) => Promise<T>) => Promise<T>;
  /** The pool itself, for the advisory lock's dedicated connection. */
  pool: Kysely<Database>;
}

export interface JobLogger {
  info: (data: Record<string, unknown>, message: string) => void;
  warn: (data: Record<string, unknown>, message: string) => void;
  error: (data: Record<string, unknown>, message: string) => void;
  /** A child logger bound to a job name, so every line a job writes carries it. */
  child: (bindings: Record<string, unknown>) => JobLogger;
}
