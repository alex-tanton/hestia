import type { ApiClient } from '../api/client.ts';
import type { PushPort } from './push-port.ts';

/**
 * What turning a notification type on did on this device. `denied` and `dismissed` are not errors:
 * the type is on, and this device simply cannot receive it yet, which the screen says in words.
 */
export type EnableOutcome = 'subscribed' | 'denied' | 'dismissed' | 'unsupported';

/**
 * Registers this device for push after a notification type has been turned on.
 *
 * The order is the rule: the permission prompt is shown here and only here, which the caller
 * reaches only after the preference write has succeeded. A device that already said no is never
 * asked again; the screen explains where to change it instead.
 */
export async function ensurePushSubscription(
  port: PushPort,
  api: ApiClient,
): Promise<EnableOutcome> {
  if (port.support() !== 'supported') return 'unsupported';

  // Only a denied permission is final: the browser blocks any further prompt. A dismissed prompt
  // leaves the permission at 'default', so the next type-on asks again.
  let permission = port.permission();
  if (permission === 'denied') return 'denied';
  if (permission === 'default') {
    permission = await port.requestPermission();
    if (permission === 'denied') return 'denied';
    if (permission !== 'granted') return 'dismissed';
  }

  const subscription =
    (await port.getSubscription()) ?? (await port.subscribe(port.vapidPublicKey));
  // Posting the same endpoint again only refreshes its keys.
  await api.send({
    method: 'POST',
    path: '/api/users/me/push-subscriptions',
    body: { endpoint: subscription.endpoint, keys: subscription.keys },
  });
  return 'subscribed';
}

/**
 * Sign-out removes this device's subscription. Online, the server row goes at once. Offline nothing
 * is queued: the local subscription is dropped, and the server prunes the row the next time a push
 * to it is refused with 404 or 410, because the browser no longer holds the subscription behind it.
 */
export async function removeDeviceSubscription(
  port: PushPort,
  api: ApiClient,
  online: boolean,
): Promise<void> {
  const subscription = await port.getSubscription();
  if (subscription === undefined) return;
  if (online) {
    try {
      await api.send({
        method: 'DELETE',
        path: '/api/users/me/push-subscriptions',
        body: { endpoint: subscription.endpoint },
      });
    } catch {
      // The row is pruned on the next refused push; sign-out itself must not wait on this.
    }
  }
  await port.unsubscribe();
}
