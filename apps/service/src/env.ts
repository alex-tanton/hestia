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
  GOTRUE_URL: gotrueUrl,
  // GoTrue's HS256 secret: verifies access tokens.
  JWT_SECRET: z.string().min(32),
  // Sent as `apikey` on calls to GoTrue, which Kong requires under `supabase start`.
  ANON_KEY: z.string().min(1),
  // For the sanctioned service-role uses only (Technical Architecture, "The RLS rule").
  SERVICE_ROLE_KEY: z.string().min(1),
  // Where the backup container writes; System health reports the newest file's time.
  BACKUP_DIR: z.string().min(1).optional(),
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
