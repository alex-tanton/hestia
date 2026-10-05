import { describe, expect, it } from 'vitest';
import { parseCliEnv, parseEnv, vapidSubjectFor } from './env.js';

const REQUIRED = {
  DATABASE_URL: 'postgres://u:p@db:5432/postgres',
  HEARTH_ORIGIN: 'https://hearth.tail1234.ts.net/',
  GOTRUE_URL: 'http://auth:9999/',
  JWT_SECRET: 'x'.repeat(40),
  ANON_KEY: 'anon',
  SERVICE_ROLE_KEY: 'service',
  VAPID_PUBLIC_KEY: 'BPublicKeyPlaceholder',
  VAPID_PRIVATE_KEY: 'privatePlaceholder',
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
      HEARTH_PUSH_TRANSPORT: 'web-push',
      VAPID_SUBJECT: 'https://hearth.tail1234.ts.net',
    });
  });

  it('uses the real web-push transport unless the push switch says otherwise', () => {
    expect(parseEnv(REQUIRED).HEARTH_PUSH_TRANSPORT).toBe('web-push');
    expect(parseEnv({ ...REQUIRED, HEARTH_PUSH_TRANSPORT: 'web-push' }).HEARTH_PUSH_TRANSPORT).toBe(
      'web-push',
    );
  });

  it('accepts test-double only as the exact value the E2E overlay sets', () => {
    expect(
      parseEnv({ ...REQUIRED, HEARTH_PUSH_TRANSPORT: 'test-double' }).HEARTH_PUSH_TRANSPORT,
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
      expect(() => parseEnv({ ...REQUIRED, HEARTH_PUSH_TRANSPORT: value })).toThrow(
        /HEARTH_PUSH_TRANSPORT/,
      );
    }
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

  // The dispatch job is scheduled in every process, so a service without its VAPID pair would fail
  // on the first send; refusing to start is the earlier and clearer failure.
  it.each(['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'] as const)(
    'refuses to start without %s',
    (key) => {
      expect(() => parseEnv({ ...REQUIRED, [key]: undefined })).toThrow(new RegExp(key));
      expect(() => parseEnv({ ...REQUIRED, [key]: '' })).toThrow(new RegExp(key));
    },
  );

  it('derives VAPID_SUBJECT from the https origin when no owner email is set', () => {
    expect(parseEnv(REQUIRED).VAPID_SUBJECT).toBe('https://hearth.tail1234.ts.net');
  });
});

describe('vapidSubjectFor', () => {
  const base = { HEARTH_OWNER_EMAIL: '', HEARTH_ORIGIN: 'https://hearth.tail1234.ts.net' };

  it('uses an explicit VAPID_SUBJECT when it is a mailto: or https: URI', () => {
    expect(vapidSubjectFor({ ...base, VAPID_SUBJECT: 'mailto:ops@example.com' })).toBe(
      'mailto:ops@example.com',
    );
    expect(vapidSubjectFor({ ...base, VAPID_SUBJECT: 'https://contact.example.com' })).toBe(
      'https://contact.example.com',
    );
  });

  it('refuses an explicit VAPID_SUBJECT that web-push would reject, without echoing it', () => {
    expect(() =>
      vapidSubjectFor({ ...base, VAPID_SUBJECT: 'http://127.0.0.1:8080/secret-value' }),
    ).toThrow(/VAPID_SUBJECT must be a mailto: or https: URI/);
    let message = '';
    try {
      vapidSubjectFor({ ...base, VAPID_SUBJECT: 'http://127.0.0.1:8080/secret-value' });
    } catch (caught: unknown) {
      message = (caught as Error).message;
    }
    expect(message).not.toContain('secret-value');
  });

  it('derives mailto: from HEARTH_OWNER_EMAIL when no explicit subject is set', () => {
    expect(
      vapidSubjectFor({
        ...base,
        HEARTH_OWNER_EMAIL: 'owner@example.com',
        HEARTH_ORIGIN: 'http://127.0.0.1:8080',
      }),
    ).toBe('mailto:owner@example.com');
  });

  it('prefers the owner email over the https origin', () => {
    expect(vapidSubjectFor({ ...base, HEARTH_OWNER_EMAIL: 'owner@example.com' })).toBe(
      'mailto:owner@example.com',
    );
  });

  it('falls back to the origin when it is https and the owner email is not a valid address', () => {
    expect(vapidSubjectFor({ ...base, HEARTH_OWNER_EMAIL: 'not an address' })).toBe(
      'https://hearth.tail1234.ts.net',
    );
  });

  it('fails fast over plain http with no owner email, naming the variables and not the origin', () => {
    const error = (() => {
      try {
        vapidSubjectFor({ ...base, HEARTH_ORIGIN: 'http://127.0.0.1:8080' });
        return undefined;
      } catch (caught: unknown) {
        return caught;
      }
    })();
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/VAPID_SUBJECT/);
    expect((error as Error).message).toMatch(/HEARTH_OWNER_EMAIL/);
    expect((error as Error).message).not.toContain('127.0.0.1');
  });

  it('makes parseEnv fail at startup when no contact can be derived', () => {
    expect(() => parseEnv({ ...REQUIRED, HEARTH_ORIGIN: 'http://127.0.0.1:8080' })).toThrow(
      /VAPID_SUBJECT is unset/,
    );
  });

  it('lets parseEnv boot over plain http when HEARTH_OWNER_EMAIL is set', () => {
    const env = parseEnv({
      ...REQUIRED,
      HEARTH_ORIGIN: 'http://127.0.0.1:8080',
      HEARTH_OWNER_EMAIL: 'alex@example.com',
    });
    expect(env.VAPID_SUBJECT).toBe('mailto:alex@example.com');
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
