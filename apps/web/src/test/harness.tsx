import { QueryClient } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
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
import type { AuthClient, AuthState } from '../lib/auth/auth-client.ts';
import { routes } from '../routes.tsx';
import { ALEX_ID } from './fixtures.ts';

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
  path: string;
  body: unknown;
  token: string | null;
  params: Record<string, string>;
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

/** Handlers keyed by `"<METHOD> /api/path/:param"`; anything unmatched answers 404. */
export function createFetchStub(handlers: Readonly<Record<string, StubHandler>>): FetchStub {
  const calls: FetchStub['calls'] = [];

  const stub: typeof fetch = async (input, init) => {
    const path =
      typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
    const method = init?.method ?? 'GET';
    const raw = typeof init?.body === 'string' ? init.body : undefined;
    const body: unknown = raw === undefined ? undefined : JSON.parse(raw);
    calls.push({ method, path, body });

    const headers = new Headers(init?.headers);
    const authorization = headers.get('authorization');
    const token = authorization === null ? null : authorization.replace(/^Bearer\s+/i, '');

    for (const [pattern, handler] of Object.entries(handlers)) {
      const params = matchRoute(pattern, method, path);
      if (params === undefined) continue;
      const result = await handler({ method, path, body, token, params });
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

/** RFC 9457 body, as the service sends it. */
export function problemBody(status: number, title: string, detail?: string): unknown {
  return { type: 'about:blank', title, status, ...(detail === undefined ? {} : { detail }) };
}

export function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

export interface RenderOptions {
  auth?: AuthStub;
  queryClient?: QueryClient;
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
    path = '*',
    initialEntries = ['/'],
  }: RenderOptions = {},
): RenderResult & { auth: AuthStub; queryClient: QueryClient } {
  const router = createMemoryRouter([{ path, element: ui }], { initialEntries });
  const result = render(
    <AppProviders auth={auth} queryClient={queryClient}>
      {/* The shell supplies both around every screen; a screen under test needs them too. */}
      <SectionProvider section="dashboard">
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </SectionProvider>
    </AppProviders>,
  );
  return { ...result, auth, queryClient };
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
