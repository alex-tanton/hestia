import { onlineManager } from '@tanstack/react-query';
import { configure, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MealPlanEntry } from '@hearth/shared';
import { stubCoarsePointer } from '../../test/browser.ts';
import { ALEX_ID, OAK_STREET_ID, oakStreetFixture, profileFixture } from '../../test/fixtures.ts';
import { queryKeys } from '../../lib/api/keys.ts';
import { emptyDealSearch } from '../../test/deal-fixtures.ts';
import { thisWeekFixture } from '../../test/list-fixtures.ts';
import {
  bakedZitiFixture,
  sheetPanChickenFixture,
  SHEET_PAN_CHICKEN_ID,
} from '../../test/meal-fixtures.ts';
import {
  createFetchStub,
  problemBody,
  renderScreen,
  testQueryClient,
  type StubHandler,
} from '../../test/harness.tsx';
import { PlannerScreen } from './PlannerScreen.tsx';
import { RecipeDetailScreen } from './RecipeDetailScreen.tsx';

configure({ asyncUtilTimeout: 5000 });

/*
 * Meal-plan dates are household dates. The browser here is Kiritimati (UTC+14): at 02:30 UTC on Oct
 * 4 it is Sunday Oct 4 there, while New York is still Saturday Oct 3, so "today" differs by a day
 * and the planner's week by a whole week.
 */

const BROWSER_ZONE = 'Pacific/Kiritimati';
const PINNED_INSTANT = new Date('2026-10-04T02:30:00.000Z');
const HOUSEHOLD_TODAY = '2026-10-03';
const BROWSER_TODAY = '2026-10-04';
const abroadProfile = { ...profileFixture, timezone: BROWSER_ZONE };

const zitiOnHouseholdToday: MealPlanEntry = {
  id: 'e0000030-0000-4000-8000-000000000001',
  householdId: OAK_STREET_ID,
  recipeId: bakedZitiFixture.id,
  recipeTitle: bakedZitiFixture.title,
  readinessPercent: 71,
  plannedDate: HOUSEHOLD_TODAY,
  mealType: 'dinner',
  addedBy: ALEX_ID,
  createdAt: '2026-09-20T12:00:00.000Z',
};

const saladOnBrowserToday: MealPlanEntry = {
  id: 'e0000030-0000-4000-8000-000000000002',
  householdId: OAK_STREET_ID,
  recipeId: SHEET_PAN_CHICKEN_ID,
  recipeTitle: sheetPanChickenFixture.title,
  readinessPercent: 40,
  plannedDate: BROWSER_TODAY,
  mealType: 'dinner',
  addedBy: ALEX_ID,
  createdAt: '2026-09-20T12:00:00.000Z',
};

const okHousehold: StubHandler = () => ({ status: 200, body: oakStreetFixture });

/*
 * The browser's profile is already cached before the screen mounts. A screen that copies a zone
 * into state on its first render would otherwise capture a fallback before the profile arrives,
 * and the test would prove nothing about the zone the screen actually reads.
 */
function clientWithAbroadProfile(): ReturnType<typeof testQueryClient> {
  const client = testQueryClient();
  client.setQueryData(queryKeys.profile, abroadProfile);
  return client;
}

function mountPlanner(household: StubHandler = okHousehold): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub({
    'GET /api/users/me': () => ({ status: 200, body: abroadProfile }),
    'GET /api/households/:id': household,
    'GET /api/households/:id/meal-plan': ({ query }) => ({
      status: 200,
      body: { week: query.get('week') ?? '', entries: [zitiOnHouseholdToday, saladOnBrowserToday] },
    }),
  });
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(<PlannerScreen householdId={OAK_STREET_ID} />, {
    queryClient: clientWithAbroadProfile(),
  });
  return stub;
}

function mountRecipe(household: StubHandler = okHousehold): void {
  const stub = createFetchStub({
    'GET /api/users/me': () => ({ status: 200, body: abroadProfile }),
    'GET /api/households/:id': household,
    'GET /api/recipes/:id': () => ({ status: 200, body: sheetPanChickenFixture }),
    'GET /api/households/:id/lists': () => ({ status: 200, body: [thisWeekFixture] }),
    'GET /api/households/:id/pantry': () => ({ status: 200, body: [] }),
    'GET /api/households/:id/deals/search': () => ({
      status: 200,
      body: emptyDealSearch,
    }),
  });
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(<RecipeDetailScreen householdId={OAK_STREET_ID} recipeId={SHEET_PAN_CHICKEN_ID} />, {
    queryClient: clientWithAbroadProfile(),
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED_INSTANT);
  onlineManager.setOnline(true);
  stubCoarsePointer();
});

afterEach(() => {
  vi.useRealTimers();
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the week planner, with the browser a day ahead of the household', () => {
  it('opens on the household’s today and reads the week from the household’s Sunday', async () => {
    mountPlanner();
    const tabs = await screen.findByRole('tablist', { name: 'Day of the week' });
    expect(within(tabs).getByRole('tab', { name: /Sat 10\/03/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // The browser's Sunday is next week for this household, so no tab for it exists here.
    expect(within(tabs).queryByRole('tab', { name: /Sun 10\/04/ })).toBeNull();
    expect(screen.getByText(/Week of Sun 09\/27/)).toBeInTheDocument();
    expect(await screen.findByText(zitiOnHouseholdToday.recipeTitle)).toBeInTheDocument();
    expect(screen.queryByText(saladOnBrowserToday.recipeTitle)).toBeNull();
  });
});

describe('the week planner until the household’s zone is known', () => {
  it('shows the loading state, with no week or day drawn, while the household is pending', async () => {
    mountPlanner(() => new Promise(() => undefined));
    expect(await screen.findByRole('status')).toHaveTextContent('Loading the week planner');
    expect(screen.queryByText(/Week of/)).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByText(zitiOnHouseholdToday.recipeTitle)).toBeNull();
  });

  it('shows the household error, with no week drawn, when the household fails', async () => {
    mountPlanner(() => ({ status: 500, body: problemBody(500, 'Internal Server Error') }));
    expect(await screen.findByText("Couldn't load the household. Try again.")).toBeInTheDocument();
    expect(screen.queryByText(/Week of/)).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
  });
});

describe('Place on week planner, with the browser a day ahead of the household', () => {
  it('defaults the date to the household’s today', async () => {
    const user = userEvent.setup();
    mountRecipe();
    await screen.findByRole('heading', { level: 1, name: sheetPanChickenFixture.title });
    await user.click(await screen.findByRole('button', { name: /Place on week planner/ }));
    expect(await screen.findByLabelText('Date')).toHaveValue(HOUSEHOLD_TODAY);
  });

  it('is a disabled skeleton until the household’s zone is known, and opens no sheet', async () => {
    const user = userEvent.setup();
    mountRecipe(() => new Promise(() => undefined));
    await screen.findByRole('heading', { level: 1, name: sheetPanChickenFixture.title });
    const button = await screen.findByRole('button', { name: /Place on week planner/ });
    expect(button).toBeDisabled();
    expect(screen.queryByText(/Loading the household/)).toBeNull();
    await user.click(button);
    expect(screen.queryByLabelText('Date')).toBeNull();
  });
});
