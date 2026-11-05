import { z } from 'zod';

export const clientConfigSchema = z.object({
  magicLinkEnabled: z.boolean().default(false),
  supabaseAnonKey: z.string().default(''),
  vapidPublicKey: z.string().default(''),
});

export type ClientConfig = z.infer<typeof clientConfigSchema>;

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    return trimmed === 'true' || trimmed === '1';
  }
  return false;
}

/**
 * Validates and normalizes client environment strictly from canonical HESTIA_PUBLIC_* keys.
 * No legacy fallbacks are permitted.
 */
export function parseClientConfig(source: Record<string, unknown> = {}): ClientConfig {
  const magicLinkValue = source['HESTIA_PUBLIC_MAGIC_LINK_ENABLED'];
  const anonKeyValue = source['HESTIA_PUBLIC_SUPABASE_ANON_KEY'] ?? '';
  const vapidPublicKeyValue = source['HESTIA_PUBLIC_VAPID_KEY'] ?? '';

  return clientConfigSchema.parse({
    magicLinkEnabled: toBoolean(magicLinkValue),
    supabaseAnonKey: typeof anonKeyValue === 'string' ? anonKeyValue.trim() : '',
    vapidPublicKey: typeof vapidPublicKeyValue === 'string' ? vapidPublicKeyValue.trim() : '',
  });
}
