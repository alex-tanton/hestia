import { randomUUID } from 'node:crypto';
import { TEST_CONFIG } from '@hestia/shared';
import pg from 'pg';

/**
 * Harness for database integration tests. Every test gets one connection inside a transaction
 * that is rolled back at the end, so nothing a test writes survives it.
 *
 * The connection is the local superuser-like `postgres` role, which sets up fixtures directly.
 * `as(user)` then runs statements exactly the way `withUserDb` does: `set local role
 * authenticated` plus the verified claims in `request.jwt.claims`, so auth.uid() is that user
 * and every RLS policy applies.
 */

export const TEST_DATABASE_URL =
  process.env['HESTIA_TEST_DATABASE_URL'] ?? TEST_CONFIG.DEFAULT_DEV_DATABASE_URL;

export interface TestUser {
  id: string;
  email: string;
}

export type Row = Record<string, unknown>;

/** A role-switched view of the test transaction. */
export interface Actor {
  query: <T extends Row = Row>(text: string, params?: unknown[]) => Promise<T[]>;
  /** The statement's error, or throws if it unexpectedly succeeded. */
  fails: (text: string, params?: unknown[]) => Promise<DatabaseError>;
}

export interface DatabaseError {
  code: string | undefined;
  message: string;
}

export interface TestDb {
  /** Statements as the connection's own role (`postgres`), for fixtures and inspection. */
  admin: Actor;
  as: (user: TestUser) => Actor;
  anon: Actor;
  /**
   * Switches through each role in turn (for example hestia_service, then authenticated), with
   * optional claims, to check what a role may switch into and hold.
   */
  asRoles: (roles: string[], claims?: Row) => Actor;
  createUser: (displayName: string, options?: { timezone?: string }) => Promise<TestUser>;
}

let savepointCounter = 0;

function toDatabaseError(error: unknown): DatabaseError {
  if (error instanceof Error) {
    const code = (error as Error & { code?: unknown }).code;
    return { code: typeof code === 'string' ? code : undefined, message: error.message };
  }
  return { code: undefined, message: String(error) };
}

function makeActor(client: pg.PoolClient, enter: string[], enterParams: unknown[][]): Actor {
  // Each statement runs in its own savepoint. Rolling back to it undoes a failed statement and
  // the role switch together; on success the switch is undone explicitly.
  const run = async <T extends Row>(text: string, params: unknown[]): Promise<T[]> => {
    savepointCounter += 1;
    const savepoint = `actor_${String(savepointCounter)}`;
    await client.query(`savepoint ${savepoint}`);
    try {
      for (const [index, statement] of enter.entries()) {
        await client.query(statement, enterParams[index] ?? []);
      }
      const result = await client.query<T>(text, params);
      await client.query('reset role');
      await client.query("select set_config('request.jwt.claims', '', true)");
      await client.query(`release savepoint ${savepoint}`);
      return result.rows;
    } catch (error) {
      await client.query(`rollback to savepoint ${savepoint}`);
      await client.query(`release savepoint ${savepoint}`);
      throw error;
    }
  };

  return {
    query: (text, params = []) => run(text, params),
    fails: async (text, params = []) => {
      let rows: Row[];
      try {
        rows = await run(text, params);
      } catch (error) {
        return toDatabaseError(error);
      }
      throw new Error(
        `expected the statement to fail, but it returned ${String(rows.length)} rows`,
      );
    },
  };
}

function claimsFor(user: TestUser): string {
  return JSON.stringify({
    sub: user.id,
    email: user.email,
    role: 'authenticated',
    aud: 'authenticated',
  });
}

const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 4 });

/**
 * Runs `fn` inside a transaction that is always rolled back. Use one per test.
 */
export async function withTestDb(fn: (db: TestDb) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  await client.query('begin');
  try {
    const admin = makeActor(client, [], []);
    const db: TestDb = {
      admin,
      as: (user) =>
        makeActor(
          client,
          ['set local role authenticated', "select set_config('request.jwt.claims', $1, true)"],
          [[], [claimsFor(user)]],
        ),
      anon: makeActor(
        client,
        ['set local role anon', "select set_config('request.jwt.claims', $1, true)"],
        [[], [JSON.stringify({ role: 'anon' })]],
      ),
      asRoles: (roles, claims) =>
        makeActor(
          client,
          [
            ...roles.map((role) => `set local role ${pg.escapeIdentifier(role)}`),
            "select set_config('request.jwt.claims', $1, true)",
          ],
          [...roles.map(() => []), [claims === undefined ? '' : JSON.stringify(claims)]],
        ),
      createUser: async (displayName, options = {}) => {
        const id = randomUUID();
        const email = `${displayName.toLowerCase().replaceAll(/[^a-z0-9]+/g, '.')}.${id.slice(0, 8)}@example.com`;
        // Inserting into auth.users fires the same trigger GoTrue's signup does.
        await admin.query(
          `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
           values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
                   $2, $3)`,
          [
            id,
            email,
            JSON.stringify({
              display_name: displayName,
              ...(options.timezone === undefined ? {} : { timezone: options.timezone }),
            }),
          ],
        );
        return { id, email };
      },
    };
    await fn(db);
  } finally {
    await client.query('rollback');
    client.release();
  }
}

export async function closeTestDb(): Promise<void> {
  await pool.end();
}
