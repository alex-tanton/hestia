import cron from 'node-cron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyDb } from '../test/fake-app.js';
import { FakeDealSource } from '../test/fixture-deal-source.js';
import { recordingJobLogger, type JobLogLine } from '../test/job-logger.js';
import { readinessNotBuiltYet } from './refresh-deals.js';
import {
  createScheduler,
  DISPATCH_NOTIFICATIONS_SCHEDULE,
  LOG_AUTOPAY_SCHEDULE,
  PRUNE_CACHE_SCHEDULE,
  REFRESH_DEALS_SCHEDULE,
  type SchedulerDeps,
} from './scheduler.js';

/**
 * Technical Architecture, "Scheduled jobs": the schedules, in UTC, and the advisory lock that
 * makes a second run a no-op. The database here is a stub whose `pg_try_advisory_lock` answers
 * nothing, which is exactly the "lock held" case; the lock being granted needs a real Postgres and
 * is covered by `jobs.integration.test.ts`.
 */

let lines: JobLogLine[] = [];

function deps(overrides: Partial<SchedulerDeps> = {}): SchedulerDeps {
  const db = emptyDb();
  return {
    database: { asServiceRole: (fn) => fn(db), pool: db },
    logger: recordingJobLogger(lines),
    refresh: {
      source: new FakeDealSource(),
      publishSkipRates: () => undefined,
      repriceExpiredItems: () => Promise.resolve(0),
      recomputeReadiness: readinessNotBuiltYet,
    },
    dispatch: {
      outbox: {
        expireOverdue: () => Promise.resolve([]),
        listDue: () => Promise.resolve([]),
        claim: () => Promise.resolve('taken' as const),
        enqueueScheduled: () => Promise.resolve({ inserted: 0, dropped: [] }),
        release: () => Promise.resolve(),
        deleteUnsent: () => Promise.resolve(),
        deleteSubscription: () => Promise.resolve(),
      },
      transport: { send: () => Promise.resolve({ kind: 'accepted' }) },
    },
    ...overrides,
  };
}

afterEach(() => {
  lines = [];
  vi.restoreAllMocks();
});

describe('schedules', () => {
  it('runs refresh-deals at 08:00, log-autopay and dispatch-notifications every 2 minutes, and prune-cache at 04:00', () => {
    expect(REFRESH_DEALS_SCHEDULE).toBe('0 8 * * *');
    expect(LOG_AUTOPAY_SCHEDULE).toBe('*/2 * * * *');
    expect(DISPATCH_NOTIFICATIONS_SCHEDULE).toBe('*/2 * * * *');
    expect(PRUNE_CACHE_SCHEDULE).toBe('0 4 * * *');
  });

  it('registers all four jobs in UTC and destroys them on stop', async () => {
    const destroy = vi.fn(() => Promise.resolve());
    const schedule = vi
      .spyOn(cron, 'schedule')
      .mockImplementation(() => ({ destroy }) as unknown as ReturnType<typeof cron.schedule>);

    const scheduler = createScheduler(deps());
    scheduler.start();

    expect(schedule).toHaveBeenCalledTimes(4);
    expect(schedule.mock.calls.map((call) => call[0])).toStrictEqual([
      REFRESH_DEALS_SCHEDULE,
      LOG_AUTOPAY_SCHEDULE,
      DISPATCH_NOTIFICATIONS_SCHEDULE,
      PRUNE_CACHE_SCHEDULE,
    ]);
    for (const call of schedule.mock.calls) {
      expect(call[2]).toMatchObject({ timezone: 'UTC' });
    }

    await scheduler.stop();
    expect(destroy).toHaveBeenCalledTimes(4);
  });

  it('actually fires each job when cron calls the scheduled callback, not just registers it', async () => {
    // The test above only asserts registration: `cron.schedule`'s mock never calls back into the
    // callback it was given, so `start()`'s own `() => void run(jobName)` bodies (one per job)
    // never ran. This calls each captured callback directly, the way `node-cron` would at the
    // scheduled minute, to exercise those four bodies for real.
    const schedule = vi
      .spyOn(cron, 'schedule')
      .mockImplementation(
        () => ({ destroy: vi.fn() }) as unknown as ReturnType<typeof cron.schedule>,
      );

    const scheduler = createScheduler(deps());
    scheduler.start();

    for (const call of schedule.mock.calls) {
      const callback = call[1] as () => void;
      callback();
    }
    await scheduler.stop();

    // deps() backs the pool with emptyDb(), whose DummyDriver never grants any advisory lock, so
    // each run logs the skip -- proof the callback body actually called run(jobName) and reached
    // the guard, for all four jobs, rather than the callback never firing at all.
    const skipped = lines.filter((line) => line.message.includes('another run holds the lock'));
    expect(skipped).toHaveLength(4);
  });
});

describe('the advisory lock guard', () => {
  it.each(['refresh-deals', 'log-autopay', 'dispatch-notifications', 'prune-cache'] as const)(
    'skips %s and says so when the lock is held',
    async (job) => {
      const scheduler = createScheduler(deps());
      await expect(scheduler.run(job)).resolves.toBe(false);
      expect(lines.at(-1)?.message).toContain('another run holds the lock');
    },
  );

  it('records a job failure rather than letting it escape the timer', async () => {
    const scheduler = createScheduler(
      deps({
        database: {
          asServiceRole: () => Promise.reject(new Error('database gone')),
          pool: {
            connection: () => ({ execute: () => Promise.reject(new Error('database gone')) }),
          } as unknown as SchedulerDeps['database']['pool'],
        },
      }),
    );

    await expect(scheduler.run('prune-cache')).resolves.toBe(false);
    expect(lines.at(-1)?.level).toBe('error');
    expect(lines.at(-1)?.message).toBe('job failed');
  });
});

describe('queueBackgroundRefresh', () => {
  it('queues without throwing and finishes before stop resolves', async () => {
    const scheduler = createScheduler(deps());
    scheduler.queueBackgroundRefresh('27705');
    scheduler.queueBackgroundRefresh('27705');
    await expect(scheduler.stop()).resolves.toBeUndefined();
  });

  it('keeps going after one background refresh fails', async () => {
    const scheduler = createScheduler(
      deps({
        database: {
          asServiceRole: () => Promise.reject(new Error('database gone')),
          pool: {
            connection: () => ({ execute: () => Promise.reject(new Error('database gone')) }),
          } as unknown as SchedulerDeps['database']['pool'],
        },
      }),
    );

    scheduler.queueBackgroundRefresh('27705');
    scheduler.queueBackgroundRefresh('27706');
    await scheduler.stop();

    expect(lines.filter((line) => line.message === 'on-demand refresh failed')).toHaveLength(2);
  });
});
