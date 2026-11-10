import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { pushTestSeam } from './test-seam.js';
import { RecordingPushTransport } from './recording-transport.js';

const KEY = 'service-role-key-for-the-test';

async function seam(dispatch: (now: Date) => Promise<boolean>) {
  const transport = new RecordingPushTransport();
  const app = Fastify();
  await app.register(pushTestSeam({ serviceRoleKey: KEY, transport, dispatch }));
  return { app, transport };
}

const AUTH = { authorization: `Bearer ${KEY}` };

describe('pushTestSeam', () => {
  it('refuses every request without the service-role key', async () => {
    const { app } = await seam(() => Promise.resolve(true));
    for (const headers of [{}, { authorization: 'Bearer wrong' }, { authorization: KEY }]) {
      const response = await app.inject({
        method: 'GET',
        url: '/api/test/push/deliveries',
        headers,
      });
      expect(response.statusCode).toBe(401);
    }
    await app.close();
  }, 15000);

  it('runs the dispatch job at the instant it is given, and reports whether it ran', async () => {
    const clocks: Date[] = [];
    const { app } = await seam((now) => {
      clocks.push(now);
      return Promise.resolve(true);
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/test/push/dispatch',
      headers: AUTH,
      payload: { now: '2026-10-02T15:00:00Z' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ran: true });
    expect(clocks.map((clock) => clock.toISOString())).toEqual(['2026-10-02T15:00:00.000Z']);
    await app.close();
  });

  it('refuses a dispatch body without an offset-bearing instant', async () => {
    const { app } = await seam(() => Promise.resolve(true));
    for (const payload of [{}, { now: 'tomorrow' }, { now: '2026-10-02T15:00:00' }]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/test/push/dispatch',
        headers: AUTH,
        payload,
      });
      expect(response.statusCode).toBe(400);
    }
    await app.close();
  }, 15000);

  it('reads back every push the transport recorded', async () => {
    const { app, transport } = await seam(() => Promise.resolve(true));
    transport.sent.push({ endpoint: 'https://push.example.test/a', message: '{"title":"t"}' });
    const response = await app.inject({
      method: 'GET',
      url: '/api/test/push/deliveries',
      headers: AUTH,
    });
    expect(response.json()).toEqual({
      deliveries: [{ endpoint: 'https://push.example.test/a', message: '{"title":"t"}' }],
    });
    await app.close();
  });
});
