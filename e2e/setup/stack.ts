import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { compose, composeChecked, runChecked } from '../support/compose.ts';
import {
  BACKUP_DIR,
  BASE_URL,
  ENV_FILE,
  REPO_ROOT,
  STATE_DIR,
  databaseUrl,
  readStackEnv,
} from '../support/env.ts';

/**
 * Brings the Compose stack up for the E2E suite and takes it down again (Engineering Practices ›
 * Testing, "E2E environment"). The suite runs through Caddy, so it runs against the real stack:
 * docker/docker-compose.yml with e2e/docker-compose.e2e.yml over it.
 *
 * Every run starts from an empty database, so the journeys see exactly the Seed Data fixtures.
 * Set `HEARTH_E2E_REUSE_STACK=1` to skip bring-up and keep the stack afterwards, which is for
 * iterating on one test locally, not for a run whose result is being trusted.
 */

/** Stack services in start order. `backup` is left out: nothing in the suite reads a backup. */
const DATA_SERVICES = ['db', 'auth', 'realtime', 'kong'];
const APP_SERVICES = ['hearth-service', 'caddy'];

const isReuse = process.env['HEARTH_E2E_REUSE_STACK'] === '1';

function step(message: string): void {
  process.stdout.write(`e2e stack: ${message}\n`);
}

/** The throwaway secrets for this run, generated the way a real install's are. */
function writeEnvFile(): void {
  mkdirSync(BACKUP_DIR, { recursive: true });
  rmSync(ENV_FILE, { force: true });
  runChecked('bash', [join(REPO_ROOT, 'scripts', 'generate-secrets.sh'), ENV_FILE], {
    // Plain HTTP on the loopback: there is no Funnel in front of the E2E stack, and every link
    // the stack prints — an invite, the owner's reset link — has to be one the browser can open.
    HEARTH_ORIGIN: BASE_URL,
    // Seed Data, "Users": Alex is the development owner, so Alex sees System health.
    HEARTH_OWNER_EMAIL: 'alex@example.com',
    BACKUP_DIR,
  });
}

export function startStack(): void {
  if (isReuse && existsSync(ENV_FILE)) {
    step('reusing the running stack (HEARTH_E2E_REUSE_STACK=1)');
    return;
  }

  step('starting from an empty database');
  if (existsSync(ENV_FILE)) {
    // An interrupted run can leave containers behind; the fresh `up` below replaces them either
    // way, so a failure here is not worth stopping for.
    compose(['down', '--volumes', '--remove-orphans']);
  }
  rmSync(STATE_DIR, { recursive: true, force: true });
  writeEnvFile();

  step('starting Postgres, GoTrue, Realtime, and Kong');
  composeChecked(['up', '--detach', '--wait', ...DATA_SERVICES]);

  const env = readStackEnv();
  const dbUrl = databaseUrl(env);

  // The Compose database applies only the hearth_service role migration on first start; the rest
  // arrive the way a deploy applies them (scripts/deploy.sh, step 4).
  step('applying migrations');
  runChecked('supabase', [
    'migration',
    'up',
    '--workdir',
    REPO_ROOT,
    '--db-url',
    `${dbUrl}?sslmode=disable`,
  ]);

  step('building and starting the service and Caddy');
  composeChecked(['up', '--detach', '--wait', '--build', ...APP_SERVICES]);

  step('seeding');
  runChecked('pnpm', ['--filter', '@hearth/service', 'db:seed'], {
    HEARTH_SEED_AUTH_URL: `${BASE_URL}/auth/v1`,
    HEARTH_SEED_SERVICE_ROLE_KEY: env['SERVICE_ROLE_KEY'] ?? '',
    HEARTH_SEED_DB_URL: dbUrl,
  });
  runChecked('psql', [
    dbUrl,
    '--quiet',
    '--no-psqlrc',
    '--set',
    'ON_ERROR_STOP=1',
    '--file',
    join(REPO_ROOT, 'e2e', 'fixtures', 'e2e-seed.sql'),
  ]);

  step(`ready at ${BASE_URL}`);
}

export function stopStack(): void {
  if (isReuse) {
    step('leaving the stack running (HEARTH_E2E_REUSE_STACK=1)');
    return;
  }
  if (!existsSync(ENV_FILE)) return;
  step('stopping');
  compose(['down', '--volumes', '--remove-orphans']);
  rmSync(STATE_DIR, { recursive: true, force: true });
}
