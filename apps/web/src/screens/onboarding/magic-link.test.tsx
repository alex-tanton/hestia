import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RouteObject } from 'react-router';
import { OFFLINE_MESSAGE } from '../../lib/api/problem.ts';
import { AuthError, RATE_LIMITED_MESSAGE } from '../../lib/auth/auth-client.ts';
import { createRoutes } from '../../routes.tsx';
import { createAuthStub, renderApp, renderScreen, type AuthStub } from '../../test/harness.tsx';
import {
  findMdButton,
  findMdField,
  getMdButton,
  getMdField,
  queryMdButton,
  queryMdField,
} from '../../test/md-queries.ts';
import { MagicLinkCodeScreen } from './MagicLinkCodeScreen.tsx';
import { MagicLinkRequestScreen } from './MagicLinkRequestScreen.tsx';
import { SignInScreen } from './SignInScreen.tsx';

async function findFieldInput(name: string): Promise<HTMLElement> {
  const field = await findMdField(name);
  return waitFor(() => {
    const input = field.shadowRoot?.querySelector('input');
    if (!input) throw new Error(`Expected shadow input for ${name}`);
    return input;
  });
}
import {
  CODE_INVALID_MESSAGE,
  CODE_LENGTH_MESSAGE,
  MAGIC_CODE_PATH,
  MAGIC_LINK_PATH,
  RESEND_AFTER_SECONDS,
  SEND_FAILED_MESSAGE,
  UNKNOWN_EMAIL_MESSAGE,
  normalizeCode,
  resendCountdown,
  resentConfirmation,
  sentConfirmation,
} from './magic-link.ts';

const EMAIL = 'alex@example.com';
const MAGIC_LINK_LABEL = 'Email me a sign-in link';

function signedOut(): AuthStub {
  return createAuthStub({ status: 'signed-out', userId: null });
}

function routePaths(tree: RouteObject[]): string[] {
  return tree.flatMap((route) => [
    ...(route.path === undefined ? [] : [route.path]),
    ...routePaths(route.children ?? []),
  ]);
}

function renderRequestScreen(auth = signedOut()): AuthStub {
  renderScreen(<MagicLinkRequestScreen />, { auth });
  return auth;
}

function renderCodeScreen(auth = signedOut()): AuthStub {
  renderScreen(<MagicLinkCodeScreen />, {
    auth,
    path: MAGIC_CODE_PATH,
    initialEntries: [{ pathname: MAGIC_CODE_PATH, state: { email: EMAIL } }],
  });
  return auth;
}

/*
 * With the magic-link flag off, no magic-link UI is reachable. The flag is a
 * build-time constant and is unset in a test run, so this is the default build.
 */
describe('with the magic-link flag off', () => {
  it('offers no magic-link option on sign in', () => {
    renderScreen(<SignInScreen />, { auth: signedOut() });

    expect(screen.getByRole('link', { name: 'Forgot password?' })).toBeInTheDocument();
    expect(queryMdButton(MAGIC_LINK_LABEL)).toBeNull();
    expect(screen.queryByRole('link', { name: MAGIC_LINK_LABEL })).not.toBeInTheDocument();
  });

  it('builds no magic-link route', () => {
    const paths = routePaths(createRoutes());

    expect(paths).toContain('sign-in');
    expect(paths).not.toContain('sign-in/link');
    expect(paths).not.toContain('sign-in/code');
  });

  it('sends a direct magic-link URL to ordinary sign in', async () => {
    renderApp({ initialEntries: [MAGIC_LINK_PATH], auth: signedOut() });

    expect(await findMdButton('Sign in')).toBeInTheDocument();
    expect(queryMdButton('Email sign-in link')).toBeNull();
  });

  it('sends a direct code URL to ordinary sign in', async () => {
    renderApp({ initialEntries: [MAGIC_CODE_PATH], auth: signedOut() });

    expect(await findMdButton('Sign in')).toBeInTheDocument();
    expect(queryMdField('6-digit code')).toBeNull();
  });
});

describe('with the magic-link flag on', () => {
  beforeEach(() => {
    vi.stubEnv('HESTIA_PUBLIC_MAGIC_LINK_ENABLED', 'true');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('offers the option on sign in', async () => {
    const user = userEvent.setup();
    renderApp({
      routes: createRoutes(),
      initialEntries: ['/sign-in'],
      auth: signedOut(),
    });

    const button = await findMdButton(MAGIC_LINK_LABEL);
    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(await findMdButton('Email sign-in link')).toBeInTheDocument();
  });

  it('routes to the request screen', async () => {
    renderApp({
      routes: createRoutes(),
      initialEntries: [MAGIC_LINK_PATH],
      auth: signedOut(),
    });

    expect(await findMdButton('Email sign-in link')).toBeInTheDocument();
  });

  it('sends the code screen back to the request screen when nothing was sent', async () => {
    renderApp({
      routes: createRoutes(),
      initialEntries: [MAGIC_CODE_PATH],
      auth: signedOut(),
    });

    expect(await findMdButton('Email sign-in link')).toBeInTheDocument();
  });
});

describe('the request-link screen', () => {
  it('asks for an address and names what will arrive', () => {
    renderRequestScreen();

    expect(getMdField('Email')).toBeInTheDocument();
    expect(
      screen.getByText('We send a sign-in link and a 6-digit code to your email address.'),
    ).toBeInTheDocument();
  });

  it('moves focus to the field when it is empty on submit', async () => {
    const user = userEvent.setup();
    renderRequestScreen();

    await user.click(getMdButton('Email sign-in link'));

    await waitFor(() => {
      expect(getMdField('Email')).toHaveProperty('errorText', 'Enter your email address.');
      expect(getMdField('Email')).toHaveFocus();
    });
  });

  it('confirms what was sent and offers the code as the way in', async () => {
    const user = userEvent.setup();
    const auth = renderRequestScreen();

    await user.type(await findFieldInput('Email'), `  ${EMAIL}  `);
    await user.click(getMdButton('Email sign-in link'));

    expect(auth.sendSignInLink).toHaveBeenCalledWith(EMAIL);
    const confirmation = await screen.findByText(sentConfirmation(EMAIL));
    expect(confirmation).toHaveAttribute('role', 'status');
    expect(getMdButton('Enter the code')).toBeInTheDocument();
    expect(getMdButton('Use a different email')).toBeInTheDocument();
  });

  it('moves focus into the confirmation once the link is sent', async () => {
    const user = userEvent.setup();
    renderRequestScreen();

    await user.type(await findFieldInput('Email'), EMAIL);
    await user.click(getMdButton('Email sign-in link'));

    const enterCode = await findMdButton('Enter the code');
    const confirmation = enterCode.closest('[tabindex="-1"]');
    await waitFor(() => {
      expect(confirmation).toHaveFocus();
    });
    // From there the actions are the next thing, rather than the top of the document.
    enterCode.tabIndex = 0;
    await user.tab();
    expect(enterCode).toHaveFocus();
  });

  it('has the live region mounted before there is anything to announce', async () => {
    const user = userEvent.setup();
    renderRequestScreen();

    const regions = screen.getAllByRole('status');
    expect(regions.every((region) => region.textContent === '')).toBe(true);

    await user.type(await findFieldInput('Email'), EMAIL);
    await user.click(getMdButton('Email sign-in link'));

    // The same node, not a fresh one: a status region that arrives populated is announced
    // unreliably.
    expect(regions).toContain(await screen.findByText(sentConfirmation(EMAIL)));
  });

  it('states what failed and what to do', async () => {
    const user = userEvent.setup();
    const auth = signedOut();
    auth.sendSignInLink = vi.fn(() => Promise.reject(new AuthError('smtp down', 500)));
    renderRequestScreen(auth);

    await user.type(await findFieldInput('Email'), EMAIL);
    await user.click(getMdButton('Email sign-in link'));

    expect(await screen.findByRole('alert')).toHaveTextContent(SEND_FAILED_MESSAGE);
  });

  it('names a rate limit for what it is', async () => {
    const user = userEvent.setup();
    const auth = signedOut();
    auth.sendSignInLink = vi.fn(() => Promise.reject(new AuthError('too many', 429)));
    renderRequestScreen(auth);

    await user.type(await findFieldInput('Email'), EMAIL);
    await user.click(getMdButton('Email sign-in link'));

    expect(await screen.findByRole('alert')).toHaveTextContent(RATE_LIMITED_MESSAGE);
  });

  it('rejects an unknown email with an invite reminder', async () => {
    const user = userEvent.setup();
    const auth = signedOut();
    auth.sendSignInLink = vi.fn(() =>
      Promise.reject(new AuthError('Signups not allowed for otp', 400)),
    );
    renderRequestScreen(auth);

    await user.type(await findFieldInput('Email'), 'uninvited@example.com');
    await user.click(getMdButton('Email sign-in link'));

    expect(await screen.findByRole('alert')).toHaveTextContent(UNKNOWN_EMAIL_MESSAGE);
  });

  it('explains why sending is unavailable offline', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      renderRequestScreen();

      const button = getMdButton('Email sign-in link');
      expect(button).toHaveProperty('softDisabled', true);
      expect(screen.getByText(OFFLINE_MESSAGE)).toBeInTheDocument();
    } finally {
      onLine.mockRestore();
    }
  });
});

describe('the code-entry screen', () => {
  it('labels one numeric field and starts the caret in it', async () => {
    renderCodeScreen();

    const field = await findMdField('6-digit code');
    const innerInput = await waitFor(() => {
      const input = field.shadowRoot?.querySelector('input');
      if (!input) throw new Error('Expected shadow input');
      return input;
    });
    expect(innerInput).toHaveAttribute('inputmode', 'numeric');
    expect(innerInput).toHaveAttribute('autocomplete', 'one-time-code');
    expect(screen.getByText(`Enter the 6-digit code we sent to ${EMAIL}.`)).toBeInTheDocument();
    await waitFor(() => {
      expect(field).toHaveFocus();
    });
  });

  it('takes a code pasted with the spacing the email had', async () => {
    renderCodeScreen();

    const field = await findMdField('6-digit code');
    const innerInput = await waitFor(() => {
      const input = field.shadowRoot?.querySelector('input');
      if (!input) throw new Error('Expected shadow input');
      return input;
    });
    fireEvent.input(innerInput, { target: { value: '123 456' } });

    await waitFor(() => {
      expect(field).toHaveProperty('value', '123456');
    });
  });

  it('links a short code to the field and moves focus there', async () => {
    const user = userEvent.setup();
    const auth = renderCodeScreen();

    await user.type(await findFieldInput('6-digit code'), '123');
    await user.click(getMdButton('Verify sign-in code'));

    const field = await findMdField('6-digit code');
    await waitFor(() => {
      expect(field).toHaveProperty('error', true);
      expect(field).toHaveProperty('errorText', CODE_LENGTH_MESSAGE);
      expect(field).toHaveFocus();
    });
    expect(auth.verifySignInCode).not.toHaveBeenCalled();
  });

  it('verifies the code against the address it was sent to', async () => {
    vi.stubEnv('HESTIA_PUBLIC_MAGIC_LINK_ENABLED', 'true');
    try {
      const user = userEvent.setup();
      // The whole route tree, because a verified code lands on the dashboard.
      const { auth } = renderApp({
        routes: createRoutes(),
        initialEntries: [{ pathname: MAGIC_CODE_PATH, state: { email: EMAIL } }],
        auth: signedOut(),
      });

      await user.type(await findFieldInput('6-digit code'), '123456');
      await user.click(getMdButton('Verify sign-in code'));

      await waitFor(() => {
        expect(auth.verifySignInCode).toHaveBeenCalledWith(EMAIL, '123456');
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('says a code is wrong or stale without saying which', async () => {
    const user = userEvent.setup();
    const auth = signedOut();
    auth.verifySignInCode = vi.fn(() => Promise.reject(new AuthError('otp_expired', 403)));
    renderCodeScreen(auth);

    await user.type(await findFieldInput('6-digit code'), '000000');
    await user.click(getMdButton('Verify sign-in code'));

    expect(await screen.findByRole('alert')).toHaveTextContent(CODE_INVALID_MESSAGE);
  });

  it('holds the resend action shut for the first 30 seconds', async () => {
    const user = userEvent.setup();
    const auth = renderCodeScreen();

    const resend = getMdButton('Send a new code');
    expect(resend).toHaveProperty('softDisabled', true);
    expect(screen.getByText(resendCountdown(RESEND_AFTER_SECONDS))).toBeInTheDocument();

    await user.click(resend);
    expect(auth.sendSignInLink).not.toHaveBeenCalled();
  });

  it('opens the resend action after 30 seconds and confirms the new code', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
      const auth = renderCodeScreen();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(RESEND_AFTER_SECONDS * 1000);
      });
      await user.click(getMdButton('Send a new code'));

      expect(auth.sendSignInLink).toHaveBeenCalledWith(EMAIL);
      expect(await screen.findByText(resentConfirmation(EMAIL))).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('explains why signing in is unavailable offline', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      renderCodeScreen();

      expect(getMdButton('Verify sign-in code')).toHaveProperty('softDisabled', true);
      expect(screen.getAllByText(OFFLINE_MESSAGE).length).toBeGreaterThan(0);
    } finally {
      onLine.mockRestore();
    }
  });
});

describe('normalizeCode', () => {
  it('keeps the digits of a pasted code', () => {
    expect(normalizeCode('123-456')).toBe('123456');
    expect(normalizeCode(' 12 34 56 ')).toBe('123456');
  });

  it('stops at six digits', () => {
    expect(normalizeCode('1234567890')).toBe('123456');
  });
});
