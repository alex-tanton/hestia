import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { makeTestApp } from './test/fake-app.js';

const apps: FastifyInstance[] = [];

async function makeApp(pingDatabase: () => Promise<void>): Promise<FastifyInstance> {
  const app = await makeTestApp({ pingDatabase });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('GET /api/health', () => {
  it('reports ok when the database answers', async () => {
    const app = await makeApp(() => Promise.resolve());

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', database: 'ok' });
  });

  it('returns 503 problem details when the database is unreachable', async () => {
    const app = await makeApp(() => Promise.reject(new Error('connect ECONNREFUSED')));

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(503);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toEqual({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      detail: 'The database is unreachable.',
    });
    expect(response.body).not.toContain('ECONNREFUSED');
  });
});

describe('error handling', () => {
  it('answers unknown routes with 404 problem details', async () => {
    const app = await makeApp(() => Promise.resolve());

    const response = await app.inject({ method: 'GET', url: '/api/nope?x=1' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({ type: 'about:blank', title: 'Not Found', status: 404 });
  });

  it('hides internal error details behind 500 problem details', async () => {
    const app = await makeApp(() => Promise.resolve());
    app.get('/api/boom', () => {
      throw new Error('secret internals');
    });

    const response = await app.inject({ method: 'GET', url: '/api/boom' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
    });
  });
});

describe('rate limiting', () => {
  it('allows 300 requests a minute per IP, then 429 problem details with Retry-After', async () => {
    const app = await makeApp(() => Promise.resolve());

    for (let i = 0; i < 300; i += 1) {
      const ok = await app.inject({ method: 'GET', url: '/api/health' });
      expect(ok.statusCode).toBe(200);
    }
    const limited = await app.inject({ method: 'GET', url: '/api/health' });

    expect(limited.statusCode).toBe(429);
    expect(limited.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(limited.headers['retry-after']).toBeDefined();
    expect(limited.json()).toMatchObject({
      type: 'about:blank',
      title: 'Too Many Requests',
      status: 429,
    });

    // A different client IP has its own budget.
    const other = await app.inject({
      method: 'GET',
      url: '/api/health',
      remoteAddress: '10.0.0.2',
    });
    expect(other.statusCode).toBe(200);
  });

  it('limits unknown /api paths too', async () => {
    const app = await makeApp(() => Promise.resolve());

    for (let i = 0; i < 300; i += 1) {
      const missing = await app.inject({ method: 'GET', url: '/api/nope' });
      expect(missing.statusCode).toBe(404);
    }
    const limited = await app.inject({ method: 'GET', url: '/api/nope' });

    expect(limited.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('keys on the forwarded client IP only when the proxy is trusted', async () => {
    const app = await makeTestApp({}, { trustedProxies: ['127.0.0.1'] });
    apps.push(app);
    app.get('/api/ip', (request) => ({ ip: request.ip }));

    const viaProxy = await app.inject({
      method: 'GET',
      url: '/api/ip',
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });
    const viaUntrusted = await app.inject({
      method: 'GET',
      url: '/api/ip',
      remoteAddress: '198.51.100.1',
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });

    expect(viaProxy.json()).toEqual({ ip: '203.0.113.9' });
    expect(viaUntrusted.json()).toEqual({ ip: '198.51.100.1' });
  });
});
