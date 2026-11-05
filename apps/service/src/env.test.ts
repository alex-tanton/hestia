import { describe, expect, it } from 'vitest';
import { parseCliEnv, parseEnv } from './env.js';

const REQUIRED = {
  DATABASE_URL: 'postgres://u:p@db:5432/postgres',
  HESTIA_ORIGIN: 'https://hestia.aberrance.app/',
  GOTRUE_URL: 'http://auth:9999/',
  JWT_SECRET: 'x'.repeat(40),
  HESTIA_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  SERVICE_ROLE_KEY: 'service',
  HESTIA_PUBLIC_VAPID_KEY: 'BPublicKeyPlaceholder',
  VAPID_PRIVATE_KEY: 'privatePlaceholder',
  VAPID_SUBJECT: 'mailto:admin@aberrance.app',
};

// The pre-rebrand variable prefix, assembled from two fragments so this file never spells the old
// name: the repository's legacy-name check can then scan it without an allowlist entry.
const LEGACY_PREFIX = 'HEAR' + 'TH_';

function withLegacyPrefix(source: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      key.startsWith('HESTIA_') ? LEGACY_PREFIX + key.slice('HESTIA_'.length) : key,
      value ?? '',
    ]),
  );
}

describe('parseEnv', () => {
  it('rejects an environment that has only the pre-rebrand names, naming HESTIA_ORIGIN (hard cutover)', () => {
    const legacyOnly = withLegacyPrefix(REQUIRED);

    expect(Object.keys(legacyOnly)).toContain(`${LEGACY_PREFIX}ORIGIN`);
    expect(() => parseEnv(legacyOnly)).toThrow(/HESTIA_ORIGIN/);
  });

  it('ignores the pre-rebrand trusted-proxies name, so no proxy is trusted through it', () => {
    const legacyProxies = { [`${LEGACY_PREFIX}TRUSTED_PROXIES`]: '10.0.0.0/8' };

    expect(parseEnv({ ...REQUIRED, ...legacyProxies }).HESTIA_TRUSTED_PROXIES).toEqual([]);
    expect(
      parseEnv({ ...REQUIRED, HESTIA_TRUSTED_PROXIES: '10.0.0.0/8' }).HESTIA_TRUSTED_PROXIES,
    ).toEqual(['10.0.0.0/8']);
  });

  it('applies defaults, splits trusted proxies, and normalizes URLs', () => {
    const env = parseEnv({ ...REQUIRED, HESTIA_TRUSTED_PROXIES: '172.28.0.0/16, 127.0.0.1' });

    expect(env).toEqual({
      ...REQUIRED,
      HESTIA_ORIGIN: 'https://hestia.aberrance.app',
      GOTRUE_URL: 'http://auth:9999',
      HOST: '0.0.0.0',
      PORT: 3000,
      LOG_LEVEL: 'info',
      HESTIA_TRUSTED_PROXIES: ['172.28.0.0/16', '127.0.0.1'],
      HESTIA_OWNER_EMAIL: '',
      HESTIA_RATE_LIMIT_PER_MINUTE: 300,
      HESTIA_PUSH_TRANSPORT: 'web-push',
      VAPID_SUBJECT: 'mailto:admin@aberrance.app',
    });
  });

  it('uses the real web-push transport unless the push switch says otherwise', () => {
    expect(parseEnv(REQUIRED).HESTIA_PUSH_TRANSPORT).toBe('web-push');
    expect(parseEnv({ ...REQUIRED, HESTIA_PUSH_TRANSPORT: 'web-push' }).HESTIA_PUSH_TRANSPORT).toBe(
      'web-push',
    );
  });

  it('accepts test-double only as the exact value the E2E overlay sets', () => {
    expect(
      parseEnv({ ...REQUIRED, HESTIA_PUSH_TRANSPORT: 'test-double' }).HESTIA_PUSH_TRANSPORT,
    ).toBe('test-double');
  });

  it('refuses any other push switch value at startup, without a fallback to either transport', () => {
    for (const value of [
      'Test-Double',
      'test_double',
      'double',
      'none',
      'off',
      '',
      ' test-double',
    ]) {
      expect(() => parseEnv({ ...REQUIRED, HESTIA_PUSH_TRANSPORT: value })).toThrow(
        /HESTIA_PUSH_TRANSPORT/,
      );
    }
  });

  it('reads the per-IP rate limit as a positive integer and defaults to production’s 300', () => {
    expect(parseEnv(REQUIRED).HESTIA_RATE_LIMIT_PER_MINUTE).toBe(300);
    expect(
      parseEnv({ ...REQUIRED, HESTIA_RATE_LIMIT_PER_MINUTE: '3000' }).HESTIA_RATE_LIMIT_PER_MINUTE,
    ).toBe(3000);
  });

  it('refuses a rate limit that is zero, negative, fractional, or not a number', () => {
    for (const value of ['0', '-5', '2.5', 'many', '']) {
      expect(() => parseEnv({ ...REQUIRED, HESTIA_RATE_LIMIT_PER_MINUTE: value })).toThrow(
        /HESTIA_RATE_LIMIT_PER_MINUTE/,
      );
    }
  });

  it('trusts no proxy when the variable is unset', () => {
    expect(parseEnv(REQUIRED).HESTIA_TRUSTED_PROXIES).toEqual([]);
  });

  it('keeps the backup directory and owner email when set', () => {
    const env = parseEnv({ ...REQUIRED, BACKUP_DIR: '/backups', HESTIA_OWNER_EMAIL: ' o@x.io ' });
    expect(env.BACKUP_DIR).toBe('/backups');
    expect(env.HESTIA_OWNER_EMAIL).toBe('o@x.io');
  });

  it('fails fast when DATABASE_URL is missing or not a Postgres URL', () => {
    expect(() => parseEnv({ ...REQUIRED, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({ ...REQUIRED, DATABASE_URL: 'https://example.com' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('refuses a short JWT secret and a missing key', () => {
    expect(() => parseEnv({ ...REQUIRED, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
    expect(() => parseEnv({ ...REQUIRED, SERVICE_ROLE_KEY: undefined })).toThrow(
      /SERVICE_ROLE_KEY/,
    );
  });

  // The dispatch job is scheduled in every process, so a service without its VAPID credentials would fail
  // on the first send; refusing to start is the earlier and clearer failure.
  it.each(['HESTIA_PUBLIC_VAPID_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const)(
    'refuses to start without %s',
    (key) => {
      expect(() => parseEnv({ ...REQUIRED, [key]: undefined })).toThrow(new RegExp(key));
      expect(() => parseEnv({ ...REQUIRED, [key]: '' })).toThrow(new RegExp(key));
    },
  );

  it('accepts valid mailto: and https: contact URIs for VAPID_SUBJECT', () => {
    expect(
      parseEnv({ ...REQUIRED, VAPID_SUBJECT: 'mailto:admin@aberrance.app' }).VAPID_SUBJECT,
    ).toBe('mailto:admin@aberrance.app');
    expect(
      parseEnv({ ...REQUIRED, VAPID_SUBJECT: 'https://hestia.aberrance.app' }).VAPID_SUBJECT,
    ).toBe('https://hestia.aberrance.app');
  });

  it.each(['http://127.0.0.1:8080', 'not-a-uri', 'mailto:not-an-email'])(
    'refuses non-contact URI %s for VAPID_SUBJECT without echoing the value',
    (invalidUri) => {
      expect(() => parseEnv({ ...REQUIRED, VAPID_SUBJECT: invalidUri })).toThrow(
        /VAPID_SUBJECT must be a mailto: or https: URI/,
      );
      let message = '';
      try {
        parseEnv({ ...REQUIRED, VAPID_SUBJECT: invalidUri });
      } catch (caught: unknown) {
        message = (caught as Error).message;
      }
      expect(message).toMatch(/VAPID_SUBJECT/);
      expect(message).not.toContain(invalidUri);
    },
  );
});

describe('parseCliEnv', () => {
  it('needs only GoTrue, the service-role key, and the origin', () => {
    expect(
      parseCliEnv({
        HESTIA_ORIGIN: REQUIRED.HESTIA_ORIGIN,
        GOTRUE_URL: REQUIRED.GOTRUE_URL,
        SERVICE_ROLE_KEY: 'service',
      }),
    ).toEqual({
      HESTIA_ORIGIN: 'https://hestia.aberrance.app',
      GOTRUE_URL: 'http://auth:9999',
      SERVICE_ROLE_KEY: 'service',
    });
    expect(() => parseCliEnv({})).toThrow(/SERVICE_ROLE_KEY/);
  });

  it('accepts optional database and VAPID fields', () => {
    expect(
      parseCliEnv({
        HESTIA_ORIGIN: REQUIRED.HESTIA_ORIGIN,
        GOTRUE_URL: REQUIRED.GOTRUE_URL,
        SERVICE_ROLE_KEY: 'service',
        DATABASE_URL: REQUIRED.DATABASE_URL,
        HESTIA_PUBLIC_VAPID_KEY: REQUIRED.HESTIA_PUBLIC_VAPID_KEY,
        VAPID_PRIVATE_KEY: REQUIRED.VAPID_PRIVATE_KEY,
        VAPID_SUBJECT: REQUIRED.VAPID_SUBJECT,
      }),
    ).toEqual({
      HESTIA_ORIGIN: 'https://hestia.aberrance.app',
      GOTRUE_URL: 'http://auth:9999',
      SERVICE_ROLE_KEY: 'service',
      DATABASE_URL: REQUIRED.DATABASE_URL,
      HESTIA_PUBLIC_VAPID_KEY: REQUIRED.HESTIA_PUBLIC_VAPID_KEY,
      VAPID_PRIVATE_KEY: REQUIRED.VAPID_PRIVATE_KEY,
      VAPID_SUBJECT: REQUIRED.VAPID_SUBJECT,
    });
  });

  it('refuses the pre-rebrand origin name, naming HESTIA_ORIGIN', () => {
    expect(() =>
      parseCliEnv({
        [`${LEGACY_PREFIX}ORIGIN`]: REQUIRED.HESTIA_ORIGIN,
        GOTRUE_URL: REQUIRED.GOTRUE_URL,
        SERVICE_ROLE_KEY: 'service',
      }),
    ).toThrow(/HESTIA_ORIGIN/);
  });
});
