import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIRST_DELAY_MS,
  MAX_ATTEMPTS,
  MAX_DELAY_MS,
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

  it('backs off rather than asking on a fixed beat, and caps the wait', () => {
    expect(refreshDelayMs(0)).toBe(FIRST_DELAY_MS);
    expect(refreshDelayMs(1)).toBe(FIRST_DELAY_MS * 2);
    expect(refreshDelayMs(2)).toBe(FIRST_DELAY_MS * 4);
    expect(refreshDelayMs(20)).toBe(MAX_DELAY_MS);
  });

  it('refetches while the server says it is refreshing', () => {
    const refetch = vi.fn();
    renderHook(() => useRefreshPoll(true, refetch));

    expect(refetch).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(FIRST_DELAY_MS);
    });
    expect(refetch).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(FIRST_DELAY_MS);
    });
    // The second wait is twice the first, so the same advance is not yet enough.
    expect(refetch).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(FIRST_DELAY_MS);
    });
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it('stops as soon as the refresh resolves', () => {
    const refetch = vi.fn();
    const { rerender, result } = renderHook(
      ({ isRefreshing }: { isRefreshing: boolean }) => useRefreshPoll(isRefreshing, refetch),
      { initialProps: { isRefreshing: true } },
    );

    act(() => {
      vi.advanceTimersByTime(FIRST_DELAY_MS);
    });
    expect(refetch).toHaveBeenCalledTimes(1);

    rerender({ isRefreshing: false });
    expect(result.current.isPolling).toBe(false);
    act(() => {
      vi.advanceTimersByTime(MAX_DELAY_MS * 5);
    });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('gives up after its attempts are spent rather than polling forever', () => {
    const refetch = vi.fn();
    const { result } = renderHook(() => useRefreshPoll(true, refetch));

    // Each advance fires one wait; the next is scheduled by the effect React runs after it.
    for (let tick = 0; tick < MAX_ATTEMPTS + 5; tick += 1) {
      act(() => {
        vi.advanceTimersByTime(MAX_DELAY_MS);
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
      vi.advanceTimersByTime(MAX_DELAY_MS * 3);
    });
    expect(refetch).not.toHaveBeenCalled();
  });
});
