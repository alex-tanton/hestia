import { parseClientConfig, type ClientConfig } from '@hestia/shared';

/**
 * Accessor for validated client configuration.
 * Uses dynamic getters so that test overrides (e.g. vi.stubEnv) take effect immediately.
 */
export const config: ClientConfig = {
  get magicLinkEnabled(): boolean {
    return parseClientConfig(import.meta.env).magicLinkEnabled;
  },
  get supabaseAnonKey(): string {
    return parseClientConfig(import.meta.env).supabaseAnonKey;
  },
  get vapidPublicKey(): string {
    return parseClientConfig(import.meta.env).vapidPublicKey;
  },
};
