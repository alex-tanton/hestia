import {
  createHmac,
  createPublicKey,
  timingSafeEqual,
  verify,
  type JsonWebKey,
  type KeyObject,
} from 'node:crypto';

/**
 * Access-token verification (signature and expiry, with the GoTrue JWT secret).
 *
 * The production GoTrue signs with HS256 and JWT_SECRET. `supabase start` (CLI 2.x) signs user
 * sessions with ES256 instead, publishing the public key at GoTrue's
 * /.well-known/jwks.json, so ES256 is accepted when, and only when, the token's `kid` names a key
 * that GoTrue publishes. No other algorithm is accepted, "none" least of all.
 */

export interface AmrEntry {
  method: string;
  timestamp: number;
}

export interface VerifiedUser {
  id: string;
  /** The email in the token; empty if absent. */
  email: string;
  amr: AmrEntry[];
  /** Every verified claim, for `request.jwt.claims`. */
  claims: Readonly<Record<string, unknown>>;
  /** The raw token, for GoTrue calls made as the user. */
  token: string;
}

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenError';
  }
}

export interface JsonWebKeySet {
  keys: (JsonWebKey & { kid?: string; alg?: string })[];
}

export interface VerifierOptions {
  secret: string;
  /** Fetches GoTrue's published keys; omitted means HS256 only. */
  fetchJwks?: () => Promise<JsonWebKeySet>;
  /** Seconds since the epoch. */
  now?: () => number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Tolerated clock difference between GoTrue and the service, in seconds.
const CLOCK_SKEW = 30;
// An unknown kid refetches the key set at most this often, so a flood of forged kids cannot
// turn into a flood of requests to GoTrue.
const JWKS_REFETCH_INTERVAL = 60;

function decodeJson(segment: string): unknown {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    throw new TokenError('malformed token');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAmr(value: unknown): AmrEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) =>
    isRecord(entry) && typeof entry['method'] === 'string' && typeof entry['timestamp'] === 'number'
      ? [{ method: entry['method'], timestamp: entry['timestamp'] }]
      : [],
  );
}

export type TokenVerifier = (token: string) => Promise<VerifiedUser>;

export function createTokenVerifier(options: VerifierOptions): TokenVerifier {
  const secret = Buffer.from(options.secret, 'utf8');
  const now = options.now ?? ((): number => Math.floor(Date.now() / 1000));
  let keys = new Map<string, KeyObject>();
  let fetchedAt = Number.NEGATIVE_INFINITY;

  async function publicKey(kid: string): Promise<KeyObject | undefined> {
    const known = keys.get(kid);
    if (known !== undefined || options.fetchJwks === undefined) return known;
    if (now() - fetchedAt < JWKS_REFETCH_INTERVAL) return undefined;
    fetchedAt = now();
    try {
      const set = await options.fetchJwks();
      const next = new Map<string, KeyObject>();
      for (const jwk of set.keys) {
        if (jwk.kid === undefined || jwk.kty !== 'EC' || jwk.crv !== 'P-256') continue;
        next.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }));
      }
      keys = next;
    } catch {
      // GoTrue unreachable or answering nonsense: the token cannot be verified, so it is refused.
      return undefined;
    }
    return keys.get(kid);
  }

  async function checkSignature(
    header: Record<string, unknown>,
    signed: string,
    signature: Buffer,
  ) {
    const alg = header['alg'];
    if (alg === 'HS256') {
      const expected = createHmac('sha256', secret).update(signed).digest();
      return expected.length === signature.length && timingSafeEqual(expected, signature);
    }
    if (alg === 'ES256' && typeof header['kid'] === 'string') {
      const key = await publicKey(header['kid']);
      if (key === undefined) return false;
      return verify('sha256', Buffer.from(signed), { key, dsaEncoding: 'ieee-p1363' }, signature);
    }
    return false;
  }

  return async (token) => {
    const parts = token.split('.');
    if (parts.length !== 3) throw new TokenError('malformed token');
    const [headerPart = '', payloadPart = '', signaturePart = ''] = parts;
    const header = decodeJson(headerPart);
    if (!isRecord(header)) throw new TokenError('malformed token');

    const signature = Buffer.from(signaturePart, 'base64url');
    if (!(await checkSignature(header, `${headerPart}.${payloadPart}`, signature))) {
      throw new TokenError('bad signature');
    }

    const claims = decodeJson(payloadPart);
    if (!isRecord(claims)) throw new TokenError('malformed token');
    const current = now();
    const { exp, nbf, sub, role, aud } = claims;
    if (typeof exp !== 'number' || exp <= current - CLOCK_SKEW) {
      throw new TokenError('expired token');
    }
    if (typeof nbf === 'number' && nbf > current + CLOCK_SKEW) {
      throw new TokenError('token not yet valid');
    }
    // Only a signed-in user's session token; the anon and service-role keys are also JWTs
    // signed with the same secret and must never pass as a user.
    if (role !== 'authenticated') throw new TokenError('not a user token');
    if (aud !== 'authenticated' && !(Array.isArray(aud) && aud.includes('authenticated'))) {
      throw new TokenError('wrong audience');
    }
    if (typeof sub !== 'string' || !UUID.test(sub)) throw new TokenError('no subject');
    if (claims['is_anonymous'] === true) throw new TokenError('anonymous session');

    return {
      id: sub.toLowerCase(),
      email: typeof claims['email'] === 'string' ? claims['email'] : '',
      amr: parseAmr(claims['amr']),
      claims,
      token,
    };
  };
}

/** Recovery sessions may set a new password without the old one for this long, in seconds. */
export const RECOVERY_WINDOW_SECONDS = 3600;

/**
 * True when the session began from a link the person opened out of their mailbox — the owner's
 * reset link — within the last hour, which is what waives the current-password check.
 *
 * The pinned GoTrue (v2.196) records a verified recovery link as amr method `otp`, not
 * `recovery`, so both are accepted. `otp` also covers a magic-link sign-in once that flag is on,
 * which proves control of the mailbox exactly as the reset link does. The window matches the
 * link's own lifetime (GOTRUE_MAILER_OTP_EXP), so a session left open does not waive the check
 * forever.
 */
export function isRecentRecovery(
  user: Pick<VerifiedUser, 'amr'>,
  now: number = Math.floor(Date.now() / 1000),
): boolean {
  return user.amr.some(
    (entry) =>
      (entry.method === 'recovery' || entry.method === 'otp') &&
      entry.timestamp <= now + CLOCK_SKEW &&
      now - entry.timestamp <= RECOVERY_WINDOW_SECONDS,
  );
}

/** `isServerOwner`: the token's email equals HESTIA_OWNER_EMAIL, ignoring case. */
export function isServerOwner(email: string, ownerEmail: string): boolean {
  const normalizedOwner = ownerEmail.trim().toLowerCase();
  return normalizedOwner !== '' && email.trim().toLowerCase() === normalizedOwner;
}
