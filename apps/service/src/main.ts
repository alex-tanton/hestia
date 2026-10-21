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
import { createScheduler, type Scheduler } from './jobs/index.js';
import { loadOpenApiDocument } from './openapi.js';
import { createGoTrueAdmin } from './privileged/gotrue-admin.js';
import { createJobDatabase } from './privileged/job-database.js';
import { createNotificationOutbox } from './privileged/notification-outbox.js';
import { readSystemHealth } from './privileged/service-role-db.js';
import { RecordingPushTransport } from './push/recording-transport.js';
import { pushTestSeam } from './push/test-seam.js';
import { createWebPushTransport } from './push/web-push-transport.js';
import { fetchRecipePage } from './recipes/fetch-recipe.js';
import { recipeFixtureFetch } from './recipes/fixture-fetch.js';
import { HostRateLimiter } from './recipes/host-rate-limiter.js';
import { parseRecipeUrl } from './recipes/parse-recipe-url.js';
import { newestBackupTime } from './services/backups.js';
import { createDealsService } from './services/deals/deals.js';
import { recordAppError } from './services/errors.js';
import { recomputeReadinessForHousehold } from './services/readiness.js';
import { repriceExpiredItems } from './services/repricing.js';
import { SkipRateRegistry } from './services/skip-rates.js';

const env = parseEnv(process.env);
const database = createDatabase(env.DATABASE_URL);
const gotrue = createGoTrueClient({ url: env.GOTRUE_URL, anonKey: env.ANON_KEY });
// The privileged clients are built here and handed to routes only as the two narrow functions
// the sanctioned uses need.
const gotrueAdmin = createGoTrueAdmin({
  url: env.GOTRUE_URL,
  serviceRoleKey: env.SERVICE_ROLE_KEY,
});
const skipRates = new SkipRateRegistry();
const openApiDocument = loadOpenApiDocument();

// One queue for every Flipp call, so the 500ms gap, the backoff, and the circuit breaker apply
// across requests and jobs alike. The queue and the scheduler both need the app's logger, and the
// app needs the deals service, so both are wired once it exists.
const wiring: { log?: FastifyBaseLogger; scheduler?: Scheduler } = {};
const queueLogger = {
  warn: (data: Record<string, unknown>, message: string) => wiring.log?.warn(data, message),
  info: (data: Record<string, unknown>, message: string) => wiring.log?.info(data, message),
};
// Only the E2E Compose overlay sets HEARTH_FLIPP_FIXTURE_DIR: every other caller, including a real
// deployment, gets the live transport unchanged.
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

// One limiter for every recipe fetch, so 1 request/second/host holds across requests, the same
// way flippQueue holds Flipp's rate discipline.
const recipeFetchLimiter = new HostRateLimiter();
const recipeUserAgent = buildUserAgent(env.HEARTH_ORIGIN);
// Only the E2E Compose overlay sets HEARTH_RECIPE_FIXTURE_DIR (see env.ts): every other caller,
// including a real deployment, fetches the pasted URL for real.
const recipeFetchPage: (pageUrl: string) => Promise<{ body: string }> =
  env.HEARTH_RECIPE_FIXTURE_DIR === undefined
    ? (pageUrl) =>
        fetchRecipePage(pageUrl, { userAgent: recipeUserAgent, limiter: recipeFetchLimiter })
    : recipeFixtureFetch({ dir: env.HEARTH_RECIPE_FIXTURE_DIR });

// The E2E push switch (env.ts). Only the Compose overlay selects `test-double`: then pushes are
// recorded rather than sent, and the seam routes that let the suite run dispatch and read them back
// are registered. Every other build keeps the web-push transport and has no test route.
const testDouble = env.HEARTH_PUSH_TRANSPORT === 'test-double';
const recordingTransport = new RecordingPushTransport();

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
    parseRecipeUrl: (url) => parseRecipeUrl(url, recipeFetchPage),
  },
  {
    trustedProxies: env.HEARTH_TRUSTED_PROXIES,
    logger: { level: env.LOG_LEVEL },
    origin: env.HEARTH_ORIGIN,
    ownerEmail: env.HEARTH_OWNER_EMAIL,
    rateLimitPerMinute: env.HEARTH_RATE_LIMIT_PER_MINUTE,
    openApiDocument: () => openApiDocument,
    testSeam: testDouble
      ? pushTestSeam({
          serviceRoleKey: env.SERVICE_ROLE_KEY,
          transport: recordingTransport,
          dispatch: async (now) =>
            (await wiring.scheduler?.run('dispatch-notifications', { now })) ?? false,
        })
      : undefined,
  },
);

wiring.log = app.log;
if (testDouble) app.log.warn('push transport is the E2E test double; no push is sent');
const jobDatabase = createJobDatabase(database.db);
const scheduler = createScheduler({
  database: jobDatabase,
  logger: app.log,
  dispatch: {
    outbox: createNotificationOutbox(jobDatabase),
    // The push service asks for a contact in each request's VAPID claims; parseEnv has already
    // resolved it to a mailto: or https: URI, so web-push accepts it.
    transport: testDouble
      ? recordingTransport
      : createWebPushTransport({
          subject: env.VAPID_SUBJECT,
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
        }),
  },
  refresh: {
    source: dealSource,
    // Held in memory by this process and labelled "since last refresh" by System health.
    publishSkipRates: (counts) => {
      skipRates.replace(counts);
    },
    repriceExpiredItems: (db) => repriceExpiredItems(db, { kind: 'all' }),
    recomputeReadiness: (db, householdIds) =>
      Promise.all(householdIds.map((id) => recomputeReadinessForHousehold(db, id))).then(
        () => undefined,
      ),
  },
});
wiring.scheduler = scheduler;
scheduler.start();

// Docker stops containers with SIGTERM; finish in-flight requests and job runs, then release the
// pool. The pool closes only after scheduler.stop() resolves, so no run is left writing to it.
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
