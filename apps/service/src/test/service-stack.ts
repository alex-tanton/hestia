import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import pg from 'pg';
import { buildApp, type AppDependencies } from '../app.js';
import { createTokenVerifier } from '../auth/jwt.js';
import { createDatabase, type DatabaseHandle } from '../db.js';
import { withAnonDb } from '../db/user-db.js';
import { createGoTrueClient } from '../gotrue/client.js';
import { createGoTrueAdmin } from '../privileged/gotrue-admin.js';
import { readSystemHealth } from '../privileged/service-role-db.js';
import { createDealsService, type DealsService } from '../services/deals/deals.js';
import { recordAppError } from '../services/errors.js';
import { FakeDealSource } from './fixture-deal-source.js';
import { TEST_DATABASE_URL } from './integration-db.js';

/**
 * The real service wired to the `supabase start` stack: Postgres as hearth_service and GoTrue
 * through Kong. Unlike the rolled-back database tests, requests here commit, so every test makes
 * its own users and households. Keys come from `supabase status` unless set in the environment.
 */

export interface StackConfig {
  gotrueUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  jwtSecret: string;
  serviceDatabaseUrl: string;
}

const SERVICE_PASSWORD = process.env['HEARTH_TEST_SERVICE_PASSWORD'] ?? 'hearth';

function supabaseStatus(): Record<string, string> {
  const output = execFileSync('supabase', ['status', '--output', 'env'], {
    cwd: fileURLToPath(new URL('../../../..', import.meta.url)),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const values: Record<string, string> = {};
  for (const line of output.split('\n')) {
    const match = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
    if (match?.[1] !== undefined && match[2] !== undefined) values[match[1]] = match[2];
  }
  return values;
}

let cached: StackConfig | undefined;

export function stackConfig(): StackConfig {
  if (cached !== undefined) return cached;
  const env = process.env;
  const status =
    env['HEARTH_TEST_ANON_KEY'] === undefined ? supabaseStatus() : ({} as Record<string, string>);
  const pick = (name: string, statusName: string): string => {
    const value = env[name] ?? status[statusName];
    if (value === undefined || value === '') throw new Error(`set ${name} or run supabase start`);
    return value;
  };
  const dbUrl = new URL(TEST_DATABASE_URL);
  dbUrl.username = 'hearth_service';
  dbUrl.password = SERVICE_PASSWORD;
  cached = {
    // Kong's port under `supabase start` (supabase/config.toml, [api].port).
    gotrueUrl: env['HEARTH_TEST_GOTRUE_URL'] ?? 'http://127.0.0.1:54321/auth/v1',
    anonKey: pick('HEARTH_TEST_ANON_KEY', 'ANON_KEY'),
    serviceRoleKey: pick('HEARTH_TEST_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY'),
    jwtSecret: pick('HEARTH_TEST_JWT_SECRET', 'JWT_SECRET'),
    serviceDatabaseUrl: dbUrl.toString(),
  };
  return cached;
}

export const adminPool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 });

/** The migrations create hearth_service without a login; give it the test password. */
export async function enableServiceLogin(): Promise<void> {
  await adminPool.query(
    `alter role hearth_service with login password ${pg.escapeLiteral(SERVICE_PASSWORD)}`,
  );
}

export interface Stack {
  database: DatabaseHandle;
  newApp: (options?: {
    ownerEmail?: string;
    deps?: Partial<AppDependencies>;
  }) => Promise<FastifyInstance>;
  close: () => Promise<void>;
}

/** The deals dependency a test drives: a double plus the postal codes it queued refreshes for. */
export interface TestDeals {
  source: FakeDealSource;
  service: DealsService;
  queued: string[];
}

export function testDeals(source = new FakeDealSource()): TestDeals {
  const queued: string[] = [];
  return {
    source,
    queued,
    service: createDealsService({
      source,
      queueBackgroundRefresh: (postalCode) => queued.push(postalCode),
    }),
  };
}

export const TEST_ORIGIN = 'http://127.0.0.1:5173';

export async function startStack(): Promise<Stack> {
  await enableServiceLogin();
  const config = stackConfig();
  const database = createDatabase(config.serviceDatabaseUrl);
  const gotrue = createGoTrueClient({ url: config.gotrueUrl, anonKey: config.anonKey });
  const admin = createGoTrueAdmin({ url: config.gotrueUrl, serviceRoleKey: config.serviceRoleKey });
  const verifyToken = createTokenVerifier({ secret: config.jwtSecret, fetchJwks: gotrue.jwks });
  const apps: FastifyInstance[] = [];

  return {
    database,
    newApp: async (options = {}) => {
      const app = await buildApp(
        {
          pingDatabase: database.ping,
          db: database.db,
          verifyToken,
          gotrue,
          changeEmail: admin.changeEmail,
          systemHealth: () => readSystemHealth(database.db),
          recordError: (record) => withAnonDb(database.db, (db) => recordAppError(db, record)),
          newestBackupTime: () => Promise.resolve(null),
          merchantSkipRates: () => [],
          deals: testDeals().service,
          // Every recipe-parse test overrides this with a fixture-reading fake (Handoff
          // non-negotiable 17: tests never make a live outbound fetch either).
          parseRecipeUrl: () => Promise.reject(new Error('unexpected parseRecipeUrl')),
          ...options.deps,
        },
        {
          trustedProxies: [],
          logger: false,
          origin: TEST_ORIGIN,
          ownerEmail: options.ownerEmail ?? '',
        },
      );
      apps.push(app);
      return app;
    },
    close: async () => {
      await Promise.all(apps.map((app) => app.close()));
      await database.close();
      await adminPool.end();
    },
  };
}

export interface SignedUpUser {
  id: string;
  email: string;
  password: string;
  token: string;
  /** A distinct client address, so GoTrue's per-IP limits do not pool every test's requests. */
  ip: string;
}

let ipCounter = 0;

function nextIp(): string {
  ipCounter += 1;
  // 198.18.0.0/15 is reserved for benchmarking, so these never collide with a real client.
  return `198.18.${String(Math.floor(ipCounter / 250) % 250)}.${String((ipCounter % 250) + 1)}`;
}

export const GOOD_PASSWORD = 'violet-teapot-harbor-17';

/** Signs a new user up through POST /api/signup. */
export async function signUp(
  app: FastifyInstance,
  displayName: string,
  timezone = 'America/New_York',
): Promise<SignedUpUser> {
  const email = `${displayName.toLowerCase().replaceAll(/[^a-z]+/g, '.')}.${randomUUID().slice(0, 8)}@example.com`;
  const ip = nextIp();
  const response = await app.inject({
    method: 'POST',
    url: '/api/signup',
    remoteAddress: ip,
    payload: { email, password: GOOD_PASSWORD, displayName, timezone },
  });
  if (response.statusCode !== 200) {
    throw new Error(`signup failed: ${String(response.statusCode)} ${response.body}`);
  }
  const session = response.json<{ access_token: string; user: { id: string } }>();
  return { id: session.user.id, email, password: GOOD_PASSWORD, token: session.access_token, ip };
}

/** A password sign-in straight to GoTrue, the way the PWA signs in. */
export async function signIn(email: string, password: string, ip: string): Promise<string> {
  const config = stackConfig();
  const response = await fetch(`${config.gotrueUrl}/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.anonKey, 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`sign-in failed: ${String(response.status)}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

/** A request as the user. */
export function as(
  app: FastifyInstance,
  user: Pick<SignedUpUser, 'token' | 'ip'>,
  method: NonNullable<InjectOptions['method']>,
  url: string,
  payload?: unknown,
): Promise<LightMyRequestResponse> {
  const options: InjectOptions = {
    method,
    url,
    remoteAddress: user.ip,
    headers: { authorization: `Bearer ${user.token}` },
    ...(payload === undefined ? {} : { payload: payload as NonNullable<InjectOptions['payload']> }),
  };
  return app.inject(options);
}

export function uniqueName(prefix: string): string {
  return `${prefix} ${randomUUID().slice(0, 6)}`;
}
