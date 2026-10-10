import { describe, expect, it } from 'vitest';
import * as jobsBarrel from './index.js';

/**
 * The `jobs/` barrel (Technical Architecture, "Scheduled jobs"): `main.ts` is the only importer,
 * and `main.ts` itself is excluded from coverage (never run by a test), so nothing else exercises
 * these re-export statements. This asserts the barrel actually forwards the real implementations
 * — not that the re-export syntax merely compiles — so a typo'd specifier or a wrong source path
 * would fail here instead of only surfacing as "main.ts can't find createScheduler" at runtime.
 */
describe('the jobs barrel', () => {
  it('re-exports the real job runners and scheduler, not placeholders', () => {
    expect(jobsBarrel.withJobLock).toBeTypeOf('function');
    expect(jobsBarrel.runDispatchNotifications).toBeTypeOf('function');
    expect(jobsBarrel.runLogAutopay).toBeTypeOf('function');
    expect(jobsBarrel.autopayOccurrences).toBeTypeOf('function');
    expect(jobsBarrel.pruneCache).toBeTypeOf('function');
    expect(jobsBarrel.runPruneCache).toBeTypeOf('function');
    expect(jobsBarrel.readinessNotBuiltYet).toBeTypeOf('function');
    expect(jobsBarrel.runOnDemandRefresh).toBeTypeOf('function');
    expect(jobsBarrel.runRefreshDeals).toBeTypeOf('function');
    expect(jobsBarrel.planFlyerRefreshNotifications).toBeTypeOf('function');
    expect(jobsBarrel.planRefresh).toBeTypeOf('function');
    expect(jobsBarrel.createScheduler).toBeTypeOf('function');
    expect(jobsBarrel.DISPATCH_NOTIFICATIONS_SCHEDULE).toBe('*/2 * * * *');
    expect(jobsBarrel.PRUNE_CACHE_SCHEDULE).toBe('0 4 * * *');
    expect(jobsBarrel.REFRESH_DEALS_SCHEDULE).toBe('0 8 * * *');
  });
});
