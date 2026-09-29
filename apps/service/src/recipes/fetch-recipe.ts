import { Buffer } from 'node:buffer';
import { lookup as nodeDnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import { isIP } from 'node:net';
import type { HostRateLimiter } from './host-rate-limiter.js';
import { isPrivateAddress } from './private-address.js';

/**
 * Fetches a user-pasted recipe URL server-side (Technical Architecture, "Recipe fetching"). Every
 * limit named there is enforced here: `http`/`https` only, private/loopback/link-local address
 * ranges refused by resolved IP (not by string-matching the URL, since DNS rebinding is the real
 * threat), a 10-second timeout, a 5 MB body cap, and a descriptive User-Agent. Fetches are
 * user-initiated and low volume by design (no crawling, no link following): a redirect is refused
 * rather than followed, so this never becomes a general-purpose fetcher.
 */

export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_BODY_BYTES = 5 * 1024 * 1024;

export type RecipeFetchErrorCode =
  'invalid_url' | 'private_address' | 'timeout' | 'too_large' | 'http_error' | 'network_error';

export class RecipeFetchError extends Error {
  readonly code: RecipeFetchErrorCode;

  constructor(message: string, code: RecipeFetchErrorCode, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'RecipeFetchError';
    this.code = code;
  }
}

export interface FetchedPage {
  readonly status: number;
  readonly body: string;
}

export interface ResolvedAddress {
  readonly address: string;
  readonly family: 4 | 6;
}

/** Injected so tests resolve a fake hostname to a fake address without a real DNS query. */
export type DnsLookup = (hostname: string) => Promise<ResolvedAddress[]>;

export const dnsLookup: DnsLookup = async (hostname) => {
  const results = await nodeDnsLookup(hostname, { all: true, verbatim: true });
  return results.map((result) => ({ address: result.address, family: result.family as 4 | 6 }));
};

/**
 * Every address a hostname could mean, checked before any connection is attempted. A literal IP
 * in the URL needs no DNS lookup at all. Refusing the whole request when *any* resolved address
 * is private, rather than only skipping that one address, is deliberate: a name that answers with
 * both a public and a private address could otherwise be steered onto the private one later.
 */
export async function resolveAllowedAddresses(
  hostname: string,
  lookupFn: DnsLookup = dnsLookup,
): Promise<ResolvedAddress[]> {
  const literalFamily = isIP(hostname);
  const candidates: ResolvedAddress[] =
    literalFamily !== 0
      ? [{ address: hostname, family: literalFamily as 4 | 6 }]
      : await lookupFn(hostname).catch((error: unknown) => {
          throw new RecipeFetchError('That host could not be resolved.', 'invalid_url', error);
        });
  if (candidates.length === 0) {
    throw new RecipeFetchError('That host could not be resolved.', 'invalid_url');
  }
  if (candidates.some((candidate) => isPrivateAddress(candidate.address))) {
    throw new RecipeFetchError(
      'That URL points at a private or local address, which recipe import refuses to fetch.',
      'private_address',
    );
  }
  return candidates;
}

/** Only `http` and `https`; anything else (`file:`, `ftp:`, …) is refused outright. */
export function parseFetchableUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch (error) {
    throw new RecipeFetchError('That is not a valid URL.', 'invalid_url', error);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new RecipeFetchError('Only http and https URLs can be imported.', 'invalid_url');
  }
  return url;
}

export interface RequestLimitsOptions {
  address: string;
  family: 4 | 6;
  userAgent: string;
  timeoutMs?: number;
  maxBodyBytes?: number;
}

/**
 * One bounded GET against a pre-validated address. Kept separate from address resolution so it
 * can be exercised directly against a real local test server — including loopback, which the
 * resolution step above would otherwise refuse — to prove the timeout and body-cap actually cut
 * a slow or oversized response off.
 */
export function requestWithLimits(url: URL, options: RequestLimitsOptions): Promise<FetchedPage> {
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;
  const maxBodyBytes = options.maxBodyBytes ?? MAX_BODY_BYTES;
  const transport = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (run: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      run();
    };

    // Pins the connection to the address already validated: a second DNS lookup at connect
    // time (which is exactly what DNS rebinding relies on) never happens.
    const lookup: LookupFunction = (_hostname, _lookupOptions, callback) => {
      callback(null, options.address, options.family);
    };

    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port === '' ? undefined : Number(url.port),
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: { 'User-Agent': options.userAgent, Accept: 'text/html,application/xhtml+xml' },
        lookup,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          // "No link following" (Technical Architecture): a redirect is refused, not chased.
          res.resume();
          finish(() => {
            reject(new RecipeFetchError(`That page redirected (${String(status)}).`, 'http_error'));
          });
          return;
        }
        if (status !== 200) {
          res.resume();
          finish(() => {
            reject(new RecipeFetchError(`That page answered ${String(status)}.`, 'http_error'));
          });
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          if (settled) return;
          total += chunk.length;
          if (total > maxBodyBytes) {
            req.destroy();
            finish(() => {
              reject(new RecipeFetchError('That page is too large.', 'too_large'));
            });
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          finish(() => {
            resolve({ status, body: Buffer.concat(chunks).toString('utf8') });
          });
        });
        res.on('error', (error: Error) => {
          finish(() => {
            reject(new RecipeFetchError('That page could not be read.', 'network_error', error));
          });
        });
      },
    );

    // A wall-clock cap, not an idle-socket one: a server trickling one byte at a time would
    // never trip an idle timeout, but it is exactly the "slow page" this limit exists to stop.
    const timer = setTimeout(() => {
      req.destroy();
      finish(() => {
        reject(new RecipeFetchError('That page took too long to respond.', 'timeout'));
      });
    }, timeoutMs);

    req.on('error', (error: Error) => {
      finish(() => {
        reject(new RecipeFetchError('Could not reach that page.', 'network_error', error));
      });
    });
    req.end();
  });
}

export interface FetchRecipePageOptions {
  userAgent: string;
  limiter: HostRateLimiter;
  lookupFn?: DnsLookup;
  /** Injected for tests, which point it at a real local server instead of the live network. */
  requestFn?: (url: URL, options: RequestLimitsOptions) => Promise<FetchedPage>;
}

/**
 * The whole pipeline a route calls: validate the scheme, resolve and check the address, wait out
 * this host's rate gap, then fetch within the timeout and body-cap limits. Nothing here follows a
 * redirect or retries; a low-volume, user-initiated fetch does not need to.
 */
export async function fetchRecipePage(
  rawUrl: string,
  options: FetchRecipePageOptions,
): Promise<FetchedPage> {
  const url = parseFetchableUrl(rawUrl);
  const [address] = await resolveAllowedAddresses(url.hostname, options.lookupFn);
  // Guaranteed non-empty by resolveAllowedAddresses, which throws rather than returning [].
  if (address === undefined) {
    throw new RecipeFetchError('That host could not be resolved.', 'invalid_url');
  }
  await options.limiter.wait(url.hostname);
  const request = options.requestFn ?? requestWithLimits;
  return request(url, {
    address: address.address,
    family: address.family,
    userAgent: options.userAgent,
  });
}
