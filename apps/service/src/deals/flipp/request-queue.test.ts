import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildUserAgent,
  CircuitOpenError,
  FlippRequestError,
  FlippRequestQueue,
  MIN_GAP_MS,
  type HttpResponse,
  type QueueLogger,
} from './request-queue.js';

/**
 * Rate discipline (non-negotiable 19). Fake timers and a fake transport throughout: these tests
 * never touch the network (non-negotiable 17).
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
    userAgent: buildUserAgent('https://hearth.example.ts.net'),
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
    // then leaves the gap at 499ms, which the e2e discipline check reads as a broken queue.
    let clock = 0;
    let wokeEarly = false;
    const starts: number[] = [];
    const queue = new FlippRequestQueue({
      get: () => {
        starts.push(clock);
        return Promise.resolve({ status: 200, json: () => Promise.resolve({}) });
      },
      userAgent: buildUserAgent('https://hearth.example.ts.net'),
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

  it('runs requests one at a time with at least a 500ms gap', async () => {
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

  it('sends a descriptive User-Agent naming the app and its origin', async () => {
    const { queue, calls } = queueWith([200]);
    const result = queue.request('https://f/1');
    await vi.advanceTimersByTimeAsync(0);
    await result;

    expect(calls[0]?.headers['User-Agent']).toBe(
      'Hearth/1.0 (self-hosted household admin; +https://hearth.example.ts.net)',
    );
  });

  it('returns the parsed body', async () => {
    const { queue } = queueWith([200]);
    const result = queue.request('https://f/1');
    await vi.advanceTimersByTimeAsync(0);
    await expect(result).resolves.toEqual({ ok: 'https://f/1' });
  });

  it('keeps running after one request fails, rather than poisoning the chain', async () => {
    const { queue, calls } = queueWith([500, 500, 500, 200], { attempts: 3, backoffMs: 1_000 });
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
