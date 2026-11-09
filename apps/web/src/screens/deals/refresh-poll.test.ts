import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_ATTEMPTS,
  MAX_POLL_MS,
  POLL_INTERVAL_MS,
  refreshDelayMs,
  useRefreshPoll,
} from './use-refresh-poll.ts';

describe('the dormant-postal-code refetch loop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses a fixed 4.5s interval and 3-minute ceiling', () => {
    expect(refreshDelayMs()).toBe(POLL_INTERVAL_MS);
    expect(POLL_INTERVAL_MS).toBe(4_500);
    expect(MAX_POLL_MS).toBe(180_000);
    expect(MAX_ATTEMPTS).toBe(40);
  });

  it('refetches repeatedly at 4.5s intervals while the server says it is refreshing', () => {
    const refetch = vi.fn();
    renderHook(() => useRefreshPoll(true, refetch));

    expect(refetch).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    expect(refetch).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    expect(refetch).toHaveBeenCalledTimes(2);

    act(() => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    expect(refetch).toHaveBeenCalledTimes(3);
  });

  it('stops as soon as the refresh resolves', () => {
    const refetch = vi.fn();
    const { rerender, result } = renderHook(
      ({ isRefreshing }: { isRefreshing: boolean }) => useRefreshPoll(isRefreshing, refetch),
      { initialProps: { isRefreshing: true } },
    );

    act(() => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    expect(refetch).toHaveBeenCalledTimes(1);

    rerender({ isRefreshing: false });
    expect(result.current.isPolling).toBe(false);
    act(() => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 5);
    });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('gives up after its attempts are spent (3 minutes / 40 attempts) rather than polling forever', () => {
    const refetch = vi.fn();
    const { result } = renderHook(() => useRefreshPoll(true, refetch));

    for (let tick = 0; tick < MAX_ATTEMPTS + 5; tick += 1) {
      act(() => {
        vi.advanceTimersByTime(POLL_INTERVAL_MS);
      });
    }

    expect(refetch).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(result.current.isPolling).toBe(false);
    expect(result.current.hasGivenUp).toBe(true);
  });

  it('does not poll while offline, since the refetch could only fail', () => {
    const refetch = vi.fn();
    renderHook(() => useRefreshPoll(true, refetch, false));

    act(() => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);
    });
    expect(refetch).not.toHaveBeenCalled();
  });
});
