import { QueryClient } from '@tanstack/react-query';
import type { Persister } from '@tanstack/react-query-persist-client';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import {
  RouterProvider,
  createMemoryRouter,
  type InitialEntry,
  type RouteObject,
} from 'react-router';
import { vi } from 'vitest';
import { PROBLEM_CONTENT_TYPE } from '@hearth/shared';
import { AppProviders } from '../App.tsx';
import { ToastProvider } from '../components/ui/Toast.tsx';
import { SectionProvider } from '../lib/section-context.tsx';
import { useWriteQueue } from '../lib/offline/use-write-queue.ts';
import type { AuthClient, AuthState } from '../lib/auth/auth-client.ts';
import type { ListRealtimeHandlers, RealtimePort } from '../lib/realtime/realtime-port.ts';
import type { PushPort } from '../lib/push/push-port.ts';
import { PushPortProvider } from '../lib/push/use-push-device.tsx';
import { routes } from '../routes.tsx';
import { ALEX_ID } from './fixtures.ts';
import { createPushDouble } from './push-double.ts';

/*
 * A typed stub of the two things every screen talks to: the session and `fetch`. There is no
 * network in a component test, and no supabase-js either — the auth client is an interface for
 * exactly this reason.
 */

export interface AuthStub extends AuthClient {
  /** Moves the session, as supabase-js would on sign-in or sign-out. */
  setState: (next: AuthState) => void;
}

export function createAuthStub(
  initial: AuthState = { status: 'signed-in', userId: ALEX_ID },
): AuthStub {
  let state = initial;
  const listeners = new Set<(next: AuthState) => void>();
  const setState = (next: AuthState): void => {
    state = next;
    for (const listener of listeners) listener(state);
  };
  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getAccessToken: vi.fn(() => Promise.resolve('access-token')),
    refreshAccessToken: vi.fn(() => Promise.resolve('refreshed-token')),
    onUnauthorized: vi.fn(() => {
      setState({ status: 'signed-out', userId: null });
      return Promise.resolve();
    }),
    signIn: vi.fn(() => Promise.resolve()),
    signUp: vi.fn(() => Promise.resolve()),
    sendSignInLink: vi.fn(() => Promise.resolve()),
    verifySignInCode: vi.fn(() => Promise.resolve()),
    signOut: vi.fn(() => {
      setState({ status: 'signed-out', userId: null });
      return Promise.resolve();
    }),
    setState,
  };
}

export interface StubRequest {
  method: string;
  /** The full path as the client asked for it, query string included. */
  path: string;
  body: unknown;
  token: string | null;
  params: Record<string, string>;
  /** The parsed query string, for the screens that filter, sort, and paginate. */
  query: URLSearchParams;
}

export interface StubResponse {
  status: number;
  body?: unknown;
}
export type StubHandler = (request: StubRequest) => StubResponse | Promise<StubResponse>;

export interface FetchStub {
  fetch: typeof fetch;
  /** Every call in order, for asserting that a request was or was not made. */
  calls: { method: string; path: string; body: unknown }[];
}

function matchRoute(
  pattern: string,
  method: string,
  path: string,
): Record<string, string> | undefined {
  const [patternMethod = '', patternPath = ''] = pattern.split(' ');
  if (patternMethod !== method) return undefined;
  const patternParts = patternPath.split('/');
  const pathParts = path.split('/');
  if (patternParts.length !== pathParts.length) return undefined;
  const params: Record<string, string> = {};
  for (const [index, part] of patternParts.entries()) {
    const actual = pathParts[index] ?? '';
    if (part.startsWith(':')) params[part.slice(1)] = actual;
    else if (part !== actual) return undefined;
  }
  return params;
}

/**
 * Handlers keyed by `"<METHOD> /api/path/:param"`; anything unmatched answers 404. A pattern
 * names the path only — a query string is parsed off and handed to the handler as `query`.
 */
export function createFetchStub(handlers: Readonly<Record<string, StubHandler>>): FetchStub {
  const calls: FetchStub['calls'] = [];

  const stub: typeof fetch = async (input, init) => {
    const requested =
      typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    const method = init?.method ?? 'GET';
    const raw = typeof init?.body === 'string' ? init.body : undefined;
    const body: unknown = raw === undefined ? undefined : JSON.parse(raw);
    calls.push({ method, path: requested, body });

    // Handlers are keyed on the path alone; a handler that cares reads the query from `query`.
    const queryStart = requested.indexOf('?');
    const pathname = queryStart === -1 ? requested : requested.slice(0, queryStart);
    const query = new URLSearchParams(queryStart === -1 ? '' : requested.slice(queryStart + 1));

    const headers = new Headers(init?.headers);
    const authorization = headers.get('authorization');
    const token = authorization === null ? null : authorization.replace(/^Bearer\s+/i, '');

    for (const [pattern, handler] of Object.entries(handlers)) {
      const params = matchRoute(pattern, method, pathname);
      if (params === undefined) continue;
      const result = await handler({ method, path: requested, body, token, params, query });
      if (result.status === 204 || result.body === undefined) {
        return new Response(null, { status: result.status });
      }
      const isProblem = result.status >= 400;
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: {
          'content-type': isProblem ? PROBLEM_CONTENT_TYPE : 'application/json',
        },
      });
    }
    return new Response(null, { status: 404 });
  };

  return { fetch: stub, calls };
}

/** Installs the stub as the global `fetch`; the test's `afterEach` unstubs it. */
export function stubFetch(handlers: Readonly<Record<string, StubHandler>>): FetchStub {
  const stub = createFetchStub(handlers);
  vi.stubGlobal('fetch', stub.fetch);
  return stub;
}

/** RFC 9457 body, as the service sends it. */
export function problemBody(status: number, title: string, detail?: string): unknown {
  return { type: 'about:blank', title, status, ...(detail === undefined ? {} : { detail }) };
}

/*
 * The queue lives in the shell, so a screen under test gets it the same way. Completion is a queued
 * write, and the queue's defaults are registered by the shell that mounts it (AppShell →
 * useWriteQueue), so a screen that completes a chore is mounted under it, as in the app.
 */
export function WithQueue({ children }: { children: ReactNode }): ReactElement {
  useWriteQueue();
  return <>{children}</>;
}

export function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

export interface RenderOptions {
  auth?: AuthStub;
  queryClient?: QueryClient;
  /** A stand-in for Supabase Realtime, for the screens that subscribe to one. */
  realtime?: RealtimePort;
  /** Absent unless a test exercises persistence directly; enables `PersistQueryClientProvider`. */
  persister?: Persister;
  /** Absent unless a test exercises the write queue's own immediate, unthrottled flush. */
  flushPersister?: Persister;
  /**
   * The device's push port. Every render gets a double by default, so no screen under test reaches
   * the browser's push APIs, which jsdom does not have.
   */
  pushPort?: PushPort;
  /** A route pattern, when the screen reads params from it. */
  path?: string;
  /** A string, or a `{ pathname, state }` entry where the screen reads router state. */
  initialEntries?: InitialEntry[];
}

/** Renders one screen inside the providers and a router, with no route guards in the way. */
export function renderScreen(
  ui: ReactElement,
  {
    auth = createAuthStub(),
    queryClient = testQueryClient(),
    realtime,
    persister,
    flushPersister,
    pushPort = createPushDouble(),
    path = '*',
    initialEntries = ['/'],
  }: RenderOptions = {},
): RenderResult & { auth: AuthStub; queryClient: QueryClient; pushPort: PushPort } {
  const router = createMemoryRouter([{ path, element: ui }], { initialEntries });
  const result = render(
    <AppProviders
      auth={auth}
      queryClient={queryClient}
      realtime={realtime}
      persister={persister}
      flushPersister={flushPersister}
    >
      {/* The shell supplies both around every screen; a screen under test needs them too. */}
      <SectionProvider section="dashboard">
        <ToastProvider>
          <PushPortProvider port={pushPort}>
            <RouterProvider router={router} />
          </PushPortProvider>
        </ToastProvider>
      </SectionProvider>
    </AppProviders>,
  );
  return { ...result, auth, queryClient, pushPort };
}

/** A realtime port a test drives by hand, recording what each open list subscribed to. */
export interface RealtimeStub extends RealtimePort {
  /** The channels currently open, by list id. */
  readonly open: Map<string, ListRealtimeHandlers>;
  /** Every list subscribed to and torn down, in order, for asserting the lifecycle. */
  readonly subscribed: string[];
  readonly unsubscribed: string[];
}

export function createRealtimeStub(): RealtimeStub {
  const open = new Map<string, ListRealtimeHandlers>();
  const subscribed: string[] = [];
  const unsubscribed: string[] = [];
  return {
    open,
    subscribed,
    unsubscribed,
    subscribeToList(listId, handlers) {
      open.set(listId, handlers);
      subscribed.push(listId);
      return () => {
        open.delete(listId);
        unsubscribed.push(listId);
      };
    },
  };
}

export interface RenderAppOptions extends RenderOptions {
  /** The route tree to mount; defaults to the app's own, built with this build's flags. */
  routes?: RouteObject[];
}

/** Renders the real route tree, so guards, redirects, and the shell are exercised too. */
export function renderApp({
  initialEntries = ['/'],
  auth = createAuthStub(),
  queryClient = testQueryClient(),
  routes: tree = routes,
}: RenderAppOptions = {}): RenderResult & { auth: AuthStub; queryClient: QueryClient } {
  const router = createMemoryRouter(tree, { initialEntries });
  const result = render(
    <AppProviders auth={auth} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...result, auth, queryClient };
}
