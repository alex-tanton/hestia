import type { DeviceSubscription, PushPort, PushSupport } from '../lib/push/push-port.ts';

/*
 * A push port a test drives by hand (no test contacts a push
 * service). It records what the browser was asked, in order, into `log`, which a test can share
 * with its fetch stub to assert the order of prompt and request.
 */

export const TEST_VAPID_PUBLIC_KEY = 'test-vapid-public-key';

export const TEST_DEVICE_SUBSCRIPTION: DeviceSubscription = {
  endpoint: 'https://push.example.com/device-a',
  keys: { p256dh: 'p256dh-key-material', auth: 'auth-key-material' },
};

export interface PushDoubleOptions {
  support?: PushSupport;
  permission?: NotificationPermission;
  /** What the user answers when the browser asks. Defaults to granting. */
  answer?: NotificationPermission;
  /** A subscription the device already holds. */
  subscription?: DeviceSubscription;
  log?: string[];
}

export interface PushDouble extends PushPort {
  readonly log: string[];
  /** Replaces the device's subscription, as a browser would after a push service refusal. */
  setSubscription: (subscription: DeviceSubscription | undefined) => void;
  /** Changes what the user answers the next time the browser asks. */
  answerWith: (answer: NotificationPermission) => void;
}

export function createPushDouble({
  support = 'supported',
  permission = 'default',
  answer: initialAnswer = 'granted',
  subscription: initialSubscription,
  log = [],
}: PushDoubleOptions = {}): PushDouble {
  let currentPermission = permission;
  let answer = initialAnswer;
  let subscription = initialSubscription;
  return {
    log,
    vapidPublicKey: TEST_VAPID_PUBLIC_KEY,
    support: () => support,
    permission: () => currentPermission,
    requestPermission: () => {
      log.push('requestPermission');
      currentPermission = answer;
      return Promise.resolve(answer);
    },
    answerWith: (next) => {
      answer = next;
    },
    getSubscription: () => Promise.resolve(subscription),
    subscribe: (applicationServerKey) => {
      log.push(`subscribe:${applicationServerKey}`);
      subscription = TEST_DEVICE_SUBSCRIPTION;
      return Promise.resolve(TEST_DEVICE_SUBSCRIPTION);
    },
    unsubscribe: () => {
      log.push('unsubscribe');
      subscription = undefined;
      return Promise.resolve();
    },
    setSubscription: (next) => {
      subscription = next;
    },
  };
}
