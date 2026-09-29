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
});
