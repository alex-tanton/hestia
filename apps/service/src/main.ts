import { buildApp } from './app.js';
import { createTokenVerifier } from './auth/jwt.js';
import { createDatabase } from './db.js';
import { withAnonDb } from './db/user-db.js';
import { parseEnv } from './env.js';
import { createGoTrueClient } from './gotrue/client.js';
import { loadOpenApiDocument } from './openapi.js';
import { createGoTrueAdmin } from './privileged/gotrue-admin.js';
import { readSystemHealth } from './privileged/service-role-db.js';
import { newestBackupTime } from './services/backups.js';
import { recordAppError } from './services/errors.js';
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
  },
  {
    trustedProxies: env.HEARTH_TRUSTED_PROXIES,
    logger: { level: env.LOG_LEVEL },
    origin: env.HEARTH_ORIGIN,
    ownerEmail: env.HEARTH_OWNER_EMAIL,
    openApiDocument: () => openApiDocument,
  },
);

// Docker stops containers with SIGTERM; finish in-flight requests and release the pool.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    void app
      .close()
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
