import webPush from 'web-push';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebPushTransport } from './web-push-transport.js';

/*
 * The real transport's mapping from push-service answers to outcomes (404 and 410 delete the
 * subscription). `sendNotification` is replaced, so no request leaves the process.
 */

const KEYS = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA', auth: 'tBHItJI5svbpez7KI4CCXg' };
const ENDPOINT = 'https://push.example.com/send/alpha';
const SUBSCRIPTION = { id: 'sub-1', endpoint: ENDPOINT, keys: KEYS };

function vapid() {
  const keys = webPush.generateVAPIDKeys();
  return { subject: 'https://hestia.aberrance.app', ...keys };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createWebPushTransport', () => {
  it('reports accepted when the push service accepts, sending to the subscription endpoint', async () => {
    const send = vi.spyOn(webPush, 'sendNotification').mockResolvedValue({ statusCode: 201 });
    const transport = createWebPushTransport(vapid());

    await expect(transport.send(SUBSCRIPTION, '{"title":"t"}')).resolves.toStrictEqual({
      kind: 'accepted',
    });
    expect(send).toHaveBeenCalledWith({ endpoint: ENDPOINT, keys: KEYS }, '{"title":"t"}');
  });

  it.each([404, 410])('reports gone for %i, so the subscription is deleted', async (statusCode) => {
    vi.spyOn(webPush, 'sendNotification').mockRejectedValue(
      new webPush.WebPushError('gone', statusCode, {}, '', ENDPOINT),
    );
    const transport = createWebPushTransport(vapid());

    await expect(transport.send(SUBSCRIPTION, 'm')).resolves.toStrictEqual({ kind: 'gone' });
  });

  it.each([400, 413, 429, 500, 503])(
    'reports failed for %i, keeping the subscription',
    async (statusCode) => {
      vi.spyOn(webPush, 'sendNotification').mockRejectedValue(
        new webPush.WebPushError('failed', statusCode, {}, '', ENDPOINT),
      );
      const transport = createWebPushTransport(vapid());

      await expect(transport.send(SUBSCRIPTION, 'm')).resolves.toStrictEqual({
        kind: 'failed',
        statusCode,
      });
    },
  );

  it('reports failed without a status for a network error', async () => {
    vi.spyOn(webPush, 'sendNotification').mockRejectedValue(new Error('ECONNRESET'));
    const transport = createWebPushTransport(vapid());

    await expect(transport.send(SUBSCRIPTION, 'm')).resolves.toStrictEqual({ kind: 'failed' });
  });

  it('refuses a malformed VAPID private key at construction, so startup fails rather than the first send', () => {
    expect(() =>
      createWebPushTransport({
        subject: 'https://hestia.aberrance.app',
        publicKey: 'not-a-key',
        privateKey: 'not-a-key',
      }),
    ).toThrow();
  });
});
