import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * `sw.ts` is almost entirely Workbox setup (precaching, a navigation route, a cache-first route
 * for deal images) plus two listeners that delegate straight to `service-worker-handlers.ts`,
 * which already has its own direct test. Workbox itself needs a real service worker scope (an
 * install/activate lifecycle, the `caches` API) that jsdom does not have, so every Workbox export
 * is faked here; what this file actually checks is Hearth's own glue: which event goes to which
 * handler, the deal-image route's own matcher, and the one bit of real logic the worker has — the
 * `SKIP_WAITING` message check.
 */

vi.mock('workbox-precaching', () => ({
  precacheAndRoute: vi.fn(),
  cleanupOutdatedCaches: vi.fn(),
  createHandlerBoundToURL: vi.fn((url: string) => ({ boundTo: url })),
}));

vi.mock('workbox-routing', () => {
  class NavigationRoute {
    handler: unknown;
    options: unknown;
    constructor(handler: unknown, options: unknown) {
      this.handler = handler;
      this.options = options;
    }
  }
  return { NavigationRoute, registerRoute: vi.fn() };
});

vi.mock('workbox-strategies', () => {
  class CacheFirst {
    options: unknown;
    constructor(options: unknown) {
      this.options = options;
    }
  }
  return { CacheFirst };
});

vi.mock('workbox-cacheable-response', () => {
  class CacheableResponsePlugin {
    options: unknown;
    constructor(options: unknown) {
      this.options = options;
    }
  }
  return { CacheableResponsePlugin };
});

vi.mock('workbox-expiration', () => {
  class ExpirationPlugin {
    options: unknown;
    constructor(options: unknown) {
      this.options = options;
    }
  }
  return { ExpirationPlugin };
});

vi.mock('./lib/push/service-worker-handlers.ts', () => ({
  handlePush: vi.fn(),
  handleNotificationClick: vi.fn(() => Promise.resolve('handled')),
}));

interface FakeSelf {
  __WB_MANIFEST: { url: string; revision: string | null }[];
  skipWaiting: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
}

/** Loads a fresh `sw.ts` against a fresh fake `self`, since the module runs its setup on import. */
async function loadWorker(): Promise<{
  self: FakeSelf;
  listenersFor: (type: string) => ((event: never) => void)[];
}> {
  vi.resetModules();
  const listeners = new Map<string, ((event: never) => void)[]>();
  const fakeSelf: FakeSelf = {
    __WB_MANIFEST: [{ url: '/index.html', revision: 'build-1' }],
    skipWaiting: vi.fn(() => Promise.resolve()),
    addEventListener: vi.fn((type: string, listener: (event: never) => void) => {
      const forType = listeners.get(type) ?? [];
      forType.push(listener);
      listeners.set(type, forType);
    }),
  };
  vi.stubGlobal('self', fakeSelf);
  await import('./sw.ts');
  return { self: fakeSelf, listenersFor: (type) => listeners.get(type) ?? [] };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('precaching', () => {
  it('precaches the build manifest and drops outdated caches', async () => {
    const { precacheAndRoute, cleanupOutdatedCaches } = await import('workbox-precaching');
    const { self } = await loadWorker();
    expect(precacheAndRoute).toHaveBeenCalledWith(self.__WB_MANIFEST);
    expect(cleanupOutdatedCaches).toHaveBeenCalledOnce();
  });
});

describe('the navigation route', () => {
  it('answers every navigation from the precached shell, except api, auth, and realtime', async () => {
    const { createHandlerBoundToURL } = await import('workbox-precaching');
    const { registerRoute } = await import('workbox-routing');
    await loadWorker();

    expect(createHandlerBoundToURL).toHaveBeenCalledWith('index.html');
    const [navigationRoute] = vi.mocked(registerRoute).mock.calls[0] as unknown as [
      { handler: unknown; options: { denylist: RegExp[] } },
    ];
    expect(navigationRoute.handler).toEqual({ boundTo: 'index.html' });
    const { denylist } = navigationRoute.options;
    expect(denylist.some((pattern) => pattern.test('/api/lists'))).toBe(true);
    expect(denylist.some((pattern) => pattern.test('/auth/v1/token'))).toBe(true);
    expect(denylist.some((pattern) => pattern.test('/realtime/v1'))).toBe(true);
    expect(denylist.some((pattern) => pattern.test('/lists'))).toBe(false);
  });
});

describe('the deal-image route', () => {
  it("matches only Flipp's two image hosts, cache-first with a 7-day, 100-entry cap", async () => {
    const { registerRoute } = await import('workbox-routing');
    await loadWorker();

    const [matcher, strategy] = vi.mocked(registerRoute).mock.calls[1] as unknown as [
      (context: { url: URL }) => boolean,
      { options: { cacheName: string; plugins: { options: unknown }[] } },
    ];
    expect(matcher({ url: new URL('https://f.wishabi.net/flyer.jpg') })).toBe(true);
    expect(matcher({ url: new URL('https://images.wishabi.net/item.png') })).toBe(true);
    expect(matcher({ url: new URL('https://example.com/flyer.jpg') })).toBe(false);

    expect(strategy.options.cacheName).toBe('deal-images');
    expect(strategy.options.plugins).toEqual([
      { options: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 } },
      { options: { statuses: [0, 200] } },
    ]);
  });
});

describe('the SKIP_WAITING message', () => {
  it('skips waiting only when asked to, and never throws on an unrelated message', async () => {
    const { self, listenersFor } = await loadWorker();
    const [onMessage] = listenersFor('message');

    onMessage?.({ data: { type: 'SKIP_WAITING' } } as never);
    expect(self.skipWaiting).toHaveBeenCalledOnce();

    onMessage?.({ data: { type: 'SOMETHING_ELSE' } } as never);
    onMessage?.({ data: null } as never);
    expect(self.skipWaiting).toHaveBeenCalledOnce();
  });
});

describe('push delegation', () => {
  it('hands a push event straight to the shared handler, with the worker scope', async () => {
    const { handlePush } = await import('./lib/push/service-worker-handlers.ts');
    const { self, listenersFor } = await loadWorker();
    const [onPush] = listenersFor('push');

    const event = { data: null };
    onPush?.(event as never);
    expect(handlePush).toHaveBeenCalledWith(self, event);
  });
});

describe('notificationclick delegation', () => {
  it('waits on the shared handler, with the worker scope', async () => {
    const { handleNotificationClick } = await import('./lib/push/service-worker-handlers.ts');
    const { self, listenersFor } = await loadWorker();
    const [onClick] = listenersFor('notificationclick');

    const waitUntil = vi.fn();
    const event = { notification: { close: vi.fn() }, waitUntil };
    onClick?.(event as never);

    expect(handleNotificationClick).toHaveBeenCalledWith(self, event);
    expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise));
  });
});
