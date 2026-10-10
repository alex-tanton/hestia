import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type DatabaseConnection,
  type Driver,
  type QueryResult,
} from 'kysely';
import { describe, expect, it } from 'vitest';
import type { Database } from '../db.js';
import { markHouseholdActive } from './households.js';

/**
 * A driver that behaves like `DummyDriver` (see `test/fake-app.ts`'s `emptyDb`) except its
 * connection throws from `executeQuery`, so a test can force a specific Postgres error without a
 * real database. `DummyDriver` always answers with zero rows and can never throw.
 */
function throwingDb(error: Error): Kysely<Database> {
  const connection: DatabaseConnection = {
    executeQuery<R>(): Promise<QueryResult<R>> {
      return Promise.reject(error);
    },
    streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
      throw error;
    },
  };
  const driver: Driver = {
    init: () => Promise.resolve(),
    acquireConnection: () => Promise.resolve(connection),
    beginTransaction: () => Promise.resolve(),
    commitTransaction: () => Promise.resolve(),
    rollbackTransaction: () => Promise.resolve(),
    releaseConnection: () => Promise.resolve(),
    destroy: () => Promise.resolve(),
  };
  return new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (db) => new PostgresIntrospector(db),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
}

/**
 * `markHouseholdActive` maps exactly one Postgres error (42501, the RLS-denial a non-member
 * triggers) to a 404; every other error is unexpected and must pass through unchanged rather than
 * being swallowed or mis-mapped. The 42501 mapping itself is covered through the real route in
 * `api.integration.test.ts`'s household tests — this is the "anything else" branch, which no
 * real household-membership check can trigger through RLS.
 */
describe('markHouseholdActive', () => {
  it('rethrows an error that is not the 42501 RLS denial', async () => {
    const dbError = Object.assign(new Error('connection terminated unexpectedly'), {
      code: '57P01',
    });
    await expect(markHouseholdActive(throwingDb(dbError), 'household-id')).rejects.toBe(dbError);
  });
});
