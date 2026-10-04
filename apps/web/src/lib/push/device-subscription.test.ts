import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../api/client.ts';
import { createAuthStub, createFetchStub, type StubHandler } from '../../test/harness.tsx';
import {
  TEST_DEVICE_SUBSCRIPTION,
  TEST_VAPID_PUBLIC_KEY,
  createPushDouble,
} from '../../test/push-double.ts';
import { ensurePushSubscription, removeDeviceSubscription } from './device-subscription.ts';

/*
 * The permission flow's order is the contract: the prompt is shown only when asked for, a refused
 * device is never prompted again, and sign-out removes the server row before the local one.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A fetch stub whose handlers append to the same log the push double writes to. */
function apiWith(log: string[], extra: Readonly<Record<string, StubHandler>> = {}) {
  const stub = createFetchStub({
    'POST /api/users/me/push-subscriptions': () => {
      log.push('POST');
      return { status: 204 };
    },
    'DELETE /api/users/me/push-subscriptions': () => {
      log.push('DELETE');
      return { status: 204 };
    },
    ...extra,
  });
  return { stub, api: createApiClient(createAuthStub(), stub.fetch) };
}

describe('ensurePushSubscription', () => {
  it('asks for permission, then subscribes, then registers the device, in that order', async () => {
    const log: string[] = [];
    const port = createPushDouble({ permission: 'default', answer: 'granted', log });
    const { stub, api } = apiWith(log);

    const outcome = await ensurePushSubscription(port, api);

    expect(outcome).toBe('subscribed');
    expect(log).toStrictEqual(['requestPermission', `subscribe:${TEST_VAPID_PUBLIC_KEY}`, 'POST']);
    expect(stub.calls.at(-1)).toStrictEqual({
      method: 'POST',
      path: '/api/users/me/push-subscriptions',
      body: TEST_DEVICE_SUBSCRIPTION,
    });
  });

  it('never asks again once the browser has been refused', async () => {
    const log: string[] = [];
    const port = createPushDouble({ permission: 'denied', log });
    const { stub, api } = apiWith(log);

    const outcome = await ensurePushSubscription(port, api);

    expect(outcome).toBe('denied');
    expect(log).toStrictEqual([]);
    expect(stub.calls).toHaveLength(0);
  });

  it('treats a dismissed prompt as not yet allowed, without subscribing', async () => {
    const log: string[] = [];
    const port = createPushDouble({ permission: 'default', answer: 'default', log });
    const { stub, api } = apiWith(log);

    const outcome = await ensurePushSubscription(port, api);

    expect(outcome).toBe('dismissed');
    expect(log).toStrictEqual(['requestPermission']);
    expect(stub.calls).toHaveLength(0);
  });

  it('asks again on the next type-on after a dismissed prompt', async () => {
    const log: string[] = [];
    const port = createPushDouble({ permission: 'default', answer: 'default', log });
    const { api } = apiWith(log);

    await ensurePushSubscription(port, api);
    const second = await ensurePushSubscription(port, api);

    expect(second).toBe('dismissed');
    expect(log).toStrictEqual(['requestPermission', 'requestPermission']);
  });

  it('then subscribes once the dismissed prompt is answered on a later type-on', async () => {
    const log: string[] = [];
    const port = createPushDouble({ permission: 'default', answer: 'default', log });
    const { api } = apiWith(log);

    await ensurePushSubscription(port, api);
    port.answerWith('granted');
    const outcome = await ensurePushSubscription(port, api);

    expect(outcome).toBe('subscribed');
    expect(log.slice(-2)).toStrictEqual([`subscribe:${TEST_VAPID_PUBLIC_KEY}`, 'POST']);
  });

  it('reuses an existing subscription rather than creating another, and refreshes its keys', async () => {
    const log: string[] = [];
    const port = createPushDouble({
      permission: 'granted',
      subscription: TEST_DEVICE_SUBSCRIPTION,
      log,
    });
    const { stub, api } = apiWith(log);

    await ensurePushSubscription(port, api);

    expect(log).toStrictEqual(['POST']);
    expect(stub.calls).toHaveLength(1);
  });

  it('does nothing where push is not supported', async () => {
    const log: string[] = [];
    const port = createPushDouble({ support: 'ios-not-installed', permission: 'default', log });
    const { stub, api } = apiWith(log);

    const outcome = await ensurePushSubscription(port, api);

    expect(outcome).toBe('unsupported');
    expect(log).toStrictEqual([]);
    expect(stub.calls).toHaveLength(0);
  });
});

describe('removeDeviceSubscription', () => {
  it('deletes the server row first, while the token still works, then drops the local subscription', async () => {
    const log: string[] = [];
    const port = createPushDouble({
      permission: 'granted',
      subscription: TEST_DEVICE_SUBSCRIPTION,
      log,
    });
    const { stub, api } = apiWith(log);

    await removeDeviceSubscription(port, api, true);

    expect(log).toStrictEqual(['DELETE', 'unsubscribe']);
    expect(stub.calls.at(-1)).toStrictEqual({
      method: 'DELETE',
      path: '/api/users/me/push-subscriptions',
      body: { endpoint: TEST_DEVICE_SUBSCRIPTION.endpoint },
    });
  });

  it('offline, drops only the local subscription and sends nothing', async () => {
    const log: string[] = [];
    const port = createPushDouble({
      permission: 'granted',
      subscription: TEST_DEVICE_SUBSCRIPTION,
      log,
    });
    const { stub, api } = apiWith(log);

    await removeDeviceSubscription(port, api, false);

    expect(log).toStrictEqual(['unsubscribe']);
    expect(stub.calls).toHaveLength(0);
  });

  it('still drops the local subscription when the server delete fails', async () => {
    const log: string[] = [];
    const port = createPushDouble({
      permission: 'granted',
      subscription: TEST_DEVICE_SUBSCRIPTION,
      log,
    });
    const { api } = apiWith(log, {
      'DELETE /api/users/me/push-subscriptions': () => {
        log.push('DELETE');
        return { status: 500 };
      },
    });

    await removeDeviceSubscription(port, api, true);

    expect(log).toStrictEqual(['DELETE', 'unsubscribe']);
  });

  it('does nothing when the device holds no subscription', async () => {
    const log: string[] = [];
    const port = createPushDouble({ permission: 'granted', log });
    const { stub, api } = apiWith(log);

    await removeDeviceSubscription(port, api, true);

    expect(log).toStrictEqual([]);
    expect(stub.calls).toHaveLength(0);
  });
});
