import { isIosBrowser, isStandalone } from '../use-install-prompt.ts';

/*
 * The browser's half of Web Push, behind an interface so the permission flow is testable without
 * a push service (Engineering Practices › Testing: no test contacts a push endpoint).
 */

/**
 * Whether this device can take push at all. `ios-not-installed` is its own state: on iOS, push
 * works only once the app is on the home screen (Engineering Practices › Install and notifications).
 */
export type PushSupport = 'supported' | 'unsupported' | 'ios-not-installed';

/** A device's subscription in the shape `POST /api/users/me/push-subscriptions` takes. */
export interface DeviceSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPort {
  /** The VAPID public key this build subscribes with; the private half never reaches the page. */
  readonly vapidPublicKey: string;
  support: () => PushSupport;
  permission: () => NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  getSubscription: () => Promise<DeviceSubscription | undefined>;
  subscribe: (applicationServerKey: string) => Promise<DeviceSubscription>;
  /** Removes this device's subscription locally; the server prunes its row on the next 404 or 410. */
  unsubscribe: () => Promise<void>;
}

/** Set at build time by the caddy image (Technical Architecture, "Auth configuration"). */
export const VAPID_PUBLIC_KEY: string = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

function hasPushApis(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function toDeviceSubscription(subscription: PushSubscription): DeviceSubscription {
  const json = subscription.toJSON();
  const p256dh = json.keys?.['p256dh'];
  const auth = json.keys?.['auth'];
  if (json.endpoint === undefined || p256dh === undefined || auth === undefined) {
    throw new Error('The browser returned a push subscription without its keys.');
  }
  return { endpoint: json.endpoint, keys: { p256dh, auth } };
}

/** `applicationServerKey` is base64url; the browser wants its raw bytes. */
function decodeApplicationServerKey(key: string): Uint8Array<ArrayBuffer> {
  const padded = key
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(key.length / 4) * 4, '=');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

export const browserPushPort: PushPort = {
  vapidPublicKey: VAPID_PUBLIC_KEY,

  support() {
    if (isIosBrowser() && !isStandalone()) return 'ios-not-installed';
    if (VAPID_PUBLIC_KEY === '' || !hasPushApis()) return 'unsupported';
    return 'supported';
  },

  permission() {
    return hasPushApis() ? Notification.permission : 'denied';
  },

  requestPermission() {
    return Notification.requestPermission();
  },

  async getSubscription() {
    if (!hasPushApis()) return undefined;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    return subscription ? toDeviceSubscription(subscription) : undefined;
  },

  async subscribe(applicationServerKey) {
    // `ready` waits for the worker to activate, which a first subscribe needs; the push manager
    // cannot subscribe through a registration that has no active worker.
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeApplicationServerKey(applicationServerKey),
    });
    return toDeviceSubscription(subscription);
  },

  async unsubscribe() {
    if (!hasPushApis()) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe();
  },
};
