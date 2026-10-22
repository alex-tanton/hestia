import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { OAK_STREET_ID, profileFixture } from '../../test/fixtures.ts';
import {
  misoSoupFixture,
  riveraSuggestionsFixture,
  tunaPokeBowlFixture,
} from '../../test/meal-fixtures.ts';
import { createFetchStub, renderScreen, type StubHandler } from '../../test/harness.tsx';
import {
  SUGGESTIONS_EMPTY_COPY,
  SUGGESTIONS_NO_DEALS_COPY,
} from '../../components/meals/meal-copy.ts';
import { SuggestionsScreen } from './SuggestionsScreen.tsx';

// The deals as-of date renders an instant in the viewer's zone, and the dates below were written
// for a New York viewer. `format.ts` builds its DATE_TIME formatter when the module loads, so the
// zone has to change before the imports run, which `vi.hoisted` guarantees. The expected text stays
// a literal on purpose: rebuilding it from the instant in the zone the component uses would only
// test the component against itself.
const viewerZone = vi.hoisted(() => {
  const previous = process.env['TZ'] ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  process.env['TZ'] = 'America/New_York';
  return previous;
});

afterAll(() => {
  // Assigned, never deleted: assigning makes Node re-detect the zone, deleting may not.
  process.env['TZ'] = viewerZone;
});

function mount(handlers: Record<string, StubHandler>): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub({
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    ...handlers,
  });
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(<SuggestionsScreen householdId={OAK_STREET_ID} />);
  return stub;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Deal-matched suggestions', () => {
  it('loading: announces it with skeletons', () => {
    mount({ 'GET /api/households/:id/suggestions': () => new Promise(() => undefined) });
    expect(screen.getByRole('status')).toHaveTextContent('Loading suggestions');
  });

  it('ranks by readiness descending, ties broken by title, and states the deal week and as-of date', async () => {
    mount({
      'GET /api/households/:id/suggestions': () => ({
        status: 200,
        body: {
          recipes: [
            {
              recipeId: 'c0000002-0000-4000-8000-000000000001',
              title: 'Beta Bowl',
              readinessPercent: 50,
              onSaleCount: 1,
              inPantryCount: 1,
              toBuyCount: 2,
            },
            {
              recipeId: 'c0000002-0000-4000-8000-000000000002',
              title: 'Alpha Bowl',
              readinessPercent: 50,
              onSaleCount: 1,
              inPantryCount: 1,
              toBuyCount: 2,
            },
            {
              recipeId: 'c0000002-0000-4000-8000-000000000003',
              title: 'Top Dish',
              readinessPercent: 90,
              onSaleCount: 4,
              inPantryCount: 5,
              toBuyCount: 1,
            },
          ],
          dealsAsOf: '2026-09-25T09:00:00.000Z',
        },
      }),
    });
    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['Top Dish', 'Alpha Bowl', 'Beta Bowl']);
    expect(screen.getByText(/Based on deals for the week of/)).toBeInTheDocument();
    expect(screen.getByText(/09\/25\/2026/)).toBeInTheDocument();
  });

  it('shows the breakdown line for every card ("4 of 5 ready — …")', async () => {
    mount({
      'GET /api/households/:id/suggestions': () => ({
        status: 200,
        body: {
          recipes: [
            {
              recipeId: 'c0000002-0000-4000-8000-000000000004',
              title: 'Sheet Pan Chicken',
              readinessPercent: 86,
              onSaleCount: 3,
              inPantryCount: 3,
              toBuyCount: 1,
            },
          ],
          dealsAsOf: '2026-09-25T09:00:00.000Z',
        },
      }),
    });
    expect(
      await screen.findByText('6 of 7 ready — 3 on sale, 3 in pantry, 1 to buy'),
    ).toBeInTheDocument();
  });

  it('no recipes yet: routes to the library rather than showing a bare empty state', async () => {
    const user = userEvent.setup();
    mount({
      'GET /api/households/:id/suggestions': () => ({
        status: 200,
        body: { recipes: [], dealsAsOf: null },
      }),
    });
    expect(await screen.findByText(SUGGESTIONS_EMPTY_COPY)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add a recipe' }));
  });

  it('no deals available: names it and offers retry, distinct from having no recipes', async () => {
    mount({
      'GET /api/households/:id/suggestions': () => ({
        status: 200,
        body: { recipes: [tunaPokeBowlFixture, misoSoupFixture], dealsAsOf: null },
      }),
    });
    expect(await screen.findByText(SUGGESTIONS_NO_DEALS_COPY)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('all recipes at 0%: shown normally, ranked by title rather than treated as empty', async () => {
    mount({
      'GET /api/households/:id/suggestions': () => ({
        status: 200,
        body: riveraSuggestionsFixture,
      }),
    });
    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['Miso Soup', 'Tuna Poke Bowl']);
    expect(screen.getAllByText('0%')).toHaveLength(2);
  });
});
