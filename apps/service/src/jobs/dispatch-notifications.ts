import { notificationCopySchema, scrubErrorText, type NotificationType } from '@hearth/shared';
import { z } from 'zod';
import type { JobLogger } from './types.js';

/**
 * `dispatch-notifications` — every 2 minutes, the send step (Technical Architecture, "Scheduled
 * jobs" › "Dispatch"). It sends every due outbox row to each of its recipient's push subscriptions,
 * claims each row by stamping `sent_at` before the first send, releases the claim when no device
 * accepts, and retires rows that can no longer be delivered.
 *
 * The job holds no privilege of its own. Its cross-user reads and writes arrive as `DispatchOutbox`,
 * built in `privileged/` (the service-role capability), and the push transport arrives as
 * `PushTransport`, so every rule below is unit-testable with a double and no push endpoint is ever
 * contacted from a test.
 */

export interface PushKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  keys: PushKeys;
}

export interface DueNotification {
  id: string;
  type: NotificationType;
  /** The row's `payload` as stored; validated here rather than trusted. */
  payload: unknown;
  /** The recipient's push subscriptions at read time. */
  subscriptions: PushSubscriptionRecord[];
}

export interface ExpiredNotification {
  id: string;
  type: NotificationType;
}

/**
 * What one push attempt came to. `gone` is a 404 or 410: the push service has revoked the
 * subscription, so it is deleted. `failed` is anything else, and the subscription stays.
 */
export type PushOutcome =
  { kind: 'accepted' } | { kind: 'gone' } | { kind: 'failed'; statusCode?: number };

export interface PushTransport {
  send: (subscription: PushSubscriptionRecord, message: string) => Promise<PushOutcome>;
}

export interface DispatchOutbox {
  /** Deletes unsent rows whose retry window (`send_after` + 24 hours) has passed, and returns them. */
  expireOverdue: () => Promise<ExpiredNotification[]>;
  /** Unsent rows whose `send_after` has arrived, each with its recipient's subscriptions. */
  listDue: () => Promise<DueNotification[]>;
  /**
   * Stamps `sent_at` before any device is sent the row, so a row is claimed once. Returns false when
   * the row was already stamped and must not be sent again.
   */
  claim: (id: string) => Promise<boolean>;
  /** Clears the claim on a row no device accepted, so the next run retries it. */
  release: (id: string) => Promise<void>;
  /** Deletes an unsent row that will never be delivered. */
  deleteUnsent: (id: string) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
}

export interface DispatchDeps {
  outbox: DispatchOutbox;
  transport: PushTransport;
  logger: JobLogger;
}

export interface DispatchOutcome {
  /** Due rows examined this run. */
  due: number;
  /** Rows stamped as sent this run. */
  sent: number;
  /** Unsent rows deleted because their retry window passed. */
  expired: number;
  /** Unsent rows deleted because their copy failed validation. */
  rejected: number;
  /** Push subscriptions deleted because the push service reported them gone. */
  subscriptionsRemoved: number;
  /** Push attempts that failed for a reason other than the subscription being gone. */
  pushFailures: number;
}

/**
 * The screen each `payload.target` opens, so a tapped notification lands on the thing it is about.
 * An unknown or missing target opens the home screen rather than failing the send.
 */
const TARGET_PATHS: Readonly<Record<string, string>> = {
  flyers: '/lists/flyers',
  chores: '/chores',
  bills: '/bills',
  meals: '/meals',
  lists: '/lists',
};

const targetSchema = z.object({ target: z.string().optional() });

export function deepLinkFor(payload: unknown): string {
  const parsed = targetSchema.safeParse(payload);
  const target = parsed.success ? parsed.data.target : undefined;
  return (target !== undefined ? TARGET_PATHS[target] : undefined) ?? '/';
}

async function attempt(
  transport: PushTransport,
  subscription: PushSubscriptionRecord,
  message: string,
  logger: JobLogger,
): Promise<PushOutcome> {
  try {
    return await transport.send(subscription, message);
  } catch (error: unknown) {
    // A transport that throws is a failed push, not a failed run: the other devices still get theirs.
    logger.warn({ err: { message: scrubErrorText(error) } }, 'push transport threw');
    return { kind: 'failed' };
  }
}

/**
 * Sends every due row once. Each row is claimed (stamped `sent_at`) before any device is sent it,
 * so a restart or an overlapping run cannot send it twice. A claim that no device accepted is
 * released, so the next run retries it. Rows past their retry window
 * are deleted before anything is sent.
 *
 * The trade-off of claiming first: a crash after a claim and before any device accepts it loses
 * that one notification to the crashed run. No device is ever sent the same notification twice.
 */
export async function runDispatchNotifications(deps: DispatchDeps): Promise<DispatchOutcome> {
  const { outbox, transport, logger } = deps;
  const outcome: DispatchOutcome = {
    due: 0,
    sent: 0,
    expired: 0,
    rejected: 0,
    subscriptionsRemoved: 0,
    pushFailures: 0,
  };

  // Logged with the type and id only: the row's payload is household content and stays out of logs.
  for (const row of await outbox.expireOverdue()) {
    outcome.expired += 1;
    logger.warn({ type: row.type, id: row.id }, 'notification retry window passed; deleted unsent');
  }

  const due = await outbox.listDue();
  outcome.due = due.length;
  for (const row of due) {
    // Validated at read time as well as in the producers: an overlong or empty line
    // would fail on the device, and retrying cannot make it shorter, so the row is deleted now.
    const copy = notificationCopySchema.safeParse(row.payload);
    if (!copy.success) {
      await outbox.deleteUnsent(row.id);
      outcome.rejected += 1;
      logger.warn({ type: row.type, id: row.id }, 'notification copy rejected; deleted unsent');
      continue;
    }

    const message = JSON.stringify({
      title: copy.data.title,
      body: copy.data.body,
      url: deepLinkFor(row.payload),
    });

    if (!(await outbox.claim(row.id))) continue;

    let accepted = 0;
    for (const subscription of row.subscriptions) {
      const result = await attempt(transport, subscription, message, logger);
      if (result.kind === 'accepted') {
        accepted += 1;
      } else if (result.kind === 'gone') {
        await outbox.deleteSubscription(subscription.id);
        outcome.subscriptionsRemoved += 1;
      } else {
        outcome.pushFailures += 1;
        logger.warn(
          {
            type: row.type,
            id: row.id,
            subscriptionId: subscription.id,
            statusCode: result.statusCode,
          },
          'push send failed; subscription kept',
        );
      }
    }

    if (accepted > 0) {
      outcome.sent += 1;
    } else {
      await outbox.release(row.id);
    }
  }

  logger.info({ ...outcome }, 'dispatch-notifications finished');
  return outcome;
}
