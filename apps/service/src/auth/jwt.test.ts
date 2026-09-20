import { generateKeyPairSync, sign, type JsonWebKey } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { signToken, TEST_JWT_SECRET, userClaims } from '../test/fake-app.js';
import {
  createTokenVerifier,
  isRecentRecovery,
  isServerOwner,
  RECOVERY_WINDOW_SECONDS,
  TokenError,
  type JsonWebKeySet,
} from './jwt.js';

const NOW = 1_800_000_000;
const verifier = createTokenVerifier({ secret: TEST_JWT_SECRET, now: () => NOW });

function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return userClaims({
    iat: NOW,
    exp: NOW + 3600,
    amr: [{ method: 'password', timestamp: NOW }],
    ...overrides,
  });
}

async function rejection(token: string, verify = verifier): Promise<string> {
  try {
    await verify(token);
  } catch (error) {
    expect(error).toBeInstanceOf(TokenError);
    return (error as Error).message;
  }
  throw new Error('expected the token to be refused');
}

function es256Token(
  privateKey: Parameters<typeof sign>[2],
  kid: string,
  payload: Record<string, unknown>,
): string {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid, typ: 'JWT' })).toString(
    'base64url',
  );
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign('sha256', Buffer.from(`${header}.${body}`), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  } as never).toString('base64url');
  return `${header}.${body}.${signature}`;
}

describe('HS256 tokens', () => {
  it('accepts a valid user token and exposes its claims', async () => {
    const payload = claims({ email: 'Alex@Example.com' });
    const user = await verifier(signToken(payload));
    expect(user.id).toBe(payload['sub']);
    expect(user.email).toBe('Alex@Example.com');
    expect(user.amr).toEqual([{ method: 'password', timestamp: NOW }]);
    expect(user.claims).toEqual(payload);
  });

  it('refuses a token signed with another secret', async () => {
    expect(
      await rejection(signToken(claims(), { secret: 'another-secret-another-secret-x' })),
    ).toBe('bad signature');
  });

  it('refuses a tampered payload', async () => {
    const [header, , signature] = signToken(claims()).split('.');
    const forged = Buffer.from(JSON.stringify(claims({ sub: crypto.randomUUID() }))).toString(
      'base64url',
    );
    expect(await rejection(`${header ?? ''}.${forged}.${signature ?? ''}`)).toBe('bad signature');
  });

  it('refuses alg none, other algorithms, and malformed tokens', async () => {
    const payload = Buffer.from(JSON.stringify(claims())).toString('base64url');
    const none = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    expect(await rejection(`${none}.${payload}.`)).toBe('bad signature');
    expect(await rejection(signToken(claims(), { header: { alg: 'HS512' } }))).toBe(
      'bad signature',
    );
    expect(await rejection('not-a-token')).toBe('malformed token');
    expect(await rejection('a.b.c')).toBe('malformed token');
    expect(await rejection(`${Buffer.from('[1]').toString('base64url')}.x.y`)).toBe(
      'malformed token',
    );
  });

  it('refuses expired tokens, allowing a little clock skew', async () => {
    expect(await rejection(signToken(claims({ exp: NOW - 31 })))).toBe('expired token');
    await expect(verifier(signToken(claims({ exp: NOW - 5 })))).resolves.toBeDefined();
    expect(await rejection(signToken(claims({ exp: undefined })))).toBe('expired token');
    expect(await rejection(signToken(claims({ nbf: NOW + 120 })))).toBe('token not yet valid');
  });

  it('refuses the anon and service-role keys, which are signed with the same secret', async () => {
    expect(await rejection(signToken({ role: 'anon', exp: NOW + 60 }))).toBe('not a user token');
    expect(await rejection(signToken({ role: 'service_role', exp: NOW + 60 }))).toBe(
      'not a user token',
    );
  });

  it('refuses a wrong audience, a missing subject, and anonymous sessions', async () => {
    expect(await rejection(signToken(claims({ aud: 'other' })))).toBe('wrong audience');
    await expect(
      verifier(signToken(claims({ aud: ['x', 'authenticated'] }))),
    ).resolves.toBeDefined();
    expect(await rejection(signToken(claims({ sub: 'nope' })))).toBe('no subject');
    expect(await rejection(signToken(claims({ is_anonymous: true })))).toBe('anonymous session');
  });

  it('tolerates junk in amr', async () => {
    const user = await verifier(signToken(claims({ amr: [1, { method: 'otp' }, 'x'] })));
    expect(user.amr).toEqual([]);
    const noAmr = await verifier(signToken(claims({ amr: undefined, email: 5 })));
    expect(noAmr.amr).toEqual([]);
    expect(noAmr.email).toBe('');
  });
});

describe('ES256 tokens (supabase start)', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'key-1' };

  it('accepts a token signed by a key GoTrue publishes', async () => {
    const fetchJwks = vi.fn(() => Promise.resolve<JsonWebKeySet>({ keys: [jwk] }));
    const verify = createTokenVerifier({ secret: TEST_JWT_SECRET, fetchJwks, now: () => NOW });
    const payload = claims();
    await expect(verify(es256Token(privateKey, 'key-1', payload))).resolves.toMatchObject({
      id: payload['sub'],
    });
    await verify(es256Token(privateKey, 'key-1', payload));
    // The key set is cached.
    expect(fetchJwks).toHaveBeenCalledTimes(1);
  });

  it('refuses an unknown kid, refetching at most once a minute', async () => {
    let now = NOW;
    const fetchJwks = vi.fn(() => Promise.resolve<JsonWebKeySet>({ keys: [jwk] }));
    const verify = createTokenVerifier({ secret: TEST_JWT_SECRET, fetchJwks, now: () => now });
    expect(await rejection(es256Token(privateKey, 'key-2', claims()), verify)).toBe(
      'bad signature',
    );
    expect(await rejection(es256Token(privateKey, 'key-3', claims()), verify)).toBe(
      'bad signature',
    );
    expect(fetchJwks).toHaveBeenCalledTimes(1);
    now += 61;
    await rejection(es256Token(privateKey, 'key-4', claims({ exp: now + 60 })), verify);
    expect(fetchJwks).toHaveBeenCalledTimes(2);
  });

  it('refuses a token signed by another key under a published kid', async () => {
    const other = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const verify = createTokenVerifier({
      secret: TEST_JWT_SECRET,
      fetchJwks: () => Promise.resolve({ keys: [jwk] }),
      now: () => NOW,
    });
    expect(await rejection(es256Token(other.privateKey, 'key-1', claims()), verify)).toBe(
      'bad signature',
    );
  });

  it('refuses ES256 when GoTrue cannot be reached, or when no key source is configured', async () => {
    const verify = createTokenVerifier({
      secret: TEST_JWT_SECRET,
      fetchJwks: () => Promise.reject(new Error('ECONNREFUSED')),
      now: () => NOW,
    });
    expect(await rejection(es256Token(privateKey, 'key-1', claims()), verify)).toBe(
      'bad signature',
    );
    expect(await rejection(es256Token(privateKey, 'key-1', claims()))).toBe('bad signature');
  });

  it('ignores keys that are not P-256 or have no kid', async () => {
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const noKid: JsonWebKey = Object.fromEntries(
      Object.entries(jwk).filter(([key]) => key !== 'kid'),
    );
    const verify = createTokenVerifier({
      secret: TEST_JWT_SECRET,
      fetchJwks: () =>
        Promise.resolve({
          keys: [{ ...rsa.publicKey.export({ format: 'jwk' }), kid: 'rsa' }, noKid],
        }),
      now: () => NOW,
    });
    expect(await rejection(es256Token(privateKey, 'rsa', claims()), verify)).toBe('bad signature');
  });
});

describe('isRecentRecovery', () => {
  it('is true only for a recovery sign-in within the last hour', () => {
    expect(isRecentRecovery({ amr: [{ method: 'recovery', timestamp: NOW - 60 }] }, NOW)).toBe(
      true,
    );
    // The pinned GoTrue records a verified reset link as otp.
    expect(isRecentRecovery({ amr: [{ method: 'otp', timestamp: NOW - 60 }] }, NOW)).toBe(true);
    expect(
      isRecentRecovery(
        { amr: [{ method: 'recovery', timestamp: NOW - RECOVERY_WINDOW_SECONDS - 1 }] },
        NOW,
      ),
    ).toBe(false);
    expect(isRecentRecovery({ amr: [{ method: 'password', timestamp: NOW }] }, NOW)).toBe(false);
    expect(isRecentRecovery({ amr: [{ method: 'recovery', timestamp: NOW + 3600 }] }, NOW)).toBe(
      false,
    );
    expect(isRecentRecovery({ amr: [] }, NOW)).toBe(false);
  });
});

describe('isServerOwner', () => {
  it('compares emails ignoring case and surrounding space', () => {
    expect(isServerOwner('Owner@Example.com', 'owner@example.com ')).toBe(true);
    expect(isServerOwner('someone@example.com', 'owner@example.com')).toBe(false);
  });

  it('makes nobody the owner when the owner email is unset', () => {
    expect(isServerOwner('', '')).toBe(false);
    expect(isServerOwner('owner@example.com', '')).toBe(false);
  });
});
