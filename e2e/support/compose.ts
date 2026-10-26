import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { COMPOSE_PROJECT, ENV_FILE, IMAGE_TAG, REPO_ROOT } from './env.ts';

/**
 * The E2E stack is docker/docker-compose.yml with e2e/docker-compose.e2e.yml over it, under its
 * own project name.
 */
const COMPOSE_FILES = [
  join(REPO_ROOT, 'docker', 'docker-compose.yml'),
  join(REPO_ROOT, 'e2e', 'docker-compose.e2e.yml'),
];

export interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

export function runCommand(
  command: string,
  args: readonly string[],
  env: Record<string, string> = {},
): CommandResult {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

/** Throws with the command's own output, which is what says why a bring-up failed. */
export function runChecked(
  command: string,
  args: readonly string[],
  env: Record<string, string> = {},
): string {
  const result = runCommand(command, args, env);
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} exited ${String(result.status)}\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result.stdout;
}

export function composeArgs(args: readonly string[]): string[] {
  const files = COMPOSE_FILES.flatMap((file) => ['-f', file]);
  return ['compose', '-p', COMPOSE_PROJECT, '--env-file', ENV_FILE, ...files, ...args];
}

// The run's own image tag: the `current` images a Compose stack on this machine runs are left
// alone, and a concurrent run's build cannot replace the images this run is about to start.
export function compose(args: readonly string[]): CommandResult {
  return runCommand('docker', composeArgs(args), { HESTIA_TAG: IMAGE_TAG });
}

export function composeChecked(args: readonly string[]): string {
  return runChecked('docker', composeArgs(args), { HESTIA_TAG: IMAGE_TAG });
}
