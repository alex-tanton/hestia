import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { Persister } from '@tanstack/react-query-persist-client';
import { createApiClient, type ApiClient } from './client.ts';
import type { AuthClient, AuthState } from '../auth/auth-client.ts';
import type { RealtimePort } from '../realtime/realtime-port.ts';

interface AppApi {
  api: ApiClient;
  auth: AuthClient;
  /** Absent in a test that does not exercise realtime, and in a build without supabase-js. */
  realtime: RealtimePort | undefined;
  /**
   * A second, unthrottled persister over the same storage and key as `PersistQueryClientProvider`'s
   * own throttled one (a queued write must survive a
   * restart, not wait out the query cache's throttled save). Absent in a test that does not
   * exercise persistence.
   */
  flushPersister: Persister | undefined;
}

const ApiContext = createContext<AppApi | null>(null);

export function ApiProvider({
  auth,
  realtime,
  flushPersister,
  children,
}: {
  auth: AuthClient;
  realtime?: RealtimePort | undefined;
  flushPersister?: Persister | undefined;
  children: ReactNode;
}): ReactElement {
  const value = useMemo<AppApi>(
    () => ({ api: createApiClient(auth), auth, realtime, flushPersister }),
    [auth, realtime, flushPersister],
  );
  return <ApiContext value={value}>{children}</ApiContext>;
}

function useAppApi(): AppApi {
  const value = useContext(ApiContext);
  if (!value) throw new Error('useApi must be used inside ApiProvider');
  return value;
}

export function useApi(): ApiClient {
  return useAppApi().api;
}

export function useAuthClient(): AuthClient {
  return useAppApi().auth;
}

export function useRealtime(): RealtimePort | undefined {
  return useAppApi().realtime;
}

/**
 * The unthrottled persister, for a caller that must force a durable save the instant something
 * queues rather than whenever the query cache's own throttled save next fires.
 */
export function useFlushPersister(): Persister | undefined {
  return useAppApi().flushPersister;
}

/** The session as the router sees it: loading, signed out, or signed in. */
export function useAuthState(): AuthState {
  const auth = useAppApi().auth;
  return useSyncExternalStore(auth.subscribe, auth.getState, auth.getState);
}
