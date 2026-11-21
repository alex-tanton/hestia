import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { MealPlanEntry } from '@hestia/shared';
import { openMenu } from '../../test/browser.ts';
import { findMdMenuItem, queryMdButton, queryMdMenuItem } from '../../test/md-queries.ts';
import { MealSlotEntry } from './MealSlotEntry.tsx';
import { CUSTOM_ITEM_ADD_TO_LIST, DELETED_RECIPE_NOTE } from './meal-copy.ts';

function withRouter(ui: ReactElement): void {
  render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('MealSlotEntry', () => {
  const recipeEntry: MealPlanEntry = {
    id: 'e1',
    householdId: 'h1',
    recipeId: 'r1',
    recipeTitle: 'Baked Ziti',
    customTitle: null,
    readinessPercent: 85,
    plannedDate: '2026-11-10',
    mealType: 'dinner',
    addedBy: 'u1',
    createdAt: '2026-11-10T12:00:00.000Z',
  };

  const customEntry: MealPlanEntry = {
    id: 'e2',
    householdId: 'h1',
    recipeId: null,
    recipeTitle: null,
    customTitle: 'Greek Yogurt & Honey',
    readinessPercent: null,
    plannedDate: '2026-11-10',
    mealType: 'breakfast',
    addedBy: 'u1',
    createdAt: '2026-11-10T12:00:00.000Z',
  };

  const deletedRecipeEntry: MealPlanEntry = {
    id: 'e3',
    householdId: 'h1',
    recipeId: null,
    recipeTitle: 'Deleted Pasta Carbonara',
    customTitle: null,
    readinessPercent: null,
    plannedDate: '2026-11-10',
    mealType: 'dinner',
    addedBy: 'u1',
    createdAt: '2026-11-10T12:00:00.000Z',
  };

  it('renders a custom item in primary text with a bullet and no link', () => {
    withRouter(
      <MealSlotEntry
        entry={customEntry}
        isReadOnly={false}
        offlineReason={undefined}
        onAddMissing={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByRole('link')).toBeNull();
    const title = screen.getByText('Greek Yogurt & Honey');
    expect(title).toBeInTheDocument();
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByText(DELETED_RECIPE_NOTE)).toBeNull();
  });

  it('offers "Add to list" and "Remove" in overflow menu for custom item', async () => {
    const user = userEvent.setup();
    const onAddMissing = vi.fn();
    const onRemove = vi.fn();

    withRouter(
      <MealSlotEntry
        entry={customEntry}
        isReadOnly={false}
        offlineReason={undefined}
        onAddMissing={onAddMissing}
        onRemove={onRemove}
      />,
    );

    await openMenu(user, 'More actions for Greek Yogurt & Honey');
    const addToList = await findMdMenuItem(CUSTOM_ITEM_ADD_TO_LIST);
    expect(addToList).toBeInTheDocument();

    const remove = await findMdMenuItem('Remove');
    expect(remove).toBeInTheDocument();

    await user.click(addToList);
    expect(onAddMissing).toHaveBeenCalledWith(customEntry);
  });

  it('renders active recipe with link and readiness percentage', () => {
    withRouter(
      <MealSlotEntry
        entry={recipeEntry}
        isReadOnly={false}
        offlineReason={undefined}
        onAddMissing={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const link = screen.getByRole('link', { name: /Baked Ziti/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/meals/recipes/r1');
    expect(link).toHaveTextContent('85%');
  });

  it('offers "Add missing to list" for active recipe', async () => {
    const user = userEvent.setup();
    const onAddMissing = vi.fn();

    withRouter(
      <MealSlotEntry
        entry={recipeEntry}
        isReadOnly={false}
        offlineReason={undefined}
        onAddMissing={onAddMissing}
        onRemove={vi.fn()}
      />,
    );

    await openMenu(user, 'More actions for Baked Ziti');
    expect(await findMdMenuItem('Add missing to list')).toBeInTheDocument();
  });

  it('renders deleted recipe snapshot in text-secondary with deleted note and omits add to list', async () => {
    const user = userEvent.setup();

    withRouter(
      <MealSlotEntry
        entry={deletedRecipeEntry}
        isReadOnly={false}
        offlineReason={undefined}
        onAddMissing={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByRole('link')).toBeNull();
    const title = screen.getByText('Deleted Pasta Carbonara');
    expect(title).toHaveClass('text-secondary');
    expect(screen.getByText(DELETED_RECIPE_NOTE)).toHaveClass('sr-only');

    await openMenu(user, 'More actions for Deleted Pasta Carbonara');
    expect(queryMdMenuItem(/Add.*to list/)).toBeNull();
    expect(await findMdMenuItem('Remove')).toBeInTheDocument();
  });

  it('hides overflow menu completely in read-only mode', () => {
    withRouter(
      <MealSlotEntry
        entry={customEntry}
        isReadOnly={true}
        offlineReason={undefined}
        onAddMissing={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(queryMdButton(/More actions/)).toBeNull();
  });

  it('disables overflow menu items when offlineReason is provided', async () => {
    const user = userEvent.setup();

    withRouter(
      <MealSlotEntry
        entry={customEntry}
        isReadOnly={false}
        offlineReason="You are offline"
        onAddMissing={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    await openMenu(user, 'More actions for Greek Yogurt & Honey');
    const addToList = await findMdMenuItem(new RegExp(CUSTOM_ITEM_ADD_TO_LIST));
    expect(addToList).toHaveProperty('disabled', true);
    const remove = await findMdMenuItem(/Remove/);
    expect(remove).toHaveProperty('disabled', true);
  });
});
