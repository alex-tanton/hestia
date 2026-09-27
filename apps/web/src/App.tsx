import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider, type Persister } from '@tanstack/react-query-persist-client';
import type { ReactElement, ReactNode } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { ErrorBoundary } from './components/states/ErrorBoundary.tsx';
import { ErrorState } from './components/states/StateBlocks.tsx';
import { ApiProvider } from './lib/api/api-context.tsx';
import type { AuthClient } from './lib/auth/auth-client.ts';
import { reportClientError } from './lib/error-reporting.ts';
import { PERSIST_MAX_AGE_MS } from './lib/offline/persist.ts';
import type { RealtimePort } from './lib/realtime/realtime-port.ts';
import { routes } from './routes.tsx';

export interface AppProvidersProps {
  auth: AuthClient;
  queryClient: QueryClient;
  realtime?: RealtimePort | undefined;
  /** Absent in tests and in the dev server's first paint; the browser build supplies one. */
  persister?: Persister | undefined;
  /**
   * A second persister over the same storage and key, with no throttle -- what the write queue
   * flushes through so a queued write is durable the instant it queues, not whenever `persister`'s
   * own throttled save next fires (Engineering Practices › The write queue).
   */
  flushPersister?: Persister | undefined;
  children: ReactNode;
}

/**
 * Server state with, in the browser, its IndexedDB persistence. Restoring brings back both the
 * last-synced queries and the paused writes, so `resumePausedMutations` is what finishes a
 * reload: the queue picks up where it left off (Engineering Practices › The write queue).
 */
function QueryProvider({
  queryClient,
  persister,
  children,
}: Pick<AppProvidersProps, 'queryClient' | 'persister' | 'children'>): ReactElement {
  if (persister === undefined) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return (
    <PersistQueryClientProvider
      client={queryClient}
      // A new build's cache shape need not match the old one, so the version busts it.
      persistOptions={{ persister, maxAge: PERSIST_MAX_AGE_MS, buster: __APP_VERSION__ }}
      onSuccess={() => {
        void queryClient.resumePausedMutations();
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

/** Server state, the session, and the API client, in the order everything below expects them. */
export function AppProviders({
  auth,
  queryClient,
  realtime,
  persister,
  flushPersister,
  children,
}: AppProvidersProps): ReactElement {
  return (
    <QueryProvider queryClient={queryClient} persister={persister}>
      <ApiProvider auth={auth} realtime={realtime} flushPersister={flushPersister}>
        <ErrorBoundary
          onError={(error) => {
            reportClientError(error);
          }}
          fallback={(reset) => (
            <main className="mx-auto max-w-160 p-4">
              <ErrorState
                message="Something went wrong. Try again, or reload."
                onRetry={reset}
                alternative={{
                  label: 'Reload',
                  onAction: () => {
                    window.location.reload();
                  },
                }}
              />
            </main>
          )}
        >
          {children}
        </ErrorBoundary>
      </ApiProvider>
    </QueryProvider>
  );
}

const router = createBrowserRouter(routes);

export function App({
  auth,
  queryClient,
  realtime,
  persister,
  flushPersister,
}: Omit<AppProvidersProps, 'children'>): ReactElement {
  return (
    <AppProviders
      auth={auth}
      queryClient={queryClient}
      realtime={realtime}
      persister={persister}
      flushPersister={flushPersister}
    >
      <RouterProvider router={router} />
    </AppProviders>
  );
}
