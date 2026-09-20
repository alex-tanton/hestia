import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository root, from this file's location. */
export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Everything a run writes lives here, outside the checkout: the generated `.env` and the backup
 * directory the Compose file mounts. Nothing here is ever committed (Handoff, non-negotiable 4).
 */
export const STATE_DIR = process.env['HEARTH_E2E_STATE_DIR'] ?? join(tmpdir(), 'hearth-e2e');
export const ENV_FILE = join(STATE_DIR, '.env');
export const BACKUP_DIR = join(STATE_DIR, 'backups');

/** The E2E stack's own ports, so a run never collides with a Compose or `supabase start` stack. */
export const BASE_URL = 'http://127.0.0.1:8099';
export const DB_PORT = 54329;

export const COMPOSE_PROJECT = 'hearth-e2e';

/** Seed Data, "Using this data". */
export const SEED_PASSWORD = 'hearth-seed-pass-2026';

/** Seed Data, "Users" and "Households". */
export const SEED = {
  alex: { email: 'alex@example.com', name: 'Alex Rivera' },
  sam: { email: 'sam@example.com', name: 'Sam Chen' },
  jordan: { email: 'jordan@example.com', name: 'Jordan Blake' },
  morgan: { email: 'morgan@example.com', name: 'Morgan Reed' },
  casey: { email: 'casey@example.com', name: 'Casey Nguyen' },
  oakStreet: { name: 'Oak Street', postalCode: '27514' },
  riveraFamily: { name: 'Rivera Family', postalCode: '27601' },
  emptyHouse: { name: 'Empty House', postalCode: '27705' },
  /** Seed Data, "Edge-case fixtures": the outstanding Oak Street invite's code. */
  outstandingInviteCode: 'K7M2Q9XA',
} as const;

export type StackEnv = Readonly<Record<string, string>>;

/** The generated `.env`, which holds the run's throwaway secrets and nothing the repo needs. */
export function readStackEnv(): StackEnv {
  const entries = readFileSync(ENV_FILE, 'utf8')
    .split('\n')
    .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => [match[1], match[2]] as const);
  return Object.fromEntries(entries) as StackEnv;
}

export function databaseUrl(env: StackEnv): string {
  return `postgresql://postgres:${env['POSTGRES_PASSWORD'] ?? ''}@127.0.0.1:${String(DB_PORT)}/postgres`;
}
