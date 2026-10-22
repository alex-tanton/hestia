import { onlineManager } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';
import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chore } from '@hearth/shared';
import { OFFLINE_ACTION_REASON } from '../../components/chores/chore-copy.ts';
import {
  TAKE_OUT_TRASH_ID,
  takeOutTrashDetailFixture,
  takeOutTrashFixture,
} from '../../test/chore-fixtures.ts';
import { OAK_STREET_ID } from '../../test/fixtures.ts';
import { testQueryClient } from '../../test/harness.tsx';
import type { ApiClient } from '../api/client.ts';
import { createCachePersister, PERSIST_MAX_AGE_MS, type AsyncStorage } from './persist.ts';
import {
  choreCompleteKey,
  choreScope,
  offlineChoreOccurrence,
  queueChoreCompletion,
  queueDropMessage,
  queueErrandDone,
  queueableWriteReason,
  registerQueueDefaults,
  type ChoreCompleteVariables,
  type ErrandDoneVariables,
} from './chore-errand-writes.ts';

/*
 * Unit tests for the queued chore and errand writes. They
 * drive TanStack Query's own mutation cache, the same as the queue does in the app, with a fake API
 * client that records what would have been sent.
 */

const DONE_AT = '2026-10-04T16:00:00.000Z';

/** A chore that repeats daily from Sept 27, so "today" is the occurrence a completion closes. */
const dailyTrash: Chore = {
  ...takeOutTrashFixture,
  recurrenceUnit: 'day',
  interval: 1,
  anchorDate: '2026-09-27',
  dueDate: '2026-10-04',
  lastCompletion: null,
};

function completeVariables(
  overrides: Partial<ChoreCompleteVariables> = {},
): ChoreCompleteVariables {
  return {
    kind: 'complete',
    householdId: OAK_STREET_ID,
    choreId: TAKE_OUT_TRASH_ID,
    completionId: 'a1111111-0000-4000-8000-00000000000a',
    doneAt: DONE_AT,
    ...overrides,
  };
}

/** The fake client: records each path, and holds the first request until the test releases it. */
function recordingApi(gate?: Promise<void>): {
  api: ApiClient;
  paths: string[];
  bodies: unknown[];
} {
  const paths: string[] = [];
  const bodies: unknown[] = [];
  const request = vi.fn(async (options: { path: string; body?: unknown }) => {
    paths.push(options.path);
    bodies.push(options.body);
    if (paths.length === 1 && gate !== undefined) await gate;
    return takeOutTrashDetailFixture;
  });
  return { api: { request, send: vi.fn() } as unknown as ApiClient, paths, bodies };
}

/** `idb-keyval` stands in as a plain map; nothing here needs IndexedDB itself. */
function fakeStorage(): AsyncStorage & { entries: Map<string, string> } {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key) => Promise.resolve(entries.get(key) ?? null),
    setItem: (key, value) => {
      entries.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key) => {
      entries.delete(key);
      return Promise.resolve();
    },
  };
}

beforeEach(() => {
  onlineManager.setOnline(true);
});

afterEach(() => {
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
});

describe('occurrence date in the household timezone', () => {
  it('closes the occurrence the household is on, not the one the device is on, across midnight', () => {
    // 22:30 on Oct 4 in New York is 02:30 on Oct 5 in UTC: the household is still on the 4th.
    const now = new Date('2026-10-05T02:30:00.000Z');
    expect(new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(now)).toBe('2026-10-05');

    expect(
      offlineChoreOccurrence(dailyTrash, new Set(['2026-10-03']), 'America/New_York', now),
    ).toBe('2026-10-04');
  });

  it('uses the household zone when the device is a day ahead of it', () => {
    // 01:30 on Oct 4 in UTC (the device) is 18:30 on Oct 3 in Los Angeles (the household).
    const now = new Date('2026-10-04T01:30:00.000Z');
    expect(
      offlineChoreOccurrence(dailyTrash, new Set(['2026-10-02']), 'America/Los_Angeles', now),
    ).toBe('2026-10-03');
  });
});

describe('queued writes need the household cache offline', () => {
  it('is available online, with or without a cache', () => {
    expect(queueableWriteReason(true, false, OFFLINE_ACTION_REASON)).toBeUndefined();
    expect(queueableWriteReason(true, true, OFFLINE_ACTION_REASON)).toBeUndefined();
  });

  it('is refused offline with no cached household, with the existing reason', () => {
    expect(queueableWriteReason(false, false, OFFLINE_ACTION_REASON)).toBe('Needs a connection.');
  });

  it('is available offline once the household is cached', () => {
    expect(queueableWriteReason(false, true, OFFLINE_ACTION_REASON)).toBeUndefined();
  });
});

describe('a dropped write is surfaced once, and names no household content', () => {
  it('counts the changes, with the fixed copy only', () => {
    expect(queueDropMessage(1, false)).toBe("1 change couldn't be saved.");
    expect(queueDropMessage(2, true)).toBe(
      "2 changes couldn't be saved. The chore or errand is no longer available.",
    );
    expect(queueDropMessage(2, true)).not.toContain(takeOutTrashFixture.name);
  });
});

describe('ordering within a scope', () => {
  it('runs one chore’s writes one at a time, while another scope runs alongside', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((settle) => {
      release = settle;
    });
    const { api, paths } = recordingApi(gate);
    const queryClient = testQueryClient();
    registerQueueDefaults(queryClient, api);

    void queueChoreCompletion(queryClient, completeVariables({ completionId: 'first' }));
    void queueChoreCompletion(queryClient, completeVariables({ completionId: 'second' }));
    void queueErrandDone(queryClient, {
      kind: 'done',
      householdId: OAK_STREET_ID,
      errandId: 'e1111111-0000-4000-8000-000000000001',
      doneAt: DONE_AT,
    } satisfies ErrandDoneVariables);

    // The errand is not held up by the chore's held first request; the second chore write is.
    await waitFor(() => {
      expect(paths).toHaveLength(2);
    });
    expect(paths.filter((path) => path.includes(TAKE_OUT_TRASH_ID))).toHaveLength(1);

    release();
    await waitFor(() => {
      expect(paths.filter((path) => path.includes(TAKE_OUT_TRASH_ID))).toHaveLength(2);
    });
  });

  it('keys each chore’s writes to its own scope', () => {
    expect(choreScope(TAKE_OUT_TRASH_ID)).toEqual({ id: `chore:${TAKE_OUT_TRASH_ID}` });
    expect(choreCompleteKey(TAKE_OUT_TRASH_ID)[1]).toBe(TAKE_OUT_TRASH_ID);
  });
});

describe('surviving a reload', () => {
  it('restores a completion queued offline and sends it with the same id and action time', async () => {
    const storage = fakeStorage();
    const persister = createCachePersister(storage);
    const { api, bodies } = recordingApi();

    onlineManager.setOnline(false);
    const before = testQueryClient();
    registerQueueDefaults(before, api);
    void queueChoreCompletion(
      before,
      completeVariables({ occurrenceDate: '2026-10-04', completionId: 'restored-id' }),
    );
    await waitFor(() => {
      expect(before.getMutationCache().getAll()[0]?.state.isPaused).toBe(true);
    });
    expect(bodies).toHaveLength(0);
    await persistQueryClientSave({ queryClient: before, persister });

    // The reload: a new client, its defaults registered before anything hydrates.
    const after = testQueryClient();
    registerQueueDefaults(after, api);
    await persistQueryClientRestore({ queryClient: after, persister, maxAge: PERSIST_MAX_AGE_MS });
    expect(after.getMutationCache().getAll()).toHaveLength(1);

    onlineManager.setOnline(true);
    await after.resumePausedMutations();

    expect(bodies).toEqual([{ id: 'restored-id', occurrenceDate: '2026-10-04', doneAt: DONE_AT }]);
  });
});
