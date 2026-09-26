import cron from 'node-cron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyDb } from '../test/fake-app.js';
import { FakeDealSource } from '../test/fixture-deal-source.js';
import { readinessNotBuiltYet } from './refresh-deals.js';
import {
  createScheduler,
  PRUNE_CACHE_SCHEDULE,
  REFRESH_DEALS_SCHEDULE,
  type SchedulerDeps,
} from './scheduler.js';
import type { JobLogger } from './types.js';

/**
 * Technical Architecture, "Scheduled jobs": the two schedules, in UTC, and the advisory lock that
 * makes a second run a no-op. The database here is a stub whose `pg_try_advisory_lock` answers
 * nothing, which is exactly the "lock held" case; the lock being granted needs a real Postgres and
 * is covered by `jobs.integration.test.ts`.
 */

let lines: { level: string; message: string; data: Record<string, unknown> }[] = [];

function logger(): JobLogger {
  const record = (level: string) => (data: Record<string, unknown>, message: string) => {
    lines.push({ level, data, message });
  };
  const self: JobLogger = {
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
    child: () => self,
  };
  return self;
}

function deps(overrides: Partial<SchedulerDeps> = {}): SchedulerDeps {
  const db = emptyDb();
  return {
    database: { asServiceRole: (fn) => fn(db), pool: db },
    logger: logger(),
    refresh: {
      source: new FakeDealSource(),
      publishSkipRates: () => undefined,
      repriceExpiredItems: () => Promise.resolve(0),
      recomputeReadiness: readinessNotBuiltYet,
    },
    ...overrides,
  };
}

afterEach(() => {
  lines = [];
  vi.restoreAllMocks();
});

describe('schedules', () => {
  it('runs refresh-deals at 08:00 and prune-cache at 04:00', () => {
    expect(REFRESH_DEALS_SCHEDULE).toBe('0 8 * * *');
    expect(PRUNE_CACHE_SCHEDULE).toBe('0 4 * * *');
  });

  it('registers both jobs in UTC and destroys them on stop', async () => {
    const destroy = vi.fn(() => Promise.resolve());
    const schedule = vi
      .spyOn(cron, 'schedule')
      .mockImplementation(() => ({ destroy }) as unknown as ReturnType<typeof cron.schedule>);

    const scheduler = createScheduler(deps());
    scheduler.start();

    expect(schedule).toHaveBeenCalledTimes(2);
    expect(schedule.mock.calls.map((call) => call[0])).toStrictEqual([
      REFRESH_DEALS_SCHEDULE,
      PRUNE_CACHE_SCHEDULE,
    ]);
    for (const call of schedule.mock.calls) {
      expect(call[2]).toMatchObject({ timezone: 'UTC' });
    }

    await scheduler.stop();
    expect(destroy).toHaveBeenCalledTimes(2);
  });
});

describe('the advisory lock guard', () => {
  it.each(['refresh-deals', 'prune-cache'] as const)(
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
