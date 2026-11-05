/**
 * Seeds a development database: creates the five seed users through GoTrue's admin API, which fires
 * the profile trigger exactly as a real signup does, then applies seed.sql with psql, computes
 * recipe readiness for Oak Street and Rivera Family, and prints the outstanding Oak Street invite.
 *
 *   pnpm db:seed
 *
 * Defaults target `supabase start`. For the Compose stack, point it at Caddy and the db container:
 *
 *   HESTIA_SEED_AUTH_URL   GoTrue through Kong (default http://127.0.0.1:54321/auth/v1)
 *   HESTIA_SEED_SERVICE_ROLE_KEY   the service-role key (default: from `supabase status`)
 *   HESTIA_SEED_DB_URL     Postgres as postgres (default the supabase start database)
 *
 * Users that already exist are left alone; seed.sql refuses to run twice, so reset the database
 * (`supabase db reset`) to seed again. It refuses any target that has users other than the seed
 * users, which every production stack does.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { TEST_CONFIG } from '@hestia/shared';
import pg from 'pg';
import { recomputeReadinessForHousehold } from './compute-readiness.js';

const SEED_PASSWORD = TEST_CONFIG.SEED_PASSWORD;

const USERS = [
  { email: 'alex@example.com', displayName: 'Alex Rivera', timezone: 'America/New_York' },
  { email: 'sam@example.com', displayName: 'Sam Chen', timezone: 'America/New_York' },
  { email: 'jordan@example.com', displayName: 'Jordan Blake', timezone: 'America/New_York' },
  { email: 'morgan@example.com', displayName: 'Morgan Reed', timezone: 'America/Chicago' },
  { email: 'casey@example.com', displayName: 'Casey Nguyen', timezone: 'America/Los_Angeles' },
] as const;

const authUrl = process.env['HESTIA_SEED_AUTH_URL'] ?? TEST_CONFIG.DEFAULT_DEV_AUTH_URL;
const dbUrl = process.env['HESTIA_SEED_DB_URL'] ?? TEST_CONFIG.DEFAULT_DEV_DATABASE_URL;

function serviceRoleKey(): string {
  const fromEnv = process.env['HESTIA_SEED_SERVICE_ROLE_KEY'];
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  const status = execFileSync('supabase', ['status', '--output', 'env'], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const match = /^SERVICE_ROLE_KEY="?([^"\n]+)"?$/m.exec(status);
  if (match?.[1] === undefined) {
    throw new Error('set HESTIA_SEED_SERVICE_ROLE_KEY, or run `supabase start` first');
  }
  return match[1];
}

async function createUser(key: string, user: (typeof USERS)[number]): Promise<void> {
  const response = await fetch(`${authUrl}/admin/users`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: user.displayName, timezone: user.timezone },
    }),
  });
  if (response.ok) {
    console.log(`created ${user.email}`);
    return;
  }
  const body = await response.text();
  if (response.status === 422 && body.includes('email_exists')) {
    console.log(`exists  ${user.email}`);
    return;
  }
  throw new Error(`creating ${user.email} failed: ${String(response.status)} ${body}`);
}

const SEED_EMAILS: ReadonlySet<string> = new Set(USERS.map((user) => user.email));

/**
 * Refuses unless both targets hold nobody but the seed users. A production stack always has its
 * owner's account, so this stops a mistyped URL or a production .env from adding users whose
 * password is published here. Both are checked because users go to GoTrue and data to Postgres.
 */
async function refuseUnlessDevelopment(key: string): Promise<void> {
  const response = await fetch(`${authUrl}/admin/users?per_page=100`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) {
    throw new Error(`listing users failed: ${String(response.status)} ${await response.text()}`);
  }
  const { users = [] } = (await response.json()) as { users?: { email?: string }[] };
  const authHasOthers = users.some((user) => !SEED_EMAILS.has(user.email ?? ''));

  const seedList = [...SEED_EMAILS].map((email) => `'${email}'`).join(', ');
  const dbOthers = execFileSync(
    'psql',
    [
      dbUrl,
      '--no-psqlrc',
      '--tuples-only',
      '--no-align',
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      `select count(*) from auth.users where email is null or email not in (${seedList})`,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  ).trim();

  if (authHasOthers || dbOthers !== '0') {
    throw new Error(
      'refusing to seed: the target has users other than the seed users, so it is not a fresh ' +
        'development database',
    );
  }
}

async function main(): Promise<void> {
  const key = serviceRoleKey();
  await refuseUnlessDevelopment(key);
  for (const user of USERS) await createUser(key, user);

  // The service generates link tokens the same way: 32 random bytes, base64url.
  const inviteToken = randomBytes(32).toString('base64url');
  execFileSync(
    'psql',
    [
      dbUrl,
      '--quiet',
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--set',
      `invite_token=${inviteToken}`,
      '--file',
      fileURLToPath(new URL('./seed.sql', import.meta.url)),
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );

  console.log('seeded households, members, favorites, notification settings, and invites');

  // Readiness is derived data: computed here, not hand-written into seed.sql, so it is always the
  // real matcher's own output for the seeded pantry, deals, and overrides — the strongest check
  // that the matching rules and the fixtures agree.
  const pool = new pg.Pool({ connectionString: dbUrl });
  try {
    const { rows } = await pool.query<{ id: string; name: string }>(
      `select id, name from public.household where name in ('Oak Street', 'Rivera Family')`,
    );
    for (const household of rows) {
      await recomputeReadinessForHousehold(pool, household.id);
    }
    console.log(`computed readiness for ${String(rows.length)} household(s)`);
  } finally {
    await pool.end();
  }

  console.log(`every seed user's password: ${SEED_PASSWORD}`);
  console.log('Oak Street invite (outstanding): code K7M2Q9XA');
  console.log(`Oak Street invite (outstanding): link token ${inviteToken}`);
}

try {
  await main();
} catch (error) {
  // psql has already printed its own error (for example "already seeded").
  console.error(error instanceof Error ? error.message.split('\n')[0] : error);
  process.exitCode = 1;
}
