import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { MealPlanEntry } from '@hestia/shared';
import {
  blankIngredient,
  IngredientEditor,
  ingredientRowError,
  toIngredientInput,
  type EditableIngredient,
} from './IngredientEditor.tsx';
import { MealSlotEntry } from './MealSlotEntry.tsx';
import { PlannerDay } from './PlannerDay.tsx';
import { breakdownLine, readinessSentence } from './meal-copy.ts';
import { RecipeCard } from './RecipeCard.tsx';
import { sortRecipes, sortSuggestions } from './recipe-sort.ts';

function withRouter(ui: ReactElement): void {
  render(<MemoryRouter>{ui}</MemoryRouter>);
}

function ControlledEditor({ initial }: { initial: EditableIngredient[] }): ReactElement {
  const [ingredients, setIngredients] = useState(initial);
  return (
    <IngredientEditor ingredients={ingredients} onChange={setIngredients} showErrors={false} />
  );
}

describe('meal-copy', () => {
  it('states readiness as a sentence, not just a number (Accessibility)', () => {
    expect(readinessSentence(4, 5)).toBe('4 of 5 ingredients ready');
  });

  it('names every bucket in the breakdown line, even at zero', () => {
    expect(breakdownLine(2, 2, 1)).toBe('4 of 5 ready — 2 on sale, 2 in pantry, 1 to buy');
    expect(breakdownLine(0, 0, 6)).toBe('0 of 6 ready — 0 on sale, 0 in pantry, 6 to buy');
  });
});

describe('RecipeCard', () => {
  it('shows the percentage, the breakdown line, and servings; the ring is decorative', () => {
    withRouter(
      <RecipeCard
        recipeId="r1"
        title="Baked Ziti"
        readinessPercent={71}
        onSaleCount={1}
        inPantryCount={4}
        toBuyCount={2}
        servings={6}
      />,
    );
    const link = screen.getByRole('link', { name: /Baked Ziti/ });
    expect(link).toHaveTextContent('71%');
    expect(link).toHaveTextContent('5 of 7 ready — 1 on sale, 4 in pantry, 2 to buy');
    expect(link).toHaveTextContent('6 servings');
    expect(link).toHaveAttribute('href', '/meals/recipes/r1');
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('omits servings when the caller has none (suggestions carry no servings)', () => {
    withRouter(
      <RecipeCard
        recipeId="r2"
        title="Tuna Poke Bowl"
        readinessPercent={0}
        onSaleCount={0}
        inPantryCount={0}
        toBuyCount={6}
      />,
    );
    expect(screen.queryByText(/serving/)).toBeNull();
  });
});

describe('IngredientEditor', () => {
  it('flags a blank item name only once a save is attempted', () => {
    const row = blankIngredient();
    expect(ingredientRowError(row)).toBe('Enter an ingredient.');
    render(<IngredientEditor ingredients={[row]} onChange={vi.fn()} showErrors={false} />);
    expect(screen.queryByText('Enter an ingredient.')).toBeNull();
  });

  it('shows the row error once showErrors is true', () => {
    render(<IngredientEditor ingredients={[blankIngredient()]} onChange={vi.fn()} showErrors />);
    expect(screen.getByText('Enter an ingredient.')).toBeInTheDocument();
  });

  it('adds and removes rows', async () => {
    const user = userEvent.setup();
    render(<ControlledEditor initial={[]} />);
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }));
    expect(screen.getByLabelText('Item')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove ingredient 1' }));
    expect(screen.queryByLabelText('Item')).toBeNull();
  });

  it('converts a row to the shared IngredientInput shape, dropping an invalid quantity', () => {
    const row = {
      key: 'k',
      rawText: '2 cups milk',
      itemName: 'milk',
      quantity: 'not-a-number',
      unit: 'cup',
    };
    expect(toIngredientInput(row)).toEqual({
      itemName: 'milk',
      quantity: null,
      unit: 'cup',
      rawText: '2 cups milk',
    });
  });
});

describe('MealSlotEntry and PlannerDay', () => {
  const placed: MealPlanEntry = {
    id: 'e1',
    householdId: 'h1',
    recipeId: 'r1',
    recipeTitle: 'Baked Ziti',
    customTitle: null,
    readinessPercent: 71,
    plannedDate: '2026-09-30',
    mealType: 'dinner',
    addedBy: 'u1',
    createdAt: '2026-09-20T12:00:00.000Z',
  };

  const deleted: MealPlanEntry = {
    id: 'e2',
    householdId: 'h1',
    recipeId: null,
    recipeTitle: 'Mushroom Stroganoff',
    customTitle: null,
    readinessPercent: null,
    plannedDate: '2026-09-22',
    mealType: 'dinner',
    addedBy: 'u1',
    createdAt: '2026-09-10T12:00:00.000Z',
  };

  it('a placed meal links to its recipe and shows its readiness', () => {
    withRouter(
      <MealSlotEntry
        entry={placed}
        isReadOnly={false}
        offlineReason={undefined}
        onAddMissing={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    const link = screen.getByRole('link', { name: /Baked Ziti/ });
    expect(link).toHaveTextContent('71%');
    expect(link).toHaveAttribute('href', '/meals/recipes/r1');
  });

  it("a deleted recipe's entry shows the snapshot title in text-secondary, no readiness, no link", () => {
    withRouter(
      <MealSlotEntry
        entry={deleted}
        isReadOnly={false}
        offlineReason={undefined}
        onAddMissing={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.queryByRole('link')).toBeNull();
    const title = screen.getByText('Mushroom Stroganoff');
    expect(title).toHaveClass('text-secondary');
    expect(screen.queryByText('71%')).toBeNull();
  });

  it("never offers 'Add missing to list' on a deleted recipe's entry (it would 404)", async () => {
    const user = userEvent.setup();
    withRouter(
      <MealSlotEntry
        entry={deleted}
        isReadOnly={false}
        offlineReason={undefined}
        onAddMissing={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    (await screen.findByRole('button', { name: /More actions/ })).focus();
    await user.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: 'Add missing to list' })).toBeNull();
    expect(within(menu).getByRole('menuitem', { name: 'Remove' })).toBeInTheDocument();
  });

  it('a past week hides the overflow menu and the add affordance entirely', () => {
    withRouter(
      <PlannerDay
        date="2026-09-22"
        label="Tue 09/22"
        entries={[deleted]}
        isReadOnly
        offlineReason={undefined}
        onAdd={vi.fn()}
        onAddMissing={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /More actions/ })).toBeNull();
    expect(screen.queryByText(/Add to/)).toBeNull();
  });

  it('lists each of the three slots with an add affordance when not read-only', () => {
    withRouter(
      <PlannerDay
        date="2026-09-30"
        label="Wed 09/30"
        entries={[placed]}
        isReadOnly={false}
        offlineReason={undefined}
        onAdd={vi.fn()}
        onAddMissing={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText('Breakfast')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText('Dinner')).toBeInTheDocument();
    expect(screen.getByText('Add to dinner')).toBeInTheDocument();
  });
});

describe('sorting', () => {
  it('ranks suggestions by readiness descending, ties by title', () => {
    const sorted = sortSuggestions([
      {
        recipeId: 'b',
        title: 'Beta',
        readinessPercent: 50,
        onSaleCount: 0,
        inPantryCount: 0,
        toBuyCount: 0,
      },
      {
        recipeId: 'a',
        title: 'Alpha',
        readinessPercent: 50,
        onSaleCount: 0,
        inPantryCount: 0,
        toBuyCount: 0,
      },
      {
        recipeId: 'c',
        title: 'Gamma',
        readinessPercent: 90,
        onSaleCount: 0,
        inPantryCount: 0,
        toBuyCount: 0,
      },
    ]);
    expect(sorted.map((s) => s.recipeId)).toEqual(['c', 'a', 'b']);
  });

  it('sorts the library by recent, title, or readiness', () => {
    const base = {
      id: '',
      householdId: '',
      sourceUrl: null,
      instructions: null,
      servings: null,
      createdBy: '',
    };
    const rows = [
      { ...base, id: '1', title: 'B', createdAt: '2026-09-10T00:00:00.000Z', readinessPercent: 40 },
      { ...base, id: '2', title: 'A', createdAt: '2026-09-20T00:00:00.000Z', readinessPercent: 90 },
    ];
    expect(sortRecipes(rows, 'recent').map((r) => r.id)).toEqual(['2', '1']);
    expect(sortRecipes(rows, 'title').map((r) => r.id)).toEqual(['2', '1']);
    expect(sortRecipes(rows, 'readiness').map((r) => r.id)).toEqual(['2', '1']);
  });
});
