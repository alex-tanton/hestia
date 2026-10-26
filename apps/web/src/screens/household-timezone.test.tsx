import { configure, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MealPlanEntry } from '@hestia/shared';
import { registerHouseholdClock } from '../test/browser.ts';
import { billFixture } from '../test/bills-fixtures.ts';
import {
  ALEX_ID,
  OAK_STREET_ID,
  oakStreetFixture,
  oakStreetMembers,
  profileFixture,
} from '../test/fixtures.ts';
import { takeOutTrashFixture, vacuumCommonAreasFixture } from '../test/chore-fixtures.ts';
import { createFetchStub, renderScreen, type StubHandler } from '../test/harness.tsx';
import { thisWeekFixture } from '../test/list-fixtures.ts';
import {
  bakedZitiFixture,
  SHEET_PAN_CHICKEN_ID,
  sheetPanChickenFixture,
} from '../test/meal-fixtures.ts';
import { DashboardRoute } from './DashboardRoute.tsx';

configure({ asyncUtilTimeout: 5000 });

/*
 * Household dates on the dashboard: "today", tomorrow, the week's end and every card's due set come
 * from the household's clock. The browser here is Kiritimati (UTC+14). At 02:30 UTC on Oct 4 it is
 * Oct 4 there and still Oct 3 (a Saturday) in New York, so the browser has already crossed midnight
 * into a new week that the household has not.
 */

const BROWSER_ZONE = 'Pacific/Kiritimati';
const PINNED_INSTANT = new Date('2026-10-04T02:30:00.000Z');
const HOUSEHOLD_TODAY = '2026-10-03';
const BROWSER_TODAY = '2026-10-04';
const HOUSEHOLD_WEEK_END = '2026-10-03';
const abroadProfile = { ...profileFixture, timezone: BROWSER_ZONE };

const ziti: MealPlanEntry = {
  id: 'e0000020-0000-4000-8000-000000000001',
  householdId: OAK_STREET_ID,
  recipeId: bakedZitiFixture.id,
  recipeTitle: 'Baked Ziti',
  readinessPercent: 71,
  plannedDate: HOUSEHOLD_TODAY,
  mealType: 'dinner',
  addedBy: ALEX_ID,
  createdAt: '2026-09-20T12:00:00.000Z',
};

const sheetPan: MealPlanEntry = {
  id: 'e0000020-0000-4000-8000-000000000002',
  householdId: OAK_STREET_ID,
  recipeId: SHEET_PAN_CHICKEN_ID,
  recipeTitle: sheetPanChickenFixture.title,
  readinessPercent: 40,
  plannedDate: BROWSER_TODAY,
  mealType: 'dinner',
  addedBy: ALEX_ID,
  createdAt: '2026-09-20T12:00:00.000Z',
};

const gasBill = billFixture({
  id: '30000010-0000-4000-8000-000000000001',
  name: 'Gas',
  currentOccurrenceDate: HOUSEHOLD_WEEK_END,
});

const waterBill = billFixture({
  id: '30000010-0000-4000-8000-000000000002',
  name: 'Water',
  currentOccurrenceDate: '2026-10-06',
});

const householdTrash = { ...takeOutTrashFixture, dueDate: HOUSEHOLD_TODAY, isOverdue: false };
const browserVacuum = { ...vacuumCommonAreasFixture, dueDate: BROWSER_TODAY, isOverdue: false };

function mount(
  overrides: Readonly<Record<string, StubHandler>> = {},
): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub({
    'GET /api/users/me': () => ({ status: 200, body: abroadProfile }),
    'GET /api/households/:id': () => ({ status: 200, body: oakStreetFixture }),
    'GET /api/households/:id/members': () => ({ status: 200, body: oakStreetMembers }),
    'GET /api/households/:id/lists': () => ({ status: 200, body: [thisWeekFixture] }),
    'GET /api/households/:id/meal-plan': ({ query }) => ({
      status: 200,
      body: { week: query.get('week') ?? '', entries: [ziti, sheetPan] },
    }),
    'GET /api/households/:id/chores': () => ({
      status: 200,
      body: [householdTrash, browserVacuum],
    }),
    'GET /api/households/:id/bills': () => ({ status: 200, body: [gasBill, waterBill] }),
    ...overrides,
  });
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(<DashboardRoute />);
  return stub;
}

function card(name: string): HTMLElement {
  return screen.getByRole('region', { name: new RegExp(`^${name}`) });
}

registerHouseholdClock(PINNED_INSTANT);

describe('dashboard dates, with the browser a day ahead of the household', () => {
  it('the Meals card names today and tomorrow in the household zone', async () => {
    mount();
    const meals = card('Meals');
    expect(await within(meals).findByText('Baked Ziti')).toBeInTheDocument();
    expect(within(meals).getByText('Today · Dinner')).toBeInTheDocument();
    expect(within(meals).getByText(sheetPanChickenFixture.title)).toBeInTheDocument();
    expect(within(meals).getByText('Tomorrow · Dinner')).toBeInTheDocument();
  });

  it('the Chores card lists what is due on the household’s today, not the browser’s', async () => {
    mount();
    const chores = card('Chores');
    expect(await within(chores).findByText(takeOutTrashFixture.name)).toBeInTheDocument();
    expect(within(chores).queryByText(vacuumCommonAreasFixture.name)).toBeNull();
  });

  it('the Bills card ends its week on the household’s Saturday, so next Tuesday’s bill is off it', async () => {
    mount();
    const bills = card('Bills');
    expect(await within(bills).findByText('Gas')).toBeInTheDocument();
    expect(within(bills).queryByText('Water')).toBeNull();
  });

  it('no card shows a dated item until the household’s zone is known', async () => {
    const stub = mount({
      'GET /api/households/:id': () => new Promise(() => undefined),
    });
    // The shopping card does not depend on any date, so it settles while the dated cards wait.
    expect(await within(card('Shopping')).findByText('12 of 15 left')).toBeInTheDocument();
    await waitFor(() => {
      expect(stub.calls.some((call) => call.path.includes('/chores'))).toBe(true);
      expect(stub.calls.some((call) => call.path.includes('/bills'))).toBe(true);
    });
    expect(screen.queryByText(takeOutTrashFixture.name)).toBeNull();
    expect(screen.queryByText('Gas')).toBeNull();
    expect(screen.queryByText('Baked Ziti')).toBeNull();
    expect(screen.queryByText(/Today · Dinner|Tomorrow · Dinner/)).toBeNull();
  });
});
