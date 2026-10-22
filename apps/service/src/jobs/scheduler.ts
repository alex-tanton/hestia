import cron, { type ScheduledTask } from 'node-cron';
import { scrubErrorText } from '@hearth/shared';
import { withJobLock } from './advisory-lock.js';
import {
  runDispatchNotifications,
  type DispatchOutbox,
  type PushTransport,
} from './dispatch-notifications.js';
import { runLogAutopay } from './log-autopay.js';
import { runOnDemandRefresh, runRefreshDeals, type RefreshDeps } from './refresh-deals.js';
import { runPruneCache } from './prune-cache.js';
import type { JobDatabase, JobLogger } from './types.js';

/**
 * The in-process job runner. `node-cron`, schedules in UTC; anything user-facing resolves against a
 * household or user timezone inside the job.
 *
 * | Job                     | Schedule        |
 * | ----------------------- | --------------- |
 * | `refresh-deals`         | Daily 08:00 UTC |
 * | `log-autopay`           | Every 2 minutes |
 * | `dispatch-notifications` | Every 2 minutes |
 * | `prune-cache`           | Daily 04:00 UTC |
 *
 * Every run takes `pg_try_advisory_lock(hashtext('<job name>'))` on a dedicated connection and
 * skips if it is held, so a restart mid-run and a second process cannot double-write.
 */

export const REFRESH_DEALS_SCHEDULE = '0 8 * * *';
export const LOG_AUTOPAY_SCHEDULE = '*/2 * * * *';
export const DISPATCH_NOTIFICATIONS_SCHEDULE = '*/2 * * * *';
export const PRUNE_CACHE_SCHEDULE = '0 4 * * *';
const TIMEZONE = 'UTC';

export interface SchedulerDeps {
  database: JobDatabase;
  logger: JobLogger;
  refresh: Omit<RefreshDeps, 'database' | 'logger'>;
  dispatch: { outbox: DispatchOutbox; transport: PushTransport };
}

export interface Scheduler {
  /**
   * Runs one job by name under its lock; returns false when the lock was held. `now` replaces the
   * clock only for dispatch-notifications, and only the E2E push seam passes it.
   */
  run: (jobName: JobName, options?: { now?: Date }) => Promise<boolean>;
  /** Queues one on-demand refresh of a dormant postal code behind whatever is already running. */
  queueBackgroundRefresh: (postalCode: string) => void;
  start: () => void;
  stop: () => Promise<void>;
}

export type JobName = 'refresh-deals' | 'log-autopay' | 'dispatch-notifications' | 'prune-cache';

export function createScheduler(deps: SchedulerDeps): Scheduler {
  const tasks: ScheduledTask[] = [];
  // Background refreshes queue behind each other and behind nothing else: the Flipp request queue
  // already serializes the calls, and this keeps two dormant postal codes from interleaving.
  let backlog: Promise<unknown> = Promise.resolve();

  const guard = async (jobName: JobName, run: () => Promise<unknown>): Promise<boolean> => {
    const logger = deps.logger.child({ job: jobName });
    try {
      const outcome = await withJobLock(deps.database.pool, jobName, run);
      if (!outcome.ran) logger.info({}, 'skipped: another run holds the lock');
      return outcome.ran;
    } catch (error: unknown) {
      logger.error({ err: { message: scrubErrorText(error) } }, 'job failed');
      return false;
    }
  };

  // Every run, scheduled or direct, is tracked until it settles, so stop() can wait for it.
  const inFlight = new Set<Promise<boolean>>();
  const track = (job: Promise<boolean>): Promise<boolean> => {
    inFlight.add(job);
    const forget = () => {
      inFlight.delete(job);
    };
    job.then(forget, forget);
    return job;
  };

  const runJob = (jobName: JobName, now: Date | undefined): Promise<boolean> => {
    const logger = deps.logger.child({ job: jobName });
    if (jobName === 'refresh-deals') {
      return guard(jobName, () =>
        runRefreshDeals({ ...deps.refresh, database: deps.database, logger }),
      );
    }
    if (jobName === 'log-autopay') {
      return guard(jobName, () => runLogAutopay({ database: deps.database, logger }));
    }
    if (jobName === 'dispatch-notifications') {
      return guard(jobName, () =>
        runDispatchNotifications({
          ...deps.dispatch,
          logger,
          ...(now === undefined ? {} : { now: () => now }),
        }),
      );
    }
    return guard(jobName, () => runPruneCache({ database: deps.database, logger }));
  };

  const run = (jobName: JobName, options?: { now?: Date }): Promise<boolean> =>
    track(runJob(jobName, options?.now));

  return {
    run,
    queueBackgroundRefresh: (postalCode) => {
      const logger = deps.logger.child({ job: 'refresh-deals', trigger: 'on-demand' });
      backlog = backlog.then(
        () =>
          // The same lock as the daily run: a background refresh that collides with it is
          // dropped rather than run twice, and the daily run covers the postal code anyway.
          withJobLock(deps.database.pool, 'refresh-deals', () =>
            runOnDemandRefresh({ ...deps.refresh, database: deps.database, logger }, postalCode),
          ).catch((error: unknown) => {
            logger.error(
              { postalCode, err: { message: scrubErrorText(error) } },
              'on-demand refresh failed',
            );
          }),
        () => undefined,
      );
    },
    start: () => {
      tasks.push(
        cron.schedule(REFRESH_DEALS_SCHEDULE, () => void run('refresh-deals'), {
          timezone: TIMEZONE,
        }),
        cron.schedule(LOG_AUTOPAY_SCHEDULE, () => void run('log-autopay'), { timezone: TIMEZONE }),
        cron.schedule(DISPATCH_NOTIFICATIONS_SCHEDULE, () => void run('dispatch-notifications'), {
          timezone: TIMEZONE,
        }),
        cron.schedule(PRUNE_CACHE_SCHEDULE, () => void run('prune-cache'), { timezone: TIMEZONE }),
      );
      deps.logger.info(
        {
          refreshDeals: REFRESH_DEALS_SCHEDULE,
          logAutopay: LOG_AUTOPAY_SCHEDULE,
          dispatchNotifications: DISPATCH_NOTIFICATIONS_SCHEDULE,
          pruneCache: PRUNE_CACHE_SCHEDULE,
          timezone: TIMEZONE,
        },
        'scheduled jobs registered',
      );
    },
    stop: async () => {
      for (const task of tasks) void task.destroy();
      tasks.length = 0;
      // A job already in flight finishes before this resolves, so the caller can close the pool
      // without a run still writing through it. That includes a dispatch run mid-send, which would
      // otherwise stamp rows after the pool had gone. Background refreshes are waited on the same
      // way, so one already in flight finishes rather than being torn off mid-flyer.
      while (inFlight.size > 0) await Promise.allSettled([...inFlight]);
      await backlog;
    },
  };
}
