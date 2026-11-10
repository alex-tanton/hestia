import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bearer, makeTestApp } from '../test/fake-app.js';

describe('barcode routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await makeTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects unauthenticated GET /api/barcodes/:barcode with 401 Problem Details', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/barcodes/012345678905',
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({
      status: 401,
      title: 'Unauthorized',
    });
  });

  it('rejects malformed barcode parameter with 400 Problem Details', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/barcodes/!@#',
      headers: bearer(),
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({
      status: 400,
      title: 'Bad Request',
    });
  });

  it('returns 404 Problem Details when barcode product is not found', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/barcodes/012345678905',
      headers: bearer(),
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({
      status: 404,
      title: 'Not Found',
      detail: 'Product not found for scanned barcode.',
    });
  });
});
