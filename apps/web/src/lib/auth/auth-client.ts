import type { createClient } from '@supabase/supabase-js';
import { sessionResponseSchema, type SignupRequest } from '@hestia/shared';
import { ApiError, parseProblem } from '../api/problem.ts';
import type { AuthPort } from '../api/client.ts';

/** supabase-js's client, as `createClient` actually returns it. */
export type SupabaseAuthClient = ReturnType<typeof createClient>;

export interface AuthState {
  /** `loading` until supabase-js has read its stored session. */
  status: 'loading' | 'signed-out' | 'signed-in';
  userId: string | null;
}

export interface AuthClient extends AuthPort {
  getState: () => AuthState;
  subscribe: (listener: (state: AuthState) => void) => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignupRequest) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Magic link. Nothing calls either of these unless the build included the magic-link screens,
   * which is what `VITE_MAGIC_LINK_ENABLED` decides.
   */
  sendSignInLink: (email: string) => Promise<void>;
  verifySignInCode: (email: string, code: string) => Promise<void>;
}

export const SIGN_IN_FAILED_MESSAGE = 'Email or password is incorrect.';
export const RATE_LIMITED_MESSAGE = 'Too many attempts. Try again in a minute.';

/** A sign-in refusal, already reduced to the sentence shown for it. */
export class AuthError extends Error {
  /**
   * The status GoTrue refused with, where the caller needs to tell refusals apart. `0` is a
   * request that never reached the network, which supabase-js reports the same way.
   */
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/**
 * Sign-in, refresh, and sign-out go straight to GoTrue through Caddy and Kong; only signup goes
 * through the service, which is where the common-password check lives. supabase-js keeps the tokens
 * in its default storage.
 *
 * It is imported here and nowhere else, and dynamically: its one entry point carries the auth,
 * realtime, storage, and postgrest clients together, which is more than the app shell's budget
 * can hold. Nothing can be shown until the session
 * is known anyway, and `loading` is the state every guard already renders for that.
 */
export function loadSupabaseClient(origin: string, anonKey: string): Promise<SupabaseAuthClient> {
  return import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(origin, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The reset link lands on /set-password with the session in the URL fragment, which
        // nothing clears before this arrives.
        detectSessionInUrl: true,
        flowType: 'implicit',
      },
    }),
  );
}

export function createAuthClient(client: Promise<SupabaseAuthClient>): AuthClient {
  let state: AuthState = { status: 'loading', userId: null };
  const listeners = new Set<(next: AuthState) => void>();

  function publish(next: AuthState): void {
    state = next;
    for (const listener of listeners) listener(state);
  }

  const ready = client.then((supabase) => {
    supabase.auth.onAuthStateChange((_event, session) => {
      publish(
        session
          ? { status: 'signed-in', userId: session.user.id }
          : { status: 'signed-out', userId: null },
      );
    });
    return supabase;
  });

  // Without the client there is no session to be had, so the app settles on signed out rather
  // than on a skeleton that never resolves; signing in then reports the failure for itself.
  ready.catch(() => {
    publish({ status: 'signed-out', userId: null });
  });

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async getAccessToken() {
      const { auth } = await ready;
      const { data } = await auth.getSession();
      return data.session?.access_token ?? null;
    },

    async refreshAccessToken() {
      const { auth } = await ready;
      const { data, error } = await auth.refreshSession();
      if (error) return null;
      return data.session?.access_token ?? null;
    },

    async onUnauthorized() {
      const { auth } = await ready;
      // Local scope only: the token the server just refused cannot revoke itself.
      await auth.signOut({ scope: 'local' });
    },

    async signIn(email, password) {
      const { auth } = await ready;
      const { error } = await auth.signInWithPassword({ email, password });
      if (!error) return;
      throw new AuthError(
        error.status === 429 ? RATE_LIMITED_MESSAGE : SIGN_IN_FAILED_MESSAGE,
        error.status,
      );
    },

    async sendSignInLink(email) {
      const { auth } = await ready;
      const { error } = await auth.signInWithOtp({
        email,
        // The email carries a link and a 6-digit code. The link lands on the app's root with the
        // session in the URL fragment, which `detectSessionInUrl` above is already watching for.
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      // The screen chooses the sentence: GoTrue's own message is for the log, not the user.
      if (error) throw new AuthError(error.message, error.status);
    },

    async verifySignInCode(email, code) {
      const { auth } = await ready;
      const { error } = await auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) throw new AuthError(error.message, error.status);
    },

    async signUp(input) {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(input),
      }).catch(() => {
        throw new ApiError(0, undefined, true);
      });
      if (!response.ok) {
        throw new ApiError(response.status, parseProblem(await response.json().catch(() => null)));
      }
      const session = sessionResponseSchema.parse(await response.json());
      const { auth } = await ready;
      const { error } = await auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (error) throw new AuthError('Signed up, but could not start a session. Sign in.');
    },

    async signOut() {
      const { auth } = await ready;
      await auth.signOut();
    },
  };
}
