import webPush from 'web-push';
import type {
  PushOutcome,
  PushSubscriptionRecord,
  PushTransport,
} from '../jobs/dispatch-notifications.js';

export interface VapidConfig {
  subject: string;
  publicKey: string;
  privateKey: string;
}

/**
 * The real Web Push transport, sending through the push service each subscription names. The VAPID
 * key pair is set once here, so a malformed key fails at startup in `main.ts` rather than on the
 * first send. Tests never build this: they hand the job a double.
 */
export function createWebPushTransport(vapid: VapidConfig): PushTransport {
  webPush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  return {
    send: async (subscription: PushSubscriptionRecord, message: string): Promise<PushOutcome> => {
      try {
        await webPush.sendNotification(
          { endpoint: subscription.endpoint, keys: subscription.keys },
          message,
        );
        return { kind: 'accepted' };
      } catch (error: unknown) {
        if (error instanceof webPush.WebPushError) {
          // 404 and 410 both mean the push service no longer knows this subscription.
          if (error.statusCode === 404 || error.statusCode === 410) return { kind: 'gone' };
          return { kind: 'failed', statusCode: error.statusCode };
        }
        return { kind: 'failed' };
      }
    },
  };
}
