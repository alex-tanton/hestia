import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { HostRateLimiter } from './host-rate-limiter.js';
import {
  fetchRecipePage,
  parseFetchableUrl,
  RecipeFetchError,
  requestWithLimits,
  resolveAllowedAddresses,
  type DnsLookup,
} from './fetch-recipe.js';

/**
 * Fetch limits. `requestWithLimits` is tested against a real local server — including loopback,
 * which is otherwise refused — to prove the timeout and body cap actually cut a slow or oversized
 * response off, not just that the option is passed through. Address resolution and scheme checks
 * are tested separately with a fake DNS lookup, so no test here ever makes a real DNS query or a
 * real outbound request.
 */

describe('parseFetchableUrl', () => {
  it('accepts http and https', () => {
    expect(parseFetchableUrl('http://example.com/a').protocol).toBe('http:');
    expect(parseFetchableUrl('https://example.com/a').protocol).toBe('https:');
  });

  it.each(['ftp://example.com', 'file:///etc/passwd', 'javascript:alert(1)', 'not a url'])(
    'refuses %s',
    (url) => {
      expect(() => parseFetchableUrl(url)).toThrow(RecipeFetchError);
    },
  );
});

describe('resolveAllowedAddresses', () => {
  it('needs no DNS lookup for a literal IP, and refuses a literal loopback address', async () => {
    await expect(resolveAllowedAddresses('127.0.0.1', neverCalled())).rejects.toMatchObject({
      code: 'private_address',
    });
  });

  it('refuses the cloud metadata address by its literal IP', async () => {
    await expect(resolveAllowedAddresses('169.254.169.254', neverCalled())).rejects.toMatchObject({
      code: 'private_address',
    });
  });

  it('refuses a hostname that resolves to a private address (DNS rebinding)', async () => {
    const lookup: DnsLookup = () => Promise.resolve([{ address: '10.0.0.5', family: 4 }]);
    await expect(resolveAllowedAddresses('evil.example.com', lookup)).rejects.toMatchObject({
      code: 'private_address',
    });
  });

  it('refuses a hostname when any of several resolved addresses is private', async () => {
    const lookup: DnsLookup = () =>
      Promise.resolve([
        { address: '8.8.8.8', family: 4 },
        { address: '192.168.1.1', family: 4 },
      ]);
    await expect(resolveAllowedAddresses('mixed.example.com', lookup)).rejects.toMatchObject({
      code: 'private_address',
    });
  });

  it('allows a hostname that resolves only to public addresses', async () => {
    const lookup: DnsLookup = () => Promise.resolve([{ address: '93.184.216.34', family: 4 }]);
    await expect(resolveAllowedAddresses('example.com', lookup)).resolves.toEqual([
      { address: '93.184.216.34', family: 4 },
    ]);
  });

  it('wraps a DNS failure as an invalid_url error rather than throwing raw', async () => {
    const lookup: DnsLookup = () => Promise.reject(new Error('ENOTFOUND'));
    await expect(resolveAllowedAddresses('nowhere.invalid', lookup)).rejects.toMatchObject({
      code: 'invalid_url',
    });
  });

  function neverCalled(): DnsLookup {
    return () => Promise.reject(new Error('a literal IP must never trigger a DNS lookup'));
  }
});

describe('requestWithLimits', () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    while (servers.length > 0) {
      const server = servers.pop();
      await new Promise<void>((resolve) =>
        server?.close(() => {
          resolve();
        }),
      );
    }
  });

  async function serve(
    handler: (request: http.IncomingMessage, response: http.ServerResponse) => void,
  ): Promise<URL> {
    const server = http.createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    return new URL(`http://127.0.0.1:${String(port)}/`);
  }

  it('returns the body of a normal 200 response', async () => {
    const url = await serve((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<html>hi</html>');
    });
    const page = await requestWithLimits(url, {
      address: '127.0.0.1',
      family: 4,
      userAgent: 'Hestia/1.0 (+https://hestia.test)',
    });
    expect(page.status).toBe(200);
    expect(page.body).toBe('<html>hi</html>');
  });

  it('sends the given User-Agent header', async () => {
    let seen: string | undefined;
    const url = await serve((request, response) => {
      seen = request.headers['user-agent'];
      response.writeHead(200);
      response.end('ok');
    });
    await requestWithLimits(url, {
      address: '127.0.0.1',
      family: 4,
      userAgent: 'Hestia/1.0 (self-hosted household admin; +https://hestia.test)',
    });
    expect(seen).toBe('Hestia/1.0 (self-hosted household admin; +https://hestia.test)');
  });

  it('rejects a non-200 status', async () => {
    const url = await serve((_request, response) => {
      response.writeHead(404);
      response.end('not found');
    });
    await expect(
      requestWithLimits(url, { address: '127.0.0.1', family: 4, userAgent: 'test' }),
    ).rejects.toMatchObject({ code: 'http_error' });
  });

  it('refuses a redirect rather than following it', async () => {
    const url = await serve((_request, response) => {
      response.writeHead(302, { location: 'http://127.0.0.1/elsewhere' });
      response.end();
    });
    await expect(
      requestWithLimits(url, { address: '127.0.0.1', family: 4, userAgent: 'test' }),
    ).rejects.toMatchObject({ code: 'http_error' });
  });

  it('cuts off a response over the body cap', async () => {
    const url = await serve((_request, response) => {
      response.writeHead(200);
      // Writes forever in small chunks; only the cap is expected to stop it.
      const chunk = 'x'.repeat(1024);
      const interval = setInterval(() => response.write(chunk), 1);
      response.on('close', () => {
        clearInterval(interval);
      });
    });
    await expect(
      requestWithLimits(url, {
        address: '127.0.0.1',
        family: 4,
        userAgent: 'test',
        maxBodyBytes: 4_096,
        timeoutMs: 5_000,
      }),
    ).rejects.toMatchObject({ code: 'too_large' });
  });

  it('times out a response that never finishes', async () => {
    const url = await serve((_request, response) => {
      response.writeHead(200);
      response.write('starting...');
      // Never calls response.end(); the server just holds the connection open.
    });
    await expect(
      requestWithLimits(url, {
        address: '127.0.0.1',
        family: 4,
        userAgent: 'test',
        timeoutMs: 100,
      }),
    ).rejects.toMatchObject({ code: 'timeout' });
  });

  it('rejects when nothing is listening at the address', async () => {
    await expect(
      requestWithLimits(new URL('http://127.0.0.1:1/'), {
        address: '127.0.0.1',
        family: 4,
        userAgent: 'test',
        timeoutMs: 2_000,
      }),
    ).rejects.toMatchObject({ code: 'network_error' });
  });
});

describe('fetchRecipePage', () => {
  it('waits for the host rate limiter and forwards the resolved address to the request step', async () => {
    const waited: string[] = [];
    const limiter = new HostRateLimiter();
    const originalWait = limiter.wait.bind(limiter);
    limiter.wait = (host: string) => {
      waited.push(host);
      return originalWait(host);
    };
    const lookup: DnsLookup = () => Promise.resolve([{ address: '93.184.216.34', family: 4 }]);
    const page = await fetchRecipePage('https://example.com/recipe', {
      userAgent: 'test',
      limiter,
      lookupFn: lookup,
      requestFn: (url, options) =>
        Promise.resolve({
          status: 200,
          body: `${url.hostname}:${options.address}:${String(options.family)}`,
        }),
    });
    expect(waited).toEqual(['example.com']);
    expect(page.body).toBe('example.com:93.184.216.34:4');
  });

  it('never reaches the request step for a private address', async () => {
    let called = false;
    await expect(
      fetchRecipePage('http://127.0.0.1/', {
        userAgent: 'test',
        limiter: new HostRateLimiter(),
        requestFn: () => {
          called = true;
          return Promise.resolve({ status: 200, body: '' });
        },
      }),
    ).rejects.toMatchObject({ code: 'private_address' });
    expect(called).toBe(false);
  });
});
