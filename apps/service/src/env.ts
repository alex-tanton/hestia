import { z } from 'zod';

const trustedProxies = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );

// GoTrue's internal address: http://auth:9999 on the Compose network, or Kong's /auth/v1 under
// `supabase start`. A trailing slash is dropped so paths can be appended.
const gotrueUrl = z.url({ protocol: /^https?$/ }).transform((value) => value.replace(/\/+$/, ''));

// The public origin, https://hestia.aberrance.app; invite and reset links are built on it.
const origin = z.url({ protocol: /^https?$/ }).transform((value) => new URL(value).origin);

/**
 * The per-IP ceiling on `/api/*`. Production keeps this; only the E2E overlay raises it, because
 * every loopback request shares one client address.
 */
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 300;

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

const envSchema = z.object({
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
  // Requests per minute per client IP across `/api/*`. Must stay a positive integer; a value of 0
  // would refuse everything, so it is rejected rather than read as "off".
  HESTIA_RATE_LIMIT_PER_MINUTE: z.coerce
    .number()
    .int()
    .min(1)
    .default(DEFAULT_RATE_LIMIT_PER_MINUTE),
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
   * Compose overlay is the one caller that sets both: it
   * mounts the checked-in raw captures read-only and points the wrapper at them, which is what
   * keeps "tests never make live calls" true for the built image the E2E suite runs, not only for
   * Vitest's in-process doubles.
   */
  HESTIA_FLIPP_FIXTURE_DIR: z.string().min(1).optional(),
  // The fixture captures' own instant (`FIXTURE_NOW`), so the wrapper's active-flyer window
  // matches what the captures actually cover regardless of the host's real clock.
  HESTIA_FLIPP_FIXTURE_NOW: z.coerce.date().optional(),
  /*
   * Unset in every real deployment, so production always fetches a pasted recipe URL for real.
   * The E2E Compose overlay is the one caller that sets it: `fetchRecipePage`'s
   * private/loopback/link-local refusal would just as correctly refuse a fixture server reachable
   * only on the Compose network, so the E2E recipe-import journey swaps the fetch step itself for
   * reading the checked-in pages this points at, the same way `HESTIA_FLIPP_FIXTURE_DIR` swaps the
   * Flipp transport.
   */
  HESTIA_RECIPE_FIXTURE_DIR: z.string().min(1).optional(),
  /*
   * Web Push. The dispatch job is scheduled in every service process, so the key pair is required
   * at startup rather than failing on the first send. Both match the names docker-compose.yml
   * passes through from the host's .env.
   */
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  // The contact URI sent in each push request's VAPID claims (RFC 8292). Must be mailto: or https:
  VAPID_SUBJECT: z.string().min(1).refine(isContactUri, {
    message: 'VAPID_SUBJECT must be a mailto: or https: URI',
  }),
  /*
   * Which transport the dispatch job sends through. `web-push` is the only value a real deployment
   * sees: docker-compose.yml passes the service's environment through by name and never forwards
   * this one, so only the E2E Compose overlay can select `test-double`. That transport records each
   * push for the suite to read and contacts no push service. Any other value fails at startup
   * rather than falling back to either transport.
   */
  HESTIA_PUSH_TRANSPORT: z.enum(['web-push', 'test-double']).default('web-push'),
});

export type Env = z.infer<typeof envSchema>;

function parse<T extends z.ZodType>(schema: T, source: NodeJS.ProcessEnv): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Parses the environment, throwing with every problem listed so startup fails fast. */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return parse(envSchema, source);
}

const cliEnvSchema = envSchema
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
