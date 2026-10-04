import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
  Route,
  Routes,
  useLocation,
} from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../App.tsx';
import { routes } from '../../routes.tsx';
import { oakStreetFixture, profileFixture } from '../../test/fixtures.ts';
import { createAuthStub, createFetchStub, testQueryClient } from '../../test/harness.tsx';
import { useSection } from '../../lib/section-context.tsx';
import { PillarScreen } from '../../screens/PillarScreen.tsx';
import { HouseholdSwitcher, type HouseholdSummary } from './HouseholdSwitcher.tsx';
import { OFFLINE_MESSAGE, OfflineBanner } from './OfflineBanner.tsx';
import { titleForPath } from './AppShell.tsx';
import { UpdateAvailable } from './UpdatePrompt.tsx';

// Seed Data › Households: Alex belongs to Oak Street (active) and Rivera Family.
const HOUSEHOLDS: HouseholdSummary[] = [
  { id: 'oak', name: 'Oak Street', memberCount: 3 },
  { id: 'rivera', name: 'Rivera Family', memberCount: 2 },
];

/**
 * The shell sits behind the session guard, so its tests need a signed-in session and a profile.
 * Both are stubs: a component test never reaches the network.
 */
function renderApp(
  path: string,
  extra: Readonly<Record<string, Parameters<typeof createFetchStub>[0][string]>> = {},
): ReturnType<typeof createMemoryRouter> {
  const stub = createFetchStub({
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    ...extra,
  });
  vi.stubGlobal('fetch', stub.fetch);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders auth={createAuthStub()} queryClient={testQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

function setOnline(isOnline: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(isOnline);
  act(() => {
    window.dispatchEvent(new Event(isOnline ? 'online' : 'offline'));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('app shell', () => {
  it('has a skip link, banner, main, and a labelled main navigation', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'This Week' })).toBeInTheDocument();
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveAttribute('href', '#main');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(document.title).toBe('This Week · Hearth');
  });

  it('shows the five tabs in order with the active one marked aria-current', async () => {
    renderApp('/');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Dashboard',
      'Lists',
      'Meals',
      'Bills',
      'Chores',
    ]);
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Lists' })).not.toHaveAttribute('aria-current');
  });

  it('moves through the tab bar by keyboard and opens a tab with Enter', async () => {
    const router = renderApp('/');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    within(nav).getByRole('link', { name: 'Dashboard' }).focus();
    await userEvent.tab();
    expect(within(nav).getByRole('link', { name: 'Lists' })).toHaveFocus();
    await userEvent.tab();
    expect(within(nav).getByRole('link', { name: 'Meals' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    // The Meals module is a lazy chunk, so its first load can outlast the default find timeout.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Meals' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/meals');
    expect(within(nav).getByRole('link', { name: 'Meals' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  }, 20_000);

  it.each([
    ['/lists', 'Lists sections'],
    ['/meals', 'Meals sections'],
    ['/chores', 'Chores sections'],
    ['/bills', 'Bills sections'],
  ])(
    'opens %s with its sub-tabs instead of the coming-soon state',
    async (path, groupName) => {
      renderApp(path, {
        'GET /api/households/:id/bills': () => ({ status: 200, body: [] }),
        'GET /api/households/:id/chores': () => ({ status: 200, body: [] }),
        'GET /api/households/:id/errands': () => ({ status: 200, body: [] }),
        'GET /api/households/:id': () => ({ status: 200, body: oakStreetFixture }),
      });
      expect(
        await screen.findByRole('radiogroup', { name: groupName }, { timeout: 10_000 }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Coming soon' })).toBeNull();
    },
    // The first load of a lazy pillar module can take several seconds on a loaded machine.
    20_000,
  );

  it('sends unknown paths to the dashboard', async () => {
    const router = renderApp('/nowhere');
    expect(await screen.findByRole('heading', { level: 1, name: 'This Week' })).toBeInTheDocument();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });
});

describe('titleForPath', () => {
  it.each([
    ['/', 'This Week'],
    ['/settings', 'Settings'],
    ['/lists', 'Lists'],
    // A shipped pillar names its sub-tab; an unshipped one shows only its tab label.
    ['/lists/pantry', 'Pantry'],
    ['/meals/suggestions', 'Suggestions'],
    // A shipped pillar names its sub-tab, so a deep link into Subscriptions shows that, not Bills.
    ['/bills/subscriptions', 'Subscriptions'],
  ])('%s → %s', (path, title) => {
    expect(titleForPath(path)).toBe(title);
  });
});

describe('section context', () => {
  function SectionProbe(): ReactElement {
    return <output>{useSection()}</output>;
  }

  it('comes from the route for the shell', async () => {
    renderApp('/bills', { 'GET /api/households/:id/bills': () => ({ status: 200, body: [] }) });
    await screen.findByRole('radiogroup', { name: 'Bills sections' }, { timeout: 5000 });
    expect(screen.getByRole('main').closest('[data-section]')).toHaveAttribute(
      'data-section',
      'bills',
    );
  });

  it('defaults to the dashboard outside any provider', () => {
    render(<SectionProbe />);
    expect(screen.getByRole('status')).toHaveTextContent('dashboard');
  });
});

describe('sub-tabs once a pillar ships', () => {
  const released = new Set(['bills'] as const);

  function renderBills(path: string): void {
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/bills/*"
            element={
              <PillarScreen pillar="bills" releasedPillars={released}>
                <LocationProbe />
              </PillarScreen>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
  }

  function LocationProbe(): ReactElement {
    return <p data-testid="location">{useLocation().pathname}</p>;
  }

  it('selects the root sub-tab at the tab root and the matching one deeper in', () => {
    renderBills('/bills/subscriptions');
    const group = screen.getByRole('radiogroup', { name: 'Bills sections' });
    expect(within(group).getByRole('radio', { name: 'Subscriptions' })).toBeChecked();
    expect(within(group).getByRole('radio', { name: 'Bills' })).not.toBeChecked();
  });

  it('moves between sub-tabs with arrow keys and navigates on Enter', async () => {
    renderBills('/bills');
    const group = screen.getByRole('radiogroup', { name: 'Bills sections' });
    await userEvent.tab();
    expect(within(group).getByRole('radio', { name: 'Bills' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    const subscriptions = within(group).getByRole('radio', { name: 'Subscriptions' });
    expect(subscriptions).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(subscriptions).toBeChecked();
    expect(screen.getByTestId('location')).toHaveTextContent('/bills/subscriptions');
  });

  it('keeps an unshipped pillar on coming soon even with the released set supplied', () => {
    render(
      <MemoryRouter initialEntries={['/chores']}>
        <PillarScreen pillar="chores" releasedPillars={released} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Coming soon' })).toBeInTheDocument();
  });
});

describe('OfflineBanner', () => {
  it('appears on the offline event, is announced as status, and clears on online', () => {
    render(<OfflineBanner />);
    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();
    setOnline(false);
    expect(status).toHaveTextContent(OFFLINE_MESSAGE);
    setOnline(true);
    expect(status).toBeEmptyDOMElement();
  });

  it('renders in the shell below the top bar when the app starts offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderApp('/');
    const banner = await screen.findByText(OFFLINE_MESSAGE);
    expect(within(screen.getByRole('banner')).getByText(OFFLINE_MESSAGE)).toBe(banner);
  });
});

describe('UpdateAvailable', () => {
  it('stays hidden until an update waits, then reloads only when asked', async () => {
    const onUpdate = vi.fn();
    const onDismiss = vi.fn();
    const { rerender } = render(
      <UpdateAvailable isVisible={false} onUpdate={onUpdate} onDismiss={onDismiss} />,
    );
    expect(screen.queryByText('Update available.')).toBeNull();
    rerender(<UpdateAvailable isVisible onUpdate={onUpdate} onDismiss={onDismiss} />);
    expect(screen.getByText('Update available.')).toBeVisible();
    expect(onUpdate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onUpdate).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss update notice' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe('HouseholdSwitcher', () => {
  it('shows a loading state until memberships arrive', () => {
    render(
      <HouseholdSwitcher
        households={undefined}
        activeHouseholdId={undefined}
        onSelect={vi.fn()}
        onJoinOrCreate={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading households');
  });

  it('names the active household and lists every membership with the active one marked', async () => {
    const onSelect = vi.fn();
    render(
      <HouseholdSwitcher
        households={HOUSEHOLDS}
        activeHouseholdId="oak"
        onSelect={onSelect}
        onJoinOrCreate={vi.fn()}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Oak Street, switch household' });
    await userEvent.click(trigger);
    const sheet = await screen.findByRole('dialog', { name: 'Households' });
    const oak = within(sheet).getByRole('button', { name: /Oak Street/ });
    expect(oak).toHaveAttribute('aria-current', 'true');
    expect(oak).toHaveTextContent('3 members');
    expect(oak).toHaveTextContent('Current');
    const rivera = within(sheet).getByRole('button', { name: /Rivera Family/ });
    expect(rivera).not.toHaveAttribute('aria-current');
    await userEvent.click(rivera);
    expect(onSelect).toHaveBeenCalledWith('rivera');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('opens with a single membership, since it is also the way to join or create', async () => {
    const onJoinOrCreate = vi.fn();
    render(
      <HouseholdSwitcher
        households={[{ id: 'empty', name: "Casey's Empty House", memberCount: 1 }]}
        activeHouseholdId="empty"
        onSelect={vi.fn()}
        onJoinOrCreate={onJoinOrCreate}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Casey's Empty House/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Households' });
    expect(within(sheet).getByText('1 member')).toBeInTheDocument();
    await userEvent.click(
      within(sheet).getByRole('button', { name: 'Join or create a household' }),
    );
    expect(onJoinOrCreate).toHaveBeenCalledOnce();
  });

  it('does nothing but close when the active household is chosen again', async () => {
    const onSelect = vi.fn();
    render(
      <HouseholdSwitcher
        households={HOUSEHOLDS}
        activeHouseholdId="oak"
        onSelect={onSelect}
        onJoinOrCreate={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /switch household/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Households' });
    await userEvent.click(within(sheet).getByRole('button', { name: /Oak Street/ }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
