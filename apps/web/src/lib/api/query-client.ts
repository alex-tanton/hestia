import { QueryClient, onlineManager } from '@tanstack/react-query';
import { ApiError } from './problem.ts';

/** A refused or missing resource will be refused again; only transport failures are retried. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  /*
   * TanStack's `onlineManager` assumes an active connection until an `online`/`offline` window
   * event tells it otherwise, and that belief governs when a paused mutation is allowed to fire. A
   * fresh page load carries no such event —
   * `navigator.onLine` is already correct at load, but nothing has fired the event that would
   * teach the manager about it — so a reload while genuinely offline leaves it believing it is
   * online. `PersistQueryClientProvider`'s restore then calls `resumePausedMutations()`, which
   * trusts that belief and fires the queued write for real; it fails, exhausts its bounded
   * retries, and is dropped as a permanent failure — an offline write silently lost, which the
   * write-queue contract rules out. Seeding the real value
   * once, before anything reads it, is what a reload while offline needs.
   */
  onlineManager.setOnline(navigator.onLine);

  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        // The API is the only source of truth and screens are small; a short window keeps a
        // back navigation instant without showing yesterday's household.
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}
