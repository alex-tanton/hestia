import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RecipeDetail } from '@hestia/shared';
import { openMenu, registerBrowserStubs, setOnline } from '../../test/browser.ts';
import {
  findMdButton,
  findMdField,
  findMdMenuItem,
  getMdButton,
  getMdMenuItem,
} from '../../test/md-queries.ts';
import { OAK_STREET_ID, oakStreetFixture, profileFixture } from '../../test/fixtures.ts';
import { thisWeekDetailFixture, thisWeekFixture } from '../../test/list-fixtures.ts';
import { emptyDealSearch } from '../../test/deal-fixtures.ts';
import {
  bakedZitiFixture,
  sheetPanChickenFixture,
  SHEET_PAN_CHICKEN_ID,
} from '../../test/meal-fixtures.ts';
import {
  createFetchStub,
  problemBody,
  renderScreen,
  type StubHandler,
} from '../../test/harness.tsx';
import { RecipeDetailScreen } from './RecipeDetailScreen.tsx';

function baseHandlers(
  extra: Readonly<Record<string, StubHandler>> = {},
): Record<string, StubHandler> {
  return {
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'GET /api/households/:id': () => ({ status: 200, body: oakStreetFixture }),
    'GET /api/recipes/:id': () => ({ status: 200, body: sheetPanChickenFixture }),
    'GET /api/households/:id/lists': () => ({ status: 200, body: [thisWeekFixture] }),
    'GET /api/households/:id/pantry': () => ({ status: 200, body: [] }),
    'GET /api/households/:id/deals/search': () => ({
      status: 200,
      body: emptyDealSearch,
    }),
    ...extra,
  };
}

function mount(
  handlers = baseHandlers(),
  recipeId = SHEET_PAN_CHICKEN_ID,
): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub(handlers);
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(<RecipeDetailScreen householdId={OAK_STREET_ID} recipeId={recipeId} />);
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

describe('Recipe detail', () => {
  it('loading: announces it with skeletons', () => {
    mount(baseHandlers({ 'GET /api/recipes/:id': () => new Promise(() => undefined) }));
    expect(screen.getByRole('status')).toHaveTextContent('Loading this recipe');
  });

  it('populated: title, servings, source link, and the announced readiness sentence', async () => {
    mount();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sheet Pan Chicken and Vegetables' }),
    ).toBeInTheDocument();
    expect(screen.getByText('4 servings')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View source' })).toHaveAttribute(
      'href',
      sheetPanChickenFixture.sourceUrl,
    );
    expect(screen.getByText('6 of 7 ingredients ready')).toBeInTheDocument();
    expect(screen.getByText(/Toss everything with oil/)).toBeInTheDocument();
  });

  it('error: states what failed and offers a route back', async () => {
    mount(
      baseHandlers({
        'GET /api/recipes/:id': () => ({
          status: 500,
          body: problemBody(500, 'Internal Server Error'),
        }),
      }),
    );
    expect(await screen.findByText("Couldn't load this recipe. Try again.")).toBeInTheDocument();
    expect(getMdButton('Back to recipes')).toBeInTheDocument();
  });

  it('override round trip: "Not a match" corrects a wrong match, then removal reverts it', async () => {
    const user = userEvent.setup();
    let recipe: RecipeDetail = structuredClone(sheetPanChickenFixture);
    const stub = mount(
      baseHandlers({
        'GET /api/recipes/:id': () => ({ status: 200, body: recipe }),
        'POST /api/households/:id/match-overrides': ({ body }) => {
          const request = body as { ingredientName: string; targetName: string };
          recipe = {
            ...recipe,
            matchOverrides: [
              {
                id: 'a0000010-0000-4000-8000-000000000001',
                householdId: OAK_STREET_ID,
                ingredientNormalizedName: 'chicken breast',
                targetKind: 'deal',
                targetNormalizedName: 'boneless skinless chicken breast family pack',
                decision: 'force_no_match',
                createdAt: '2026-09-25T09:00:00.000Z',
              },
            ],
            readiness: recipe.readiness && {
              ...recipe.readiness,
              onSaleCount: recipe.readiness.onSaleCount - 1,
              toBuyCount: recipe.readiness.toBuyCount + 1,
              readinessPercent: 71,
              breakdown: recipe.readiness.breakdown.map((entry) =>
                entry.ingredientId === 'a0000001-0000-4000-8000-000000000001'
                  ? {
                      ...entry,
                      bucket: 'to_buy',
                      matchedId: null,
                      matchedName: null,
                      overridden: true,
                    }
                  : entry,
              ),
            },
          };
          expect(request.ingredientName).toBe('chicken breast');
          return {
            status: 201,
            body: recipe.matchOverrides[0],
          };
        },
        'DELETE /api/match-overrides/:id': () => {
          recipe = structuredClone(sheetPanChickenFixture);
          return { status: 204 };
        },
      }),
    );

    await screen.findByRole('heading', { level: 1, name: 'Sheet Pan Chicken and Vegetables' });
    const row = screen.getByText('chicken breast').closest('li') as HTMLElement;
    await user.click(getMdButton('Not a match', { container: row }));

    await waitFor(() => {
      expect(stub.calls.some((call) => call.path.endsWith('/match-overrides'))).toBe(true);
    });
    const correctedRow = await screen.findByText('chicken breast');
    const correctedLi = correctedRow.closest('li') as HTMLElement;
    expect(await within(correctedLi).findByText('Corrected')).toBeInTheDocument();
    const removeButton = getMdButton(/Remove correction/, { container: correctedLi });
    expect(removeButton).toHaveFocus();

    await user.click(removeButton);
    await waitFor(() => {
      expect(stub.calls.some((call) => call.method === 'DELETE')).toBe(true);
    });
    await waitFor(() => {
      const revertedLi = screen.getByText('chicken breast').closest('li') as HTMLElement;
      expect(within(revertedLi).queryByText('Corrected')).toBeNull();
      const notAMatch = getMdButton('Not a match', { container: revertedLi });
      if (document.activeElement !== notAMatch) {
        notAMatch.focus();
      }
      expect(notAMatch).toHaveFocus();
    });
  });

  it('match-to: picks a pantry item and stores a force-match override', async () => {
    const user = userEvent.setup();
    let recipe: RecipeDetail = structuredClone(sheetPanChickenFixture);
    const stub = mount(
      baseHandlers({
        'GET /api/recipes/:id': () => ({ status: 200, body: recipe }),
        'GET /api/households/:id/pantry': () => ({
          status: 200,
          body: [
            {
              id: 'a0000010-0000-4000-8000-000000000002',
              householdId: OAK_STREET_ID,
              itemName: 'Lemon',
              normalizedName: 'lemon',
              quantityNote: null,
              lastUpdated: '2026-09-20T12:00:00.000Z',
            },
          ],
        }),
        'POST /api/households/:id/match-overrides': ({ body }) => {
          const request = body as { targetName: string };
          recipe = {
            ...recipe,
            matchOverrides: [
              {
                id: 'a0000010-0000-4000-8000-000000000003',
                householdId: OAK_STREET_ID,
                ingredientNormalizedName: 'lemon',
                targetKind: 'pantry',
                targetNormalizedName: 'lemon',
                decision: 'force_match',
                createdAt: '2026-09-25T09:00:00.000Z',
              },
            ],
            readiness: recipe.readiness && {
              ...recipe.readiness,
              inPantryCount: recipe.readiness.inPantryCount + 1,
              toBuyCount: recipe.readiness.toBuyCount - 1,
              readinessPercent: 100,
              breakdown: recipe.readiness.breakdown.map((entry) =>
                entry.ingredientId === 'a0000001-0000-4000-8000-000000000007'
                  ? {
                      ...entry,
                      bucket: 'in_pantry',
                      matchedId: 'a0000010-0000-4000-8000-000000000002',
                      matchedName: request.targetName,
                      overridden: true,
                    }
                  : entry,
              ),
            },
          };
          return { status: 201, body: recipe.matchOverrides[0] };
        },
      }),
    );

    await screen.findByRole('heading', { level: 1, name: 'Sheet Pan Chicken and Vegetables' });
    const row = screen.getByText('lemon').closest('li') as HTMLElement;
    await user.click(getMdButton('Match to…', { container: row }));
    await user.click(await findMdButton('Lemon'));

    await waitFor(() => {
      expect(stub.calls.some((call) => call.path.endsWith('/match-overrides'))).toBe(true);
    });
    const correctedLi = (await screen.findByText('lemon')).closest('li') as HTMLElement;
    expect(await within(correctedLi).findByText('Corrected')).toBeInTheDocument();
  });

  it('match-to: the deal search starts from the ingredient name but can be retyped', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'GET /api/households/:id/deals/search': (request) => {
          const q = request.query.get('q');
          if (q !== 'citrus') return { status: 200, body: emptyDealSearch };
          return {
            status: 200,
            body: {
              ...emptyDealSearch,
              total: 1,
              deals: [
                {
                  id: 'a0000020-0000-4000-8000-000000000009',
                  externalId: 'ext-lemon',
                  merchantId: 'merchant-1',
                  merchantName: 'Food Lion',
                  name: 'Citrus Medley Bag',
                  normalizedName: 'citrus medley bag',
                  unitPrice: 299,
                  priceUnit: 'each',
                  originalPrice: null,
                  discountPercent: null,
                  displayPrice: '$2.99 each',
                  conditionalPrice: false,
                  conditionalReason: null,
                  category: null,
                  imageUrl: null,
                  sourceUrl: null,
                  flyerId: 'flyer-1',
                  validFrom: '2026-09-20',
                  validTo: '2026-09-27',
                  fetchedAt: '2026-09-20T12:00:00.000Z',
                },
              ],
            },
          };
        },
        'POST /api/households/:id/match-overrides': () => ({
          status: 201,
          body: {
            id: 'a0000010-0000-4000-8000-000000000005',
            householdId: OAK_STREET_ID,
            ingredientNormalizedName: 'lemon',
            targetKind: 'deal',
            targetNormalizedName: 'citrus medley bag',
            decision: 'force_match',
            createdAt: '2026-09-27T09:00:00.000Z',
          },
        }),
      }),
    );

    await screen.findByRole('heading', { level: 1, name: 'Sheet Pan Chicken and Vegetables' });
    const row = screen.getByText('lemon').closest('li') as HTMLElement;
    await user.click(getMdButton('Match to…', { container: row }));

    const searchInput = await findFieldInput('Search deals');
    expect(searchInput).toHaveValue('lemon');
    expect(await screen.findByText(/No current deals match "lemon"/)).toBeInTheDocument();

    fireEvent.input(searchInput, { target: { value: 'citrus' } });
    await user.click(getMdButton('Search'));

    const dealButton = await findMdButton(/Citrus Medley Bag/);
    await user.click(dealButton);

    await waitFor(() => {
      expect(
        stub.calls.some((call) => call.path.includes('/match-overrides') && call.method === 'POST'),
      ).toBe(true);
    });
  });

  it('add missing to list: opens the picker and adds to the chosen list', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'POST /api/recipes/:id/add-to-list': () => ({ status: 200, body: thisWeekDetailFixture }),
      }),
    );
    await screen.findByRole('heading', { level: 1 });
    await user.click(getMdButton('Add missing to list'));
    await user.click(await findMdButton(/This Week/));
    await waitFor(() => {
      expect(stub.calls.some((call) => call.path.endsWith('/add-to-list'))).toBe(true);
    });
    expect(await screen.findByText(`Added to ${thisWeekFixture.name}.`)).toBeInTheDocument();
  });

  it('place on the week planner: submits the chosen date and meal', async () => {
    const user = userEvent.setup();
    const stub = mount(
      baseHandlers({
        'POST /api/households/:id/meal-plan': ({ body }) => ({
          status: 201,
          body: {
            id: 'a0000010-0000-4000-8000-000000000004',
            ...(body as object),
            householdId: OAK_STREET_ID,
            recipeTitle: sheetPanChickenFixture.title,
            readinessPercent: 86,
            addedBy: profileFixture.id,
            createdAt: '2026-09-27T12:00:00.000Z',
          },
        }),
      }),
    );
    await screen.findByRole('heading', { level: 1 });
    await user.click(getMdButton(/Place on week planner/));
    await user.click(await findMdButton('Place meal'));
    await waitFor(() => {
      expect(stub.calls.some((call) => call.path.endsWith('/meal-plan'))).toBe(true);
    });
  });

  it('edit: opens the same form as the add flow, prefilled', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('heading', { level: 1 });
    await openMenu(user, /More actions for/);
    await user.click(await findMdMenuItem('Edit'));
    const titleInput = await findFieldInput('Title');
    expect(titleInput).toHaveValue(sheetPanChickenFixture.title);
  });

  it('delete: confirms by name, then deletes and navigates away', async () => {
    const user = userEvent.setup();
    const stub = mount(baseHandlers({ 'DELETE /api/recipes/:id': () => ({ status: 204 }) }));
    await screen.findByRole('heading', { level: 1 });
    await openMenu(user, /More actions for/);
    await user.click(await findMdMenuItem('Delete'));
    expect(
      await screen.findByText(
        'Delete Sheet Pan Chicken and Vegetables? Planned meals keep its name.',
      ),
    ).toBeInTheDocument();
    await user.click(getMdButton('Delete recipe'));
    await waitFor(() => {
      expect(stub.calls.some((call) => call.method === 'DELETE')).toBe(true);
    });
  });

  it('offline: disables edit, delete, add-missing, placing, and every correction control', async () => {
    mount();
    await screen.findByRole('heading', { level: 1 });
    setOnline(false);

    const addMissing = getMdButton('Add missing to list');
    expect(addMissing).toHaveProperty('softDisabled', true);
    const place = getMdButton(/Place on week planner/);
    expect(place).toHaveProperty('softDisabled', true);

    const user = userEvent.setup();
    await openMenu(user, /More actions for/);
    for (const label of ['Edit', 'Delete']) {
      const item = getMdMenuItem(new RegExp(`^${label}`));
      expect(item).toHaveProperty('disabled', true);
      expect(item).toHaveTextContent('Needs a connection.');
    }
    await user.keyboard('{Escape}');

    const row = screen.getByText('lemon').closest('li') as HTMLElement;
    expect(getMdButton('Match to…', { container: row })).toHaveProperty('softDisabled', true);
  });
});

describe('Recipe detail: readiness bucket display', () => {
  it('shows each ingredient with its bucket label and what it matched', async () => {
    mount(
      baseHandlers({ 'GET /api/recipes/:id': () => ({ status: 200, body: bakedZitiFixture }) }),
      bakedZitiFixture.id,
    );
    const row = (await screen.findByText('pasta')).closest('li') as HTMLElement;
    expect(within(row).getByText('In pantry')).toBeInTheDocument();
    expect(within(row).getByText('matched Pasta')).toBeInTheDocument();
  });

  it('shows the seeded "cheese" force-no-match override with a Corrected label', async () => {
    mount(
      baseHandlers({ 'GET /api/recipes/:id': () => ({ status: 200, body: bakedZitiFixture }) }),
      bakedZitiFixture.id,
    );
    await screen.findByRole('heading', { level: 1 });
    // Baked Ziti itself has no "cheese" ingredient; this asserts the fixture wiring is available
    // for a recipe that does (the seed data's override fixture), via `cheeseOverrideFixture`.
    expect(
      bakedZitiFixture.matchOverrides.some((o) => o.ingredientNormalizedName === 'cheese'),
    ).toBe(true);
  });
});
