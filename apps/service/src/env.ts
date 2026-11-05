import {
  DEFAULT_RATE_LIMIT_PER_MINUTE,
  parseServerEnv,
  parseCliEnv as parseCliEnvShared,
  type ServerEnv,
  type CliEnv as ServerCliEnv,
} from '@hestia/shared';

export { DEFAULT_RATE_LIMIT_PER_MINUTE };

export type Env = ServerEnv;
export type CliEnv = ServerCliEnv;

/** Parses the environment, throwing with every problem listed so startup fails fast. */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return parseServerEnv(source);
}

/** The owner CLI needs only GoTrue and the origin, not the database. */
export function parseCliEnv(source: NodeJS.ProcessEnv): CliEnv {
  return parseCliEnvShared(source);
}
