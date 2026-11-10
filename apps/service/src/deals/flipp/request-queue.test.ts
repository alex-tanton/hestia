import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildUserAgent,
  CircuitOpenError,
  DEFAULT_CONCURRENCY,
  FlippRequestError,
  FlippRequestQueue,
  MIN_GAP_MS,
  type HttpResponse,
  type QueueLogger,
} from './request-queue.js';

/**
 * Rate discipline. Fake timers and a fake transport throughout: these tests never touch the
 * network.
 */

interface Call {
  url: string;
  headers: Record<string, string>;
  at: number;
}

function transport(statuses: (number | 'throw')[]) {
  const calls: Call[] = [];
  let index = 0;
  const get = (url: string, headers: Record<string, string>): Promise<HttpResponse> => {
    // eslint-disable-next-line no-restricted-syntax -- reads the fake-timer clock installed in beforeEach
    calls.push({ url, headers, at: Date.now() });
    const status = statuses[Math.min(index, statuses.length - 1)] ?? 200;
    index += 1;
    if (status === 'throw') return Promise.reject(new Error('socket hang up'));
    return Promise.resolve({ status, json: () => Promise.resolve({ ok: url }) });
  };
  return { calls, get };
}

function queueWith(statuses: (number | 'throw')[], options: Record<string, unknown> = {}) {
  const fake = transport(statuses);
  const queue = new FlippRequestQueue({
    get: fake.get,
    userAgent: buildUserAgent('https://hestia.aberrance.app'),
    ...options,
  });
  return { ...fake, queue };
}

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the serialized request queue', () => {
  it('keeps the gap at the minimum when a timer wakes a millisecond early', async () => {
    // Node timers can fire a millisecond before the clock says the delay has passed. One sleep
    // then leaves the gap at 149ms, which the discipline check reads as a broken queue.
    let clock = 0;
    let wokeEarly = false;
    const starts: number[] = [];
    const queue = new FlippRequestQueue({
      get: () => {
        starts.push(clock);
        return Promise.resolve({ status: 200, json: () => Promise.resolve({}) });
      },
      userAgent: buildUserAgent('https://hestia.aberrance.app'),
      now: () => clock,
      sleep: (ms) => {
        clock += !wokeEarly && ms > 1 ? ms - 1 : ms;
        wokeEarly = true;
        return Promise.resolve();
      },
    });

    await queue.request('https://f/1');
    await queue.request('https://f/2');

    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(MIN_GAP_MS);
  });

  it('runs requests with bounded concurrency and at least a 150ms gap', async () => {
    const { queue, calls } = queueWith([200]);
    const results = Promise.all([
      queue.request('https://f/1'),
      queue.request('https://f/2'),
      queue.request('https://f/3'),
    ]);

    await vi.advanceTimersByTimeAsync(2_000);
    await results;

    expect(calls.map((call) => call.url)).toEqual(['https://f/1', 'https://f/2', 'https://f/3']);
    expect(calls.map((call) => call.at)).toEqual([0, MIN_GAP_MS, MIN_GAP_MS * 2]);
  });

  it('processes up to 4 requests concurrently in parallel with overlapping in-flight executions', async () => {
    let activeInFlight = 0;
    let maxActive = 0;
    const completed: string[] = [];
    const queue = new FlippRequestQueue({
      get: async (url) => {
        activeInFlight += 1;
        maxActive = Math.max(maxActive, activeInFlight);
        await new Promise((resolve) => setTimeout(resolve, 500));
        activeInFlight -= 1;
        completed.push(url);
        return { status: 200, json: () => Promise.resolve({ ok: url }) };
      },
      userAgent: buildUserAgent('https://hestia.aberrance.app'),
      concurrency: DEFAULT_CONCURRENCY,
      minGapMs: 150,
    });

    const promises = [
      queue.request('https://f/1'),
      queue.request('https://f/2'),
      queue.request('https://f/3'),
      queue.request('https://f/4'),
      queue.request('https://f/5'),
    ];

    await vi.advanceTimersByTimeAsync(3_000);
    await Promise.all(promises);

    expect(maxActive).toBe(4);
    expect(completed).toHaveLength(5);
  });

  it('sends a descriptive User-Agent naming the app and its origin', async () => {
    const { queue, calls } = queueWith([200]);
    const result = queue.request('https://f/1');
    await vi.advanceTimersByTimeAsync(0);
    await result;

    expect(calls[0]?.headers['User-Agent']).toBe(
      'Hestia/1.0 (self-hosted household admin; +https://hestia.aberrance.app)',
    );
  });

  it('returns the parsed body', async () => {
    const { queue } = queueWith([200]);
    const result = queue.request('https://f/1');
    await vi.advanceTimersByTimeAsync(0);
    await expect(result).resolves.toEqual({ ok: 'https://f/1' });
  });

  it('keeps running after one request fails, rather than poisoning the chain', async () => {
    const { queue, calls } = queueWith([500, 500, 500, 200], {
      attempts: 3,
      backoffMs: 1_000,
      concurrency: 1,
    });
    const failed = queue.request('https://f/1').catch((error: unknown) => error);
    const next = queue.request('https://f/2');

    await vi.advanceTimersByTimeAsync(60_000);

    expect(await failed).toBeInstanceOf(FlippRequestError);
    await expect(next).resolves.toEqual({ ok: 'https://f/2' });
    expect(calls).toHaveLength(4);
  });
});

describe('backoff', () => {
  it('retries a non-200 with an exponential delay, then gives up', async () => {
    const { queue, calls } = queueWith([503], { attempts: 3, backoffMs: 1_000 });
    const result = queue.request('https://f/1').catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(30_000);

    const error = await result;
    expect(error).toBeInstanceOf(FlippRequestError);
    expect((error as FlippRequestError).status).toBe(503);
    // One second, then two, each still respecting the minimum gap.
    expect(calls.map((call) => call.at)).toEqual([0, 1_000, 3_000]);
  });

  it('retries a transport error the same way', async () => {
    const { queue, calls } = queueWith(['throw', 'throw', 200], { attempts: 3, backoffMs: 1_000 });
    const result = queue.request('https://f/1');
    await vi.advanceTimersByTimeAsync(30_000);

    await expect(result).resolves.toEqual({ ok: 'https://f/1' });
    expect(calls).toHaveLength(3);
  });
});

describe('the circuit breaker', () => {
  it('opens after five consecutive failed requests and stays open for 30 minutes', async () => {
    const warn = vi.fn<QueueLogger['warn']>();
    const { queue, calls } = queueWith([500], { attempts: 1, backoffMs: 1_000, logger: { warn } });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failing = queue.request(`https://f/${String(attempt)}`).catch(() => undefined);
      await vi.advanceTimersByTimeAsync(5_000);
      await failing;
    }
    expect(calls).toHaveLength(5);
    expect(queue.isOpen).toBe(true);
    expect(warn).toHaveBeenCalledOnce();

    // While open, nothing reaches the transport at all.
    const refused = queue.request('https://f/blocked').catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(1_000);
    const error = await refused;
    expect(error).toBeInstanceOf(CircuitOpenError);
    expect(calls).toHaveLength(5);

    // The breaker names the instant it reopens: half an hour after the fifth failure.
    const openUntil = (error as CircuitOpenError).openUntil;
    // eslint-disable-next-line no-restricted-syntax -- reads the fake-timer clock installed in beforeEach
    await vi.advanceTimersByTimeAsync(openUntil - 1_000 - Date.now());
    expect(queue.isOpen).toBe(true);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(queue.isOpen).toBe(false);
    const retried = queue.request('https://f/after').catch(() => undefined);
    await vi.advanceTimersByTimeAsync(5_000);
    await retried;
    expect(calls).toHaveLength(6);
  });

  it('rejects queued requests with CircuitOpenError when breaker trips', async () => {
    const { queue, calls } = queueWith([500], {
      attempts: 1,
      failureThreshold: 5,
      concurrency: 2,
    });

    const promises = [
      queue.request('https://f/0').catch((e: unknown) => e),
      queue.request('https://f/1').catch((e: unknown) => e),
      queue.request('https://f/2').catch((e: unknown) => e),
      queue.request('https://f/3').catch((e: unknown) => e),
      queue.request('https://f/4').catch((e: unknown) => e),
      queue.request('https://f/5').catch((e: unknown) => e),
      queue.request('https://f/6').catch((e: unknown) => e),
    ];

    await vi.advanceTimersByTimeAsync(10_000);
    const results = await Promise.all(promises);

    expect(calls).toHaveLength(5);
    expect(queue.isOpen).toBe(true);

    for (let i = 0; i < 5; i += 1) {
      expect(results[i]).toBeInstanceOf(FlippRequestError);
    }
    expect(results[5]).toBeInstanceOf(CircuitOpenError);
    expect(results[6]).toBeInstanceOf(CircuitOpenError);
  });

  it('rejects active in-flight requests with CircuitOpenError when breaker trips during execution', async () => {
    const queue = new FlippRequestQueue({
      get: async (url) => {
        if (url === 'https://f/slow') {
          // Takes 1,000ms
          await new Promise((resolve) => setTimeout(resolve, 1_000));
          return { status: 200, json: () => Promise.resolve({ ok: url }) };
        }
        // Other calls fail immediately
        return { status: 500, json: () => Promise.resolve({}) };
      },
      userAgent: buildUserAgent('https://hestia.aberrance.app'),
      concurrency: 4,
      minGapMs: 50,
      attempts: 1,
      failureThreshold: 5,
    });

    // Slow request starts at t=0
    const slow = queue.request('https://f/slow').catch((e: unknown) => e);

    // Then 5 requests fail while slow is in-flight
    const f1 = queue.request('https://f/f1').catch((e: unknown) => e);
    const f2 = queue.request('https://f/f2').catch((e: unknown) => e);
    const f3 = queue.request('https://f/f3').catch((e: unknown) => e);
    const f4 = queue.request('https://f/f4').catch((e: unknown) => e);
    const f5 = queue.request('https://f/f5').catch((e: unknown) => e);

    await vi.advanceTimersByTimeAsync(2_000);
    await Promise.all([f1, f2, f3, f4, f5]);

    expect(queue.isOpen).toBe(true);
    const slowResult = await slow;
    expect(slowResult).toBeInstanceOf(CircuitOpenError);
  });

  it('forgets earlier failures once a request succeeds', async () => {
    const { queue } = queueWith([500, 500, 500, 500, 200, 500, 500, 500, 500], {
      attempts: 1,
      backoffMs: 1_000,
    });

    for (let attempt = 0; attempt < 9; attempt += 1) {
      const pending = queue.request(`https://f/${String(attempt)}`).catch(() => undefined);
      await vi.advanceTimersByTimeAsync(5_000);
      await pending;
    }

    // Four failures, a success, then four more: the run never reaches five in a row.
    expect(queue.isOpen).toBe(false);
  });
});
