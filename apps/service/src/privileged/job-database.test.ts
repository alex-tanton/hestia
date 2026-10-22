import { describe, expect, it } from 'vitest';
import { emptyDb } from '../test/fake-app.js';
import { createJobDatabase } from './job-database.js';

/**
 * The service-role capability jobs receive (scheduled jobs are a sanctioned service-role use). Only
 * `main.ts` and the CLI build one, and `main.ts` is excluded from coverage, so nothing else ever
 * calls `createJobDatabase` — this exercises it directly rather than through the excluded
 * entrypoint.
 */
describe('createJobDatabase', () => {
  it('exposes the pool unchanged, and runs asServiceRole through a transaction', async () => {
    const db = emptyDb();
    const jobDb = createJobDatabase(db);

    expect(jobDb.pool).toBe(db);

    const result = await jobDb.asServiceRole((trx) => {
      // `withServiceRoleDb` hands the callback the transaction-scoped Kysely, not `db` itself.
      expect(trx).not.toBe(db);
      return Promise.resolve('ran-as-service-role');
    });
    expect(result).toBe('ran-as-service-role');
  });
});
