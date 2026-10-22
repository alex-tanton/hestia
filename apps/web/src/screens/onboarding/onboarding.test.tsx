import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMMON_PASSWORD_MESSAGE } from '@hearth/shared';
import { createAuthStub, problemBody, renderScreen, stubFetch } from '../../test/harness.tsx';
import { oakStreetFixture, profileFixture } from '../../test/fixtures.ts';
import { merchantsResponse } from '../../test/deal-fixtures.ts';
import { AuthError, SIGN_IN_FAILED_MESSAGE } from '../../lib/auth/auth-client.ts';
import { FavoriteStoresStep } from './FavoriteStoresStep.tsx';
import { CreateHouseholdStep } from './CreateHouseholdStep.tsx';
import { ForgotPasswordScreen } from './ForgotPasswordScreen.tsx';
import { IOS_INSTALL_MESSAGE, InstallStep } from './InstallStep.tsx';
import { JoinHouseholdStep } from './JoinHouseholdStep.tsx';
import { Component as JoinRoute } from './JoinRoute.tsx';
import { RESET_LINK_EXPIRED_MESSAGE, SetPasswordScreen } from './SetPasswordScreen.tsx';
import { SignInScreen } from './SignInScreen.tsx';
import { SignUpScreen } from './SignUpScreen.tsx';

// The invite link is read from the URL fragment once, at module load (lib/url-hash.ts); mocking
// the module is the only way a test controls what a fresh `/join` visit saw. `hashHasAuthError`
// stays real — `set-password` tests in this file rely on it.
vi.mock('../../lib/url-hash.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/url-hash.ts')>()),
  initialUrlHash: () => '#token=a-token-from-the-url-fragment',
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sign in', () => {
  it('labels both fields and offers the forgot-password route', () => {
    renderScreen(<SignInScreen />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toBeInTheDocument();
  });

  it('moves focus to the first field in error on submit', async () => {
    const user = userEvent.setup();
    renderScreen(<SignInScreen />);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Email')).toHaveFocus();
    });
  });

  it('shows one sentence for a wrong password', async () => {
    const user = userEvent.setup();
    const auth = createAuthStub({ status: 'signed-out', userId: null });
    auth.signIn = vi.fn(() => Promise.reject(new AuthError(SIGN_IN_FAILED_MESSAGE)));
    renderScreen(<SignInScreen />, { auth });

    await user.type(screen.getByLabelText('Email'), 'alex@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(SIGN_IN_FAILED_MESSAGE);
  });
});

describe('sign up', () => {
  it('refuses a common password with the same sentence the service uses', async () => {
    const user = userEvent.setup();
    const auth = createAuthStub({ status: 'signed-out', userId: null });
    renderScreen(<SignUpScreen />, { auth });

    await user.type(screen.getByLabelText('Display name'), 'Alex Rivera');
    await user.type(screen.getByLabelText('Email'), 'alex@example.com');
    await user.type(screen.getByLabelText('Password'), 'password1');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(COMMON_PASSWORD_MESSAGE)).toBeInTheDocument();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('refuses a password under eight characters', async () => {
    const user = userEvent.setup();
    const auth = createAuthStub({ status: 'signed-out', userId: null });
    renderScreen(<SignUpScreen />, { auth });

    await user.type(screen.getByLabelText('Display name'), 'Alex Rivera');
    await user.type(screen.getByLabelText('Email'), 'alex@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('shows the rule up front and signs up with the browser timezone', async () => {
    const user = userEvent.setup();
    const auth = createAuthStub({ status: 'signed-out', userId: null });
    renderScreen(<SignUpScreen />, { auth });

    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Display name'), 'Alex Rivera');
    await user.type(screen.getByLabelText('Email'), 'alex@example.com');
    await user.type(screen.getByLabelText('Password'), 'hearth-seed-pass-2026');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'alex@example.com',
          displayName: 'Alex Rivera',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      );
    });
  });
});

describe('forgot password', () => {
  it('sends the user to the server owner and offers no form', () => {
    renderScreen(<ForgotPasswordScreen />);
    expect(
      screen.getByText('Ask your server owner for a reset link. They can create one for you.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('set a new password', () => {
  it('asks only for the new password and sends no current one', async () => {
    const user = userEvent.setup();
    const stub = stubFetch({ 'POST /api/users/me/password': () => ({ status: 204 }) });
    renderScreen(<SetPasswordScreen />);

    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('New password'), 'hearth-seed-pass-2026');
    await user.click(screen.getByRole('button', { name: 'Set password' }));

    await waitFor(() => {
      expect(stub.calls).toContainEqual({
        method: 'POST',
        path: '/api/users/me/password',
        body: { newPassword: 'hearth-seed-pass-2026' },
      });
    });
  });

  it('says so when the link has already been used', async () => {
    const user = userEvent.setup();
    stubFetch({
      'POST /api/users/me/password': () => ({
        status: 400,
        body: problemBody(400, 'Bad Request', 'Enter your current password.'),
      }),
    });
    renderScreen(<SetPasswordScreen />);

    await user.type(screen.getByLabelText('New password'), 'hearth-seed-pass-2026');
    await user.click(screen.getByRole('button', { name: 'Set password' }));

    expect(await screen.findByText(RESET_LINK_EXPIRED_MESSAGE)).toBeInTheDocument();
  });

  it('says so when there is no session at all', () => {
    renderScreen(<SetPasswordScreen />, {
      auth: createAuthStub({ status: 'signed-out', userId: null }),
    });
    expect(screen.getByText(RESET_LINK_EXPIRED_MESSAGE)).toBeInTheDocument();
  });
});

describe('creating a household', () => {
  it('refuses a postal code that is not five digits', async () => {
    const user = userEvent.setup();
    const stub = stubFetch({});
    renderScreen(<CreateHouseholdStep onCreated={() => undefined} />);

    await user.type(screen.getByLabelText('Household name'), 'Oak Street');
    await user.type(screen.getByLabelText('ZIP code'), '275');
    await user.click(screen.getByRole('button', { name: 'Create household' }));

    expect(await screen.findByText('Enter a five-digit ZIP code.')).toBeInTheDocument();
    expect(stub.calls).toHaveLength(0);
  });

  it('sends the browser timezone without asking for it', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const stub = stubFetch({
      'POST /api/households': () => ({ status: 201, body: oakStreetFixture }),
    });
    renderScreen(<CreateHouseholdStep onCreated={onCreated} />);

    await user.type(screen.getByLabelText('Household name'), 'Oak Street');
    await user.type(screen.getByLabelText('ZIP code'), '27514');
    await user.click(screen.getByRole('button', { name: 'Create household' }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled();
    });
    expect(stub.calls[0]?.body).toEqual({
      name: 'Oak Street',
      postalCode: '27514',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  });
});

describe('joining a household', () => {
  it('normalizes what the person typed before sending it', async () => {
    const user = userEvent.setup();
    const stub = stubFetch({
      'POST /api/households/join': () => ({ status: 200, body: oakStreetFixture }),
      'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    });
    renderScreen(<JoinHouseholdStep onJoined={() => undefined} />);

    await user.type(screen.getByLabelText('Invite code'), 'o-i l9kr4t');
    await user.click(screen.getByRole('button', { name: 'Join household' }));

    await waitFor(() => {
      expect(stub.calls[0]?.body).toEqual({ tokenOrCode: '0119KR4T' });
    });
  });

  it('shows Design’s copy for an expired invite', async () => {
    const user = userEvent.setup();
    stubFetch({
      'POST /api/households/join': () => ({
        status: 410,
        body: problemBody(410, 'Gone', 'This invite has expired or was revoked.'),
      }),
    });
    renderScreen(<JoinHouseholdStep onJoined={() => undefined} />);

    await user.type(screen.getByLabelText('Invite code'), '9XKR4TZ2');
    await user.click(screen.getByRole('button', { name: 'Join household' }));

    expect(
      await screen.findByText('This invite has expired. Ask for a new link or code.'),
    ).toBeInTheDocument();
  });

  it('shows Design’s copy for a code that matches nothing', async () => {
    const user = userEvent.setup();
    stubFetch({
      'POST /api/households/join': () => ({
        status: 404,
        body: problemBody(404, 'Not Found', 'No invite matches that link or code.'),
      }),
    });
    renderScreen(<JoinHouseholdStep onJoined={() => undefined} />);

    await user.type(screen.getByLabelText('Invite code'), '9XKR4TZ2');
    await user.click(screen.getByRole('button', { name: 'Join household' }));

    expect(
      await screen.findByText("That code doesn't match an invite. Check it and try again."),
    ).toBeInTheDocument();
  });

  it('redeems a link’s token as soon as the screen opens', async () => {
    const onJoined = vi.fn();
    const stub = stubFetch({
      'POST /api/households/join': () => ({ status: 200, body: oakStreetFixture }),
      'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    });
    renderScreen(
      <JoinHouseholdStep autoToken="a-token-from-the-invite-link" onJoined={onJoined} />,
    );

    await waitFor(() => {
      expect(onJoined).toHaveBeenCalled();
    });
    expect(stub.calls[0]?.body).toEqual({ tokenOrCode: 'a-token-from-the-invite-link' });
  });

  it('moves focus into the code form when a failed link puts it back', async () => {
    stubFetch({
      'POST /api/households/join': () => ({
        status: 410,
        body: problemBody(410, 'Gone', 'This invite has expired or was revoked.'),
      }),
    });
    renderScreen(<JoinHouseholdStep autoToken="a-dead-token" onJoined={() => undefined} />);

    // The status message gave way to the form, so focus follows rather than falling back to the
    // document.
    expect(await screen.findByLabelText('Invite code')).toHaveFocus();
  });

  it('leaves focus alone on an ordinary visit, which starts on the form', async () => {
    stubFetch({});
    renderScreen(<JoinHouseholdStep onJoined={() => undefined} />);
    expect(await screen.findByLabelText('Invite code')).not.toHaveFocus();
  });
});

describe('the /join lazy route module', () => {
  it('opens straight on the join step and redeems the token from the URL fragment', async () => {
    const stub = stubFetch({
      'POST /api/households/join': () => ({ status: 200, body: oakStreetFixture }),
    });
    renderScreen(<JoinRoute />);

    // The redeem starts immediately, before any code form would show.
    expect(screen.getByText('Opening your invite…')).toBeInTheDocument();
    await waitFor(() => {
      expect(stub.calls.some((call) => call.path === '/api/households/join')).toBe(true);
    });
    expect(stub.calls[0]?.body).toEqual({ tokenOrCode: 'a-token-from-the-url-fragment' });
  });
});

describe('the rest of onboarding', () => {
  it('picks favorite stores from the merchants near the postal code, then moves on', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    const stub = stubFetch({
      'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
      'GET /api/households/:id': () => ({ status: 200, body: oakStreetFixture }),
      'GET /api/households/:id/merchants': () => ({ status: 200, body: merchantsResponse() }),
      'POST /api/households/:id/favorite-stores': () => ({ status: 204 }),
    });
    renderScreen(<FavoriteStoresStep onDone={onDone} />);

    const publix = await screen.findByRole('checkbox', { name: /Publix/ });
    expect(publix).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Harris Teeter/ })).toBeChecked();

    await user.click(publix);
    await waitFor(() => {
      expect(stub.calls.some((call) => call.method === 'POST')).toBe(true);
    });
    expect(stub.calls.find((call) => call.method === 'POST')?.body).toEqual({
      merchantId: '2361',
      merchantName: 'Publix',
    });

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('explains the iOS install sequence instead of prompting', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
    );
    renderScreen(<InstallStep onDone={() => undefined} />);

    expect(screen.getByText(IOS_INSTALL_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Hearth' })).toBeInTheDocument();
  });
});
