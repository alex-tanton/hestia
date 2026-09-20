import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createApiClient, type ApiClient } from './client.ts';
import type { AuthClient, AuthState } from '../auth/auth-client.ts';

interface AppApi {
  api: ApiClient;
  auth: AuthClient;
}

const ApiContext = createContext<AppApi | null>(null);

export function ApiProvider({
  auth,
  children,
}: {
  auth: AuthClient;
  children: ReactNode;
}): ReactElement {
  const value = useMemo<AppApi>(() => ({ api: createApiClient(auth), auth }), [auth]);
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

/** The session as the router sees it: loading, signed out, or signed in. */
export function useAuthState(): AuthState {
  const auth = useAppApi().auth;
  return useSyncExternalStore(auth.subscribe, auth.getState, auth.getState);
}
