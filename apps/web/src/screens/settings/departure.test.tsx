import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeparturePreview } from '@hestia/shared';
import {
  createFetchStub,
  renderScreen,
  type FetchStub,
  type StubHandler,
} from '../../test/harness.tsx';
import {
  ALEX_ID,
  OAK_STREET_ID,
  RIVERA_FAMILY_ID,
  departurePreviewFixture,
  lastMemberPreviewFixture,
  oakStreetMembers,
  profileFixture,
  riveraFamilyMembers,
  SAM_ID,
} from '../../test/fixtures.ts';
import { deletionSummary } from './DeleteHouseholdPanel.tsx';
import { Component as DepartRoute } from './DepartRoute.tsx';
import { DepartureScreen } from './DepartureScreen.tsx';

const PATH = '/settings/households/:householdId/members/:userId/depart';

function entry(householdId: string, userId: string): string {
  return `/settings/households/${householdId}/members/${userId}/depart`;
}

function renderDeparture(
  preview: DeparturePreview,
  members: unknown,
  extra: Readonly<Record<string, StubHandler>> = {},
  element: ReactElement = <DepartureScreen />,
): FetchStub {
  const stub = createFetchStub({
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'GET /api/households/:id/members': () => ({ status: 200, body: members }),
    'GET /api/households/:id/members/:userId/departure-preview': () => ({
      status: 200,
      body: preview,
    }),
    ...extra,
  });
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(element, {
    path: PATH,
    initialEntries: [entry(preview.householdId, preview.userId)],
  });
  return stub;
}

beforeEach(() => {
  // The native picker is the primary design target and the one a phone shows.
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(pointer: coarse)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('deletionSummary', () => {
  it('names the counts of what is lost', () => {
    expect(deletionSummary(lastMemberPreviewFixture.deletionCounts)).toBe(
      'This deletes 4 lists, 23 recipes, and 6 chores permanently.',
    );
  });

  it('says so when there is nothing in the household', () => {
    expect(deletionSummary(departurePreviewFixture.deletionCounts)).toBe('It holds nothing yet.');
  });
});

describe('removing a member', () => {
  it('blocks the removal until every item has a new owner', async () => {
    const user = userEvent.setup();
    const stub = renderDeparture(departurePreviewFixture, oakStreetMembers, {
      'POST /api/households/:id/members/:userId/remove': () => ({
        status: 200,
        body: { householdDeleted: false, promotedUserId: null },
      }),
    });

    const confirm = (): HTMLElement => screen.getByRole('button', { name: 'Remove Sam Chen' });
    await screen.findByRole('button', { name: 'Remove Sam Chen' });
    expect(confirm()).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Choose someone for each item above first.')).toBeInTheDocument();

    await user.click(confirm());
    expect(stub.calls.some((call) => call.method === 'POST')).toBe(false);

    await user.selectOptions(screen.getByLabelText('This Week'), ALEX_ID);
    expect(confirm()).toHaveAttribute('aria-disabled', 'true');

    await user.selectOptions(screen.getByLabelText('Take out trash'), ALEX_ID);
    await waitFor(() => {
      expect(confirm()).not.toHaveAttribute('aria-disabled');
    });

    await user.click(confirm());
    await waitFor(() => {
      const post = stub.calls.find((call) => call.method === 'POST');
      expect(post?.body).toEqual({
        reassignments: {
          'dddddddd-dddd-4ddd-8ddd-dddddddddddd': ALEX_ID,
          'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee': ALEX_ID,
        },
      });
    });
  });

  it('lists rotations for information, with no picker', async () => {
    renderDeparture(departurePreviewFixture, oakStreetMembers);
    expect(
      await screen.findByText(
        'Take out trash: will be removed from rotation; the turn passes to Jordan Blake.',
      ),
    ).toBeInTheDocument();
  });

  it('offers only the members who stay', async () => {
    renderDeparture(departurePreviewFixture, oakStreetMembers);
    const picker = await screen.findByLabelText('This Week');
    expect(picker).toHaveTextContent('Alex Rivera');
    expect(picker).toHaveTextContent('Jordan Blake');
    expect(picker).not.toHaveTextContent('Sam Chen');
  });

  it('says a departure needs a connection when the preview cannot load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    renderScreen(<DepartureScreen />, {
      path: PATH,
      initialEntries: [entry(OAK_STREET_ID, SAM_ID)],
    });
    expect(
      await screen.findByText(
        'Leaving a household needs a connection. Try again when you are back online.',
      ),
    ).toBeInTheDocument();
  });
});

describe('the last member leaving', () => {
  it('takes the typed household name before it deletes anything', async () => {
    const user = userEvent.setup();
    const stub = renderDeparture(lastMemberPreviewFixture, riveraFamilyMembers, {
      'POST /api/households/:id/leave': () => ({
        status: 200,
        body: { householdDeleted: true, promotedUserId: null },
      }),
    });

    expect(await screen.findByText('You are the last member')).toBeInTheDocument();
    expect(
      screen.getByText(/This deletes 4 lists, 23 recipes, and 6 chores permanently\./),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete household and leave' }));

    const confirm = await screen.findByRole('button', { name: 'Delete household' });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText('Type Rivera Family to confirm'), 'Rivera');
    expect(confirm).toBeDisabled();
    expect(stub.calls.some((call) => call.method === 'POST')).toBe(false);

    await user.type(screen.getByLabelText('Type Rivera Family to confirm'), ' Family');
    await waitFor(() => {
      expect(confirm).toBeEnabled();
    });

    await user.click(confirm);
    await waitFor(() => {
      const post = stub.calls.find((call) => call.method === 'POST');
      expect(post?.path).toBe(`/api/households/${RIVERA_FAMILY_ID}/leave`);
      expect(post?.body).toEqual({ reassignments: {}, confirmName: 'Rivera Family' });
    });
  });

  it('shows no reassignment pickers, since there is no one to reassign to', async () => {
    renderDeparture(lastMemberPreviewFixture, riveraFamilyMembers);
    await screen.findByText('You are the last member');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('the lazy route module', () => {
  it('wires the depart route to the departure screen', async () => {
    renderDeparture(departurePreviewFixture, oakStreetMembers, {}, <DepartRoute />);
    expect(await screen.findByRole('button', { name: 'Remove Sam Chen' })).toBeInTheDocument();
  });
});
