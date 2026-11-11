import { randomInt } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { BASE_URL } from '../support/env.ts';
import { serviceLogLines } from '../support/logs.ts';

/**
 * Production learns the client address only from Cloudflare's `CF-Connecting-IP` header, through
 * the trusted cloudflared hop on the Compose network. The E2E stack has no Cloudflare in front of
 * it, so this spec sends the header the way the edge would and reads the address the service logged.
 * The production CSP host is covered by `scripts/caddy-entrypoint.test.mjs`.
 *
 * Each address comes from a documentation range with a random last octet, so the lines an earlier
 * test or a reused stack left in the log cannot satisfy a test.
 */

/** TEST-NET-3: stands in for the client Cloudflare names. */
function cloudflareClient(): string {
  return `203.0.113.${String(randomInt(1, 255))}`;
}

/** TEST-NET-2: stands in for an address a client invents. */
function spoofedClient(): string {
  return `198.51.100.${String(randomInt(1, 255))}`;
}

/** The `req.remoteAddress` of every logged `/api/health` request, oldest first. */
function healthClientAddresses(): string[] {
  const addresses: string[] = [];
  for (const line of serviceLogLines()) {
    const req = line['req'];
    if (typeof req !== 'object' || req === null) continue;
    if (!('url' in req) || req.url !== '/api/health') continue;
    if ('remoteAddress' in req && typeof req.remoteAddress === 'string') {
      addresses.push(req.remoteAddress);
    }
  }
  return addresses;
}

test('CF-Connecting-IP names the client and X-Forwarded-For is ignored', async ({ request }) => {
  const client = cloudflareClient();
  const spoof = spoofedClient();

  const response = await request.get('/api/health', {
    headers: { 'CF-Connecting-IP': client, 'X-Forwarded-For': spoof },
  });
  expect(response.status()).toBe(200);

  await expect.poll(() => healthClientAddresses()).toContain(client);
  expect(healthClientAddresses()).not.toContain(spoof);
});

test('X-Forwarded-For alone cannot choose the client address', async ({ request }) => {
  const spoof = spoofedClient();
  const anchor = cloudflareClient();

  const spoofed = await request.get('/api/health', { headers: { 'X-Forwarded-For': spoof } });
  expect(spoofed.status()).toBe(200);

  // The service logs in order, so once the anchor request is visible the spoofed one is too.
  const anchored = await request.get('/api/health', { headers: { 'CF-Connecting-IP': anchor } });
  expect(anchored.status()).toBe(200);
  await expect.poll(() => healthClientAddresses()).toContain(anchor);

  expect(healthClientAddresses()).not.toContain(spoof);
});

test("the CSP allows WebSockets to the stack's own host and no CORS or cookie header is sent", async ({
  request,
}) => {
  const page = await request.get('/');
  expect(page.status()).toBe(200);
  const csp = page.headers()['content-security-policy'] ?? '';
  const connectSrc = /connect-src\s+([^;]+)/i.exec(csp)?.[1] ?? '';
  const imgSrc = /img-src\s+([^;]+)/i.exec(csp)?.[1] ?? '';
  expect(csp).toContain(`connect-src 'self' wss://${new URL(BASE_URL).host}`);
  expect(imgSrc).toContain("'self' data:");
  for (const origin of [
    'https://*.flipp.com',
    'https://flipp-image-retrieval.flipp.com',
    'https://*.wishabi.com',
    'https://*.wishabi.net',
    'https://*.openfoodfacts.org',
  ]) {
    expect(imgSrc).toContain(origin);
    // Workbox CacheFirst in /sw.js fetches external images inside the service worker, which
    // Chromium checks against connect-src rather than img-src.
    expect(connectSrc).toContain(origin);
  }

  const health = await request.get('/api/health');
  for (const response of [page, health]) {
    expect(response.headers()['access-control-allow-origin']).toBeUndefined();
    expect(response.headers()['set-cookie']).toBeUndefined();
  }
});

test('serves static assets with immutable cache and entrypoints with no-cache', async ({
  request,
}) => {
  const index = await request.get('/index.html');
  expect(index.status()).toBe(200);
  expect(index.headers()['cache-control']).toBe('no-cache, must-revalidate');

  const sw = await request.get('/sw.js');
  expect(sw.status()).toBe(200);
  expect(sw.headers()['cache-control']).toBe('no-cache, must-revalidate');

  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.status()).toBe(200);
  expect(manifest.headers()['cache-control']).toBe('public, max-age=86400, must-revalidate');

  // Resolve a built asset link from index.html if present, or assert path matching directly
  const html = await index.text();
  const assetMatch = /\/assets\/[a-zA-Z0-9_-]+\.(?:js|css)/.exec(html);
  if (assetMatch) {
    const asset = await request.get(assetMatch[0]);
    expect(asset.status()).toBe(200);
    expect(asset.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
  }
});

test('active service worker fetches allowed external deal images without CSP block', async ({
  context,
  page,
}) => {
  const onePixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  );
  await context.route('https://f.wishabi.net/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: onePixelPng,
    }),
  );

  const cspErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /content security policy/i.test(message.text())) {
      cspErrors.push(message.text());
    }
  });

  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  });
  await page.reload();

  const result = await page.evaluate(async () => {
    const controller = Boolean(navigator.serviceWorker.controller);
    const loaded = await new Promise<{ ok: boolean; width: number }>((resolve) => {
      const img = document.createElement('img');
      img.onload = () => {
        resolve({ ok: true, width: img.naturalWidth });
      };
      img.onerror = () => {
        resolve({ ok: false, width: 0 });
      };
      img.src = 'https://f.wishabi.net/e2e-sw-csp-check.png';
      document.body.appendChild(img);
    });
    return { controller, loaded };
  });

  expect(result.controller).toBe(true);
  expect(result.loaded).toEqual({ ok: true, width: 1 });
  expect(cspErrors).toEqual([]);
});
