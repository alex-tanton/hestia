import { describe, expect, it } from 'vitest';
import { parseCliEnv, parseEnv } from './env.js';

const REQUIRED = {
  DATABASE_URL: 'postgres://u:p@db:5432/postgres',
  HEARTH_ORIGIN: 'https://hearth.tail1234.ts.net/',
  GOTRUE_URL: 'http://auth:9999/',
  JWT_SECRET: 'x'.repeat(40),
  ANON_KEY: 'anon',
  SERVICE_ROLE_KEY: 'service',
};

describe('parseEnv', () => {
  it('applies defaults, splits trusted proxies, and normalizes URLs', () => {
    const env = parseEnv({ ...REQUIRED, HEARTH_TRUSTED_PROXIES: '172.28.0.0/16, 127.0.0.1' });

    expect(env).toEqual({
      ...REQUIRED,
      HEARTH_ORIGIN: 'https://hearth.tail1234.ts.net',
      GOTRUE_URL: 'http://auth:9999',
      HOST: '0.0.0.0',
      PORT: 3000,
      LOG_LEVEL: 'info',
      HEARTH_TRUSTED_PROXIES: ['172.28.0.0/16', '127.0.0.1'],
      HEARTH_OWNER_EMAIL: '',
      HEARTH_RATE_LIMIT_PER_MINUTE: 300,
    });
  });

  it('reads the per-IP rate limit as a positive integer and defaults to production’s 300', () => {
    expect(parseEnv(REQUIRED).HEARTH_RATE_LIMIT_PER_MINUTE).toBe(300);
    expect(
      parseEnv({ ...REQUIRED, HEARTH_RATE_LIMIT_PER_MINUTE: '3000' }).HEARTH_RATE_LIMIT_PER_MINUTE,
    ).toBe(3000);
  });

  it('refuses a rate limit that is zero, negative, fractional, or not a number', () => {
    for (const value of ['0', '-5', '2.5', 'many', '']) {
      expect(() => parseEnv({ ...REQUIRED, HEARTH_RATE_LIMIT_PER_MINUTE: value })).toThrow(
        /HEARTH_RATE_LIMIT_PER_MINUTE/,
      );
    }
  });

  it('trusts no proxy when the variable is unset', () => {
    expect(parseEnv(REQUIRED).HEARTH_TRUSTED_PROXIES).toEqual([]);
  });

  it('keeps the backup directory and owner email when set', () => {
    const env = parseEnv({ ...REQUIRED, BACKUP_DIR: '/backups', HEARTH_OWNER_EMAIL: ' o@x.io ' });
    expect(env.BACKUP_DIR).toBe('/backups');
    expect(env.HEARTH_OWNER_EMAIL).toBe('o@x.io');
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
});

describe('parseCliEnv', () => {
  it('needs only GoTrue, the service-role key, and the origin', () => {
    expect(
      parseCliEnv({
        HEARTH_ORIGIN: REQUIRED.HEARTH_ORIGIN,
        GOTRUE_URL: REQUIRED.GOTRUE_URL,
        SERVICE_ROLE_KEY: 'service',
      }),
    ).toEqual({
      HEARTH_ORIGIN: 'https://hearth.tail1234.ts.net',
      GOTRUE_URL: 'http://auth:9999',
      SERVICE_ROLE_KEY: 'service',
    });
    expect(() => parseCliEnv({})).toThrow(/SERVICE_ROLE_KEY/);
  });
});
