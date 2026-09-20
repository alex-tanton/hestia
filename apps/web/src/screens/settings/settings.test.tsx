import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProfileResponse } from '@hearth/shared';
import {
  createFetchStub,
  problemBody,
  renderScreen,
  type StubHandler,
} from '../../test/harness.tsx';
import {
  OAK_STREET_ID,
  RIVERA_FAMILY_ID,
  inviteFixture,
  oakStreetFixture,
  oakStreetMembers,
  profileFixture,
  riveraFamilyFixture,
  riveraFamilyMembers,
} from '../../test/fixtures.ts';
import { SettingsScreen } from './SettingsScreen.tsx';

const HOUSEHOLDS: Record<string, unknown> = {
  [OAK_STREET_ID]: oakStreetFixture,
  [RIVERA_FAMILY_ID]: riveraFamilyFixture,
};
const MEMBERS: Record<string, unknown> = {
  [OAK_STREET_ID]: oakStreetMembers,
  [RIVERA_FAMILY_ID]: riveraFamilyMembers,
};

function settingsHandlers(
  profile: ProfileResponse = profileFixture,
  extra: Readonly<Record<string, StubHandler>> = {},
): Record<string, StubHandler> {
  return {
    'GET /api/users/me': () => ({ status: 200, body: profile }),
    'GET /api/households/:id': ({ params }) => ({
      status: 200,
      body: HOUSEHOLDS[params['id'] ?? ''],
    }),
    'GET /api/households/:id/members': ({ params }) => ({
      status: 200,
      body: MEMBERS[params['id'] ?? ''],
    }),
    'GET /api/households/:id/invites': () => ({ status: 200, body: [inviteFixture] }),
    ...extra,
  };
}

function renderSettings(
  handlers: Readonly<Record<string, StubHandler>>,
): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub(handlers);
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(<SettingsScreen />);
  return stub;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Settings', () => {
  it('announces that it is loading before anything arrives', () => {
    renderSettings({ 'GET /api/users/me': () => new Promise(() => undefined) });
    expect(screen.getByRole('status')).toHaveTextContent('Loading settings');
  });

  it('offers a retry when the profile fails', async () => {
    renderSettings({
      'GET /api/users/me': () => ({ status: 500, body: problemBody(500, 'Server Error') }),
    });
    expect(await screen.findByText("Couldn't load your settings. Try again.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('says it needs a connection when the request never leaves', async () => {
    const stub = createFetchStub({});
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    renderScreen(<SettingsScreen />);
    expect(
      await screen.findByText('Settings need a connection. Your household still works offline.'),
    ).toBeInTheDocument();
    expect(stub.calls).toHaveLength(0);
  });

  it('shows every section Design lists', async () => {
    renderSettings(settingsHandlers());

    for (const heading of [
      'Account',
      'My Households',
      'Invites',
      'Household settings',
      'Notifications',
      'About',
    ]) {
      expect(await screen.findByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    }
    expect(await screen.findByDisplayValue('Alex Rivera')).toBeInTheDocument();
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
  });

  it('lists each household with its members and a leave action', async () => {
    renderSettings(settingsHandlers());

    expect(await screen.findByText('Sam Chen')).toBeInTheDocument();
    expect(screen.getByText('Jordan Blake')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave Oak Street' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave Rivera Family' })).toBeInTheDocument();
  });

  it('keeps System health for the server owner', async () => {
    renderSettings(settingsHandlers());
    await screen.findByRole('heading', { level: 2, name: 'About' });
    expect(screen.queryByRole('button', { name: /System health/ })).not.toBeInTheDocument();
  });

  it('shows System health to the server owner', async () => {
    renderSettings(settingsHandlers({ ...profileFixture, isServerOwner: true }));
    expect(await screen.findByRole('button', { name: /System health/ })).toBeInTheDocument();
  });

  it('hides invite management from a member', async () => {
    const asMember: ProfileResponse = {
      ...profileFixture,
      memberships: profileFixture.memberships.map((membership) => ({
        ...membership,
        role: 'member' as const,
      })),
    };
    renderSettings(settingsHandlers(asMember));

    expect(
      await screen.findByText('Only the household admin can change these.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Invites' })).not.toBeInTheDocument();
  });

  it('shows a new invite’s link and code once, with copy actions', async () => {
    const user = userEvent.setup();
    renderSettings(
      settingsHandlers(profileFixture, {
        'POST /api/households/:id/invites': () => ({
          status: 201,
          body: {
            invite: inviteFixture,
            link: 'https://hearth.example.ts.net/join#token=abcdefghijklmnopqrstuvwxyz012345678',
            code: '9XKR4TZ2',
          },
        }),
      }),
    );

    await user.click(await screen.findByRole('button', { name: 'Create an invite' }));

    expect(await screen.findByText('9XKR4TZ2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy invite link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
  });

  it('gives the admin remove and transfer on another member', async () => {
    const user = userEvent.setup();
    renderSettings(settingsHandlers());

    // Radix opens its menu from the keyboard, which is the path jsdom can drive.
    (await screen.findByRole('button', { name: 'More actions for Sam Chen' })).focus();
    await user.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Make admin' })).toBeInTheDocument();
    expect(
      within(menu).getByRole('menuitem', { name: 'Remove from household' }),
    ).toBeInTheDocument();
  });

  it('saves quiet hours and keeps notification types for later', async () => {
    const user = userEvent.setup();
    const stub = renderSettings(
      settingsHandlers(profileFixture, {
        'PATCH /api/users/me': () => ({ status: 200, body: profileFixture }),
      }),
    );

    expect(await screen.findByRole('heading', { name: 'Notification types' })).toBeInTheDocument();
    await user.click(screen.getByLabelText('Hold notifications during quiet hours'));
    await user.click(screen.getByRole('button', { name: 'Save quiet hours' }));

    await waitFor(() => {
      expect(
        stub.calls.some(
          (call) =>
            call.method === 'PATCH' &&
            call.path === '/api/users/me' &&
            JSON.stringify(call.body) ===
              JSON.stringify({ quietHours: { start: '22:00', end: '07:00' } }),
        ),
      ).toBe(true);
    });
  });

  it('disables the bill reminder offline and says why, in the description too', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      renderSettings(settingsHandlers());
      const reminder = await screen.findByLabelText('Remind me about all household bills');
      expect(reminder).toBeDisabled();
      // Design › Offline rules: the reason sits beside the control and in its description.
      expect(reminder).toHaveAccessibleDescription('Offline. This needs a connection.');
    } finally {
      onLine.mockRestore();
    }
  });
});
