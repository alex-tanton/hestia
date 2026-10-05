import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIRST_RUN_HEADING } from '../components/dashboard/DashboardFirstRun.tsx';
import { addDays, todayInTimezone } from '../lib/household-date.ts';
import { billFixture } from '../test/bills-fixtures.ts';
import { oakStreetFixture, oakStreetMembers, profileFixture } from '../test/fixtures.ts';
import {
  cleanBathroomFixture,
  takeOutTrashFixture,
  vacuumCommonAreasFixture,
} from '../test/chore-fixtures.ts';
import { createFetchStub, problemBody, renderScreen, type StubHandler } from '../test/harness.tsx';
import { thisWeekFixture, weekendCookoutFixture } from '../test/list-fixtures.ts';
import { DashboardRoute } from './DashboardRoute.tsx';

const EMPTY_WEEK: StubHandler = ({ query }) => ({
  status: 200,
  body: { week: query.get('week') ?? '2026-09-20', entries: [] },
});

const EMPTY_CHORES: StubHandler = () => ({ status: 200, body: [] });
const EMPTY_BILLS: StubHandler = () => ({ status: 200, body: [] });

/** PRD › This Week: the Shopping card shows the active list's status and items outstanding. */
function mount(
  lists: StubHandler,
  mealPlan: StubHandler = EMPTY_WEEK,
  chores: StubHandler = EMPTY_CHORES,
  bills: StubHandler = EMPTY_BILLS,
): void {
  const stub = createFetchStub({
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'GET /api/households/:id': () => ({ status: 200, body: oakStreetFixture }),
    'GET /api/households/:id/members': () => ({ status: 200, body: oakStreetMembers }),
    'GET /api/households/:id/lists': lists,
    'GET /api/households/:id/meal-plan': mealPlan,
    'GET /api/households/:id/chores': chores,
    'GET /api/households/:id/bills': bills,
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
    // Bills and Chores both shipped and are empty, so they fold into the same first-run panel
    // rather than rendering their own "Nothing due" cards.
    expect(screen.queryByRole('region', { name: /^Bills/ })).toBeNull();
    expect(screen.queryByRole('region', { name: /^Chores/ })).toBeNull();
  });

  it('keeps the failure inside the card', async () => {
    mount(() => ({ status: 500, body: problemBody(500, 'Internal Server Error') }));
    expect(await screen.findByText("Couldn't load your lists. Try again.")).toBeInTheDocument();
    // Lists failed, not every shipped card is empty, so Bills still renders its own (empty) card.
    expect(within(card('Bills')).getByText('Nothing due this week')).toBeInTheDocument();
  });
});

describe('the Chores card', () => {
  it('names what is due today and what is overdue, overdue first, with the word "Overdue"', async () => {
    const today = todayInTimezone(oakStreetFixture.timezone);
    mount(
      () => ({ status: 200, body: [] }),
      undefined,
      () => ({
        status: 200,
        body: [
          // Due in two days: not on the card.
          cleanBathroomFixture,
          { ...takeOutTrashFixture, dueDate: today, isOverdue: false },
          {
            ...vacuumCommonAreasFixture,
            dueDate: addDays(today, -3),
            isOverdue: true,
          },
        ],
      }),
    );
    const chores = card('Chores');
    const items = await within(chores).findAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Vacuum common areas · Overdue',
      'Take out trash',
    ]);
    expect(within(chores).queryByText('Clean bathroom')).toBeNull();
  });

  it('reads as empty, not as failed, when nothing is due today', async () => {
    // A populated Shopping card keeps the first-run panel from replacing the Chores card.
    mount(
      () => ({ status: 200, body: [thisWeekFixture] }),
      undefined,
      () => ({ status: 200, body: [cleanBathroomFixture] }),
    );
    expect(await within(card('Chores')).findByText('Nothing due today')).toBeInTheDocument();
  });

  it('keeps a failure inside the card', async () => {
    mount(
      () => ({ status: 200, body: [thisWeekFixture] }),
      undefined,
      () => ({ status: 500, body: problemBody(500, 'Internal Server Error') }),
    );
    expect(
      await within(card('Chores')).findByText("Couldn't load chores. Try again."),
    ).toBeInTheDocument();
    expect(await within(card('Shopping')).findByText('12 of 15 left')).toBeInTheDocument();
  });
});

describe('the Meals card', () => {
  it("names today's meal, then tomorrow's", async () => {
    const today = todayInTimezone(oakStreetFixture.timezone);
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
      await within(card('Meals')).findByText('Nothing planned for today or tomorrow'),
    ).toBeInTheDocument();
  });
});

describe('the Bills card', () => {
  it('shows what is due this week, overdue first, and leaves later bills off', async () => {
    const today = todayInTimezone(oakStreetFixture.timezone);
    mount(
      () => ({ status: 200, body: [] }),
      undefined,
      undefined,
      () => ({
        status: 200,
        body: [
          billFixture({
            id: '30000002-0000-4000-8000-000000000002',
            name: 'Rent',
            amountCents: 185_000,
            currentOccurrenceDate: addDays(today, 30),
            isOverdue: false,
          }),
          billFixture({
            id: '30000005-0000-4000-8000-000000000005',
            name: 'Duke Energy',
            amountCents: 14_230,
            currentOccurrenceDate: addDays(today, -5),
            isOverdue: true,
          }),
          billFixture({
            id: '30000001-0000-4000-8000-000000000001',
            name: 'Spectrum Internet',
            amountCents: 7_499,
            currentOccurrenceDate: today,
            isOverdue: false,
          }),
        ],
      }),
    );
    const bills = card('Bills');
    const items = await within(bills).findAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Duke Energy'),
      expect.stringContaining('Spectrum Internet'),
    ]);
    expect(items[0]).toHaveTextContent('Overdue');
    expect(within(bills).queryByText('Rent')).toBeNull();
  });

  it('reads as empty rather than failed when nothing is due this week', async () => {
    mount(() => ({ status: 200, body: [thisWeekFixture, weekendCookoutFixture] }));
    await screen.findByText('This Week');
    expect(within(card('Bills')).getByText('Nothing due this week')).toBeInTheDocument();
  });

  it('keeps the failure inside the card', async () => {
    mount(
      () => ({ status: 200, body: [] }),
      undefined,
      undefined,
      () => ({ status: 500, body: problemBody(500, 'Internal Server Error') }),
    );
    expect(await screen.findByText("Couldn't load bills. Try again.")).toBeInTheDocument();
    expect(within(card('Shopping')).getByText('Nothing left to buy')).toBeInTheDocument();
  });
});
