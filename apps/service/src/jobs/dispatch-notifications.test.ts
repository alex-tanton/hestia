import { describe, expect, it } from 'vitest';
import { recordingJobLogger, type JobLogLine } from '../test/job-logger.js';
import { RecordingPushTransport } from '../test/push-double.js';
import {
  deepLinkFor,
  runDispatchNotifications,
  type ClaimOutcome,
  type DispatchOutbox,
  type DueNotification,
  type ExpiredNotification,
  type PushSubscriptionRecord,
} from './dispatch-notifications.js';

/*
 * The send step. The outbox is in memory and the transport is a double, so each rule is asserted
 * without a database or a push endpoint. The SQL behind the outbox is covered by
 * dispatch-notifications.integration.test.ts.
 */

const KEYS = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA', auth: 'tBHItJI5svbpez7KI4CCXg' };

function device(name: string): PushSubscriptionRecord {
  return { id: `sub-${name}`, endpoint: `https://push.example.com/${name}`, keys: KEYS };
}

function row(overrides: Partial<DueNotification> & { id: string }): DueNotification {
  return {
    type: 'bill_due',
    payload: { title: 'Rent is due', body: 'Due on the 1st.', target: 'bills', householdId: 'h' },
    subscriptions: [device('a'), device('b')],
    ...overrides,
  };
}

/** An in-memory outbox that behaves like the table for the rules under test. */
class MemoryOutbox implements DispatchOutbox {
  due: DueNotification[];
  expired: ExpiredNotification[];
  /** Rows currently claimed, i.e. with `sent_at` set. */
  readonly stamped: string[] = [];
  readonly claimed: string[] = [];
  readonly released: string[] = [];
  readonly deletedUnsent: string[] = [];
  readonly deletedSubscriptions: string[] = [];
  readonly events: string[];

  constructor(due: DueNotification[], expired: ExpiredNotification[] = [], events: string[] = []) {
    this.due = due;
    this.expired = expired;
    this.events = events;
  }

  enqueueScheduled(): Promise<{ inserted: number; dropped: [] }> {
    this.events.push('enqueue');
    return Promise.resolve({ inserted: 0, dropped: [] });
  }

  expireOverdue(): Promise<ExpiredNotification[]> {
    const gone = this.expired;
    this.expired = [];
    return Promise.resolve(gone);
  }

  listDue(): Promise<DueNotification[]> {
    const open = this.due.filter(
      (one) => !this.stamped.includes(one.id) && !this.deletedUnsent.includes(one.id),
    );
    return Promise.resolve(open);
  }

  claim(id: string): Promise<ClaimOutcome> {
    this.events.push(`claim:${id}`);
    if (this.stamped.includes(id)) return Promise.resolve('taken');
    this.stamped.push(id);
    this.claimed.push(id);
    return Promise.resolve('claimed');
  }

  release(id: string): Promise<void> {
    this.events.push(`release:${id}`);
    const at = this.stamped.indexOf(id);
    if (at >= 0) this.stamped.splice(at, 1);
    this.released.push(id);
    return Promise.resolve();
  }

  deleteUnsent(id: string): Promise<void> {
    this.deletedUnsent.push(id);
    return Promise.resolve();
  }

  deleteSubscription(id: string): Promise<void> {
    this.deletedSubscriptions.push(id);
    for (const one of this.due) {
      one.subscriptions = one.subscriptions.filter((sub) => sub.id !== id);
    }
    return Promise.resolve();
  }
}

function harness(outbox: MemoryOutbox) {
  const transport = new RecordingPushTransport();
  const lines: JobLogLine[] = [];
  const logger = recordingJobLogger(lines);
  const run = () => runDispatchNotifications({ outbox, transport, logger });
  return { transport, lines, run };
}

/** Records each push attempt into the same event log the outbox writes to. */
function eventedTransport(events: string[]): RecordingPushTransport {
  const transport = new RecordingPushTransport();
  const send = transport.send.bind(transport);
  transport.send = (subscription, message) => {
    events.push(`send:${subscription.id}`);
    return send(subscription, message);
  };
  return transport;
}

describe('claim, then send', () => {
  it('claims a row before the first device is sent to, and sends each device once', async () => {
    const events: string[] = [];
    const outbox = new MemoryOutbox([row({ id: 'n1' })], [], events);
    const transport = eventedTransport(events);
    const logger = recordingJobLogger([]);

    await runDispatchNotifications({ outbox, transport, logger });

    expect(events).toStrictEqual(['enqueue', 'claim:n1', 'send:sub-a', 'send:sub-b']);
  });

  it('releases the claim when no device accepts, so the next run retries', async () => {
    const outbox = new MemoryOutbox([row({ id: 'n1' })]);
    const { transport, run } = harness(outbox);
    transport.outcomes.set('https://push.example.com/a', { kind: 'failed', statusCode: 503 });
    transport.outcomes.set('https://push.example.com/b', { kind: 'failed' });

    const first = await run();

    expect(outbox.released).toStrictEqual(['n1']);
    expect(outbox.stamped).toStrictEqual([]);
    expect(first.sent).toBe(0);

    transport.outcomes.clear();
    const second = await run();

    expect(second.sent).toBe(1);
    expect(outbox.claimed).toStrictEqual(['n1', 'n1']);
  });

  it('keeps the claim when one device accepts, so no device is sent the row again', async () => {
    const outbox = new MemoryOutbox([row({ id: 'n1' })]);
    const { transport, run } = harness(outbox);
    transport.outcomes.set('https://push.example.com/b', { kind: 'failed', statusCode: 500 });

    await run();
    transport.reset();
    await run();

    expect(outbox.released).toStrictEqual([]);
    expect(transport.sent).toStrictEqual([]);
  });

  it('sends nothing for a row another claimer already holds', async () => {
    class LostClaim extends MemoryOutbox {
      override claim(): Promise<ClaimOutcome> {
        return Promise.resolve('taken');
      }
    }
    const outbox = new LostClaim([row({ id: 'n1' })]);
    const { transport, run } = harness(outbox);

    const outcome = await run();

    expect(transport.sent).toStrictEqual([]);
    expect(outbox.released).toStrictEqual([]);
    expect(outcome.sent).toBe(0);
  });

  it('deletes unsent a row whose condition lapsed before the send, and pushes nothing', async () => {
    class LapsedCondition extends MemoryOutbox {
      override claim(id: string): Promise<ClaimOutcome> {
        this.deletedUnsent.push(id);
        return Promise.resolve('stale');
      }
    }
    const outbox = new LapsedCondition([row({ id: 'n1' })]);
    const { transport, lines, run } = harness(outbox);

    const outcome = await run();

    expect(transport.sent).toStrictEqual([]);
    expect(outbox.claimed).toStrictEqual([]);
    expect(outcome.stale).toBe(1);
    expect(
      lines.some((line) => line.message === 'notification no longer due; deleted unsent'),
    ).toBe(true);
  });

  it('leaves a row in place when its condition check throws, and pushes nothing', async () => {
    class ThrowingCheck extends MemoryOutbox {
      override claim(): Promise<ClaimOutcome> {
        return Promise.reject(new Error('connection reset'));
      }
    }
    const outbox = new ThrowingCheck([row({ id: 'n1' })]);
    const { transport, run } = harness(outbox);

    // The failed statement rolls back with its transaction, so the row is neither stamped nor
    // deleted; the run ends with the error, as a failed database write ends a run.
    await expect(run()).rejects.toThrow('connection reset');

    expect(outbox.deletedUnsent).toStrictEqual([]);
    expect(outbox.stamped).toStrictEqual([]);
    expect(transport.sent).toStrictEqual([]);
  });

  it('enqueues the scheduled reminders before it reads the rows due to send', async () => {
    const events: string[] = [];
    const outbox = new MemoryOutbox([row({ id: 'n1' })], [], events);
    const { run } = harness(outbox);

    await run();

    expect(events[0]).toBe('enqueue');
    expect(events.indexOf('enqueue')).toBeLessThan(events.indexOf('claim:n1'));
  });

  it('does not push to the accepting device again when a write fails after it accepted', async () => {
    class FailingDelete extends MemoryOutbox {
      override deleteSubscription(id: string): Promise<void> {
        return Promise.reject(new Error(`write failed for ${id}`));
      }
    }
    const outbox = new FailingDelete([row({ id: 'n1' })]);
    const { transport, run } = harness(outbox);
    transport.outcomes.set('https://push.example.com/b', { kind: 'gone' });

    await expect(run()).rejects.toThrow('write failed');
    expect(transport.sent.map((one) => one.endpoint)).toStrictEqual([
      'https://push.example.com/a',
      'https://push.example.com/b',
    ]);

    transport.reset();
    await run();

    expect(transport.sent).toStrictEqual([]);
    expect(outbox.stamped).toStrictEqual(['n1']);
  });
});

describe('sending to devices', () => {
  it('sends to every device and stamps sent_at once when all accept', async () => {
    const outbox = new MemoryOutbox([row({ id: 'n1' })]);
    const { transport, run } = harness(outbox);

    const outcome = await run();

    expect(transport.sent.map((one) => one.endpoint)).toStrictEqual([
      'https://push.example.com/a',
      'https://push.example.com/b',
    ]);
    expect(outbox.stamped).toStrictEqual(['n1']);
    expect(outcome).toMatchObject({ due: 1, sent: 1, pushFailures: 0, subscriptionsRemoved: 0 });
  });

  it('sends the title, body, and deep link in the payload', async () => {
    const outbox = new MemoryOutbox([row({ id: 'n1' })]);
    const { transport, run } = harness(outbox);

    await run();

    expect(JSON.parse(transport.sent[0]?.message ?? '')).toStrictEqual({
      title: 'Rent is due',
      body: 'Due on the 1st.',
      url: '/bills',
    });
  });

  it('stamps sent_at when one device accepts even though another fails, and keeps the failing device', async () => {
    const outbox = new MemoryOutbox([row({ id: 'n1' })]);
    const { transport, lines, run } = harness(outbox);
    transport.outcomes.set('https://push.example.com/b', { kind: 'failed', statusCode: 500 });

    const outcome = await run();

    expect(outbox.stamped).toStrictEqual(['n1']);
    expect(outbox.deletedSubscriptions).toStrictEqual([]);
    expect(outcome).toMatchObject({ sent: 1, pushFailures: 1 });
    const warning = lines.find((line) => line.message === 'push send failed; subscription kept');
    expect(warning?.data).toMatchObject({ type: 'bill_due', id: 'n1', statusCode: 500 });
    // Nothing about the endpoint goes into the log.
    expect(JSON.stringify(warning?.data)).not.toContain('push.example.com');
  });

  it('deletes a subscription the push service reports gone (404 or 410) and keeps the others', async () => {
    // The transport maps 404 and 410 to `gone`; that mapping is asserted in web-push-transport.test.ts.
    const outbox = new MemoryOutbox([row({ id: 'n1' })]);
    const { transport, run } = harness(outbox);
    transport.outcomes.set('https://push.example.com/a', { kind: 'gone' });

    const outcome = await run();

    expect(outbox.deletedSubscriptions).toStrictEqual(['sub-a']);
    expect(outbox.due[0]?.subscriptions.map((sub) => sub.id)).toStrictEqual(['sub-b']);
    expect(outcome.subscriptionsRemoved).toBe(1);
    expect(outbox.stamped).toStrictEqual(['n1']);
  });

  it('keeps a subscription whose push fails for any reason other than gone', async () => {
    const outbox = new MemoryOutbox([row({ id: 'n1', subscriptions: [device('a')] })]);
    const { transport, run } = harness(outbox);
    transport.outcomes.set('https://push.example.com/a', { kind: 'failed', statusCode: 429 });

    await run();

    expect(outbox.deletedSubscriptions).toStrictEqual([]);
    expect(outbox.stamped).toStrictEqual([]);
  });

  it('treats a transport that throws as a failed push, leaving the subscription in place', async () => {
    const outbox = new MemoryOutbox([row({ id: 'n1', subscriptions: [device('a'), device('b')] })]);
    const { transport, lines, run } = harness(outbox);
    transport.outcomes.set('https://push.example.com/a', new Error('socket hang up'));

    const outcome = await run();

    expect(outbox.deletedSubscriptions).toStrictEqual([]);
    expect(outbox.stamped).toStrictEqual(['n1']);
    expect(outcome.pushFailures).toBe(1);
    expect(lines.some((line) => line.message === 'push transport threw')).toBe(true);
  });

  it('leaves a row unsent when no device accepts it, so the next run retries', async () => {
    const outbox = new MemoryOutbox([row({ id: 'n1' })]);
    const { transport, run } = harness(outbox);
    transport.outcomes.set('https://push.example.com/a', { kind: 'failed', statusCode: 503 });
    transport.outcomes.set('https://push.example.com/b', { kind: 'failed' });

    await run();
    expect(outbox.stamped).toStrictEqual([]);
    expect(outbox.deletedUnsent).toStrictEqual([]);

    transport.outcomes.clear();
    await run();
    expect(outbox.stamped).toStrictEqual(['n1']);
  });

  it('leaves a row unsent while its recipient has no subscription yet', async () => {
    const outbox = new MemoryOutbox([row({ id: 'n1', subscriptions: [] })]);
    const { transport, run } = harness(outbox);

    const outcome = await run();

    expect(transport.sent).toStrictEqual([]);
    expect(outbox.stamped).toStrictEqual([]);
    expect(outbox.deletedUnsent).toStrictEqual([]);
    expect(outcome.sent).toBe(0);
  });

  it('sends nothing on a rerun once every row is stamped', async () => {
    const outbox = new MemoryOutbox([row({ id: 'n1' }), row({ id: 'n2' })]);
    const { transport, run } = harness(outbox);

    await run();
    const sentAfterFirst = transport.sent.length;
    const second = await run();

    expect(transport.sent).toHaveLength(sentAfterFirst);
    expect(second).toMatchObject({ due: 0, sent: 0 });
    expect(outbox.stamped).toStrictEqual(['n1', 'n2']);
  });
});

describe('retry window', () => {
  it('deletes rows past their retry window unsent, warning with the type and id only', async () => {
    const outbox = new MemoryOutbox([], [{ id: 'old', type: 'chore_due' }]);
    const { transport, lines, run } = harness(outbox);

    const outcome = await run();

    expect(outcome.expired).toBe(1);
    expect(transport.sent).toStrictEqual([]);
    const warning = lines.find(
      (line) => line.message === 'notification retry window passed; deleted unsent',
    );
    expect(warning?.level).toBe('warn');
    expect(Object.keys(warning?.data ?? {}).sort()).toStrictEqual(['id', 'type']);
    expect(warning?.data).toStrictEqual({ type: 'chore_due', id: 'old' });
  });
});

describe('copy validation', () => {
  it('deletes unsent, without sending, a row whose title is over 60 characters', async () => {
    const outbox = new MemoryOutbox([
      row({ id: 'long', payload: { title: 'x'.repeat(61), body: 'Short.' } }),
    ]);
    const { transport, lines, run } = harness(outbox);

    const outcome = await run();

    expect(transport.sent).toStrictEqual([]);
    expect(outbox.deletedUnsent).toStrictEqual(['long']);
    expect(outbox.stamped).toStrictEqual([]);
    expect(outcome.rejected).toBe(1);
    const warning = lines.find(
      (line) => line.message === 'notification copy rejected; deleted unsent',
    );
    expect(warning?.data).toStrictEqual({ type: 'bill_due', id: 'long' });
  });

  it('deletes a row whose body is over 60 characters', async () => {
    const outbox = new MemoryOutbox([
      row({ id: 'long-body', payload: { title: 'Fine', body: 'y'.repeat(61) } }),
    ]);
    const { run } = harness(outbox);

    await run();

    expect(outbox.deletedUnsent).toStrictEqual(['long-body']);
  });

  it('sends a copy line of exactly 60 characters', async () => {
    const outbox = new MemoryOutbox([
      row({ id: 'edge', payload: { title: 'x'.repeat(60), body: 'y'.repeat(60) } }),
    ]);
    const { run } = harness(outbox);

    const outcome = await run();

    expect(outcome.sent).toBe(1);
    expect(outbox.deletedUnsent).toStrictEqual([]);
  });

  it('deletes a row with an empty title', async () => {
    const outbox = new MemoryOutbox([row({ id: 'blank', payload: { title: '   ', body: 'Hi.' } })]);
    const { run } = harness(outbox);

    await run();

    expect(outbox.deletedUnsent).toStrictEqual(['blank']);
  });
});

describe('push message household', () => {
  it('carries the household id so a tap can switch to it before the deep link', async () => {
    const householdId = '11111111-1111-4111-8111-111111111111';
    const outbox = new MemoryOutbox([
      row({
        id: 'n1',
        payload: { title: 'Rent is due', body: 'Due on the 1st.', target: 'bills', householdId },
      }),
    ]);
    const { transport, run } = harness(outbox);

    await run();

    expect(JSON.parse(transport.sent[0]?.message ?? '')).toStrictEqual({
      title: 'Rent is due',
      body: 'Due on the 1st.',
      url: '/bills',
      householdId,
    });
  });
});

describe('deepLinkFor', () => {
  it('opens the screen each target names', () => {
    expect(deepLinkFor({ target: 'flyers' })).toBe('/lists/flyers');
    expect(deepLinkFor({ target: 'chores' })).toBe('/chores');
    expect(deepLinkFor({ target: 'bills' })).toBe('/bills');
  });

  it('opens the home screen for an unknown or missing target', () => {
    expect(deepLinkFor({ target: 'nowhere' })).toBe('/');
    expect(deepLinkFor({})).toBe('/');
    expect(deepLinkFor(null)).toBe('/');
  });
});
