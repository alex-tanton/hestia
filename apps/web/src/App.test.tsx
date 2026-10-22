import { screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProfileResponse } from '@hearth/shared';
import { useSwitchHousehold } from './lib/api/hooks.ts';
import { queryKeys } from './lib/api/keys.ts';
import {
  createAuthStub,
  createFetchStub,
  problemBody,
  renderApp,
  renderScreen,
  testQueryClient,
  type FetchStub,
  type StubHandler,
} from './test/harness.tsx';
import {
  OAK_STREET_ID,
  RIVERA_FAMILY_ID,
  oakStreetFixture,
  oakStreetMembers,
  profileFixture,
  riveraFamilyFixture,
  riveraFamilyMembers,
} from './test/fixtures.ts';

const HOUSEHOLDS: Record<string, unknown> = {
  [OAK_STREET_ID]: oakStreetFixture,
  [RIVERA_FAMILY_ID]: riveraFamilyFixture,
};
const MEMBERS: Record<string, unknown> = {
  [OAK_STREET_ID]: oakStreetMembers,
  [RIVERA_FAMILY_ID]: riveraFamilyMembers,
};

function stub(handlers: Readonly<Record<string, StubHandler>>): FetchStub {
  const created = createFetchStub(handlers);
  vi.stubGlobal('fetch', created.fetch);
  return created;
}

function appHandlers(
  profile: () => ProfileResponse,
  extra: Readonly<Record<string, StubHandler>> = {},
): Record<string, StubHandler> {
  return {
    'GET /api/users/me': () => ({ status: 200, body: profile() }),
    'GET /api/households/:id': ({ params }) => ({
      status: 200,
      body: HOUSEHOLDS[params['id'] ?? ''],
    }),
    'GET /api/households/:id/members': ({ params }) => ({
      status: 200,
      body: MEMBERS[params['id'] ?? ''],
    }),
    'GET /api/households/:id/invites': () => ({ status: 200, body: [] }),
    ...extra,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('opening the app', () => {
  it('sends a signed-out visitor to sign in', async () => {
    stub({});
    renderApp({ auth: createAuthStub({ status: 'signed-out', userId: null }) });

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });

  it('sends someone with no household to onboarding', async () => {
    stub(appHandlers(() => ({ ...profileFixture, activeHouseholdId: null, memberships: [] })));
    renderApp();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Set up your household' }),
    ).toBeInTheDocument();
  });

  it('lands on This Week with the active household in the top bar', async () => {
    stub(appHandlers(() => profileFixture));
    renderApp();

    expect(await screen.findByRole('heading', { level: 1, name: 'This Week' })).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /Oak Street, switch household/ }),
    ).toBeInTheDocument();
  });

  it('returns to sign in when the session is refused', async () => {
    const auth = createAuthStub();
    stub(
      appHandlers(() => profileFixture, {
        'GET /api/users/me': () => ({
          status: 401,
          body: problemBody(401, 'Unauthorized', 'Your session has expired. Sign in again.'),
        }),
      }),
    );
    renderApp({ auth });

    await waitFor(() => {
      expect(auth.onUnauthorized).toHaveBeenCalled();
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });
});

describe('the timezone reconciliation', () => {
  it('sends a change only when the browser disagrees with the profile', async () => {
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const calls = stub(
      appHandlers(() => ({ ...profileFixture, timezone: browserTimezone }), {
        'PATCH /api/users/me': () => ({ status: 200, body: profileFixture }),
      }),
    );
    renderApp();

    await screen.findByRole('heading', { level: 1, name: 'This Week' });
    expect(calls.calls.filter((call) => call.method === 'PATCH')).toHaveLength(0);
  });

  it('sends the browser’s timezone when it has moved', async () => {
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const elsewhere =
      browserTimezone === 'Pacific/Honolulu' ? 'America/Denver' : 'Pacific/Honolulu';
    const calls = stub(
      appHandlers(() => ({ ...profileFixture, timezone: elsewhere }), {
        'PATCH /api/users/me': () => ({ status: 200, body: profileFixture }),
      }),
    );
    renderApp();

    await waitFor(() => {
      expect(calls.calls).toContainEqual({
        method: 'PATCH',
        path: '/api/users/me',
        body: { timezone: browserTimezone },
      });
    });
  });
});

describe('switching household', () => {
  it('sends the switch, returns to the tab root, and drops the old screen', async () => {
    const user = userEvent.setup();
    let active = OAK_STREET_ID;
    const calls = stub(
      appHandlers(() => ({ ...profileFixture, activeHouseholdId: active }), {
        'PUT /api/users/me/active-household': ({ body }) => {
          active = (body as { householdId: string }).householdId;
          return { status: 200, body: { ...profileFixture, activeHouseholdId: active } };
        },
      }),
    );
    renderApp({ initialEntries: ['/settings'] });

    expect(await screen.findByText('Sam Chen')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /switch household/ }));
    const sheet = await screen.findByRole('dialog');
    await user.click(within(sheet).getByRole('button', { name: /Rivera Family/ }));

    await waitFor(() => {
      expect(calls.calls).toContainEqual({
        method: 'PUT',
        path: '/api/users/me/active-household',
        body: { householdId: RIVERA_FAMILY_ID },
      });
    });

    // The switch returns every tab to its root.
    expect(await screen.findByRole('heading', { level: 1, name: 'This Week' })).toBeInTheDocument();
    expect(screen.queryByText('Sam Chen')).not.toBeInTheDocument();
  });

  it('removes every household-scoped query, so no stale household can be read', async () => {
    const user = userEvent.setup();
    stub(
      appHandlers(() => profileFixture, {
        'PUT /api/users/me/active-household': () => ({
          status: 200,
          body: { ...profileFixture, activeHouseholdId: RIVERA_FAMILY_ID },
        }),
      }),
    );
    const queryClient = testQueryClient();
    queryClient.setQueryData(queryKeys.profile, profileFixture);
    queryClient.setQueryData(queryKeys.household(OAK_STREET_ID), oakStreetFixture);
    queryClient.setQueryData(queryKeys.members(OAK_STREET_ID), oakStreetMembers);

    function SwitchProbe(): ReactElement {
      const switchHousehold = useSwitchHousehold();
      return (
        <button
          type="button"
          onClick={() => {
            switchHousehold.mutate(RIVERA_FAMILY_ID);
          }}
        >
          Switch
        </button>
      );
    }

    renderScreen(<SwitchProbe />, { queryClient });
    await user.click(screen.getByRole('button', { name: 'Switch' }));

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.members(OAK_STREET_ID))).toBeUndefined();
    });
    expect(queryClient.getQueryData(queryKeys.household(OAK_STREET_ID))).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.profile)).toMatchObject({
      activeHouseholdId: RIVERA_FAMILY_ID,
    });
  });
});
