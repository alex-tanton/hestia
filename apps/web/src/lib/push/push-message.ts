/*
 * The wire contract between the push service, the service worker, and the page. It is kept free
 * of DOM and worker globals so the worker, the page, and their tests can all import it.
 *
 * The service sends `{ title, body, url, householdId? }`. `url` is a path inside the app, and
 * `householdId` is the household a tap switches to first.
 */

/** The message the worker posts to an open window when a notification is tapped. */
export const NOTIFICATION_CLICK_MESSAGE = 'hestia:notification-click';

/** The query parameter a tap carries into a window the worker had to open. */
export const HOUSEHOLD_PARAM = 'household';

/** The icon a notification shows; the app's own 192px icon. */
export const NOTIFICATION_ICON = '/icons/icon-192.png';

/** What a notification shows when a push arrives that cannot be read. Names nothing private. */
export const FALLBACK_NOTIFICATION = { title: 'Hestia', body: 'You have a new notification.' };

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  householdId: string | undefined;
}

export interface ClickMessage {
  type: typeof NOTIFICATION_CLICK_MESSAGE;
  url: string;
  householdId: string | undefined;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A deep link must be a path inside this app. Anything else (an absolute URL, or a protocol-
 * relative `//host`) would let a push send the user off-site, so it falls back to the dashboard.
 */
export function safePath(url: unknown): string {
  if (typeof url !== 'string') return '/';
  if (!url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) return '/';
  return url;
}

/** Reads a push body. A body that is not the expected shape yields `undefined`, never a throw. */
export function parsePushMessage(text: string | null | undefined): PushMessage | undefined {
  if (text === null || text === undefined) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null) return undefined;
  const { title, body, url, householdId } = value as Record<string, unknown>;
  if (typeof title !== 'string' || title.trim() === '') return undefined;
  if (typeof body !== 'string' || body.trim() === '') return undefined;
  const household =
    typeof householdId === 'string' && GUID.test(householdId) ? householdId : undefined;
  return { title, body, url: safePath(url), householdId: household };
}

/** Reads the message a worker posts on a tap. Anything else on the channel is not ours. */
export function parseClickMessage(data: unknown): ClickMessage | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const { type, url, householdId } = data as Record<string, unknown>;
  if (type !== NOTIFICATION_CLICK_MESSAGE) return undefined;
  const household =
    typeof householdId === 'string' && GUID.test(householdId) ? householdId : undefined;
  return { type: NOTIFICATION_CLICK_MESSAGE, url: safePath(url), householdId: household };
}
