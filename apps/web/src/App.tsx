import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { ErrorBoundary } from './components/states/ErrorBoundary.tsx';
import { ErrorState } from './components/states/StateBlocks.tsx';
import { ApiProvider } from './lib/api/api-context.tsx';
import type { AuthClient } from './lib/auth/auth-client.ts';
import { reportClientError } from './lib/error-reporting.ts';
import { routes } from './routes.tsx';

export interface AppProvidersProps {
  auth: AuthClient;
  queryClient: QueryClient;
  children: ReactNode;
}

/** Server state, the session, and the API client, in the order everything below expects them. */
export function AppProviders({ auth, queryClient, children }: AppProvidersProps): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider auth={auth}>
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
    </QueryClientProvider>
  );
}

const router = createBrowserRouter(routes);

export function App({ auth, queryClient }: Omit<AppProvidersProps, 'children'>): ReactElement {
  return (
    <AppProviders auth={auth} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
