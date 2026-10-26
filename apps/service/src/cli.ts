import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { parseCliEnv } from './env.js';
import { GoTrueError } from './gotrue/http.js';
import { createGoTrueAdmin, type GoTrueAdmin } from './privileged/gotrue-admin.js';

/**
 * hestia-admin, the owner CLI:
 *
 *   docker compose exec hestia-service hestia-admin reset-password <email>
 *
 * Prints a one-time recovery link that opens the PWA's set-new-password screen. One of the
 * sanctioned service-role uses.
 */

/** Where GoTrue's /verify sends a recovery link, with the session in the fragment. */
export const SET_PASSWORD_PATH = '/set-password';

const USAGE = 'Usage: hestia-admin reset-password <email>';

export interface CliIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

export async function runCli(
  args: readonly string[],
  admin: Pick<GoTrueAdmin, 'recoveryLink'>,
  origin: string,
  io: CliIo,
): Promise<number> {
  const [command, email, ...rest] = args;
  if (command !== 'reset-password' || email === undefined || rest.length > 0) {
    io.err(USAGE);
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

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const env = parseCliEnv(process.env);
  const admin = createGoTrueAdmin({ url: env.GOTRUE_URL, serviceRoleKey: env.SERVICE_ROLE_KEY });
  process.exitCode = await runCli(process.argv.slice(2), admin, env.HESTIA_ORIGIN, {
    out: (line) => {
      process.stdout.write(`${line}\n`);
    },
    err: (line) => {
      process.stderr.write(`${line}\n`);
    },
  });
}
