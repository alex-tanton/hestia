import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OAK_STREET_ID } from '../../test/fixtures.ts';
import { createFetchStub, renderScreen, type StubHandler } from '../../test/harness.tsx';
import { recipeListResponseFixture, suggestionsFixture } from '../../test/meal-fixtures.ts';
import { findMdField, getMdButton, getMdField, getMdTab } from '../../test/md-queries.ts';
import { MealPlacementSheet, QUICK_SUGGESTIONS } from './MealPlacementSheet.tsx';

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

    expect(screen.getByRole('heading', { name: 'Plan meal' })).toBeInTheDocument();
    expect(getMdTab('Recipe')).toHaveProperty('active', true);
    expect(getMdTab('Quick Item')).toHaveProperty('active', false);

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

    await user.click(getMdTab('Quick Item'));
    await waitFor(() => {
      expect(getMdTab('Quick Item')).toHaveProperty('active', true);
    });

    expect(getMdField('Item name')).toBeInTheDocument();
    expect(getMdButton('Save meal placement')).toBeDisabled();

    // Verify all suggestion chips are present
    for (const suggestion of QUICK_SUGGESTIONS) {
      expect(getMdButton(suggestion)).toBeInTheDocument();
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

    await user.click(getMdTab('Quick Item'));

    const input = await findFieldInput('Item name');
    fireEvent.input(input, { target: { value: 'Greek Yogurt' } });

    const placeBtn = getMdButton('Save meal placement');
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

    await user.click(getMdTab('Quick Item'));

    const input = await findFieldInput('Item name');
    fireEvent.input(input, { target: { value: 'Scrambled Eggs' } });
    fireEvent.keyDown(input, { key: 'Enter' });

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

    await user.click(getMdTab('Quick Item'));

    await user.click(getMdButton('Banana'));
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

    await user.click(getMdTab('Quick Item'));

    const input = await findFieldInput('Item name');
    fireEvent.input(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(getMdButton('Save meal placement')).toBeDisabled();
    expect(onPickCustom).not.toHaveBeenCalled();
  });
});
