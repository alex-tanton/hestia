import { appendFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { compose, composeChecked, runChecked, runCommand } from '../support/compose.ts';
import {
  BACKUP_DIR,
  BASE_URL,
  CADDY_PORT,
  COMPOSE_PROJECT,
  DB_PORT,
  ENV_FILE,
  IMAGE_TAG,
  NETWORK,
  REPO_ROOT,
  RUN_ID,
  STATE_DIR,
  databaseUrl,
  readStackEnv,
} from '../support/env.ts';
import { SUBNET_CANDIDATES, type Subnet } from '../support/run-identity.ts';

/**
 * Brings the Compose stack up for the E2E suite and takes it down again. The suite runs through
 * Caddy, so it runs against the real stack: docker/docker-compose.yml with
 * e2e/docker-compose.e2e.yml over it.
 *
 * Every run starts from an empty database, so the journeys see exactly the seed data fixtures.
 * Each run has its own project, network, image tag, state directory, and host ports (see
 * e2e/support/env.ts), so a run never touches another run's stack, not even one started a moment
 * earlier. Teardown removes exactly those things and nothing selected by pattern.
 *
 * Set `HESTIA_E2E_REUSE_STACK=1` to skip bring-up and keep the stack afterwards, which is for
 * iterating on one test locally, not for a run whose result is being trusted.
 */

/** Stack services in start order. `backup` is left out: nothing in the suite reads a backup. */
const DATA_SERVICES = ['db', 'auth', 'realtime', 'kong'];
const APP_SERVICES = ['hestia-service', 'caddy'];

const isReuse = process.env['HESTIA_E2E_REUSE_STACK'] === '1';

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
    HESTIA_ORIGIN: BASE_URL,
    // Alex is the development owner, so Alex sees System health.
    HESTIA_OWNER_EMAIL: 'alex@example.com',
    BACKUP_DIR,
  });
}

/**
 * The run's network is created here rather than by Compose. Docker checks a new network's subnet
 * against every network it already runs, and the create is atomic, so two runs starting together
 * cannot both take the same /24: the loser's create fails and it moves to the next candidate.
 */
function reserveSubnet(): Subnet {
  // A network already under this name is not this run's to remove: it belongs to a run with the
  // same id, or to one that died without its state directory. Removing it could pull a live run's
  // containers onto a different subnet, so the run stops and says which network it found.
  const existing = runCommand('docker', ['network', 'inspect', NETWORK]);
  if (existing.status === 0) {
    throw new Error(
      `network ${NETWORK} already exists; another run is using HESTIA_E2E_RUN_ID=${RUN_ID}. Remove it with docker network rm once no run holds it`,
    );
  }

  let lastError = 'no candidate subnet was tried';
  for (const candidate of SUBNET_CANDIDATES) {
    const result = runCommand('docker', [
      'network',
      'create',
      '--driver',
      'bridge',
      '--subnet',
      candidate.subnet,
      '--gateway',
      candidate.gateway,
      '--label',
      `hestia.e2e.run=${RUN_ID}`,
      NETWORK,
    ]);
    if (result.status === 0) return candidate;
    lastError = result.stderr.trim();
  }
  throw new Error(`no free subnet for the E2E network; the last error was: ${lastError}`);
}

/** The run's own values, which docker-compose.e2e.yml interpolates on every Compose command. */
function appendRunEnv(subnet: Subnet): void {
  const lines = [
    `HESTIA_E2E_CADDY_PORT=${String(CADDY_PORT)}`,
    `HESTIA_E2E_DB_PORT=${String(DB_PORT)}`,
    `HESTIA_E2E_NETWORK=${NETWORK}`,
    `HESTIA_E2E_SUBNET=${subnet.subnet}`,
    `HESTIA_E2E_GATEWAY=${subnet.gateway}`,
  ];
  appendFileSync(ENV_FILE, `${lines.join('\n')}\n`);
}

export function startStack(): void {
  if (isReuse && existsSync(ENV_FILE)) {
    step(`reusing the running stack, run ${RUN_ID} (HESTIA_E2E_REUSE_STACK=1)`);
    return;
  }
  if (!isReuse && existsSync(ENV_FILE)) {
    // Fresh ids are never chosen while their state exists (e2e/support/env.ts), so this id was set
    // explicitly and is held by a live run or by one that crashed. Tearing it down here would
    // destroy whatever holds it, so the run stops and says how to clear it.
    throw new Error(
      `run ${RUN_ID} already has state in ${STATE_DIR}: a live run or a crashed one holds this id. ` +
        `Pick another HESTIA_E2E_RUN_ID, or clear it with: docker compose -p ${COMPOSE_PROJECT} down --volumes --remove-orphans, then delete ${STATE_DIR}`,
    );
  }

  step(`run ${RUN_ID}, project ${COMPOSE_PROJECT}: starting from an empty database`);
  rmSync(STATE_DIR, { recursive: true, force: true });
  writeEnvFile();
  appendRunEnv(reserveSubnet());

  step('starting Postgres, GoTrue, Realtime, and Kong');
  composeChecked(['up', '--detach', '--wait', ...DATA_SERVICES]);

  const env = readStackEnv();
  const dbUrl = databaseUrl(env);

  // The Compose database applies only the hestia_service role migration on first start; the rest
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
  runChecked('pnpm', ['--filter', '@hestia/service', 'db:seed'], {
    HESTIA_SEED_AUTH_URL: `${BASE_URL}/auth/v1`,
    HESTIA_SEED_SERVICE_ROLE_KEY: env['SERVICE_ROLE_KEY'] ?? '',
    HESTIA_SEED_DB_URL: dbUrl,
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
    step('leaving the stack running (HESTIA_E2E_REUSE_STACK=1)');
    return;
  }
  if (!existsSync(ENV_FILE)) return;
  step('stopping');
  compose(['down', '--volumes', '--remove-orphans']);
  // Compose leaves an external network in place, so the run's own network goes by its name, and
  // the two images it built go by their run-specific tags. Each removal is scoped to this run's
  // name, never a pattern; a failure means there was nothing left to remove.
  runCommand('docker', ['network', 'rm', NETWORK]);
  runCommand('docker', ['image', 'rm', `hestia-service:${IMAGE_TAG}`, `hestia-caddy:${IMAGE_TAG}`]);
  rmSync(STATE_DIR, { recursive: true, force: true });
}
