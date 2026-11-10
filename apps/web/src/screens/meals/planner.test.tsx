import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MealPlanEntry, MealPlanWeekResponse } from '@hestia/shared';
import { registerBrowserStubs, setOnline } from '../../test/browser.ts';
import { OAK_STREET_ID, oakStreetFixture, profileFixture } from '../../test/fixtures.ts';
import { thisWeekDetailFixture, thisWeekFixture } from '../../test/list-fixtures.ts';
import {
  bakedZitiFixture,
  sheetPanChickenFixture,
  suggestionsFixture,
} from '../../test/meal-fixtures.ts';
import { createFetchStub, renderScreen, type StubHandler } from '../../test/harness.tsx';
import { addDays, todayInTimezone, weekStart } from '../../lib/household-date.ts';
import { PLANNER_PAST_WEEK_COPY } from '../../components/meals/meal-copy.ts';
import { PlannerScreen } from './PlannerScreen.tsx';

const TIMEZONE = oakStreetFixture.timezone;
const CURRENT_WEEK = weekStart(todayInTimezone(TIMEZONE));
const WEDNESDAY = addDays(CURRENT_WEEK, 3);
const PAST_WEEK = addDays(CURRENT_WEEK, -7);
const PAST_TUESDAY = addDays(PAST_WEEK, 2);

const GREEK_SALAD_ID = 'f0000001-0000-4000-8000-000000000001';

const zitiEntry: MealPlanEntry = {
  id: 'e0000010-0000-4000-8000-000000000001',
  householdId: OAK_STREET_ID,
  recipeId: bakedZitiFixture.id,
  recipeTitle: 'Baked Ziti',
  customTitle: null,
  readinessPercent: 71,
  plannedDate: WEDNESDAY,
  mealType: 'dinner',
  addedBy: profileFixture.id,
  createdAt: '2026-09-20T12:00:00.000Z',
};

const saladEntry: MealPlanEntry = {
  id: 'e0000010-0000-4000-8000-000000000002',
  householdId: OAK_STREET_ID,
  recipeId: GREEK_SALAD_ID,
  recipeTitle: 'Greek Salad',
  customTitle: null,
  readinessPercent: 29,
  plannedDate: WEDNESDAY,
  mealType: 'dinner',
  addedBy: profileFixture.id,
  createdAt: '2026-09-20T12:00:00.000Z',
};

const deletedEntry: MealPlanEntry = {
  id: 'e0000010-0000-4000-8000-000000000003',
  householdId: OAK_STREET_ID,
  recipeId: null,
  recipeTitle: 'Mushroom Stroganoff',
  customTitle: null,
  readinessPercent: null,
  plannedDate: PAST_TUESDAY,
  mealType: 'dinner',
  addedBy: profileFixture.id,
  createdAt: '2026-09-10T12:00:00.000Z',
};

function weekResponse(week: string): MealPlanWeekResponse {
  if (week === CURRENT_WEEK) return { week, entries: [zitiEntry, saladEntry] };
  if (week === PAST_WEEK) return { week, entries: [deletedEntry] };
  return { week, entries: [] };
}

function baseHandlers(
  extra: Readonly<Record<string, StubHandler>> = {},
): Record<string, StubHandler> {
  return {
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'GET /api/households/:id': () => ({ status: 200, body: oakStreetFixture }),
    'GET /api/households/:id/meal-plan': ({ query }) => ({
      status: 200,
      body: weekResponse(query.get('week') ?? CURRENT_WEEK),
    }),
    'GET /api/households/:id/suggestions': () => ({ status: 200, body: suggestionsFixture }),
    'GET /api/households/:id/recipes': () => ({
      status: 200,
      body: {
        recipes: [sheetPanChickenFixture, bakedZitiFixture],
        page: 1,
        pageSize: 50,
        total: 2,
        hasMore: false,
      },
    }),
    'GET /api/households/:id/lists': () => ({ status: 200, body: [thisWeekFixture] }),
    ...extra,
  };
}

function mount(handlers = baseHandlers()): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub(handlers);
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(<PlannerScreen householdId={OAK_STREET_ID} />);
  return stub;
}

registerBrowserStubs();

describe('Week planner', () => {
  it('loading: announces it with skeletons', () => {
    mount(
      baseHandlers({ 'GET /api/households/:id/meal-plan': () => new Promise(() => undefined) }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading the week planner');
  });

  it("lists a slot's placed recipes, since it may hold more than one", async () => {
    const user = userEvent.setup();
    mount();
    const tabs = await screen.findByRole('tablist', { name: 'Day of the week' });
    await user.click(within(tabs).getByRole('tab', { name: /Wed/ }));
    expect(await screen.findByRole('link', { name: /Baked Ziti/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Greek Salad/ })).toBeInTheDocument();
  });

  it("a deleted recipe's entry shows the snapshot title with no readiness and no link, and is read-only", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Previous week' }));
    expect(await screen.findByText(PLANNER_PAST_WEEK_COPY)).toBeInTheDocument();
    const tabs = screen.getByRole('tablist', { name: 'Day of the week' });
    await user.click(within(tabs).getByRole('tab', { name: /Tue/ }));
    const title = await screen.findByText('Mushroom Stroganoff');
    expect(title).toHaveClass('text-secondary');
    expect(screen.queryByRole('link', { name: /Mushroom Stroganoff/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /More actions/ })).toBeNull();
    expect(screen.queryByText(/Add to dinner/)).toBeNull();
  });

  it('places a recipe from the picker, defaulting to suggestions', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'POST /api/households/:id/meal-plan': ({ body }) => ({
          status: 201,
          body: {
            id: 'e0000010-0000-4000-8000-000000000004',
            householdId: OAK_STREET_ID,
            recipeTitle: 'Grilled Cheese and Tomato Soup',
            readinessPercent: 100,
            addedBy: profileFixture.id,
            createdAt: '2026-09-27T12:00:00.000Z',
            ...(body as object),
          },
        }),
      }),
    );
    const tabs = await screen.findByRole('tablist', { name: 'Day of the week' });
    await user.click(within(tabs).getByRole('tab', { name: /Wed/ }));
    await screen.findByRole('link', { name: /Baked Ziti/ });
    await user.click(screen.getByRole('button', { name: 'Add to breakfast' }));
    await user.click(await screen.findByRole('button', { name: /Grilled Cheese and Tomato Soup/ }));
    await waitFor(() => {
      expect(
        stub.calls.some((call) => call.path.endsWith('/meal-plan') && call.method === 'POST'),
      ).toBe(true);
    });
  });

  it('removes a placed meal', async () => {
    const user = userEvent.setup();
    const stub = mount(baseHandlers({ 'DELETE /api/meal-plan/:id': () => ({ status: 204 }) }));
    const tabs = await screen.findByRole('tablist', { name: 'Day of the week' });
    await user.click(within(tabs).getByRole('tab', { name: /Wed/ }));
    (await screen.findByRole('button', { name: 'More actions for Baked Ziti' })).focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    await waitFor(() => {
      expect(stub.calls.some((call) => call.method === 'DELETE')).toBe(true);
    });
  });

  it("adds a placed meal's missing ingredients to a list", async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'POST /api/meal-plan/:id/add-to-list': () => ({ status: 200, body: thisWeekDetailFixture }),
      }),
    );
    const tabs = await screen.findByRole('tablist', { name: 'Day of the week' });
    await user.click(within(tabs).getByRole('tab', { name: /Wed/ }));
    (await screen.findByRole('button', { name: 'More actions for Baked Ziti' })).focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('menuitem', { name: 'Add missing to list' }));
    await user.click(await screen.findByRole('button', { name: /This Week/ }));
    await waitFor(() => {
      expect(
        stub.calls.some((call) => call.method === 'POST' && call.path.endsWith('/add-to-list')),
      ).toBe(true);
    });
  });

  it("adds the whole week's missing ingredients to a list", async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'POST /api/households/:id/meal-plan/add-to-list': () => ({
          status: 200,
          body: thisWeekDetailFixture,
        }),
      }),
    );
    await screen.findByRole('tablist', { name: 'Day of the week' });
    await user.click(screen.getByRole('button', { name: "Add week's missing to list" }));
    await user.click(await screen.findByRole('button', { name: /This Week/ }));
    await waitFor(() => {
      expect(
        stub.calls.some((call) => call.method === 'POST' && call.path.endsWith('/add-to-list')),
      ).toBe(true);
    });
  });

  it('offline: disables placing, removing, and the week action, without hiding them', async () => {
    mount();
    await screen.findByRole('tablist', { name: 'Day of the week' });
    setOnline(false);
    expect(screen.getByRole('button', { name: "Add week's missing to list" })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    const tabs = screen.getByRole('tablist', { name: 'Day of the week' });
    const user = userEvent.setup();
    await user.click(within(tabs).getByRole('tab', { name: /Wed/ }));
    expect(screen.getByRole('button', { name: 'Add to breakfast' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    (await screen.findByRole('button', { name: 'More actions for Baked Ziti' })).focus();
    await user.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    for (const label of ['Add missing to list', 'Remove']) {
      const item = within(menu).getByRole('menuitem', { name: new RegExp(`^${label}`) });
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).toHaveTextContent('Needs a connection.');
    }
  });

  it('desktop: shows the full seven-day grid instead of day tabs', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(min-width: 1024px)',
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    mount();
    await screen.findByText(/Week of/);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(await screen.findByRole('link', { name: /Baked Ziti/ })).toBeInTheDocument();
  });
});
