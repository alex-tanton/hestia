import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthStub, createFetchStub, renderScreen } from '../../test/harness.tsx';
import { TEST_DEVICE_SUBSCRIPTION, createPushDouble } from '../../test/push-double.ts';
import { AboutSection } from './AboutSection.tsx';

/*
 * Sign-out removes this device's push subscription. Online the server row goes first, while the
 * session can still delete it; offline only the local one goes.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderAbout({ online }: { online: boolean }) {
  const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
  const log: string[] = [];
  const stub = createFetchStub({
    'DELETE /api/users/me/push-subscriptions': () => {
      log.push('DELETE');
      return { status: 204 };
    },
  });
  vi.stubGlobal('fetch', stub.fetch);
  const auth = createAuthStub();
  const signOutStub = auth.signOut;
  auth.signOut = vi.fn(async () => {
    log.push('signOut');
    await signOutStub();
  });
  const pushPort = createPushDouble({
    permission: 'granted',
    subscription: TEST_DEVICE_SUBSCRIPTION,
    log,
  });
  renderScreen(<AboutSection isServerOwner={false} />, { auth, pushPort });
  return { auth, log, stub, onLine };
}

describe('Sign out removes this device', () => {
  it('online: deletes the server row, drops the local subscription, then signs out', async () => {
    const user = userEvent.setup();
    const { auth, log, stub, onLine } = renderAbout({ online: true });

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(auth.signOut).toHaveBeenCalledOnce();
    });
    expect(log).toStrictEqual(['DELETE', 'unsubscribe', 'signOut']);
    expect(stub.calls.at(0)).toStrictEqual({
      method: 'DELETE',
      path: '/api/users/me/push-subscriptions',
      body: { endpoint: TEST_DEVICE_SUBSCRIPTION.endpoint },
    });
    onLine.mockRestore();
  });

  it('offline: drops only the local subscription and still signs out', async () => {
    const user = userEvent.setup();
    const { auth, log, stub, onLine } = renderAbout({ online: false });

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(auth.signOut).toHaveBeenCalledOnce();
    });
    expect(log).toStrictEqual(['unsubscribe', 'signOut']);
    expect(stub.calls).toHaveLength(0);
    onLine.mockRestore();
  });
});
