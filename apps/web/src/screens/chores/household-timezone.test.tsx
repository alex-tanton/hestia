import { onlineManager } from '@tanstack/react-query';
import { configure, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Errand } from '@hearth/shared';
import {
  OAK_STREET_ID,
  oakStreetFixture,
  oakStreetMembers,
  profileFixture,
} from '../../test/fixtures.ts';
import {
  choreListFixture,
  returnPackageFixture,
  takeOutTrashFixture,
} from '../../test/chore-fixtures.ts';
import {
  createFetchStub,
  problemBody,
  renderScreen,
  type StubHandler,
} from '../../test/harness.tsx';
import { ChoreFormScreen } from './ChoreFormScreen.tsx';
import { ChoresListScreen } from './ChoresListScreen.tsx';
import { ErrandsListScreen } from './ErrandsListScreen.tsx';

configure({ asyncUtilTimeout: 5000 });

/*
 * Household dates (PRD, "Timezone"): a chore's or errand's day is the household's, however the
 * device's zone reads the clock. The device here is Kiritimati (UTC+14), a day ahead of New York:
 * at 02:30 UTC on Sept 28 it is Sept 27 in New York and Sept 28 in Kiritimati.
 */

const BROWSER_ZONE = 'Pacific/Kiritimati';
const PINNED_INSTANT = new Date('2026-09-28T02:30:00.000Z');
const abroadProfile = { ...profileFixture, timezone: BROWSER_ZONE };

function stubWith(
  choreOrErrandHandlers: Readonly<Record<string, StubHandler>>,
  household: StubHandler = () => ({ status: 200, body: oakStreetFixture }),
): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub({
    'GET /api/users/me': () => ({ status: 200, body: abroadProfile }),
    'GET /api/households/:id/members': () => ({ status: 200, body: oakStreetMembers }),
    'GET /api/households/:id': household,
    ...choreOrErrandHandlers,
  });
  vi.stubGlobal('fetch', stub.fetch);
  return stub;
}

function rowOfDoneButton(name: string): HTMLElement {
  const row = screen.getByRole('button', { name: `Mark ${name} done` }).closest('li');
  if (row === null) throw new Error('the row is always there');
  return row;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED_INSTANT);
  onlineManager.setOnline(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('household dates, with the device a day ahead', () => {
  it('groups a chore due on the household’s today under Today, not Overdue', async () => {
    stubWith({
      'GET /api/households/:id/chores': () => ({ status: 200, body: [takeOutTrashFixture] }),
    });
    renderScreen(<ChoresListScreen householdId={OAK_STREET_ID} />);

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Overdue' })).toBeNull();
    expect(
      within(rowOfDoneButton(takeOutTrashFixture.name)).getByText('Due today'),
    ).toBeInTheDocument();
  });

  it('an errand due on the household’s today reads due today, not overdue', async () => {
    const dueToday: Errand = { ...returnPackageFixture, dueDate: '2026-09-27', status: 'open' };
    stubWith({
      'GET /api/households/:id/errands': () => ({ status: 200, body: [dueToday] }),
    });
    renderScreen(<ErrandsListScreen householdId={OAK_STREET_ID} />);

    expect(await screen.findByText('Due today')).toBeInTheDocument();
    expect(screen.queryByText(/Overdue/)).toBeNull();
  });

  it('a new chore’s anchor starts on the household’s today', async () => {
    stubWith({});
    renderScreen(<ChoreFormScreen householdId={OAK_STREET_ID} />, { initialEntries: ['/'] });

    expect(await screen.findByLabelText('Anchor date')).toHaveValue('2026-09-27');
  });

  it('offline with no household cached, the list shows its offline state, not dated rows', async () => {
    onlineManager.setOnline(false);
    stubWith({
      'GET /api/households/:id/chores': () => ({ status: 200, body: [takeOutTrashFixture] }),
    });
    renderScreen(<ChoresListScreen householdId={OAK_STREET_ID} />);

    expect(
      await screen.findByText(/household's details sync when you reconnect/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: `Mark ${takeOutTrashFixture.name} done` }),
    ).toBeNull();
  });

  it('shows the chores list’s error, not dated rows, when the household cannot load', async () => {
    stubWith(
      {
        'GET /api/households/:id/chores': () => ({ status: 200, body: choreListFixture }),
      },
      () => ({ status: 500, body: problemBody(500, 'Internal Server Error') }),
    );
    renderScreen(<ChoresListScreen householdId={OAK_STREET_ID} />);

    expect(await screen.findByText("Couldn't load the household. Try again.")).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: `Mark ${takeOutTrashFixture.name} done` }),
    ).toBeNull();
  });
});
