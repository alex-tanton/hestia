import { buildApp } from './app.js';
import { createDatabase } from './db.js';
import { parseEnv } from './env.js';

const env = parseEnv(process.env);
const database = createDatabase(env.DATABASE_URL);
const app = await buildApp(
  { pingDatabase: database.ping },
  { trustedProxies: env.HEARTH_TRUSTED_PROXIES, logger: { level: env.LOG_LEVEL } },
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
