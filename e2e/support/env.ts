import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnvFile, runNames } from './run-identity.ts';

/** The repository root, from this file's location. */
export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/*
 * One run's identity is fixed once per process tree. This module is first loaded by the Playwright
 * config in the runner, which writes the values into the environment; the workers, global setup,
 * and global teardown inherit them, so every process in a run addresses the same stack, and two
 * runs on one machine never share one. `HESTIA_E2E_RUN_ID` names a run explicitly, which is how a
 * reused stack is found again.
 */
const STATE_ROOT = process.env['HESTIA_E2E_STATE_DIR'] ?? join(tmpdir(), 'hearth-e2e');

if (
  process.env['HESTIA_E2E_REUSE_STACK'] === '1' &&
  process.env['HESTIA_E2E_RUN_ID'] === undefined
) {
  // A fresh id would name a stack nobody can find again, and the run would leave it running.
  throw new Error(
    'HESTIA_E2E_REUSE_STACK=1 needs HESTIA_E2E_RUN_ID=<id>, the run id the stack printed when it started',
  );
}

/**
 * A random id whose state directory does not exist yet. An id still in use, by a live run or one
 * left behind by a crash, is never chosen, so a fresh run cannot tear down another run's stack.
 */
function freshRunId(stateRoot: string): string {
  for (;;) {
    const id = randomBytes(3).toString('hex');
    if (!existsSync(join(stateRoot, id))) return id;
  }
}

export const RUN_ID = (process.env['HESTIA_E2E_RUN_ID'] ??= freshRunId(STATE_ROOT));
const names = runNames(RUN_ID);
export const COMPOSE_PROJECT = names.project;
export const NETWORK = names.network;
export const IMAGE_TAG = names.imageTag;

/**
 * Everything a run writes lives here, outside the checkout: the generated `.env` and the backup
 * directory the Compose file mounts. Nothing here is ever committed. Each run gets its own
 * directory under the root, so its teardown removes only its own files.
 */
export const STATE_DIR = join(STATE_ROOT, RUN_ID);
export const ENV_FILE = join(STATE_DIR, '.env');
export const BACKUP_DIR = join(STATE_DIR, 'backups');

/*
 * The host ports are free ones picked at run start, not fixed numbers: Caddy's origin and the
 * invite and reset links are built from the port, so it must be known before the stack starts,
 * which rules out letting Docker assign it. A reused stack keeps the ports it was brought up on.
 */
const reused =
  process.env['HESTIA_E2E_REUSE_STACK'] === '1' && existsSync(ENV_FILE)
    ? parseEnvFile(readFileSync(ENV_FILE, 'utf8'))
    : {};
const CADDY_PORT_VALUE = (process.env['HESTIA_E2E_CADDY_PORT'] ??=
  reused['HESTIA_E2E_CADDY_PORT'] ?? freePort());
const DB_PORT_VALUE = (process.env['HESTIA_E2E_DB_PORT'] ??=
  reused['HESTIA_E2E_DB_PORT'] ?? distinctFreePort(CADDY_PORT_VALUE));

/** The E2E stack's own ports, so a run never collides with a Compose or `supabase start` stack. */
export const CADDY_PORT = Number(CADDY_PORT_VALUE);
export const BASE_URL = `http://127.0.0.1:${CADDY_PORT_VALUE}`;
export const DB_PORT = Number(DB_PORT_VALUE);

/**
 * A loopback port the OS has just confirmed free. It is asked for in a child process because this
 * module loads synchronously and Node's socket API is not. Another process could still take the
 * port before Docker binds it; that makes `up` fail loudly, it does not make two runs share a stack.
 */
function freePort(): string {
  const probe =
    "const s=require('node:net').createServer();" +
    "s.listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port));s.close();});";
  return execFileSync(process.execPath, ['-e', probe], { encoding: 'utf8' }).trim();
}

function distinctFreePort(avoid: string): string {
  let port = freePort();
  while (port === avoid) port = freePort();
  return port;
}

/** The password every seed user signs in with. */
export const SEED_PASSWORD = 'hearth-seed-pass-2026';

/** The seed users and households. */
export const SEED = {
  alex: { email: 'alex@example.com', name: 'Alex Rivera' },
  sam: { email: 'sam@example.com', name: 'Sam Chen' },
  jordan: { email: 'jordan@example.com', name: 'Jordan Blake' },
  morgan: { email: 'morgan@example.com', name: 'Morgan Reed' },
  casey: { email: 'casey@example.com', name: 'Casey Nguyen' },
  oakStreet: { name: 'Oak Street', postalCode: '27514' },
  riveraFamily: { name: 'Rivera Family', postalCode: '27601' },
  emptyHouse: { name: 'Empty House', postalCode: '27705' },
  /** The outstanding Oak Street invite's code, an edge-case seed fixture. */
  outstandingInviteCode: 'K7M2Q9XA',
} as const;

export type StackEnv = Readonly<Record<string, string>>;

/** The generated `.env`, which holds the run's throwaway secrets and nothing the repo needs. */
export function readStackEnv(): StackEnv {
  return parseEnvFile(readFileSync(ENV_FILE, 'utf8'));
}

export function databaseUrl(env: StackEnv): string {
  return `postgresql://postgres:${env['POSTGRES_PASSWORD'] ?? ''}@127.0.0.1:${String(DB_PORT)}/postgres`;
}
