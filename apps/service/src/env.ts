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

// The public origin, https://<machine>.<tailnet>.ts.net; invite and reset links are built on it.
const origin = z.url({ protocol: /^https?$/ }).transform((value) => new URL(value).origin);

/**
 * The per-IP ceiling on `/api/*` (Technical Architecture, "Rate limits"). Production keeps this;
 * only the E2E overlay raises it, because every loopback request shares one client address.
 */
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 300;

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  // Comma-separated addresses or CIDRs (the Compose network's subnet in production).
  // Empty means no proxy is trusted, so X-Forwarded-For is ignored.
  HEARTH_TRUSTED_PROXIES: trustedProxies,
  HEARTH_ORIGIN: origin,
  // Unset means nobody is the server owner, so System health is closed to everyone.
  HEARTH_OWNER_EMAIL: z.string().trim().default(''),
  // Requests per minute per client IP across `/api/*`. Must stay a positive integer; a value of 0
  // would refuse everything, so it is rejected rather than read as "off".
  HEARTH_RATE_LIMIT_PER_MINUTE: z.coerce
    .number()
    .int()
    .min(1)
    .default(DEFAULT_RATE_LIMIT_PER_MINUTE),
  GOTRUE_URL: gotrueUrl,
  // GoTrue's HS256 secret: verifies access tokens.
  JWT_SECRET: z.string().min(32),
  // Sent as `apikey` on calls to GoTrue, which Kong requires under `supabase start`.
  ANON_KEY: z.string().min(1),
  // For the sanctioned service-role uses only (Technical Architecture, "The RLS rule").
  SERVICE_ROLE_KEY: z.string().min(1),
  // Where the backup container writes; System health reports the newest file's time.
  BACKUP_DIR: z.string().min(1).optional(),
  /*
   * Unset in every real deployment, so production always calls the live Flipp endpoint (Technical
   * Architecture, "Development"). The E2E Compose overlay is the one caller that sets both: it
   * mounts the checked-in raw captures read-only and points the wrapper at them, which is what
   * keeps "tests never make live calls" (Handoff non-negotiable 17) true for the built image the
   * E2E suite runs, not only for Vitest's in-process doubles.
   */
  HEARTH_FLIPP_FIXTURE_DIR: z.string().min(1).optional(),
  // The fixture captures' own instant (`FIXTURE_NOW`), so the wrapper's active-flyer window
  // matches what the captures actually cover regardless of the host's real clock.
  HEARTH_FLIPP_FIXTURE_NOW: z.coerce.date().optional(),
  /*
   * Unset in every real deployment, so production always fetches a pasted recipe URL for real
   * (Technical Architecture, "Recipe fetching"). The E2E Compose overlay is the one caller that
   * sets it: `fetchRecipePage`'s private/loopback/link-local refusal would just as correctly
   * refuse a fixture server reachable only on the Compose network, so the E2E recipe-import
   * journey (Handoff, Phase 3 "Done when") swaps the fetch step itself for reading the checked-in
   * pages this points at, the same way `HEARTH_FLIPP_FIXTURE_DIR` swaps the Flipp transport.
   */
  HEARTH_RECIPE_FIXTURE_DIR: z.string().min(1).optional(),
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

const cliEnvSchema = envSchema.pick({
  HEARTH_ORIGIN: true,
  GOTRUE_URL: true,
  SERVICE_ROLE_KEY: true,
});

export type CliEnv = z.infer<typeof cliEnvSchema>;

/** The owner CLI needs only GoTrue and the origin, not the database. */
export function parseCliEnv(source: NodeJS.ProcessEnv): CliEnv {
  return parse(cliEnvSchema, source);
}
