import { onlineManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NO_PRICE_LABEL, REPRICED_LABEL } from '../../components/lists/ItemPrice.tsx';
import { PENDING_SUBTOTAL_LABEL } from '../../components/lists/PendingMark.tsx';
import {
  ScreenChromeProvider,
  useCurrentScreenChrome,
} from '../../components/shell/screen-chrome.tsx';
import { useWriteQueue } from '../../lib/offline/use-write-queue.ts';
import { OAK_STREET_ID, oakStreetMembers, profileFixture } from '../../test/fixtures.ts';
import {
  PARTY_SUPPLIES_ID,
  THIS_WEEK_ID,
  emptyListFixture,
  pantryFixture,
  partySuppliesDetailFixture,
  partySuppliesFixture,
  thisWeekDetailFixture,
  thisWeekFixture,
  weekendCookoutDetailFixture,
  weekendCookoutFixture,
} from '../../test/list-fixtures.ts';
import {
  createFetchStub,
  problemBody,
  renderScreen,
  type StubHandler,
} from '../../test/harness.tsx';
import { ArchivedListsScreen } from './ArchivedListsScreen.tsx';
import { ALL_BOUGHT_COPY, ARCHIVED_COPY, ListDetailScreen } from './ListDetailScreen.tsx';
import { LISTS_EMPTY_COPY, ListsIndexScreen } from './ListsIndexScreen.tsx';
import { PANTRY_EMPTY_COPY, PANTRY_NO_MATCH_COPY, PantryScreen } from './PantryScreen.tsx';

/** The queue lives in the shell, so a screen under test gets it the same way. */
function WithQueue({ children }: { children: ReactNode }): ReactElement {
  useWriteQueue();
  return <>{children}</>;
}

function baseHandlers(
  extra: Readonly<Record<string, StubHandler>> = {},
): Record<string, StubHandler> {
  return {
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'GET /api/households/:id/members': () => ({ status: 200, body: oakStreetMembers }),
    'GET /api/households/:id/lists': ({ query }) => ({
      status: 200,
      body:
        query.get('archived') === 'true'
          ? [partySuppliesFixture]
          : [thisWeekFixture, weekendCookoutFixture],
    }),
    'GET /api/lists/:id': ({ params }) => ({
      status: 200,
      body: params['id'] === PARTY_SUPPLIES_ID ? partySuppliesDetailFixture : thisWeekDetailFixture,
    }),
    'GET /api/households/:id/pantry': () => ({ status: 200, body: pantryFixture }),
    ...extra,
  };
}

function mount(
  ui: ReactElement,
  handlers: Record<string, StubHandler>,
): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub(handlers);
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(<WithQueue>{ui}</WithQueue>);
  return stub;
}

function index(handlers = baseHandlers(), isArchived = false): ReturnType<typeof createFetchStub> {
  return mount(<ListsIndexScreen householdId={OAK_STREET_ID} isArchived={isArchived} />, handlers);
}

function detail(
  handlers = baseHandlers(),
  listId = THIS_WEEK_ID,
): ReturnType<typeof createFetchStub> {
  return mount(
    <ListDetailScreen householdId={OAK_STREET_ID} listId={listId} userId={profileFixture.id} />,
    handlers,
  );
}

/** Both halves of "offline": the banner reads `navigator`, the queue reads TanStack's manager. */
function setOnline(isOnline: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(isOnline);
  act(() => {
    onlineManager.setOnline(isOnline);
    window.dispatchEvent(new Event(isOnline ? 'online' : 'offline'));
  });
}

beforeEach(() => {
  setOnline(true);
});

afterEach(() => {
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Shopping lists index (Design › Screens › 7)', () => {
  it('loading: announces it with skeletons rather than a spinner', () => {
    index(baseHandlers({ 'GET /api/households/:id/lists': () => new Promise(() => undefined) }));
    expect(screen.getByRole('status')).toHaveTextContent('Loading your lists');
  });

  it('populated: names each list with its counts and last activity', async () => {
    index();
    const row = await screen.findByRole('link', { name: /This Week/ });
    expect(row).toHaveAttribute('href', `/lists/${THIS_WEEK_ID}`);
    expect(row).toHaveTextContent('15 items');
    expect(row).toHaveTextContent('12 outstanding');
  });

  it('empty: names what the screen holds and offers the action', async () => {
    index(baseHandlers({ 'GET /api/households/:id/lists': () => ({ status: 200, body: [] }) }));
    expect(await screen.findByText(LISTS_EMPTY_COPY)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create a list' })).toBeInTheDocument();
  });

  it('error: states what failed and retries', async () => {
    const user = userEvent.setup();
    const stub = index(
      baseHandlers({
        'GET /api/households/:id/lists': () => ({
          status: 500,
          body: problemBody(500, 'Internal Server Error'),
        }),
      }),
    );
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(stub.calls.filter((call) => call.path.includes('/lists')).length).toBeGreaterThan(1);
    });
  });

  it('offline: disables creating a list and says why, beside the control', async () => {
    index();
    await screen.findByRole('link', { name: /This Week/ });
    setOnline(false);
    const create = await screen.findByRole('button', { name: 'New list' });
    expect(create).toHaveAttribute('aria-disabled', 'true');
    const reasonId = create.getAttribute('aria-describedby');
    expect(reasonId).not.toBeNull();
    expect(document.getElementById(reasonId ?? '')).toHaveTextContent('Needs a connection.');
  });

  it('names the item count in the delete confirmation', async () => {
    const user = userEvent.setup();
    index();
    (await screen.findByRole('button', { name: 'More actions for This Week' })).focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(
      await screen.findByText('Delete This Week? Its 15 items are removed permanently.'),
    ).toBeInTheDocument();
  });

  it('offline: disables archive and delete in the menu with the same explanation', async () => {
    const user = userEvent.setup();
    index();
    await screen.findByRole('link', { name: /This Week/ });
    setOnline(false);
    (await screen.findByRole('button', { name: 'More actions for This Week' })).focus();
    await user.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    for (const label of ['Rename', 'Archive', 'Delete']) {
      const item = within(menu).getByRole('menuitem', { name: new RegExp(`^${label}`) });
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).toHaveTextContent('Needs a connection.');
    }
  });

  it('archived: lists them read-only with an unarchive action', async () => {
    const user = userEvent.setup();
    index(baseHandlers(), true);
    expect(await screen.findByRole('link', { name: /Party Supplies/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New list' })).toBeNull();
    (await screen.findByRole('button', { name: 'More actions for Party Supplies' })).focus();
    await user.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Unarchive' })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'Archive' })).toBeNull();
  });
});

function ChromeProbe(): ReactElement {
  const chrome = useCurrentScreenChrome();
  return <p data-testid="chrome">{chrome === undefined ? 'none' : JSON.stringify(chrome)}</p>;
}

describe('ArchivedListsScreen', () => {
  it('names itself, points the back control at Lists, and shows the archived view', async () => {
    mount(
      <ScreenChromeProvider>
        <ChromeProbe />
        <ArchivedListsScreen householdId={OAK_STREET_ID} />
      </ScreenChromeProvider>,
      baseHandlers({
        'GET /api/households/:id/lists': () => ({ status: 200, body: [partySuppliesFixture] }),
      }),
    );
    expect(await screen.findByRole('link', { name: /Party Supplies/ })).toBeInTheDocument();
    const chrome = screen.getByTestId('chrome');
    expect(chrome).toHaveTextContent('Archived lists');
    expect(chrome).toHaveTextContent('/lists');
    expect(chrome).toHaveTextContent('Lists');
    // The archived view is read-only: no create action for it.
    expect(screen.queryByRole('button', { name: 'New list' })).toBeNull();
  });
});

/** Creating and renaming are the same sheet (ListNameSheet.tsx), opened from the index screen. */
describe('Creating and renaming a list', () => {
  it('creates a list, from the sheet, and closes it', async () => {
    const user = userEvent.setup();
    const stub = index(
      baseHandlers({
        'POST /api/households/:id/lists': ({ body }) => ({
          status: 201,
          body: { ...thisWeekDetailFixture, name: (body as { name: string }).name },
        }),
      }),
    );
    await screen.findByRole('link', { name: /This Week/ });
    await user.click(screen.getByRole('button', { name: 'New list' }));
    const dialog = await screen.findByRole('dialog', { name: 'New list' });
    await user.type(within(dialog).getByLabelText('List name'), 'Game Night');
    await user.click(within(dialog).getByRole('button', { name: 'Create list' }));
    await waitFor(() => {
      const post = stub.calls.find((call) => call.method === 'POST');
      expect(post?.body).toEqual({ name: 'Game Night' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('blocks an empty name before it ever asks the server', async () => {
    const user = userEvent.setup();
    const stub = index();
    await screen.findByRole('link', { name: /This Week/ });
    await user.click(screen.getByRole('button', { name: 'New list' }));
    const dialog = await screen.findByRole('dialog', { name: 'New list' });
    await user.click(within(dialog).getByRole('button', { name: 'Create list' }));
    expect(await within(dialog).findByText('Enter a name.')).toBeInTheDocument();
    expect(stub.calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('shows the server error without closing the sheet', async () => {
    const user = userEvent.setup();
    index(
      baseHandlers({
        // 422 is neither in the status table nor >= 500, so the screen's own fallback copy wins.
        'POST /api/households/:id/lists': () => ({
          status: 422,
          body: problemBody(422, 'Unprocessable Entity'),
        }),
      }),
    );
    await screen.findByRole('link', { name: /This Week/ });
    await user.click(screen.getByRole('button', { name: 'New list' }));
    const dialog = await screen.findByRole('dialog', { name: 'New list' });
    await user.type(within(dialog).getByLabelText('List name'), 'Game Night');
    await user.click(within(dialog).getByRole('button', { name: 'Create list' }));
    expect(
      await within(dialog).findByText("Couldn't create the list. Try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renames an existing list, pre-filled with its current name', async () => {
    const user = userEvent.setup();
    const stub = index(
      baseHandlers({
        'PATCH /api/lists/:id': ({ body }) => ({
          status: 200,
          body: { ...thisWeekDetailFixture, name: (body as { name: string }).name },
        }),
      }),
    );
    (await screen.findByRole('button', { name: 'More actions for This Week' })).focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rename This Week' });
    const field = within(dialog).getByLabelText('List name');
    expect(field).toHaveValue('This Week');
    await user.clear(field);
    await user.type(field, 'Weekly Shop');
    await user.click(within(dialog).getByRole('button', { name: 'Save name' }));
    await waitFor(() => {
      const patch = stub.calls.find((call) => call.method === 'PATCH');
      expect(patch?.body).toEqual({ name: 'Weekly Shop' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Shopping list detail (Design › Screens › 8)', () => {
  it('groups items by store with the subtotals the API computed', async () => {
    detail();
    expect(await screen.findByRole('heading', { name: 'Food Lion' })).toBeInTheDocument();
    const foodLion = screen.getByRole('region', { name: 'Food Lion' });
    expect(foodLion).toHaveTextContent('$18.26');
    expect(foodLion).toHaveTextContent('+1 unpriced');

    const cvs = screen.getByRole('region', { name: 'CVS Pharmacy' });
    expect(cvs).toHaveTextContent('$10.78');
    const harrisTeeter = screen.getByRole('region', { name: 'Harris Teeter' });
    expect(harrisTeeter).toHaveTextContent('$7.00');
  });

  it('puts the unassigned group last, under "Anywhere"', async () => {
    detail();
    await screen.findByRole('heading', { name: 'Food Lion' });
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings.at(-1)).toBe('Anywhere');
  });

  it('marks a repriced item with the old sale price struck through beside the new one', async () => {
    detail();
    const row = await screen.findByRole('checkbox', { name: /Broccoli/ });
    const listRow = row.closest('li');
    expect(listRow).toHaveTextContent('$1.99/lb');
    expect(listRow?.querySelector('s')).toHaveTextContent('$1.49');
    expect(within(listRow as HTMLElement).getByText(REPRICED_LABEL)).toBeInTheDocument();
    // Never colour alone: the accessible name carries the repricing too.
    expect(row).toHaveAccessibleName(/repriced from \$1\.49/);
  });

  it('shows "No price" for an item whose price repricing cleared', async () => {
    detail();
    const row = await screen.findByRole('checkbox', { name: /GARNIER/ });
    const listRow = row.closest('li');
    expect(listRow).toHaveTextContent(NO_PRICE_LABEL);
    expect(listRow?.querySelector('s')).toHaveTextContent('$4.49');
  });

  it('badges a conditional price and names who added the item', async () => {
    detail();
    const row = await screen.findByRole('checkbox', { name: /Broccoli/ });
    const listRow = row.closest('li') as HTMLElement;
    expect(within(listRow).getByText('Card or coupon')).toBeInTheDocument();
    expect(listRow).toHaveTextContent('Added by Sam Chen');
  });

  it('shows an in-cart item with the words, not just a colour', async () => {
    detail();
    const row = await screen.findByRole('checkbox', { name: /Ground Beef/i });
    expect(within(row.closest('li') as HTMLElement).getByText('In cart')).toBeInTheDocument();
    expect(row).not.toBeChecked();
  });

  it('collapses bought items into a dimmed "Bought (n)" group', async () => {
    const user = userEvent.setup();
    detail();
    const toggle = await screen.findByRole('button', { name: /Bought \(3\)/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('checkbox', { name: /Shredded cheese/ })).toBeNull();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('checkbox', { name: /Shredded cheese/ })).toBeChecked();
  });

  it('empty: names what the list holds and offers the add action', async () => {
    detail(baseHandlers({ 'GET /api/lists/:id': () => ({ status: 200, body: emptyListFixture }) }));
    expect(
      await screen.findByText('Nothing on this list yet. Add what you need to buy.'),
    ).toBeInTheDocument();
  });

  it('all bought: states it plainly and offers the pantry action', async () => {
    detail(
      baseHandlers({
        'GET /api/lists/:id': () => ({ status: 200, body: weekendCookoutDetailFixture }),
      }),
    );
    expect(await screen.findByText(ALL_BOUGHT_COPY)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add bought items to pantry' })).toBeInTheDocument();
  });

  it('archived: read-only, with an unarchive action and no add', async () => {
    detail(baseHandlers(), PARTY_SUPPLIES_ID);
    expect(await screen.findByText(ARCHIVED_COPY)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unarchive' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add an item' })).toBeNull();
  });

  it('offline: keeps the add action but disables deleting an item', async () => {
    const user = userEvent.setup();
    detail();
    await screen.findByRole('heading', { name: 'Food Lion' });
    setOnline(false);
    // Add, check, uncheck, and edit queue; everything else is disabled with an explanation.
    expect(await screen.findByRole('button', { name: 'Add an item' })).not.toHaveAttribute(
      'aria-disabled',
    );
    (await screen.findByRole('button', { name: 'More actions for Apples' })).focus();
    await user.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /^Edit/ })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
    const remove = within(menu).getByRole('menuitem', { name: /^Delete/ });
    expect(remove).toHaveAttribute('aria-disabled', 'true');
    expect(remove).toHaveTextContent('Needs a connection.');
  });

  it('marks a group whose subtotal a queued write has moved', async () => {
    const user = userEvent.setup();
    detail();
    await screen.findByRole('heading', { name: 'Food Lion' });
    setOnline(false);
    await user.click(await screen.findByRole('checkbox', { name: /Broccoli/ }));
    const foodLion = screen.getByRole('region', { name: 'Food Lion' });
    // The subtotal is the server's, so it is marked pending rather than recomputed.
    expect(within(foodLion).getByText(PENDING_SUBTOTAL_LABEL)).toBeInTheDocument();
    expect(foodLion).toHaveTextContent('$18.26');
  });
});

describe('Pantry (Design › Screens › 9)', () => {
  function pantry(handlers = baseHandlers()): ReturnType<typeof createFetchStub> {
    return mount(<PantryScreen householdId={OAK_STREET_ID} />, handlers);
  }

  it('populated: names each item with its quantity note', async () => {
    pantry();
    expect(await screen.findByText('Olive oil')).toBeInTheDocument();
    expect(screen.getByText('half a bottle')).toBeInTheDocument();
  });

  it('empty: names what the pantry holds and why', async () => {
    pantry(baseHandlers({ 'GET /api/households/:id/pantry': () => ({ status: 200, body: [] }) }));
    expect(await screen.findByText(PANTRY_EMPTY_COPY)).toBeInTheDocument();
  });

  it('filtered empty: different copy from first run, with a clear action', async () => {
    const user = userEvent.setup();
    pantry();
    await screen.findByText('Olive oil');
    await user.type(screen.getByLabelText('Search the pantry'), 'zzz');
    expect(await screen.findByText(PANTRY_NO_MATCH_COPY)).toBeInTheDocument();
    expect(screen.queryByText(PANTRY_EMPTY_COPY)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(await screen.findByText('Olive oil')).toBeInTheDocument();
  });

  it('error: states what failed and retries', async () => {
    pantry(
      baseHandlers({
        'GET /api/households/:id/pantry': () => ({
          status: 500,
          body: problemBody(500, 'Internal Server Error'),
        }),
      }),
    );
    expect(await screen.findByText("Couldn't load the pantry. Try again.")).toBeInTheDocument();
  });

  it('offline: every pantry write is disabled, since none of them queue', async () => {
    pantry();
    await screen.findByText('Olive oil');
    setOnline(false);
    const add = await screen.findByRole('button', { name: 'Add an item' });
    expect(add).toHaveAttribute('aria-disabled', 'true');
  });

  it('adds an item through the sheet', async () => {
    const user = userEvent.setup();
    const stub = pantry(
      baseHandlers({
        'POST /api/households/:id/pantry': ({ body }) => ({
          status: 201,
          body: { ...pantryFixture[0], itemName: (body as { itemName: string }).itemName },
        }),
      }),
    );
    await screen.findByText('Olive oil');
    await user.click(screen.getByRole('button', { name: 'Add an item' }));
    await user.type(await screen.findByLabelText('Item'), 'Rice');
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await waitFor(() => {
      expect(
        stub.calls.some((call) => call.method === 'POST' && call.path.endsWith('/pantry')),
      ).toBe(true);
    });
  });
});
