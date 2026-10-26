import { screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFetchStub, renderScreen, type StubHandler } from '../../test/harness.tsx';
import { OAK_STREET_ID, RIVERA_FAMILY_ID, profileFixture } from '../../test/fixtures.ts';
import { useProfile } from '../api/hooks.ts';
import { useNotificationTarget } from './notification-target.ts';

/*
 * A tap switches the active household first and then routes to the screen the notification is
 * about.
 */

function TargetProbe(): null {
  const profile = useProfile();
  useNotificationTarget(profile.data);
  return null;
}

function LocationProbe(): ReactElement {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function Screen(): ReactElement {
  return (
    <>
      <TargetProbe />
      <LocationProbe />
    </>
  );
}

function renderTarget(initialEntry: string, extra: Readonly<Record<string, StubHandler>> = {}) {
  const switched: string[] = [];
  const stub = createFetchStub({
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'PUT /api/users/me/active-household': ({ body }) => {
      const { householdId } = body as { householdId: string };
      switched.push(householdId);
      return { status: 200, body: { ...profileFixture, activeHouseholdId: householdId } };
    },
    ...extra,
  });
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(<Screen />, { initialEntries: [initialEntry] });
  return { stub, switched };
}

/** A stand-in for the service worker's message channel, which jsdom does not provide. */
function stubServiceWorkerChannel(): EventTarget {
  const channel = new EventTarget();
  Object.defineProperty(navigator, 'serviceWorker', { value: channel, configurable: true });
  return channel;
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('a tap on a notification', () => {
  it('switches to the notification household and then opens its screen', async () => {
    const { switched } = renderTarget(`/bills?household=${RIVERA_FAMILY_ID}`);

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/bills$/);
    });
    expect(switched).toStrictEqual([RIVERA_FAMILY_ID]);
  });

  it('opens the screen without a switch when the household is already active', async () => {
    const { switched } = renderTarget(`/chores?household=${OAK_STREET_ID}`);

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/chores$/);
    });
    expect(switched).toStrictEqual([]);
  });

  it('switches household when the service worker posts the target to an open window', async () => {
    const channel = stubServiceWorkerChannel();
    const { switched } = renderTarget('/');

    channel.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'hestia:notification-click', url: '/chores', householdId: RIVERA_FAMILY_ID },
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/chores$/);
    });
    expect(switched).toStrictEqual([RIVERA_FAMILY_ID]);
  });

  it('does not show a household the caller has left, and lands on the dashboard instead', async () => {
    const channel = stubServiceWorkerChannel();
    const left = '99999999-9999-4999-8999-999999999999';
    const { switched } = renderTarget('/');

    channel.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'hestia:notification-click', url: '/bills', householdId: left },
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
    });
    expect(switched).toStrictEqual([]);
  });

  it('ignores messages on the channel that are not a notification tap', async () => {
    const channel = stubServiceWorkerChannel();
    const { switched } = renderTarget('/');

    channel.dispatchEvent(new MessageEvent('message', { data: { type: 'something-else' } }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
    });
    expect(switched).toStrictEqual([]);
  });
});
