import { describe, expect, it, vi } from 'vitest';
import { emptyDb } from '../test/fake-app.js';
import { FakeDealSource } from '../test/fixture-deal-source.js';
import type { DispatchOutbox } from './dispatch-notifications.js';
import { readinessNotBuiltYet } from './refresh-deals.js';
import { createScheduler, type SchedulerDeps } from './scheduler.js';
import type { JobLogger } from './types.js';

/*
 * stop() must not resolve while a job run is still in flight, so main.ts can close the pool only
 * after every run has finished writing through it. The advisory lock is granted by a stand-in here,
 * so the run starts and then waits on the outbox; the real lock is covered by
 * jobs.integration.test.ts.
 */

vi.mock('./advisory-lock.js', () => ({
  withJobLock: async <T>(_db: unknown, _job: string, run: () => Promise<T>) => ({
    ran: true,
    result: await run(),
  }),
}));

const quietLogger: JobLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => quietLogger,
};

function depsWith(outbox: DispatchOutbox): SchedulerDeps {
  const db = emptyDb();
  return {
    database: { asServiceRole: (fn) => fn(db), pool: db },
    logger: quietLogger,
    refresh: {
      source: new FakeDealSource(),
      publishSkipRates: () => undefined,
      repriceExpiredItems: () => Promise.resolve(0),
      recomputeReadiness: readinessNotBuiltYet,
    },
    dispatch: { outbox, transport: { send: () => Promise.resolve({ kind: 'accepted' }) } },
  };
}

describe('stop', () => {
  it('waits for an in-flight dispatch run before resolving', async () => {
    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const outbox: DispatchOutbox = {
      expireOverdue: () => Promise.resolve([]),
      listDue: async () => {
        await gate;
        return [];
      },
      claim: () => Promise.resolve('taken' as const),
      enqueueScheduled: () => Promise.resolve({ inserted: 0, dropped: [] }),
      release: () => Promise.resolve(),
      deleteUnsent: () => Promise.resolve(),
      deleteSubscription: () => Promise.resolve(),
    };
    const scheduler = createScheduler(depsWith(outbox));

    const run = scheduler.run('dispatch-notifications');
    let stopped = false;
    const stop = scheduler.stop().then(() => {
      stopped = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(stopped).toBe(false);

    open();
    await stop;
    expect(stopped).toBe(true);
    await expect(run).resolves.toBe(true);
  });
});
