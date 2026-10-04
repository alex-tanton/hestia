import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { act, configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PENDING_CLASSES, PENDING_ROW_LABEL } from '../../components/lists/PendingMark.tsx';
import { useWriteQueue } from '../../lib/offline/use-write-queue.ts';
import { queryKeys } from '../../lib/api/keys.ts';
import {
  OAK_STREET_ID,
  oakStreetFixture,
  oakStreetMembers,
  profileFixture,
} from '../../test/fixtures.ts';
import {
  TAKE_OUT_TRASH_ID,
  choreListFixture,
  takeOutTrashDetailFixture,
  takeOutTrashFixture,
} from '../../test/chore-fixtures.ts';
import {
  createFetchStub,
  problemBody,
  renderScreen,
  type StubHandler,
} from '../../test/harness.tsx';
import { ChoresListScreen } from './ChoresListScreen.tsx';

/*
 * A chore completion as a queued write (Requirements, "Offline behavior"; Engineering Practices ›
 * The write queue). The queue's own rules are unit-tested in `chore-errand-writes.test.ts`; these
 * drive the list the way a member does, offline and back online.
 */

configure({ asyncUtilTimeout: 5000 });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DONE_AT = '2026-09-27T16:00:00.000Z';
const DONE_LABEL = `Mark ${takeOutTrashFixture.name} done`;

function WithQueue({ children }: { children: ReactNode }): ReactElement {
  useWriteQueue();
  return <>{children}</>;
}

function setOnline(isOnline: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(isOnline);
  act(() => {
    onlineManager.setOnline(isOnline);
    window.dispatchEvent(new Event(isOnline ? 'online' : 'offline'));
  });
}

function mountList(extra: Readonly<Record<string, StubHandler>> = {}): {
  stub: ReturnType<typeof createFetchStub>;
  queryClient: QueryClient;
} {
  const stub = createFetchStub({
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'GET /api/households/:id/members': () => ({ status: 200, body: oakStreetMembers }),
    'GET /api/households/:id': () => ({ status: 200, body: oakStreetFixture }),
    'GET /api/households/:id/chores': () => ({ status: 200, body: choreListFixture }),
    'POST /api/chores/:id/complete': () => ({ status: 200, body: takeOutTrashDetailFixture }),
    ...extra,
  });
  vi.stubGlobal('fetch', stub.fetch);
  const { queryClient } = renderScreen(
    <WithQueue>
      <ChoresListScreen householdId={OAK_STREET_ID} />
    </WithQueue>,
  );
  return { stub, queryClient };
}

/** The row for the trash chore, once the list and the household are both cached. */
async function loadedRow(queryClient: QueryClient): Promise<HTMLElement> {
  const done = await screen.findByRole('button', { name: DONE_LABEL });
  await waitFor(() => {
    expect(queryClient.getQueryData(queryKeys.household(OAK_STREET_ID))).toBeDefined();
  });
  const row = done.closest('li');
  if (row === null) throw new Error('the row is always there');
  return row;
}

function postCalls(stub: ReturnType<typeof createFetchStub>): typeof stub.calls {
  return stub.calls.filter((call) => call.method === 'POST');
}

beforeEach(() => {
  // Pin "today" to Seed Data's Sunday, noon in New York; timers keep running for the screens.
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

describe('a chore completed offline', () => {
  it('is queued: the row is marked pending and nothing is sent', async () => {
    const user = userEvent.setup();
    const { stub, queryClient } = mountList();
    const row = await loadedRow(queryClient);

    setOnline(false);
    await user.click(screen.getByRole('button', { name: DONE_LABEL }));

    await waitFor(() => {
      expect(within(row).getByText(PENDING_ROW_LABEL)).toBeInTheDocument();
      expect(row.className).toContain(PENDING_CLASSES);
    });
    expect(postCalls(stub)).toHaveLength(0);
  });

  it('replays on reconnect with its id, the household-date occurrence, and its action time', async () => {
    const user = userEvent.setup();
    const { stub, queryClient } = mountList();
    await loadedRow(queryClient);

    setOnline(false);
    await user.click(screen.getByRole('button', { name: DONE_LABEL }));
    setOnline(true);

    await waitFor(() => {
      expect(postCalls(stub)).toHaveLength(1);
    });
    const [sent] = postCalls(stub);
    expect(sent?.path).toBe(`/api/chores/${TAKE_OUT_TRASH_ID}/complete`);
    const body = sent?.body as { id: string; occurrenceDate: string; doneAt: string };
    expect(body.id).toMatch(UUID);
    expect(body).toEqual({
      id: body.id,
      occurrenceDate: takeOutTrashFixture.dueDate,
      doneAt: DONE_AT,
    });
    expect(await screen.findByText('1 change synced.')).toBeInTheDocument();
  });

  it('can be undone while it waits: the queued write is removed and nothing is sent', async () => {
    const user = userEvent.setup();
    const { stub, queryClient } = mountList();
    const row = await loadedRow(queryClient);

    setOnline(false);
    await user.click(screen.getByRole('button', { name: DONE_LABEL }));
    await user.click(await screen.findByRole('button', { name: 'Undo' }));

    await waitFor(() => {
      expect(within(row).queryByText(PENDING_ROW_LABEL)).toBeNull();
    });
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);

    setOnline(true);
    await queryClient.resumePausedMutations();
    expect(postCalls(stub)).toHaveLength(0);
  });

  it('a refusal on replay is dropped and surfaced once, naming no chore', async () => {
    const user = userEvent.setup();
    const { queryClient } = mountList({
      'POST /api/chores/:id/complete': () => ({
        status: 404,
        body: problemBody(404, 'Not Found', 'Chore not found.'),
      }),
    });
    const row = await loadedRow(queryClient);

    setOnline(false);
    await user.click(screen.getByRole('button', { name: DONE_LABEL }));
    setOnline(true);

    const message = "1 change couldn't be saved. The chore or errand is no longer available.";
    const notice = await screen.findByText(message);
    expect(screen.getAllByText(message)).toHaveLength(1);
    expect(notice.textContent).not.toContain(takeOutTrashFixture.name);

    await waitFor(() => {
      expect(within(row).queryByText(PENDING_ROW_LABEL)).toBeNull();
    });
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
  });
});
