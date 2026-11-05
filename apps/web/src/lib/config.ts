import { parseClientConfig, type ClientConfig } from '@hestia/shared';

function readClientConfig(): ClientConfig {
  return parseClientConfig({
    HESTIA_PUBLIC_MAGIC_LINK_ENABLED: import.meta.env.HESTIA_PUBLIC_MAGIC_LINK_ENABLED,
    HESTIA_PUBLIC_SUPABASE_ANON_KEY: import.meta.env.HESTIA_PUBLIC_SUPABASE_ANON_KEY,
    HESTIA_PUBLIC_VAPID_KEY: import.meta.env.HESTIA_PUBLIC_VAPID_KEY,
  });
}

/**
 * Accessor for validated client configuration.
 * Uses dynamic getters so that test overrides (e.g. vi.stubEnv) take effect immediately.
 */
export const config: ClientConfig = {
  get magicLinkEnabled(): boolean {
    return readClientConfig().magicLinkEnabled;
  },
  get supabaseAnonKey(): string {
    return readClientConfig().supabaseAnonKey;
  },
  get vapidPublicKey(): string {
    return readClientConfig().vapidPublicKey;
  },
};
