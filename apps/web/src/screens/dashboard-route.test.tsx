import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIRST_RUN_HEADING } from '../components/dashboard/DashboardFirstRun.tsx';
import { todayInTimezone } from '../lib/household-date.ts';
import { oakStreetMembers, profileFixture } from '../test/fixtures.ts';
import { createFetchStub, problemBody, renderScreen, type StubHandler } from '../test/harness.tsx';
import { thisWeekFixture, weekendCookoutFixture } from '../test/list-fixtures.ts';
import { DashboardRoute } from './DashboardRoute.tsx';

const EMPTY_WEEK: StubHandler = ({ query }) => ({
  status: 200,
  body: { week: query.get('week') ?? '2026-09-20', entries: [] },
});

/** PRD › This Week: the Shopping card shows the active list's status and items outstanding. */
function mount(lists: StubHandler, mealPlan: StubHandler = EMPTY_WEEK): void {
  const stub = createFetchStub({
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'GET /api/households/:id/members': () => ({ status: 200, body: oakStreetMembers }),
    'GET /api/households/:id/lists': lists,
    'GET /api/households/:id/meal-plan': mealPlan,
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

  it('shows the first-run panel when every shipped pillar has nothing', async () => {
    mount(() => ({ status: 200, body: [] }));
    expect(
      await screen.findByRole('heading', { level: 2, name: FIRST_RUN_HEADING }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a list' })).toHaveAttribute('href', '/lists');
    // The unshipped pillars keep their placeholders, so the layout does not reflow.
    for (const name of ['Bills', 'Chores']) {
      expect(within(card(name)).getByText('Coming soon')).toBeInTheDocument();
    }
  });

  it('keeps the failure inside the card', async () => {
    mount(() => ({ status: 500, body: problemBody(500, 'Internal Server Error') }));
    expect(await screen.findByText("Couldn't load your lists. Try again.")).toBeInTheDocument();
    expect(within(card('Bills')).getByText('Coming soon')).toBeInTheDocument();
  });
});

describe('the Meals card', () => {
  it("names today's meal, then tomorrow's", async () => {
    const today = todayInTimezone(profileFixture.timezone);
    mount(
      () => ({ status: 200, body: [] }),
      ({ query }) => ({
        status: 200,
        body: {
          week: query.get('week') ?? today,
          entries: [
            {
              id: 'e0000099-0000-4000-8000-000000000001',
              householdId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              recipeId: 'c0000099-0000-4000-8000-000000000001',
              recipeTitle: 'Baked Ziti',
              readinessPercent: 71,
              plannedDate: today,
              mealType: 'dinner',
              addedBy: '11111111-1111-4111-8111-111111111111',
              createdAt: '2026-09-20T12:00:00.000Z',
            },
          ],
        },
      }),
    );
    const meals = card('Meals');
    expect(await within(meals).findByText('Baked Ziti')).toBeInTheDocument();
    expect(within(meals).getByText(/Today · Dinner/)).toBeInTheDocument();
  });

  it('reads as empty rather than failed when nothing is planned', async () => {
    mount(() => ({ status: 200, body: [thisWeekFixture, weekendCookoutFixture] }));
    await screen.findByText('This Week');
    expect(
      within(card('Meals')).getByText('Nothing planned for today or tomorrow'),
    ).toBeInTheDocument();
  });
});
