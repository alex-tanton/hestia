import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MealPlanEntry, MealPlanWeekResponse } from '@hestia/shared';
import { openMenu, registerBrowserStubs, setOnline } from '../../test/browser.ts';
import {
  findMdButton,
  findMdField,
  findMdMenuItem,
  findMdTab,
  getMdButton,
  getMdMenuItem,
  getMdTab,
  queryMdButton,
  queryMdTab,
} from '../../test/md-queries.ts';
import { OAK_STREET_ID, oakStreetFixture, profileFixture } from '../../test/fixtures.ts';
import { thisWeekDetailFixture, thisWeekFixture } from '../../test/list-fixtures.ts';
import {
  bakedZitiFixture,
  sheetPanChickenFixture,
  suggestionsFixture,
} from '../../test/meal-fixtures.ts';
import { createFetchStub, renderScreen, type StubHandler } from '../../test/harness.tsx';
import { addDays, todayInTimezone, weekStart } from '../../lib/household-date.ts';
import {
  CUSTOM_ITEM_ADD_TO_LIST,
  PLANNER_PAST_WEEK_COPY,
} from '../../components/meals/meal-copy.ts';
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

const bananaEntry: MealPlanEntry = {
  id: 'e0000010-0000-4000-8000-000000000005',
  householdId: OAK_STREET_ID,
  recipeId: null,
  recipeTitle: null,
  customTitle: 'Banana',
  readinessPercent: null,
  plannedDate: WEDNESDAY,
  mealType: 'breakfast',
  addedBy: profileFixture.id,
  createdAt: '2026-09-20T12:00:00.000Z',
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

async function findFieldInput(name: string, container?: HTMLElement): Promise<HTMLElement> {
  const host = await findMdField(name, { container });
  if (host instanceof HTMLInputElement || host instanceof HTMLTextAreaElement) {
    return host;
  }
  return waitFor(() => {
    const input = host.shadowRoot?.querySelector<HTMLElement>('input, textarea');
    if (input === null || input === undefined) {
      throw new Error(`Expected shadow input inside <${host.localName}>`);
    }
    return input;
  });
}

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
    await user.click(await findMdTab(/Wed/));
    expect(await screen.findByRole('link', { name: /Baked Ziti/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Greek Salad/ })).toBeInTheDocument();
  });

  it("a deleted recipe's entry shows the snapshot title with no readiness and no link, and is read-only", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await findMdButton('Previous week'));
    expect(await screen.findByText(PLANNER_PAST_WEEK_COPY)).toBeInTheDocument();
    await user.click(await findMdTab(/Tue/));
    const title = await screen.findByText('Mushroom Stroganoff');
    expect(title).toHaveClass('text-secondary');
    expect(screen.queryByRole('link', { name: /Mushroom Stroganoff/ })).toBeNull();
    expect(queryMdButton(/More actions/)).toBeNull();
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
    await user.click(await findMdTab(/Wed/));
    await screen.findByRole('link', { name: /Baked Ziti/ });
    await user.click(await findMdButton(/Plan meal for Wed/));
    await user.click(await findMdButton(/Grilled Cheese and Tomato Soup/));
    await waitFor(() => {
      expect(
        stub.calls.some((call) => call.path.endsWith('/meal-plan') && call.method === 'POST'),
      ).toBe(true);
    });
  });

  it('removes a placed meal', async () => {
    const user = userEvent.setup();
    const stub = mount(baseHandlers({ 'DELETE /api/meal-plan/:id': () => ({ status: 204 }) }));
    await user.click(await findMdTab(/Wed/));
    await openMenu(user, 'More actions for Baked Ziti');
    await user.click(await findMdMenuItem('Remove'));
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
    await user.click(await findMdTab(/Wed/));
    await openMenu(user, 'More actions for Baked Ziti');
    await user.click(await findMdMenuItem('Add missing to list'));
    await user.click(await findMdButton(/This Week/));
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
    await findMdTab(/Sun/);
    await user.click(getMdButton("Add week's missing to list"));
    await user.click(await findMdButton(/This Week/));
    await waitFor(() => {
      expect(
        stub.calls.some((call) => call.method === 'POST' && call.path.endsWith('/add-to-list')),
      ).toBe(true);
    });
  });

  it('offline: disables placing, removing, and the week action, without hiding them', async () => {
    mount();
    await findMdTab(/Sun/);
    setOnline(false);
    expect(getMdButton("Add week's missing to list")).toHaveProperty('softDisabled', true);
    const user = userEvent.setup();
    await user.click(getMdTab(/Wed/));
    expect(getMdButton(/Plan meal for Wed/)).toHaveProperty('softDisabled', true);
    await openMenu(user, 'More actions for Baked Ziti');
    for (const label of ['Add missing to list', 'Remove']) {
      const item = getMdMenuItem(new RegExp(`^${label}`));
      expect(item).toHaveProperty('disabled', true);
      expect(item).toHaveTextContent('Needs a connection.');
    }
  });

  it('places a custom item by typing in the Quick Item tab', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'POST /api/households/:id/meal-plan': ({ body }) => ({
          status: 201,
          body: {
            id: 'e0000010-0000-4000-8000-000000000005',
            householdId: OAK_STREET_ID,
            recipeId: null,
            recipeTitle: null,
            customTitle: 'Banana',
            readinessPercent: null,
            addedBy: profileFixture.id,
            createdAt: '2026-09-27T12:00:00.000Z',
            ...(body as object),
          },
        }),
      }),
    );
    await user.click(await findMdTab(/Wed/));
    await user.click(await findMdButton(/Plan meal for Wed/));
    await user.click(await findMdTab('Quick Item'));
    const input = await findFieldInput('Item name');
    fireEvent.input(input, { target: { value: 'Banana' } });
    await user.click(getMdButton('Save meal placement'));
    await waitFor(() => {
      expect(
        stub.calls.some(
          (call) =>
            call.path.endsWith('/meal-plan') &&
            call.method === 'POST' &&
            (call.body as { customTitle?: string }).customTitle === 'Banana',
        ),
      ).toBe(true);
    });
  });

  it('places a custom item using a suggestion chip', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'POST /api/households/:id/meal-plan': ({ body }) => ({
          status: 201,
          body: {
            id: 'e0000010-0000-4000-8000-000000000006',
            householdId: OAK_STREET_ID,
            recipeId: null,
            recipeTitle: null,
            customTitle: 'Greek Yogurt',
            readinessPercent: null,
            addedBy: profileFixture.id,
            createdAt: '2026-09-27T12:00:00.000Z',
            ...(body as object),
          },
        }),
      }),
    );
    await user.click(await findMdTab(/Wed/));
    await user.click(await findMdButton(/Plan meal for Wed/));
    await user.click(await findMdTab('Quick Item'));
    await user.click(await findMdButton('Greek Yogurt'));
    await waitFor(() => {
      expect(
        stub.calls.some(
          (call) =>
            call.path.endsWith('/meal-plan') &&
            call.method === 'POST' &&
            (call.body as { customTitle?: string }).customTitle === 'Greek Yogurt',
        ),
      ).toBe(true);
    });
  });

  it('adds a custom meal item to a list from its overflow menu', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'GET /api/households/:id/meal-plan': () => ({
          status: 200,
          body: { week: CURRENT_WEEK, entries: [zitiEntry, bananaEntry] },
        }),
        'POST /api/meal-plan/:id/add-to-list': () => ({
          status: 200,
          body: thisWeekDetailFixture,
        }),
      }),
    );
    await user.click(await findMdTab(/Wed/));
    expect(await screen.findByText('Banana')).toBeInTheDocument();
    await openMenu(user, 'More actions for Banana');
    await user.click(await findMdMenuItem(CUSTOM_ITEM_ADD_TO_LIST));
    expect(await screen.findByText('Add to which list?')).toBeInTheDocument();
    await user.click(await findMdButton(/This Week/));
    await waitFor(() => {
      expect(
        stub.calls.some(
          (call) =>
            call.method === 'POST' &&
            call.path.includes(bananaEntry.id) &&
            call.path.endsWith('/add-to-list'),
        ),
      ).toBe(true);
    });
  });

  it('removes a custom meal item', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'GET /api/households/:id/meal-plan': () => ({
          status: 200,
          body: { week: CURRENT_WEEK, entries: [zitiEntry, bananaEntry] },
        }),
        'DELETE /api/meal-plan/:id': () => ({ status: 204 }),
      }),
    );
    await user.click(await findMdTab(/Wed/));
    expect(await screen.findByText('Banana')).toBeInTheDocument();
    await openMenu(user, 'More actions for Banana');
    await user.click(await findMdMenuItem('Remove'));
    await waitFor(() => {
      expect(
        stub.calls.some((call) => call.method === 'DELETE' && call.path.includes(bananaEntry.id)),
      ).toBe(true);
    });
    expect(await screen.findByText('Removed meal from planner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('mobile: renders empty state when entire week has zero meals', async () => {
    mount(
      baseHandlers({
        'GET /api/households/:id/meal-plan': () => ({
          status: 200,
          body: { week: CURRENT_WEEK, entries: [] },
        }),
      }),
    );
    expect(await screen.findByText('No meals planned this week')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Plan upcoming meals, reuse favorites, or generate ideas based on pantry inventory and store deals.',
      ),
    ).toBeInTheDocument();
    expect(getMdButton('Plan meal')).toBeInTheDocument();
  });

  it('desktop: shows the full seven-column grid with slot subsections and add affordances', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(min-width: 840px)' || query === '(min-width: 1024px)',
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    mount();
    await screen.findByText(/Week of/);
    expect(queryMdTab()).toBeNull();
    expect(await screen.findByRole('link', { name: /Baked Ziti/ })).toBeInTheDocument();
    const firstDay = document.getElementById(`planner-day-${CURRENT_WEEK}`);
    expect(
      getMdButton('Add to breakfast', { container: firstDay ?? undefined }),
    ).toBeInTheDocument();
  });
});
