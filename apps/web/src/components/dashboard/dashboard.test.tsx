import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardScreen, type DashboardScreenProps } from '../../screens/DashboardScreen.tsx';
import type { PillarId } from '../../lib/sections.ts';
import { DashboardCard, type DashboardCardState } from './DashboardCard.tsx';
import { DASHBOARD_EMPTY_COPY } from './DashboardCards.tsx';

const ALL_RELEASED: ReadonlySet<PillarId> = new Set(['lists', 'meals', 'bills', 'chores']);

function renderDashboard(props: DashboardScreenProps): void {
  render(
    <MemoryRouter>
      <DashboardScreen {...props} />
    </MemoryRouter>,
  );
}

function card(name: string): HTMLElement {
  return screen.getByRole('region', { name: new RegExp(`^${name}`) });
}

function renderCard(state: DashboardCardState): void {
  render(
    <MemoryRouter>
      <DashboardCard pillar="bills" title="Bills" state={state} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('This Week dashboard', () => {
  it('stacks Bills, Shopping, Meals, Chores in that order', () => {
    renderDashboard({});
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Bills', 'Shopping', 'Meals', 'Chores']);
  });

  it('shows muted, untappable placeholders in each section color while nothing has shipped', () => {
    renderDashboard({});
    for (const [name, section] of [
      ['Bills', 'bills'],
      ['Shopping', 'lists'],
      ['Meals', 'meals'],
      ['Chores', 'chores'],
    ] as const) {
      const region = card(name);
      expect(within(region).getByText('Coming soon')).toBeInTheDocument();
      expect(within(region).queryByRole('link')).toBeNull();
      expect(region.closest('[data-section]')).toHaveAttribute('data-section', section);
    }
  });

  it('keeps a placeholder for an unshipped pillar even when data is supplied', () => {
    renderDashboard({
      releasedPillars: new Set(['lists']),
      shopping: { status: 'empty', message: DASHBOARD_EMPTY_COPY.lists },
      bills: { status: 'empty', message: DASHBOARD_EMPTY_COPY.bills },
    });
    expect(within(card('Shopping')).getByText('Nothing left to buy')).toBeInTheDocument();
    expect(within(card('Bills')).getByText('Coming soon')).toBeInTheDocument();
  });

  it('renders each card independently: one failing card leaves the others intact', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = {
      status: 'populated',
      total: 1,
      get items(): never {
        throw new Error('bad bills payload');
      },
    } as unknown as DashboardCardState;

    renderDashboard({
      releasedPillars: ALL_RELEASED,
      bills: broken,
      shopping: {
        status: 'populated',
        items: [{ id: 'l1', label: 'This Week', detail: '12 left' }],
        total: 1,
      },
      meals: { status: 'loading' },
      chores: { status: 'error', message: "Couldn't load chores.", onRetry: vi.fn() },
    });

    expect(
      within(card('Bills')).getByText(/Something went wrong loading bills. Try again, or reload./),
    ).toBeInTheDocument();
    expect(within(card('Shopping')).getByText('This Week')).toBeInTheDocument();
    expect(within(card('Meals')).getByRole('status')).toHaveTextContent('Loading meals');
    expect(within(card('Chores')).getByText("Couldn't load chores.")).toBeInTheDocument();
  });
});

describe('DashboardCard states', () => {
  it('populated: shows up to three items, a remainder count, and links to its section', () => {
    renderCard({
      status: 'populated',
      total: 5,
      items: [
        { id: 'b1', label: 'Duke Energy', detail: '$142.30', isOverdue: true },
        { id: 'b2', label: 'Internet', detail: '$74.99' },
        { id: 'b3', label: 'Water', detail: '$48.20' },
        { id: 'b4', label: 'Rent', detail: '$1,850.00' },
      ],
    });
    const region = card('Bills');
    expect(within(region).getAllByRole('listitem')).toHaveLength(3);
    expect(within(region).queryByText('Rent')).toBeNull();
    expect(within(region).getByText('+2 more')).toBeInTheDocument();
    expect(within(region).getByRole('link', { name: 'Bills' })).toHaveAttribute('href', '/bills');
  });

  it('marks overdue with the word, not just red', () => {
    renderCard({
      status: 'populated',
      total: 1,
      items: [{ id: 'b1', label: 'Duke Energy', detail: '$142.30', isOverdue: true }],
    });
    expect(within(card('Bills')).getByRole('listitem')).toHaveTextContent('Duke Energy · Overdue');
  });

  it('empty: keeps its place with one line', () => {
    renderCard({ status: 'empty', message: DASHBOARD_EMPTY_COPY.bills });
    expect(within(card('Bills')).getByText('Nothing due this week')).toBeInTheDocument();
  });

  it('loading: announces loading with skeleton rows', () => {
    renderCard({ status: 'loading' });
    expect(within(card('Bills')).getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('error: states what failed and retries', async () => {
    const onRetry = vi.fn();
    renderCard({ status: 'error', message: "Couldn't load bills.", onRetry });
    await userEvent.click(within(card('Bills')).getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('placeholder: muted with no link', () => {
    renderCard({ status: 'placeholder' });
    expect(within(card('Bills')).queryByRole('link')).toBeNull();
  });
});

describe('defaults', () => {
  it('shows a released card as loading until its state arrives', () => {
    function Only(): ReactElement {
      return <DashboardScreen releasedPillars={new Set(['chores'])} />;
    }
    render(
      <MemoryRouter>
        <Only />
      </MemoryRouter>,
    );
    expect(within(card('Chores')).getByRole('status')).toHaveTextContent('Loading chores');
  });
});
