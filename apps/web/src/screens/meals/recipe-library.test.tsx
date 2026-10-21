import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { registerBrowserStubs, setOnline } from '../../test/browser.ts';
import { OAK_STREET_ID, profileFixture } from '../../test/fixtures.ts';
import {
  bakedZitiFixture,
  grilledCheeseFixture,
  padThaiFixture,
  recipeListResponseFixture,
  sheetPanChickenFixture,
  suggestionsFixture,
} from '../../test/meal-fixtures.ts';
import {
  createFetchStub,
  problemBody,
  renderScreen,
  type StubHandler,
} from '../../test/harness.tsx';
import {
  RECIPE_LIBRARY_EMPTY_COPY,
  RECIPE_LIBRARY_NO_MATCH_COPY,
} from '../../components/meals/meal-copy.ts';
import { RecipeLibraryScreen } from './RecipeLibraryScreen.tsx';

function baseHandlers(
  extra: Readonly<Record<string, StubHandler>> = {},
): Record<string, StubHandler> {
  return {
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'GET /api/households/:id/recipes': () => ({ status: 200, body: recipeListResponseFixture }),
    'GET /api/households/:id/suggestions': () => ({ status: 200, body: suggestionsFixture }),
    ...extra,
  };
}

function mount(handlers = baseHandlers()): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub(handlers);
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(<RecipeLibraryScreen householdId={OAK_STREET_ID} />);
  return stub;
}

registerBrowserStubs();

describe('Recipe library (Design › Screens › 11)', () => {
  it('loading: announces it with skeletons', () => {
    mount(baseHandlers({ 'GET /api/households/:id/recipes': () => new Promise(() => undefined) }));
    expect(screen.getByRole('status')).toHaveTextContent('Loading recipes');
  });

  it('populated: shows readiness, the breakdown line, and servings on each card', async () => {
    mount();
    const card = await screen.findByRole('link', { name: /Sheet Pan Chicken and Vegetables/ });
    expect(card).toHaveTextContent('86%');
    expect(card).toHaveTextContent('6 of 7 ready — 3 on sale, 3 in pantry, 1 to buy');
    expect(card).toHaveTextContent('4 servings');
    expect(card).toHaveAttribute('href', expect.stringContaining(sheetPanChickenFixture.id));
  });

  it('empty: first run names what it holds and offers to add one', async () => {
    mount(
      baseHandlers({
        'GET /api/households/:id/recipes': () => ({
          status: 200,
          body: { recipes: [], page: 1, pageSize: 50, total: 0, hasMore: false },
        }),
        'GET /api/households/:id/suggestions': () => ({
          status: 200,
          body: { recipes: [], dealsAsOf: null },
        }),
      }),
    );
    expect(await screen.findByText(RECIPE_LIBRARY_EMPTY_COPY)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add a recipe' })[0]).toBeInTheDocument();
  });

  it('filtered empty: different copy, with a clear-search action', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText(/Sheet Pan Chicken/);
    await user.type(screen.getByLabelText('Search recipes'), 'zzzzz');
    expect(await screen.findByText(RECIPE_LIBRARY_NO_MATCH_COPY)).toBeInTheDocument();
    expect(screen.queryByText(RECIPE_LIBRARY_EMPTY_COPY)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(await screen.findByText(/Sheet Pan Chicken/)).toBeInTheDocument();
  });

  it('error: states what failed and retries', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'GET /api/households/:id/recipes': () => ({
          status: 500,
          body: problemBody(500, 'Internal Server Error'),
        }),
      }),
    );
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(stub.calls.filter((call) => call.path.includes('/recipes')).length).toBeGreaterThan(1);
    });
  });

  it('offline: disables adding a recipe and says why', async () => {
    mount();
    await screen.findByText(/Sheet Pan Chicken/);
    setOnline(false);
    const add = screen.getByRole('button', { name: 'Add a recipe' });
    expect(add).toHaveAttribute('aria-disabled', 'true');
    const reasonId = add.getAttribute('aria-describedby');
    expect(document.getElementById(reasonId ?? '')).toHaveTextContent('Needs a connection.');
  });

  it('sorts by title, recently added, and readiness', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText(/Sheet Pan Chicken/);

    function titles(): string[] {
      return screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    }

    await user.selectOptions(screen.getByLabelText('Sort by'), 'Title');
    expect(titles()).toEqual([...titles()].sort((a, b) => a.localeCompare(b)));

    await user.selectOptions(screen.getByLabelText('Sort by'), 'Readiness');
    expect(titles()[0]).toBe(grilledCheeseFixture.title);
    expect(titles().at(-1)).toBe(padThaiFixture.title);
  });

  it('paginates at 50 (Requirements › "Scale and pagination"), reaching a second page', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'GET /api/households/:id/recipes': (request) => {
          const page = Number(request.query.get('page') ?? '1');
          if (page === 2) {
            return {
              status: 200,
              body: { recipes: [bakedZitiFixture], page: 2, pageSize: 1, total: 2, hasMore: false },
            };
          }
          return {
            status: 200,
            body: {
              recipes: [sheetPanChickenFixture],
              page: 1,
              pageSize: 1,
              total: 2,
              hasMore: true,
            },
          };
        },
      }),
    );
    await screen.findByText(/Sheet Pan Chicken/);
    expect(screen.queryByText(bakedZitiFixture.title)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByText(bakedZitiFixture.title);
    expect(screen.queryByText(/Sheet Pan Chicken/)).toBeNull();
    await waitFor(() => {
      expect(stub.calls.some((call) => call.path.includes('page=2'))).toBe(true);
    });
  });

  it('a new search returns to page 1', async () => {
    const user = userEvent.setup();
    mount(
      baseHandlers({
        'GET /api/households/:id/recipes': (request) => {
          const page = Number(request.query.get('page') ?? '1');
          if (page === 2) {
            return {
              status: 200,
              body: { recipes: [bakedZitiFixture], page: 2, pageSize: 1, total: 2, hasMore: false },
            };
          }
          return {
            status: 200,
            body: {
              recipes: [sheetPanChickenFixture],
              page: 1,
              pageSize: 1,
              total: 2,
              hasMore: true,
            },
          };
        },
      }),
    );
    await screen.findByText(/Sheet Pan Chicken/);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText(bakedZitiFixture.title);

    await user.type(screen.getByLabelText('Search recipes'), 'chicken');
    await screen.findByText(/Sheet Pan Chicken/);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('add flow: choose manual entry, fill it in, and save', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'POST /api/households/:id/recipes': ({ body }) => ({
          status: 201,
          body: { ...bakedZitiFixture, ...(body as object) },
        }),
      }),
    );
    await screen.findByText(/Sheet Pan Chicken/);
    await user.click(screen.getAllByRole('button', { name: 'Add a recipe' })[0]!);
    await user.click(await screen.findByRole('button', { name: 'Enter by hand' }));
    await user.type(await screen.findByLabelText('Title'), 'Weeknight Tacos');
    // Entering by hand seeds one blank ingredient row already.
    await user.type(screen.getByLabelText('Item'), 'ground beef');
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    await waitFor(() => {
      expect(
        stub.calls.some((call) => call.method === 'POST' && call.path.endsWith('/recipes')),
      ).toBe(true);
    });
  });

  it('add flow: flags a blank ingredient name rather than saving silently', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText(/Sheet Pan Chicken/);
    await user.click(screen.getAllByRole('button', { name: 'Add a recipe' })[0]!);
    await user.click(await screen.findByRole('button', { name: 'Enter by hand' }));
    await user.type(await screen.findByLabelText('Title'), 'Untitled Dish');
    // Entering by hand seeds one blank ingredient row, left blank here on purpose.
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect(await screen.findByText('Enter an ingredient.')).toBeInTheDocument();
  });

  it('parse-failed: falls back to the manual form, prefilled with the typed URL', async () => {
    const user = userEvent.setup();
    mount(
      baseHandlers({
        'POST /api/households/:id/recipes/parse': () => ({
          status: 502,
          body: problemBody(502, 'Bad Gateway'),
        }),
      }),
    );
    await screen.findByText(/Sheet Pan Chicken/);
    await user.click(screen.getAllByRole('button', { name: 'Add a recipe' })[0]!);
    await user.click(await screen.findByRole('button', { name: 'Paste a link' }));
    await user.type(screen.getByLabelText('Recipe URL'), 'https://example.test/bad-page');
    await user.click(screen.getByRole('button', { name: 'Parse' }));
    expect(await screen.findByText("Couldn't read that page. Add it by hand?")).toBeInTheDocument();
    expect(await screen.findByLabelText('Source URL')).toHaveValue('https://example.test/bad-page');
  });

  it('parse-incomplete: flags missing fields rather than saving silently', async () => {
    const user = userEvent.setup();
    mount(
      baseHandlers({
        'POST /api/households/:id/recipes/parse': () => ({
          status: 200,
          body: {
            needsManualEntry: false,
            sourceUrl: 'https://example.test/partial',
            title: 'Partial Recipe',
            instructions: null,
            servings: null,
            ingredients: [],
          },
        }),
      }),
    );
    await screen.findByText(/Sheet Pan Chicken/);
    await user.click(screen.getAllByRole('button', { name: 'Add a recipe' })[0]!);
    await user.click(await screen.findByRole('button', { name: 'Paste a link' }));
    await user.type(screen.getByLabelText('Recipe URL'), 'https://example.test/partial');
    await user.click(screen.getByRole('button', { name: 'Parse' }));
    expect(
      await screen.findByText(
        "That page didn't have everything. Fill in what's missing before saving.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Partial Recipe');
  });
});
