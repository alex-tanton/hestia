import type { z } from 'zod';
import { PROBLEM_CONTENT_TYPE } from '@hearth/shared';
import { ApiError, parseProblem } from './problem.ts';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** What the API client needs from the session, so tests can drive it without supabase-js. */
export interface AuthPort {
  getAccessToken: () => Promise<string | null>;
  /** A fresh access token, or null when the refresh token is gone too. */
  refreshAccessToken: () => Promise<string | null>;
  /** The session is unusable: drop it, so the route guard sends the user to sign in. */
  onUnauthorized: () => Promise<void>;
}

interface RequestInit_ {
  method: HttpMethod;
  /** Path under the origin, e.g. `/api/users/me`. */
  path: string;
  body?: unknown;
  signal?: AbortSignal;
}

export interface ApiClient {
  /** A call whose response body is validated with a shared schema. */
  request: <S extends z.ZodType>(init: RequestInit_ & { schema: S }) => Promise<z.infer<S>>;
  /** A call whose response body is discarded (204, or a body the screen does not need). */
  send: (init: RequestInit_) => Promise<void>;
}

function isProblemResponse(response: Response): boolean {
  return (response.headers.get('content-type') ?? '').startsWith(PROBLEM_CONTENT_TYPE);
}

async function readProblem(response: Response): Promise<ApiError> {
  if (!isProblemResponse(response)) return new ApiError(response.status);
  try {
    return new ApiError(response.status, parseProblem(await response.json()));
  } catch {
    // A truncated or non-JSON body is still a failure; the status carries the meaning.
    return new ApiError(response.status);
  }
}

export function createApiClient(auth: AuthPort, fetchImpl: typeof fetch = fetch): ApiClient {
  async function once(init: RequestInit_, token: string | null): Promise<Response> {
    const headers = new Headers({ accept: 'application/json' });
    if (token !== null) headers.set('authorization', `Bearer ${token}`);
    if (init.body !== undefined) headers.set('content-type', 'application/json');
    try {
      return await fetchImpl(init.path, {
        method: init.method,
        headers,
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        ...(init.signal ? { signal: init.signal } : {}),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      // fetch rejects only when the request never completed: no connection, or DNS.
      throw new ApiError(0, undefined, true);
    }
  }

  /**
   * A 401 means the access token was rejected. One refresh-and-retry covers the ordinary case of
   * an expired token; a second failure means the session itself is gone.
   */
  async function call(init: RequestInit_): Promise<Response> {
    const response = await once(init, await auth.getAccessToken());
    if (response.status !== 401) return response;

    const refreshed = await auth.refreshAccessToken();
    if (refreshed !== null) {
      const retried = await once(init, refreshed);
      if (retried.status !== 401) return retried;
    }
    await auth.onUnauthorized();
    return response;
  }

  async function request<S extends z.ZodType>(
    init: RequestInit_ & { schema: S },
  ): Promise<z.infer<S>> {
    const response = await call(init);
    if (!response.ok) throw await readProblem(response);
    return init.schema.parse(await response.json());
  }

  async function send(init: RequestInit_): Promise<void> {
    const response = await call(init);
    if (!response.ok) throw await readProblem(response);
  }

  return { request, send };
}
