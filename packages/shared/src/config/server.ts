import { z } from 'zod';
import { RATE_LIMIT_CONFIG } from './constants.js';

const trustedProxies = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );

// GoTrue's internal address: http://auth:9999 on Compose, or Kong's /auth/v1 under `supabase start`.
const gotrueUrl = z.url({ protocol: /^https?$/ }).transform((value) => value.replace(/\/+$/, ''));

// The public origin, https://hestia.aberrance.app; invite and reset links are built on it.
const origin = z.url({ protocol: /^https?$/ }).transform((value) => new URL(value).origin);

function isContactUri(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'mailto:') {
      return z.email().safeParse(url.pathname).success;
    }
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const serverEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  // Comma-separated addresses or CIDRs (the Compose network's subnet in production).
  // Empty means no proxy is trusted, so X-Forwarded-For is ignored.
  HESTIA_TRUSTED_PROXIES: trustedProxies,
  HESTIA_ORIGIN: origin,
  // Unset means nobody is the server owner, so System health is closed to everyone.
  HESTIA_OWNER_EMAIL: z.string().trim().default(''),
  // Requests per minute per client IP across `/api/*`. Must stay a positive integer.
  HESTIA_RATE_LIMIT_PER_MINUTE: z.coerce
    .number()
    .int()
    .min(1)
    .default(RATE_LIMIT_CONFIG.DEFAULT_PER_MINUTE),
  GOTRUE_URL: gotrueUrl,
  // GoTrue's HS256 secret: verifies access tokens.
  JWT_SECRET: z.string().min(32),
  // Sent as `apikey` on calls to GoTrue, which Kong requires under `supabase start`.
  ANON_KEY: z.string().min(1),
  // For the sanctioned service-role uses only.
  SERVICE_ROLE_KEY: z.string().min(1),
  // Where the backup container writes; System health reports the newest file's time.
  BACKUP_DIR: z.string().min(1).optional(),
  /*
   * Unset in every real deployment, so production always calls the live Flipp endpoint. The E2E
   * Compose overlay mounts the checked-in raw captures read-only and points the wrapper at them.
   */
  HESTIA_FLIPP_FIXTURE_DIR: z.string().min(1).optional(),
  // The fixture captures' own instant (`FIXTURE_NOW`).
  HESTIA_FLIPP_FIXTURE_NOW: z.coerce.date().optional(),
  /*
   * Unset in every real deployment, so production always fetches a pasted recipe URL for real.
   */
  HESTIA_RECIPE_FIXTURE_DIR: z.string().min(1).optional(),
  /*
   * Web Push key pair and contact URI (RFC 8292).
   */
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().min(1).refine(isContactUri, {
    message: 'VAPID_SUBJECT must be a mailto: or https: URI',
  }),
  /*
   * Which transport the dispatch job sends through (`web-push` in real deployments; `test-double` in E2E).
   */
  HESTIA_PUSH_TRANSPORT: z.enum(['web-push', 'test-double']).default('web-push'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function parse<T extends z.ZodType>(schema: T, source: NodeJS.ProcessEnv): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Parses the backend server environment, throwing with every problem listed so startup fails fast. */
export function parseServerEnv(source: NodeJS.ProcessEnv): ServerEnv {
  return parse(serverEnvSchema, source);
}

export const cliEnvSchema = serverEnvSchema
  .pick({
    HESTIA_ORIGIN: true,
    GOTRUE_URL: true,
    SERVICE_ROLE_KEY: true,
  })
  .extend({
    DATABASE_URL: z.string().min(1).optional(),
    VAPID_PUBLIC_KEY: z.string().min(1).optional(),
    VAPID_PRIVATE_KEY: z.string().min(1).optional(),
    VAPID_SUBJECT: z.string().min(1).optional(),
  });

export type CliEnv = z.infer<typeof cliEnvSchema>;

/** The owner CLI needs only GoTrue and the origin, not the database. */
export function parseCliEnv(source: NodeJS.ProcessEnv): CliEnv {
  return parse(cliEnvSchema, source);
}
