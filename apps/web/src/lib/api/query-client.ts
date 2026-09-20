import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './problem.ts';

/** A refused or missing resource will be refused again; only transport failures are retried. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
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
