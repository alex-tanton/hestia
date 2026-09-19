import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

describe('parseEnv', () => {
  it('applies defaults and splits trusted proxies', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgres://u:p@db:5432/postgres',
      HEARTH_TRUSTED_PROXIES: '172.28.0.0/16, 127.0.0.1',
    });

    expect(env).toEqual({
      DATABASE_URL: 'postgres://u:p@db:5432/postgres',
      HOST: '0.0.0.0',
      PORT: 3000,
      LOG_LEVEL: 'info',
      HEARTH_TRUSTED_PROXIES: ['172.28.0.0/16', '127.0.0.1'],
    });
  });

  it('trusts no proxy when the variable is unset', () => {
    expect(parseEnv({ DATABASE_URL: 'postgresql://db/x' }).HEARTH_TRUSTED_PROXIES).toEqual([]);
  });

  it('fails fast when DATABASE_URL is missing or not a Postgres URL', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({ DATABASE_URL: 'https://example.com' })).toThrow(/DATABASE_URL/);
  });
});
