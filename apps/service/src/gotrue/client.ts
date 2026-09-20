import { callGoTrue, GoTrueError, type Fetch, type GoTrueResponse } from './http.js';
import type { JsonWebKeySet } from '../auth/jwt.js';

/**
 * GoTrue calls made for or as a user, with the anon key (Technical Architecture, "Auth
 * configuration"). Signup and the password change reach GoTrue only through here; Caddy refuses
 * both endpoints from outside.
 */
export interface GoTrueClient {
  /** POST /signup. Returns GoTrue's session unchanged. */
  signup: (
    input: { email: string; password: string; displayName: string; timezone: string },
    clientIp: string,
  ) => Promise<GoTrueResponse>;
  /** A password grant, used only to re-verify the current password. */
  verifyPassword: (email: string, password: string, clientIp: string) => Promise<boolean>;
  /** PUT /user with the caller's own token. */
  updatePassword: (accessToken: string, password: string, clientIp: string) => Promise<void>;
  /** GoTrue's published signing keys. */
  jwks: () => Promise<JsonWebKeySet>;
}

export interface GoTrueClientOptions {
  url: string;
  anonKey: string;
  fetch?: Fetch;
}

export function createGoTrueClient(options: GoTrueClientOptions): GoTrueClient {
  const fetchFn = options.fetch ?? fetch;
  const call = (request: Omit<Parameters<typeof callGoTrue>[2], 'apikey'>) =>
    callGoTrue(fetchFn, options.url, { ...request, apikey: options.anonKey });

  return {
    signup: (input, clientIp) =>
      call({
        method: 'POST',
        path: '/signup',
        clientIp,
        body: {
          email: input.email,
          password: input.password,
          // user_metadata; the auth.users trigger copies both into profile.
          data: { display_name: input.displayName, timezone: input.timezone },
        },
      }),

    verifyPassword: async (email, password, clientIp) => {
      try {
        await call({
          method: 'POST',
          path: '/token?grant_type=password',
          clientIp,
          body: { email, password },
        });
        return true;
      } catch (error) {
        if (error instanceof GoTrueError && error.status === 400) return false;
        throw error;
      }
    },

    updatePassword: async (accessToken, password, clientIp) => {
      await call({
        method: 'PUT',
        path: '/user',
        bearer: accessToken,
        clientIp,
        body: { password },
      });
    },

    jwks: async () => {
      const { body } = await call({ method: 'GET', path: '/.well-known/jwks.json' });
      const keys =
        typeof body === 'object' && body !== null && Array.isArray((body as JsonWebKeySet).keys)
          ? (body as JsonWebKeySet).keys
          : [];
      return { keys };
    },
  };
}
