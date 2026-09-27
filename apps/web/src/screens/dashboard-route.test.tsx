import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIRST_RUN_HEADING } from '../components/dashboard/DashboardFirstRun.tsx';
import { oakStreetMembers, profileFixture } from '../test/fixtures.ts';
import { createFetchStub, problemBody, renderScreen, type StubHandler } from '../test/harness.tsx';
import { thisWeekFixture, weekendCookoutFixture } from '../test/list-fixtures.ts';
import { DashboardRoute } from './DashboardRoute.tsx';

/** PRD › This Week: the Shopping card shows the active list's status and items outstanding. */
function mount(lists: StubHandler): void {
  const stub = createFetchStub({
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'GET /api/households/:id/members': () => ({ status: 200, body: oakStreetMembers }),
    'GET /api/households/:id/lists': lists,
  });
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(<DashboardRoute />);
}

function card(name: string): HTMLElement {
  return screen.getByRole('region', { name: new RegExp(`^${name}`) });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the Shopping card', () => {
  it('names each list still outstanding, with its progress', async () => {
    mount(() => ({ status: 200, body: [thisWeekFixture, weekendCookoutFixture] }));
    expect(await screen.findByText('This Week')).toBeInTheDocument();
    const shopping = card('Shopping');
    expect(within(shopping).getByText('12 of 15 left')).toBeInTheDocument();
    // A list with nothing left to buy is not news, so it is not on the card.
    expect(within(shopping).queryByText('Weekend Cookout')).toBeNull();
    expect(within(shopping).getByRole('link', { name: 'Shopping' })).toHaveAttribute(
      'href',
      '/lists',
    );
  });

  it('shows the first-run panel when the only shipped pillar has nothing', async () => {
    mount(() => ({ status: 200, body: [] }));
    expect(
      await screen.findByRole('heading', { level: 2, name: FIRST_RUN_HEADING }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a list' })).toHaveAttribute('href', '/lists');
    // The unshipped pillars keep their placeholders, so the layout does not reflow.
    for (const name of ['Bills', 'Meals', 'Chores']) {
      expect(within(card(name)).getByText('Coming soon')).toBeInTheDocument();
    }
  });

  it('keeps the failure inside the card', async () => {
    mount(() => ({ status: 500, body: problemBody(500, 'Internal Server Error') }));
    expect(await screen.findByText("Couldn't load your lists. Try again.")).toBeInTheDocument();
    expect(within(card('Bills')).getByText('Coming soon')).toBeInTheDocument();
  });
});
