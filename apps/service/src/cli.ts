import { pathToFileURL } from 'node:url';
import { pushKeysSchema } from '@hestia/shared';
import { sql } from 'kysely';
import { z } from 'zod';
import { createDatabase, type DatabaseHandle } from './db.js';
import { parseCliEnv } from './env.js';
import { GoTrueError } from './gotrue/http.js';
import type { PushTransport } from './jobs/dispatch-notifications.js';
import { createGoTrueAdmin, type GoTrueAdmin } from './privileged/gotrue-admin.js';
import { withServiceRoleDb } from './privileged/service-role-db.js';
import { createWebPushTransport } from './push/web-push-transport.js';

/**
 * hestia-admin, the owner CLI:
 *
 *   docker compose exec hestia-service hestia-admin reset-password <email>
 *   docker compose exec hestia-service hestia-admin test-push --email <email> [--title <title>] [--body <body>]
 *
 * Prints a one-time recovery link or dispatches a test push notification to user devices.
 * Sanctioned service-role uses.
 */

/** Where GoTrue's /verify sends a recovery link, with the session in the fragment. */
export const SET_PASSWORD_PATH = '/set-password';

const RESET_USAGE = 'Usage: hestia-admin reset-password <email>';
const PUSH_USAGE =
  'Usage: hestia-admin test-push --email <email> [--title <title>] [--body <body>]';
const GENERAL_USAGE = `Usage:\n  hestia-admin reset-password <email>\n  hestia-admin test-push --email <email> [--title <title>] [--body <body>]`;

export interface CliIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

export interface PushSubscriptionTarget {
  id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushOps {
  lookupUser: (email: string) => Promise<{ id: string } | undefined>;
  listSubscriptions: (userId: string) => Promise<PushSubscriptionTarget[]>;
  deleteSubscription: (id: string) => Promise<void>;
  transport: PushTransport;
}

export async function runCli(
  args: readonly string[],
  admin: Pick<GoTrueAdmin, 'recoveryLink'>,
  origin: string,
  io: CliIo,
  pushOps?: PushOps,
): Promise<number> {
  const [command, ...rest] = args;
  if (command === 'reset-password') {
    const [email, ...extra] = rest;
    if (email === undefined || extra.length > 0) {
      io.err(RESET_USAGE);
      return 2;
    }
    if (!z.email().safeParse(email).success) {
      io.err(`Not an email address: ${email}`);
      return 2;
    }
    try {
      const link = await admin.recoveryLink(email, `${origin}${SET_PASSWORD_PATH}`);
      io.out(link);
      io.err('One-time link; it expires in an hour. Hand it over in person.');
      return 0;
    } catch (error) {
      if (error instanceof GoTrueError && error.status === 404) {
        io.err(`No user has the email ${email}.`);
      } else if (error instanceof GoTrueError) {
        io.err(`GoTrue refused: ${String(error.status)} ${error.message}`);
      } else {
        io.err(
          `Could not create the link: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return 1;
    }
  }

  if (command === 'test-push') {
    if (!pushOps) {
      io.err('Push operations are not configured.');
      return 1;
    }
    let email: string | undefined;
    let title = 'Test Push Notification';
    let body = 'This is a test notification from Hestia.';

    for (let i = 0; i < rest.length; i++) {
      const arg = rest[i];
      const next = rest[i + 1];
      if (arg === '--email' && next !== undefined) {
        email = next;
        i++;
      } else if (arg === '--title' && next !== undefined) {
        title = next;
        i++;
      } else if (arg === '--body' && next !== undefined) {
        body = next;
        i++;
      } else {
        io.err(PUSH_USAGE);
        return 2;
      }
    }

    if (!email) {
      io.err(PUSH_USAGE);
      return 2;
    }
    if (!z.email().safeParse(email).success) {
      io.err(`Not an email address: ${email}`);
      return 2;
    }

    const user = await pushOps.lookupUser(email);
    if (!user) {
      io.err(`No user has the email ${email}.`);
      return 1;
    }

    const subscriptions = await pushOps.listSubscriptions(user.id);
    if (subscriptions.length === 0) {
      io.err(`User ${email} has no active push subscriptions.`);
      return 1;
    }

    const payload = JSON.stringify({ title, body, url: '/' });
    let accepted = 0;
    let gone = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      const outcome = await pushOps.transport.send(sub, payload);
      if (outcome.kind === 'accepted') {
        accepted++;
      } else if (outcome.kind === 'gone') {
        gone++;
        await pushOps.deleteSubscription(sub.id);
      } else {
        failed++;
      }
    }

    io.out(
      `Dispatched test push to ${String(subscriptions.length)} device(s) for ${email}: ${String(accepted)} accepted, ${String(gone)} gone, ${String(failed)} failed.`,
    );
    return 0;
  }

  io.err(GENERAL_USAGE);
  return 2;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const env = parseCliEnv(process.env);
  const admin = createGoTrueAdmin({ url: env.GOTRUE_URL, serviceRoleKey: env.SERVICE_ROLE_KEY });
  let pushOps: PushOps | undefined;
  let dbHandle: DatabaseHandle | undefined;

  if (process.argv[2] === 'test-push') {
    if (
      !env.DATABASE_URL ||
      !env.VAPID_PUBLIC_KEY ||
      !env.VAPID_PRIVATE_KEY ||
      !env.VAPID_SUBJECT
    ) {
      process.stderr.write('Missing required environment variables for test-push.\n');
      process.exit(1);
    }
    const handle = createDatabase(env.DATABASE_URL);
    dbHandle = handle;
    const transport = createWebPushTransport({
      subject: env.VAPID_SUBJECT,
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
    });
    pushOps = {
      lookupUser: async (email) => {
        const { rows } = await withServiceRoleDb(handle.db, (trx) =>
          sql<{
            id: string;
          }>`select id from public.profile where lower(email) = lower(${email})`.execute(trx),
        );
        return rows[0];
      },
      listSubscriptions: async (userId) => {
        const { rows } = await withServiceRoleDb(handle.db, (trx) =>
          sql<{ id: string; endpoint: string; keys: unknown }>`
            select id, endpoint, keys from public.push_subscription where user_id = ${userId}::uuid order by created_at, endpoint
          `.execute(trx),
        );
        const valid: PushSubscriptionTarget[] = [];
        for (const row of rows) {
          const parsed = pushKeysSchema.safeParse(row.keys);
          if (parsed.success) valid.push({ id: row.id, endpoint: row.endpoint, keys: parsed.data });
        }
        return valid;
      },
      deleteSubscription: async (id) => {
        await withServiceRoleDb(handle.db, (trx) =>
          sql`delete from public.push_subscription where id = ${id}::uuid`.execute(trx),
        );
      },
      transport,
    };
  }

  try {
    process.exitCode = await runCli(
      process.argv.slice(2),
      admin,
      env.HESTIA_ORIGIN,
      {
        out: (line) => {
          process.stdout.write(`${line}\n`);
        },
        err: (line) => {
          process.stderr.write(`${line}\n`);
        },
      },
      pushOps,
    );
  } finally {
    if (dbHandle) await dbHandle.close();
  }
}
