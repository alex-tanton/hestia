import { describe, expect, it } from 'vitest';
import { HostRateLimiter } from './host-rate-limiter.js';

/** Per-host spacing (Technical Architecture, "Recipe fetching": 1 request per second per host). */
describe('HostRateLimiter', () => {
  function fakeClock(start = 0): {
    now: () => number;
    sleep: (ms: number) => Promise<void>;
    advance: (ms: number) => void;
    sleeps: number[];
  } {
    let time = start;
    const sleeps: number[] = [];
    return {
      now: () => time,
      sleep: (ms: number) => {
        sleeps.push(ms);
        time += ms;
        return Promise.resolve();
      },
      advance: (ms: number) => {
        time += ms;
      },
      sleeps,
    };
  }

  it('does not wait for the first request to a host', async () => {
    const clock = fakeClock();
    const limiter = new HostRateLimiter({ now: clock.now, sleep: clock.sleep });
    await limiter.wait('example.com');
    expect(clock.sleeps).toEqual([]);
  });

  it('waits out the remaining gap for a second request to the same host', async () => {
    const clock = fakeClock();
    const limiter = new HostRateLimiter({ minGapMs: 1_000, now: clock.now, sleep: clock.sleep });
    await limiter.wait('example.com');
    clock.advance(300);
    await limiter.wait('example.com');
    expect(clock.sleeps).toEqual([700]);
  });

  it('never waits once the gap has already elapsed', async () => {
    const clock = fakeClock();
    const limiter = new HostRateLimiter({ minGapMs: 1_000, now: clock.now, sleep: clock.sleep });
    await limiter.wait('example.com');
    clock.advance(1_500);
    await limiter.wait('example.com');
    expect(clock.sleeps).toEqual([]);
  });

  it('tracks hosts independently, so one host never waits on another', async () => {
    const clock = fakeClock();
    const limiter = new HostRateLimiter({ minGapMs: 1_000, now: clock.now, sleep: clock.sleep });
    await limiter.wait('a.example.com');
    clock.advance(10);
    await limiter.wait('b.example.com');
    expect(clock.sleeps).toEqual([]);
  });

  it('treats a hostname case-insensitively', async () => {
    const clock = fakeClock();
    const limiter = new HostRateLimiter({ minGapMs: 1_000, now: clock.now, sleep: clock.sleep });
    await limiter.wait('Example.com');
    clock.advance(100);
    await limiter.wait('example.com');
    expect(clock.sleeps).toEqual([900]);
  });

  it('serializes two concurrent callers for the same host instead of letting them fire together', async () => {
    // Both calls start before either resolves, which is what two simultaneous imports from the
    // same site look like. Each must claim its own slot, one minGap after the other, rather than
    // reading the same `last` value and sleeping the same amount.
    const clock = fakeClock();
    const limiter = new HostRateLimiter({ minGapMs: 1_000, now: clock.now, sleep: clock.sleep });
    const first = limiter.wait('example.com');
    const second = limiter.wait('example.com');
    await Promise.all([first, second]);
    // The first caller reserves slot 0 and never sleeps; the second reserves slot 1_000 and
    // sleeps out the whole gap — never both reading `last` as unset and skipping the wait.
    expect(clock.sleeps).toEqual([1_000]);
  });

  it('really sleeps with the real clock and timer when no fakes are given', async () => {
    // Measures real elapsed time. The shared pin freezes `Date`, and `vi.useRealTimers()` does not
    // unpin it, so the elapsed time is read from `performance.now()` for this one test; the
    // limiter's default `now` stays the pinned `Date.now`, which still makes the second call wait.
    // Every other test overrides both `now` and `sleep`, which never exercises the constructor's
    // own defaults (`Date.now` and a real `setTimeout`-backed sleep). minGapMs is tiny so the test
    // stays fast; the only thing under test is that the default sleep actually waits and resolves.
    const limiter = new HostRateLimiter({ minGapMs: 20 });
    const start = performance.now();
    await limiter.wait('default.example.com');
    await limiter.wait('default.example.com');
    expect(performance.now() - start).toBeGreaterThanOrEqual(15);
  });

  it('drops an old entry on the next wait for any host, rather than growing the map forever', async () => {
    // Pruning is purely a memory bound: by the time an entry is old enough to prune, its own gap
    // has also naturally elapsed, so a pruned host and an unpruned-but-expired one wait the same
    // (zero) amount either way — this cannot be told apart from the outside by timing alone. What
    // this does assert is that `wait()` on an unrelated host, long after an earlier one, still
    // triggers the deletion pass (the `if (at < cutoff)` branch in `prune()`) without throwing or
    // otherwise disturbing a later wait for the pruned host's own name.
    const clock = fakeClock();
    const limiter = new HostRateLimiter({ minGapMs: 1_000, now: clock.now, sleep: clock.sleep });
    await limiter.wait('stale.example.com');
    // PRUNE_AFTER_GAPS (10) gaps later: 'stale.example.com' is now well past pruning age.
    clock.advance(1_000 * 11);
    await limiter.wait('fresh.example.com');
    await limiter.wait('stale.example.com');
    expect(clock.sleeps).toEqual([]);
  });
});
