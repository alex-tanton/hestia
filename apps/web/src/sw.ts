/*
 * The app's service worker (Engineering Practices › PWA implementation). It is the only one:
 * vite-plugin-pwa injects the precache manifest into it (`injectManifest`), and nothing else is
 * cached by hand. Built with Workbox, so caching rules are written here rather than hand-rolled.
 */
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import {
  handleNotificationClick,
  handlePush,
  type NotificationClickEventLike,
  type PushEventLike,
  type WorkerScopeLike,
} from './lib/push/service-worker-handlers.ts';

interface PrecacheEntry {
  url: string;
  revision: string | null;
}

/** The worker's global scope, as far as this file uses it. The page's DOM typings do not apply. */
interface WorkerGlobal extends WorkerScopeLike {
  /** Replaced at build time by vite-plugin-pwa with this build's precache list. */
  __WB_MANIFEST: (PrecacheEntry | string)[];
  skipWaiting: () => Promise<void>;
  addEventListener(type: 'push', listener: (event: PushEventLike) => void): void;
  addEventListener(
    type: 'notificationclick',
    listener: (
      event: NotificationClickEventLike & { waitUntil: (p: Promise<unknown>) => void },
    ) => void,
  ): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

declare const self: WorkerGlobal;

/*
 * Precache the build: the shell, its stylesheet, and the icons, revisioned at build time. The
 * update flow is prompt-style (Engineering Practices › Service worker): a new worker waits until
 * the user asks for it, so nothing reloads mid-task.
 */
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

/*
 * A navigation is answered from the precached shell, so every app path works offline. API and
 * auth calls are never answered by the worker (TanStack Query persists their results instead).
 */
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//, /^\/auth\//, /^\/realtime\//],
  }),
);

/*
 * Deal images come straight from Flipp's CDN: cache-first, 7-day expiry, 100-entry cap. These two
 * hosts are the only ones the CSP's img-src allows for images (Technical Architecture, "Routing").
 * Cross-origin responses are opaque, so status 0 counts as cacheable alongside 200.
 */
// Workbox's plugin typings predate exactOptionalPropertyTypes; the plugins are valid at runtime.
type CachePlugin = NonNullable<
  NonNullable<ConstructorParameters<typeof CacheFirst>[0]>['plugins']
>[number];

registerRoute(
  ({ url }) =>
    url.origin === 'https://f.wishabi.net' || url.origin === 'https://images.wishabi.net',
  new CacheFirst({
    cacheName: 'deal-images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 }) as CachePlugin,
      new CacheableResponsePlugin({ statuses: [0, 200] }) as CachePlugin,
    ],
  }),
);

// The page posts this when the user asks for the waiting update (UpdatePrompt).
self.addEventListener('message', (event) => {
  const data = event.data as { type?: unknown } | null;
  if (data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

self.addEventListener('push', (event) => {
  handlePush(self, event);
});

self.addEventListener('notificationclick', (event) => {
  event.waitUntil(handleNotificationClick(self, event));
});
