import { describe, expect, it } from 'vitest';
import {
  AUTH_CONFIG,
  RATE_LIMIT_CONFIG,
  TEST_CONFIG,
  parseClientConfig,
  parseServerEnv,
  parseCliEnv,
} from './index.js';

describe('shared configuration', () => {
  describe('constants', () => {
    it('defines expected auth policy values', () => {
      expect(AUTH_CONFIG.PASSWORD_MIN_LENGTH).toBe(8);
      expect(AUTH_CONFIG.PASSWORD_MAX_LENGTH).toBe(72);
      expect(AUTH_CONFIG.JWT_EXPIRY_SECONDS).toBe(3600);
      expect(AUTH_CONFIG.OTP_LENGTH).toBe(6);
      expect(AUTH_CONFIG.OTP_EXPIRY_SECONDS).toBe(900);
    });

    it('defines expected rate limit constants', () => {
      expect(RATE_LIMIT_CONFIG.DEFAULT_PER_MINUTE).toBe(300);
      expect(RATE_LIMIT_CONFIG.E2E_OVERLAY_PER_MINUTE).toBe(3000);
    });

    it('defines expected test constants', () => {
      expect(TEST_CONFIG.SEED_PASSWORD).toBe('hestia-seed-pass-2026');
      expect(TEST_CONFIG.DEFAULT_TEST_NOW).toBe('2026-10-14T12:00:00.000Z');
    });
  });

  describe('parseClientConfig', () => {
    it('parses canonical HESTIA_PUBLIC_* keys', () => {
      const config = parseClientConfig({
        HESTIA_PUBLIC_MAGIC_LINK_ENABLED: 'true',
        HESTIA_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
        HESTIA_PUBLIC_VAPID_KEY: 'test-vapid-key',
      });

      expect(config).toEqual({
        magicLinkEnabled: true,
        supabaseAnonKey: 'test-anon-key',
        vapidPublicKey: 'test-vapid-key',
      });
    });

    it('ignores legacy VITE_* keys without fallbacks', () => {
      const config = parseClientConfig({
        VITE_MAGIC_LINK_ENABLED: 'true',
        VITE_SUPABASE_ANON_KEY: 'legacy-anon-key',
        VITE_VAPID_PUBLIC_KEY: 'legacy-vapid-key',
      });

      expect(config).toEqual({
        magicLinkEnabled: false,
        supabaseAnonKey: '',
        vapidPublicKey: '',
      });
    });

    it('treats 1, true, and "true" as enabled', () => {
      expect(
        parseClientConfig({
          HESTIA_PUBLIC_MAGIC_LINK_ENABLED: '1',
          HESTIA_PUBLIC_SUPABASE_ANON_KEY: 'k',
        }).magicLinkEnabled,
      ).toBe(true);

      expect(
        parseClientConfig({
          HESTIA_PUBLIC_MAGIC_LINK_ENABLED: true,
          HESTIA_PUBLIC_SUPABASE_ANON_KEY: 'k',
        }).magicLinkEnabled,
      ).toBe(true);

      expect(
        parseClientConfig({
          HESTIA_PUBLIC_MAGIC_LINK_ENABLED: 'false',
          HESTIA_PUBLIC_SUPABASE_ANON_KEY: 'k',
        }).magicLinkEnabled,
      ).toBe(false);

      expect(
        parseClientConfig({
          HESTIA_PUBLIC_SUPABASE_ANON_KEY: 'k',
        }).magicLinkEnabled,
      ).toBe(false);
    });

    it('defaults anon key and vapid key to empty string when not provided', () => {
      const config = parseClientConfig({});
      expect(config.magicLinkEnabled).toBe(false);
      expect(config.supabaseAnonKey).toBe('');
      expect(config.vapidPublicKey).toBe('');
    });
  });

  describe('parseServerEnv & parseCliEnv', () => {
    const validRequired = {
      DATABASE_URL: 'postgres://user:pass@localhost:5432/postgres',
      HESTIA_ORIGIN: 'https://hestia.aberrance.app',
      GOTRUE_URL: 'http://auth:9999',
      JWT_SECRET: 'a'.repeat(32),
      HESTIA_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      SERVICE_ROLE_KEY: 'service-key',
      HESTIA_PUBLIC_VAPID_KEY: 'vapid-pub',
      VAPID_PRIVATE_KEY: 'vapid-priv',
      VAPID_SUBJECT: 'mailto:admin@aberrance.app',
    };

    it('parses valid server environment with defaults', () => {
      const env = parseServerEnv(validRequired);
      expect(env.HOST).toBe('0.0.0.0');
      expect(env.PORT).toBe(3000);
      expect(env.LOG_LEVEL).toBe('info');
      expect(env.HESTIA_RATE_LIMIT_PER_MINUTE).toBe(RATE_LIMIT_CONFIG.DEFAULT_PER_MINUTE);
      expect(env.HESTIA_PUSH_TRANSPORT).toBe('web-push');
    });

    it('parses CLI env requiring only origin, gotrue, and service key', () => {
      const cliEnv = parseCliEnv({
        HESTIA_ORIGIN: 'https://hestia.aberrance.app',
        GOTRUE_URL: 'http://auth:9999',
        SERVICE_ROLE_KEY: 'service-key',
      });
      expect(cliEnv.HESTIA_ORIGIN).toBe('https://hestia.aberrance.app');
      expect(cliEnv.GOTRUE_URL).toBe('http://auth:9999');
      expect(cliEnv.SERVICE_ROLE_KEY).toBe('service-key');
    });
  });
});
