import { describe, expect, it, vi } from 'vitest';
import { emptyDb } from '../test/fake-app.js';
import { withJobLock } from './advisory-lock.js';

/**
 * Technical Architecture, "Idempotency": a job whose lock is held skips the run rather than
 * doing the work twice. The acquire-and-release half needs a real Postgres and is covered by
 * `jobs.integration.test.ts`; this is the skip half, where `pg_try_advisory_lock` answers nothing.
 */

describe('withJobLock', () => {
  it('skips the run when the lock is not granted', async () => {
    const run = vi.fn(() => Promise.resolve('done'));
    const outcome = await withJobLock(emptyDb(), 'refresh-deals', run);

    expect(outcome.ran).toBe(false);
    expect(outcome.result).toBeUndefined();
    expect(run).not.toHaveBeenCalled();
  });
});
