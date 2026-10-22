import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * The browser's own push port (push-port.ts) is what `push-double.ts` stands in for everywhere
 * else (no test contacts a push service) — which is exactly why
 * its own logic is otherwise never exercised. This file drives `browserPushPort` directly, faking
 * only the browser APIs it reads: `Notification`, `PushManager`, and `navigator.serviceWorker`.
 */

vi.mock('../use-install-prompt.ts', () => ({
  isIosBrowser: vi.fn(() => false),
  isStandalone: vi.fn(() => false),
}));

const { isIosBrowser, isStandalone } = await import('../use-install-prompt.ts');

function stubServiceWorker(container: Record<string, unknown>): void {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: container,
    configurable: true,
  });
}

function stubBrowserApis(): void {
  vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() });
  // Only ever checked with `'PushManager' in window`; push-port.ts never constructs one.
  vi.stubGlobal('PushManager', {});
  stubServiceWorker({});
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.mocked(isIosBrowser).mockReturnValue(false);
  vi.mocked(isStandalone).mockReturnValue(false);
  Reflect.deleteProperty(navigator, 'serviceWorker');
  vi.resetModules();
});

describe('support', () => {
  it('reports ios-not-installed on iOS Safari before the app is on the home screen', async () => {
    vi.mocked(isIosBrowser).mockReturnValue(true);
    vi.mocked(isStandalone).mockReturnValue(false);
    const { browserPushPort } = await import('./push-port.ts');
    expect(browserPushPort.support()).toBe('ios-not-installed');
  });

  it('is supported on an installed iOS home-screen app, same as any other browser', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'test-vapid-key');
    vi.mocked(isIosBrowser).mockReturnValue(true);
    vi.mocked(isStandalone).mockReturnValue(true);
    stubBrowserApis();
    const { browserPushPort } = await import('./push-port.ts');
    expect(browserPushPort.support()).toBe('supported');
  });

  it('is unsupported with no VAPID key configured, even with every browser API present', async () => {
    stubBrowserApis();
    const { browserPushPort } = await import('./push-port.ts');
    expect(browserPushPort.support()).toBe('unsupported');
  });

  it('is unsupported when a push API is missing, even with a VAPID key', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'test-vapid-key');
    // No serviceWorker, no PushManager, no Notification stubbed.
    const { browserPushPort } = await import('./push-port.ts');
    expect(browserPushPort.support()).toBe('unsupported');
  });

  it('is supported with a VAPID key and every push API present', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'test-vapid-key');
    stubBrowserApis();
    const { browserPushPort } = await import('./push-port.ts');
    expect(browserPushPort.support()).toBe('supported');
  });
});

describe('permission', () => {
  it('reads the browser’s own permission when the push APIs exist', async () => {
    stubBrowserApis();
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() });
    const { browserPushPort } = await import('./push-port.ts');
    expect(browserPushPort.permission()).toBe('granted');
  });

  it('reads as denied when the device has no push APIs at all', async () => {
    const { browserPushPort } = await import('./push-port.ts');
    expect(browserPushPort.permission()).toBe('denied');
  });
});

describe('requestPermission', () => {
  it('asks the browser and returns what it answered', async () => {
    const requestPermission = vi.fn(() => Promise.resolve('granted' as NotificationPermission));
    vi.stubGlobal('Notification', { permission: 'default', requestPermission });
    const { browserPushPort } = await import('./push-port.ts');
    await expect(browserPushPort.requestPermission()).resolves.toBe('granted');
    expect(requestPermission).toHaveBeenCalledOnce();
  });
});

describe('getSubscription', () => {
  it('resolves undefined when the device has no push APIs', async () => {
    const { browserPushPort } = await import('./push-port.ts');
    await expect(browserPushPort.getSubscription()).resolves.toBeUndefined();
  });

  it('resolves undefined when there is no worker registration yet', async () => {
    stubBrowserApis();
    stubServiceWorker({ getRegistration: () => Promise.resolve(undefined) });
    const { browserPushPort } = await import('./push-port.ts');
    await expect(browserPushPort.getSubscription()).resolves.toBeUndefined();
  });

  it('resolves undefined when the registration holds no subscription', async () => {
    stubBrowserApis();
    stubServiceWorker({
      getRegistration: () =>
        Promise.resolve({ pushManager: { getSubscription: () => Promise.resolve(undefined) } }),
    });
    const { browserPushPort } = await import('./push-port.ts');
    await expect(browserPushPort.getSubscription()).resolves.toBeUndefined();
  });

  it('converts a real PushSubscription into the shape the server takes', async () => {
    stubBrowserApis();
    const toJSON = () => ({
      endpoint: 'https://push.example.com/device-a',
      keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
    });
    stubServiceWorker({
      getRegistration: () =>
        Promise.resolve({ pushManager: { getSubscription: () => Promise.resolve({ toJSON }) } }),
    });
    const { browserPushPort } = await import('./push-port.ts');
    await expect(browserPushPort.getSubscription()).resolves.toEqual({
      endpoint: 'https://push.example.com/device-a',
      keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
    });
  });

  it('refuses a subscription the browser returned without its keys', async () => {
    stubBrowserApis();
    stubServiceWorker({
      getRegistration: () =>
        Promise.resolve({
          pushManager: {
            getSubscription: () =>
              Promise.resolve({ toJSON: () => ({ endpoint: undefined, keys: undefined }) }),
          },
        }),
    });
    const { browserPushPort } = await import('./push-port.ts');
    await expect(browserPushPort.getSubscription()).rejects.toThrow(
      'The browser returned a push subscription without its keys.',
    );
  });
});

describe('subscribe', () => {
  it('waits for the worker to activate, then subscribes with the decoded application key', async () => {
    stubBrowserApis();
    const subscribe = vi.fn(
      (options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) =>
        Promise.resolve({
          userVisibleOnly: options.userVisibleOnly,
          toJSON: () => ({
            endpoint: 'https://push.example.com/device-a',
            keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
          }),
        }),
    );
    stubServiceWorker({ ready: Promise.resolve({ pushManager: { subscribe } }) });
    const { browserPushPort } = await import('./push-port.ts');

    // base64url, with both characters the decoder has to translate back (- and _) and no padding.
    await expect(browserPushPort.subscribe('AP8_-Q')).resolves.toEqual({
      endpoint: 'https://push.example.com/device-a',
      keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
    });

    expect(subscribe).toHaveBeenCalledOnce();
    const call = subscribe.mock.calls[0]?.[0];
    if (call === undefined) throw new Error('subscribe was not called');
    expect(call.userVisibleOnly).toBe(true);
    expect(Array.from(call.applicationServerKey)).toEqual([0, 255, 63, 249]);
  });
});

describe('unsubscribe', () => {
  it('does nothing when the device has no push APIs', async () => {
    const { browserPushPort } = await import('./push-port.ts');
    await expect(browserPushPort.unsubscribe()).resolves.toBeUndefined();
  });

  it('does nothing when there is no subscription to remove', async () => {
    stubBrowserApis();
    stubServiceWorker({
      getRegistration: () =>
        Promise.resolve({ pushManager: { getSubscription: () => Promise.resolve(undefined) } }),
    });
    const { browserPushPort } = await import('./push-port.ts');
    await expect(browserPushPort.unsubscribe()).resolves.toBeUndefined();
  });

  it('unsubscribes the device’s current subscription', async () => {
    stubBrowserApis();
    const unsubscribe = vi.fn(() => Promise.resolve(true));
    stubServiceWorker({
      getRegistration: () =>
        Promise.resolve({
          pushManager: { getSubscription: () => Promise.resolve({ unsubscribe }) },
        }),
    });
    const { browserPushPort } = await import('./push-port.ts');
    await browserPushPort.unsubscribe();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
