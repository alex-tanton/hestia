import {
  FALLBACK_NOTIFICATION,
  HOUSEHOLD_PARAM,
  NOTIFICATION_CLICK_MESSAGE,
  NOTIFICATION_ICON,
  parsePushMessage,
  safePath,
} from './push-message.ts';

/*
 * The push and notificationclick handlers, written against the few worker APIs they use rather
 * than the worker's global types, so the page's type-checking and tests need no webworker lib.
 * `src/sw.ts` passes the real `self` in; tests pass a fake with the same shape.
 */

export interface WindowClientLike {
  readonly visibilityState?: string;
  readonly focused?: boolean;
  focus: () => Promise<unknown>;
  postMessage: (message: unknown) => void;
}

export interface WorkerScopeLike {
  registration: {
    showNotification: (
      title: string,
      options: { body: string; icon: string; data: unknown },
    ) => Promise<void>;
  };
  clients: {
    matchAll: (options: {
      type: 'window';
      includeUncontrolled: boolean;
    }) => Promise<WindowClientLike[]>;
    openWindow: (url: string) => Promise<unknown>;
  };
}

export interface PushEventLike {
  data: { text: () => string } | null;
  waitUntil: (promise: Promise<unknown>) => void;
}

export interface NotificationClickEventLike {
  notification: { close: () => void; data: unknown };
}

/** What a shown notification carries, so a later tap knows where to go. */
export interface NotificationData {
  url: string;
  householdId: string | undefined;
}

export function handlePush(scope: WorkerScopeLike, event: PushEventLike): void {
  const message = parsePushMessage(event.data?.text());
  const shown = message ?? FALLBACK_NOTIFICATION;
  const data: NotificationData = {
    url: message?.url ?? '/',
    householdId: message?.householdId,
  };
  event.waitUntil(
    scope.registration.showNotification(shown.title, {
      body: shown.body,
      icon: NOTIFICATION_ICON,
      data,
    }),
  );
}

/** A `?household=` the page reads and removes, so the switch happens once and the URL stays clean. */
export function openTarget(url: string, householdId: string | undefined): string {
  if (householdId === undefined) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${HOUSEHOLD_PARAM}=${encodeURIComponent(householdId)}`;
}

function readData(value: unknown): NotificationData {
  const { url, householdId } = (value ?? {}) as Partial<Record<keyof NotificationData, unknown>>;
  return {
    url: safePath(url),
    householdId: typeof householdId === 'string' ? householdId : undefined,
  };
}

/**
 * A tap focuses an open window and posts the target to it, so the page can switch household and
 * route in place. With no window open, the app opens with the target carried in the URL instead.
 */
export async function handleNotificationClick(
  scope: WorkerScopeLike,
  event: NotificationClickEventLike,
): Promise<void> {
  event.notification.close();
  const { url, householdId } = readData(event.notification.data);

  const windows = await scope.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const target =
    windows.find((client) => client.focused === true) ??
    windows.find((client) => client.visibilityState === 'visible') ??
    windows[0];

  if (target !== undefined) {
    await target.focus();
    target.postMessage({ type: NOTIFICATION_CLICK_MESSAGE, url, householdId });
    return;
  }
  await scope.clients.openWindow(openTarget(url, householdId));
}
