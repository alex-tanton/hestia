import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { oakStreetFixture, profileFixture } from '../../test/fixtures.ts';
import { createFetchStub, renderApp } from '../../test/harness.tsx';
import { findMdButton, getMdButton } from '../../test/md-queries.ts';
import { PillarScreen } from '../../screens/PillarScreen.tsx';
import { HouseholdSwitcher, type HouseholdSummary } from './HouseholdSwitcher.tsx';
import { OFFLINE_MESSAGE, OfflineBanner } from './OfflineBanner.tsx';
import { titleForPath } from './AppShell.tsx';
import { UpdateAvailable } from './UpdatePrompt.tsx';

// Seed data: Alex belongs to Oak Street (active) and Rivera Family.
const HOUSEHOLDS: HouseholdSummary[] = [
  { id: 'oak', name: 'Oak Street', memberCount: 3 },
  { id: 'rivera', name: 'Rivera Family', memberCount: 2 },
];

/**
 * The shell sits behind the session guard, so its tests need a signed-in session and a profile.
 * Both are stubs: a component test never reaches the network. Builds on the shared harness's
 * `renderApp`, which already mounts the real route tree and providers.
 */
function openPath(
  path: string,
  extra: Readonly<Record<string, Parameters<typeof createFetchStub>[0][string]>> = {},
): ReturnType<typeof renderApp> {
  const stub = createFetchStub({
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    ...extra,
  });
  vi.stubGlobal('fetch', stub.fetch);
  return renderApp({ initialEntries: [path] });
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
    openPath('/');
    const headings = await screen.findAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('This Week');
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveAttribute('href', '#main');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    const navs = screen.getAllByRole('navigation', { name: 'Main' });
    expect(navs).toHaveLength(2);
    const settingsLinks = screen.getAllByRole('link', { name: 'Settings' });
    expect(settingsLinks).toHaveLength(2);
    expect(settingsLinks.some((link) => link.closest('nav') !== null)).toBe(true);
    expect(settingsLinks.some((link) => link.closest('nav') === null)).toBe(true);
    expect(document.title).toBe('This Week · Hestia');
  });

  it('shows the five tabs in order with the active one marked aria-current', async () => {
    openPath('/');
    const [navBar, navRail] = await screen.findAllByRole('navigation', { name: 'Main' });
    if (!navBar || !navRail) throw new Error('Missing navigation landmarks');
    const barLinks = within(navBar).getAllByRole('link');
    expect(barLinks.map((link) => link.textContent)).toEqual([
      'Dashboard',
      'Lists',
      'Meals',
      'Bills',
      'Chores',
    ]);
    expect(within(navBar).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(navBar).getByRole('link', { name: 'Lists' })).not.toHaveAttribute('aria-current');

    const railLinks = within(navRail).getAllByRole('link');
    expect(railLinks.map((link) => link.textContent)).toEqual([
      'Dashboard',
      'Lists',
      'Meals',
      'Bills',
      'Chores',
      'Settings',
    ]);
    expect(within(navRail).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('moves through the tab bar by keyboard and opens a tab with Enter', async () => {
    openPath('/');
    const [navBar] = await screen.findAllByRole('navigation', { name: 'Main' });
    if (!navBar) throw new Error('Missing navigation bar');
    within(navBar).getByRole('link', { name: 'Dashboard' }).focus();
    await userEvent.tab();
    expect(within(navBar).getByRole('link', { name: 'Lists' })).toHaveFocus();
    await userEvent.tab();
    expect(within(navBar).getByRole('link', { name: 'Meals' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    // The Meals module is a lazy chunk, so its first load can outlast the default find timeout.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Meals' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe('Meals · Hestia');
    });
    expect(within(navBar).getByRole('link', { name: 'Meals' })).toHaveAttribute(
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
      openPath(path, {
        'GET /api/households/:id/bills': () => ({ status: 200, body: [] }),
        'GET /api/households/:id/chores': () => ({ status: 200, body: [] }),
        'GET /api/households/:id/errands': () => ({ status: 200, body: [] }),
        'GET /api/households/:id': () => ({ status: 200, body: oakStreetFixture }),
      });
      expect(
        await screen.findByRole('navigation', { name: groupName }, { timeout: 10_000 }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Coming soon' })).toBeNull();
    },
    // The first load of a lazy pillar module can take several seconds on a loaded machine.
    20_000,
  );

  it('sends unknown paths to the dashboard', async () => {
    openPath('/nowhere');
    expect(await screen.findByRole('heading', { level: 1, name: 'This Week' })).toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe('This Week · Hestia');
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
    ['/meals/recipes', 'Recipes'],
    // A shipped pillar names its sub-tab, so a deep link into Subscriptions shows that, not Bills.
    ['/bills/subscriptions', 'Subscriptions'],
  ])('%s → %s', (path, title) => {
    expect(titleForPath(path)).toBe(title);
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

  it('selects the active sub-tab inside MD3 tabs', () => {
    renderBills('/bills/subscriptions');
    const nav = screen.getByRole('navigation', { name: 'Bills sections' });
    const tabs = within(nav).getByRole('tablist');
    expect(tabs).toBeInTheDocument();
    const activeTab = within(tabs).getByRole('tab', { name: 'Subscriptions', selected: true });
    expect(activeTab).toBeInTheDocument();
  });

  it('resets window scroll to (0, 0) and navigates when switching sub-tabs', async () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo');
    renderBills('/bills');
    const nav = screen.getByRole('navigation', { name: 'Bills sections' });
    const tabs = within(nav).getByRole('tablist');
    expect(tabs).toBeInTheDocument();
    const mdTabs = nav.querySelector('md-tabs');
    expect(mdTabs).not.toBeNull();
    if (!mdTabs) return;
    act(() => {
      mdTabs.dispatchEvent(
        new CustomEvent('change', { bubbles: true, detail: { activeTabIndex: 1 } }),
      );
    });
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/bills/subscriptions');
    });
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
    openPath('/');
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
    await userEvent.click(getMdButton('Reload'));
    expect(onUpdate).toHaveBeenCalledOnce();
    await userEvent.click(await findMdButton('Dismiss update notice'));
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
    expect(within(sheet).getByText('No other households')).toBeInTheDocument();
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
