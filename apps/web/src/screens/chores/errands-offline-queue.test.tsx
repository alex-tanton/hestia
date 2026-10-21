import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFLINE_ACTION_REASON } from '../../components/chores/chore-copy.ts';
import { PENDING_CLASSES, PENDING_ROW_LABEL } from '../../components/lists/PendingMark.tsx';
import { queryKeys } from '../../lib/api/keys.ts';
import { setOnline } from '../../test/browser.ts';
import {
  RETURN_PACKAGE_ID,
  errandListFixture,
  returnPackageFixture,
} from '../../test/chore-fixtures.ts';
import {
  ALEX_ID,
  OAK_STREET_ID,
  oakStreetFixture,
  oakStreetMembers,
  profileFixture,
} from '../../test/fixtures.ts';
import { createFetchStub, renderScreen, type StubHandler, WithQueue } from '../../test/harness.tsx';
import { ErrandsListScreen } from './ErrandsListScreen.tsx';

/*
 * Marking an errand done as a queued write (Requirements, "Offline behavior"). Reopening stays
 * online-only, and the errand's done time is the moment it was marked.
 */

configure({ asyncUtilTimeout: 5000 });

const DONE_AT = '2026-09-27T16:00:00.000Z';
const DONE_CHECKBOX = `Mark ${returnPackageFixture.name} as done`;

function mountErrands(extra: Readonly<Record<string, StubHandler>> = {}): {
  stub: ReturnType<typeof createFetchStub>;
  queryClient: QueryClient;
} {
  const stub = createFetchStub({
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'GET /api/households/:id/members': () => ({ status: 200, body: oakStreetMembers }),
    'GET /api/households/:id': () => ({ status: 200, body: oakStreetFixture }),
    'GET /api/households/:id/errands': () => ({ status: 200, body: errandListFixture }),
    'PATCH /api/errands/:id': () => ({
      status: 200,
      body: { ...returnPackageFixture, status: 'done', completedAt: DONE_AT, completedBy: ALEX_ID },
    }),
    ...extra,
  });
  vi.stubGlobal('fetch', stub.fetch);
  const { queryClient } = renderScreen(
    <WithQueue>
      <ErrandsListScreen householdId={OAK_STREET_ID} />
    </WithQueue>,
  );
  return { stub, queryClient };
}

async function loadedRow(queryClient: QueryClient): Promise<HTMLElement> {
  const checkbox = await screen.findByRole('checkbox', { name: DONE_CHECKBOX });
  await waitFor(() => {
    expect(queryClient.getQueryData(queryKeys.household(OAK_STREET_ID))).toBeDefined();
  });
  const row = checkbox.closest('li');
  if (row === null) throw new Error('the row is always there');
  return row;
}

function patchCalls(stub: ReturnType<typeof createFetchStub>): typeof stub.calls {
  return stub.calls.filter((call) => call.method === 'PATCH');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(DONE_AT));
  setOnline(true);
});

afterEach(() => {
  vi.useRealTimers();
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('an errand marked done offline', () => {
  it('is queued: the row is marked pending and the done box already shows', async () => {
    const user = userEvent.setup();
    const { stub, queryClient } = mountErrands();
    const row = await loadedRow(queryClient);

    setOnline(false);
    await user.click(screen.getByRole('checkbox', { name: DONE_CHECKBOX }));

    await waitFor(() => {
      expect(within(row).getByText(PENDING_ROW_LABEL)).toBeInTheDocument();
      expect(row.className).toContain(PENDING_CLASSES);
      expect(
        screen.getByRole('checkbox', { name: `Mark ${returnPackageFixture.name} as open` }),
      ).toBeChecked();
    });
    expect(patchCalls(stub)).toHaveLength(0);
  });

  it('replays on reconnect with the time it was marked, and says how many synced', async () => {
    const user = userEvent.setup();
    const { stub, queryClient } = mountErrands();
    await loadedRow(queryClient);

    setOnline(false);
    await user.click(screen.getByRole('checkbox', { name: DONE_CHECKBOX }));
    setOnline(true);

    await waitFor(() => {
      expect(patchCalls(stub)).toHaveLength(1);
    });
    const [sent] = patchCalls(stub);
    expect(sent?.path).toBe(`/api/errands/${RETURN_PACKAGE_ID}`);
    expect(sent?.body).toEqual({ status: 'done', doneAt: DONE_AT });
    expect(await screen.findByText('1 change synced.')).toBeInTheDocument();
  });

  it('cannot be reopened offline: the done box is held with the reason', async () => {
    const user = userEvent.setup();
    const { queryClient } = mountErrands();
    await loadedRow(queryClient);

    setOnline(false);
    // Done errands sit in the collapsed section; opening it is what a member does to reach one.
    await user.click(await screen.findByText(/completed$/));

    const reopen = await screen.findByRole('checkbox', {
      name: 'Mark Replace porch light bulb as open',
    });
    expect(reopen).toBeDisabled();
    expect(reopen).toHaveAccessibleDescription(OFFLINE_ACTION_REASON);
  });
});
