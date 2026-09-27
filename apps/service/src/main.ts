import type { FastifyBaseLogger } from 'fastify';
import { buildApp } from './app.js';
import { createTokenVerifier } from './auth/jwt.js';
import { createDatabase } from './db.js';
import { withAnonDb } from './db/user-db.js';
import { FlippDealSource } from './deals/flipp/flipp-deal-source.js';
import { FIXTURE_ITEM_DETAIL, fixtureTransport } from './deals/flipp/fixture-transport.js';
import {
  buildUserAgent,
  fetchGet,
  FlippRequestQueue,
  type HttpGet,
} from './deals/flipp/request-queue.js';
import { parseEnv } from './env.js';
import { createGoTrueClient } from './gotrue/client.js';
import { createScheduler, readinessNotBuiltYet, type Scheduler } from './jobs/index.js';
import { loadOpenApiDocument } from './openapi.js';
import { createGoTrueAdmin } from './privileged/gotrue-admin.js';
import { createJobDatabase } from './privileged/job-database.js';
import { readSystemHealth } from './privileged/service-role-db.js';
import { newestBackupTime } from './services/backups.js';
import { createDealsService } from './services/deals/deals.js';
import { recordAppError } from './services/errors.js';
import { repriceExpiredItems } from './services/repricing.js';
import { SkipRateRegistry } from './services/skip-rates.js';

const env = parseEnv(process.env);
const database = createDatabase(env.DATABASE_URL);
const gotrue = createGoTrueClient({ url: env.GOTRUE_URL, anonKey: env.ANON_KEY });
// The privileged clients are built here and handed to routes only as the two narrow functions
// the sanctioned uses need (Technical Architecture, "The RLS rule").
const gotrueAdmin = createGoTrueAdmin({
  url: env.GOTRUE_URL,
  serviceRoleKey: env.SERVICE_ROLE_KEY,
});
const skipRates = new SkipRateRegistry();
const openApiDocument = loadOpenApiDocument();

// One queue for every Flipp call, so the 500ms gap, the backoff, and the circuit breaker apply
// across requests and jobs alike (Handoff non-negotiable 19). The queue and the scheduler both
// need the app's logger, and the app needs the deals service, so both are wired once it exists.
const wiring: { log?: FastifyBaseLogger; scheduler?: Scheduler } = {};
const queueLogger = {
  warn: (data: Record<string, unknown>, message: string) => wiring.log?.warn(data, message),
  info: (data: Record<string, unknown>, message: string) => wiring.log?.info(data, message),
};
// Only the E2E Compose overlay sets HEARTH_FLIPP_FIXTURE_DIR (non-negotiable 17): every other
// caller, including a real deployment, gets the live transport unchanged.
const flippGet: HttpGet =
  env.HEARTH_FLIPP_FIXTURE_DIR === undefined
    ? fetchGet
    : fixtureTransport({ dir: env.HEARTH_FLIPP_FIXTURE_DIR, itemDetail: FIXTURE_ITEM_DETAIL });
const flippQueue = new FlippRequestQueue({
  get: flippGet,
  userAgent: buildUserAgent(env.HEARTH_ORIGIN),
  logger: queueLogger,
});
const fixtureNow = env.HEARTH_FLIPP_FIXTURE_NOW;
const dealSource = new FlippDealSource({
  queue: flippQueue,
  logger: queueLogger,
  ...(fixtureNow === undefined ? {} : { now: () => fixtureNow }),
});

const deals = createDealsService({
  source: dealSource,
  queueBackgroundRefresh: (postalCode) => wiring.scheduler?.queueBackgroundRefresh(postalCode),
  logger: queueLogger,
});

const app = await buildApp(
  {
    pingDatabase: database.ping,
    db: database.db,
    verifyToken: createTokenVerifier({ secret: env.JWT_SECRET, fetchJwks: gotrue.jwks }),
    gotrue,
    changeEmail: gotrueAdmin.changeEmail,
    systemHealth: () => readSystemHealth(database.db),
    recordError: (record) => withAnonDb(database.db, (db) => recordAppError(db, record)),
    newestBackupTime: () => newestBackupTime(env.BACKUP_DIR),
    merchantSkipRates: () => skipRates.list(),
    deals,
  },
  {
    trustedProxies: env.HEARTH_TRUSTED_PROXIES,
    logger: { level: env.LOG_LEVEL },
    origin: env.HEARTH_ORIGIN,
    ownerEmail: env.HEARTH_OWNER_EMAIL,
    openApiDocument: () => openApiDocument,
  },
);

wiring.log = app.log;
const scheduler = createScheduler({
  database: createJobDatabase(database.db),
  logger: app.log,
  refresh: {
    source: dealSource,
    // Held in memory by this process and labelled "since last refresh" by System health.
    publishSkipRates: (counts) => {
      skipRates.replace(counts);
    },
    repriceExpiredItems: (db) => repriceExpiredItems(db, { kind: 'all' }),
    recomputeReadiness: readinessNotBuiltYet,
  },
});
wiring.scheduler = scheduler;
scheduler.start();

// Docker stops containers with SIGTERM; finish in-flight requests and release the pool.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    void app
      .close()
      .then(() => scheduler.stop())
      .then(() => database.close())
      .then(
        () => process.exit(0),
        (error: unknown) => {
          app.log.error({ err: error }, 'shutdown failed');
          process.exit(1);
        },
      );
  });
}

await app.listen({ host: env.HOST, port: env.PORT });
