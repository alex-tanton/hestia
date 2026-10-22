import { describe, expect, it, vi } from 'vitest';
import {
  AuthError,
  createAuthClient,
  type AuthClient,
  type SupabaseAuthClient,
} from './auth-client.ts';

interface FakeAuth {
  onAuthStateChange: ReturnType<typeof vi.fn>;
  signInWithOtp: ReturnType<typeof vi.fn>;
  verifyOtp: ReturnType<typeof vi.fn>;
}

/** supabase-js, reduced to the two calls magic link makes. Nothing here touches the network. */
function fakeSupabase(overrides: Partial<FakeAuth> = {}): { auth: FakeAuth; client: AuthClient } {
  const auth: FakeAuth = {
    onAuthStateChange: vi.fn(),
    signInWithOtp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    verifyOtp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    ...overrides,
  };
  return {
    auth,
    client: createAuthClient(Promise.resolve({ auth } as unknown as SupabaseAuthClient)),
  };
}

/*
 * Magic link is built and disabled, so these two calls have no screen exercising them in a default
 * build. Their shape is what the appendix on enabling magic link promises GoTrue, which makes it
 * worth pinning down here.
 */
describe('the magic-link calls', () => {
  it('asks GoTrue for a link whose landing page is the app root', async () => {
    const { auth, client } = fakeSupabase();

    await client.sendSignInLink('alex@example.com');

    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'alex@example.com',
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
  });

  it('verifies the 6-digit code as an email OTP', async () => {
    const { auth, client } = fakeSupabase();

    await client.verifySignInCode('alex@example.com', '123456');

    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'alex@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it('carries the refusal status, which is what the screens tell refusals apart by', async () => {
    const { client } = fakeSupabase({
      verifyOtp: vi.fn(() =>
        Promise.resolve({ data: {}, error: { message: 'Token has expired', status: 403 } }),
      ),
    });

    const error = await client
      .verifySignInCode('alex@example.com', '000000')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AuthError);
    expect((error as AuthError).status).toBe(403);
  });
});
