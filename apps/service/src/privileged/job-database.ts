import type { Kysely } from 'kysely';
import type { Database } from '../db.js';
import type { JobDatabase } from '../jobs/types.js';
import { withServiceRoleDb } from './service-role-db.js';

/**
 * The service-role capability the scheduled jobs need, built here rather than reached for by the
 * jobs themselves (Technical Architecture, "The RLS rule": scheduled jobs are one of the
 * sanctioned uses). Only `main.ts` and the CLI may import this module, which is what the ESLint
 * fence around `privileged/` enforces; jobs receive the narrow `JobDatabase` and nothing more.
 */
export function createJobDatabase(db: Kysely<Database>): JobDatabase {
  return {
    asServiceRole: (fn) => withServiceRoleDb(db, fn),
    pool: db,
  };
}
