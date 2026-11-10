import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OAK_STREET_ID } from '../../test/fixtures.ts';
import { createFetchStub, renderScreen, type StubHandler } from '../../test/harness.tsx';
import { recipeListResponseFixture, suggestionsFixture } from '../../test/meal-fixtures.ts';
import { MealPlacementSheet, QUICK_SUGGESTIONS } from './MealPlacementSheet.tsx';

describe('MealPlacementSheet', () => {
  let handlers: Record<string, StubHandler>;

  beforeEach(() => {
    handlers = {
      'GET /api/households/:id/suggestions': () => ({
        status: 200,
        body: suggestionsFixture,
      }),
      'GET /api/households/:id/recipes': () => ({
        status: 200,
        body: recipeListResponseFixture,
      }),
    };
    const stub = createFetchStub(handlers);
    vi.stubGlobal('fetch', stub.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders with Recipe tab active by default and allows selecting a recipe', async () => {
    const user = userEvent.setup();
    const onPickRecipe = vi.fn();
    const onPickCustom = vi.fn();
    const onOpenChange = vi.fn();

    renderScreen(
      <MealPlacementSheet
        householdId={OAK_STREET_ID}
        onPickRecipe={onPickRecipe}
        onPickCustom={onPickCustom}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Place meal' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Recipe' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByRole('tab', { name: 'Quick Item' })).toHaveAttribute(
      'data-state',
      'inactive',
    );

    // Recipes should load in the list
    const recipeItem = await screen.findByRole('button', {
      name: /Grilled Cheese and Tomato Soup/,
    });
    expect(recipeItem).toBeInTheDocument();

    await user.click(recipeItem);
    expect(onPickRecipe).toHaveBeenCalledWith(expect.any(String), 'Grilled Cheese and Tomato Soup');
  });

  it('switches to Quick Item tab and reveals input and suggestion chips', async () => {
    const user = userEvent.setup();
    const onPickRecipe = vi.fn();
    const onPickCustom = vi.fn();

    renderScreen(
      <MealPlacementSheet
        householdId={OAK_STREET_ID}
        onPickRecipe={onPickRecipe}
        onPickCustom={onPickCustom}
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Quick Item' }));
    expect(screen.getByRole('tab', { name: 'Quick Item' })).toHaveAttribute('data-state', 'active');

    expect(screen.getByLabelText('Item name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place item' })).toBeDisabled();

    // Verify all suggestion chips are present
    for (const suggestion of QUICK_SUGGESTIONS) {
      expect(screen.getByRole('button', { name: suggestion })).toBeInTheDocument();
    }
  });

  it('places a custom item when typing a name and clicking "Place item"', async () => {
    const user = userEvent.setup();
    const onPickCustom = vi.fn();

    renderScreen(
      <MealPlacementSheet
        householdId={OAK_STREET_ID}
        onPickRecipe={vi.fn()}
        onPickCustom={onPickCustom}
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Quick Item' }));

    const input = screen.getByLabelText('Item name');
    await user.type(input, 'Greek Yogurt');

    const placeBtn = screen.getByRole('button', { name: 'Place item' });
    expect(placeBtn).toBeEnabled();

    await user.click(placeBtn);
    expect(onPickCustom).toHaveBeenCalledWith('Greek Yogurt');
  });

  it('places a custom item on Enter key press', async () => {
    const user = userEvent.setup();
    const onPickCustom = vi.fn();

    renderScreen(
      <MealPlacementSheet
        householdId={OAK_STREET_ID}
        onPickRecipe={vi.fn()}
        onPickCustom={onPickCustom}
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Quick Item' }));

    const input = screen.getByLabelText('Item name');
    await user.type(input, 'Scrambled Eggs{Enter}');

    expect(onPickCustom).toHaveBeenCalledWith('Scrambled Eggs');
  });

  it('clicking a suggestion chip immediately calls onPickCustom', async () => {
    const user = userEvent.setup();
    const onPickCustom = vi.fn();

    renderScreen(
      <MealPlacementSheet
        householdId={OAK_STREET_ID}
        onPickRecipe={vi.fn()}
        onPickCustom={onPickCustom}
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Quick Item' }));

    await user.click(screen.getByRole('button', { name: 'Banana' }));
    expect(onPickCustom).toHaveBeenCalledWith('Banana');
  });

  it('does not allow submitting whitespace-only custom items', async () => {
    const user = userEvent.setup();
    const onPickCustom = vi.fn();

    renderScreen(
      <MealPlacementSheet
        householdId={OAK_STREET_ID}
        onPickRecipe={vi.fn()}
        onPickCustom={onPickCustom}
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Quick Item' }));

    const input = screen.getByLabelText('Item name');
    await user.type(input, '   {Enter}');

    expect(screen.getByRole('button', { name: 'Place item' })).toBeDisabled();
    expect(onPickCustom).not.toHaveBeenCalled();
  });
});
