import { createHmac, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { buildApp, type AppDependencies, type AppOptions } from '../app.js';
import { createTokenVerifier } from '../auth/jwt.js';
import type { Database } from '../db.js';

/** Helpers for unit tests that drive the app with inject() and no database or GoTrue. */

export const TEST_JWT_SECRET = 'unit-test-secret-at-least-32-characters-long';
export const TEST_ORIGIN = 'https://hearth.test.ts.net';
export const TEST_OWNER_EMAIL = 'Owner@Example.com';

/** An HS256 token signed the way GoTrue signs one. */
export function signToken(
  claims: Record<string, unknown>,
  options: { secret?: string; header?: Record<string, unknown> } = {},
): string {
  const header = Buffer.from(
    JSON.stringify(options.header ?? { alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', options.secret ?? TEST_JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function userClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: randomUUID(),
    email: 'member@example.com',
    role: 'authenticated',
    aud: 'authenticated',
    iat: now,
    exp: now + 3600,
    amr: [{ method: 'password', timestamp: now }],
    ...overrides,
  };
}

export function bearer(claims: Record<string, unknown> = userClaims()): Record<string, string> {
  return { authorization: `Bearer ${signToken(claims)}` };
}

/** A Kysely that answers every query with no rows, so no test can reach a real database. */
export function emptyDb(): Kysely<Database> {
  return new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (db) => new PostgresIntrospector(db),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
}

export function fakeDeps(overrides: Partial<AppDependencies> = {}): AppDependencies {
  const unexpected = (what: string) => () => Promise.reject(new Error(`unexpected ${what}`));
  return {
    pingDatabase: () => Promise.resolve(),
    db: emptyDb(),
    verifyToken: createTokenVerifier({ secret: TEST_JWT_SECRET }),
    gotrue: {
      signup: unexpected('signup'),
      verifyPassword: unexpected('verifyPassword'),
      updatePassword: unexpected('updatePassword'),
    },
    changeEmail: unexpected('changeEmail'),
    systemHealth: unexpected('systemHealth'),
    recordError: () => Promise.resolve(),
    newestBackupTime: () => Promise.resolve(null),
    merchantSkipRates: () => [],
    ...overrides,
  };
}

export async function makeTestApp(
  overrides: Partial<AppDependencies> = {},
  options: Partial<AppOptions> = {},
): Promise<FastifyInstance> {
  return buildApp(fakeDeps(overrides), {
    trustedProxies: [],
    logger: false,
    origin: TEST_ORIGIN,
    ownerEmail: TEST_OWNER_EMAIL,
    ...options,
  });
}
