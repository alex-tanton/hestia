import { configure, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Bill } from '@hearth/shared';
import { registerHouseholdClock } from '../../test/browser.ts';
import { billFixture } from '../../test/bills-fixtures.ts';
import { OAK_STREET_ID, oakStreetFixture, profileFixture } from '../../test/fixtures.ts';
import {
  createFetchStub,
  problemBody,
  renderScreen,
  type StubHandler,
} from '../../test/harness.tsx';
import { BillsIndexScreen } from './BillsIndexScreen.tsx';

configure({ asyncUtilTimeout: 5000 });

/*
 * "This week" runs through the household's Saturday (PRD, "This Week"; Design › Screens › 14).
 * The browser here is Kiritimati (UTC+14): at 02:30 UTC on Oct 4 it is Sunday Oct 4 there, so its
 * week would already run to Oct 10, while New York is still on Saturday Oct 3 and its week ends
 * there. A bill due Tuesday Oct 6 is therefore Later for this household.
 */

const BROWSER_ZONE = 'Pacific/Kiritimati';
const PINNED_INSTANT = new Date('2026-10-04T02:30:00.000Z');
const abroadProfile = { ...profileFixture, timezone: BROWSER_ZONE };

const gasBill: Bill = billFixture({
  id: '30000020-0000-4000-8000-000000000001',
  name: 'Gas',
  currentOccurrenceDate: '2026-10-03',
});

// A personal bill: it belongs to no household, yet its dates still follow the household's week.
const waterBill: Bill = billFixture({
  id: '30000020-0000-4000-8000-000000000002',
  name: 'Water',
  householdId: null,
  visibility: 'personal',
  currentOccurrenceDate: '2026-10-06',
});

function mount(
  household: StubHandler = () => ({ status: 200, body: oakStreetFixture }),
): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub({
    'GET /api/users/me': () => ({ status: 200, body: abroadProfile }),
    'GET /api/households/:id': household,
    'GET /api/households/:id/bills': () => ({ status: 200, body: [gasBill, waterBill] }),
  });
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(<BillsIndexScreen householdId={OAK_STREET_ID} />);
  return stub;
}

function groupNamed(heading: string): HTMLElement {
  const section = screen.getByRole('heading', { name: heading }).closest('section');
  if (section === null) throw new Error('every bill group is a section');
  return section;
}

registerHouseholdClock(PINNED_INSTANT);

describe('bill groups, with the browser a day ahead of the household', () => {
  it('a household or personal bill due next Tuesday is Later, since the household’s week ends Saturday', async () => {
    mount();
    expect(await screen.findByRole('heading', { name: 'This week' })).toBeInTheDocument();
    expect(within(groupNamed('This week')).getByText('Gas')).toBeInTheDocument();
    expect(within(groupNamed('This week')).queryByText('Water')).toBeNull();
    expect(within(groupNamed('Later')).getByText('Water')).toBeInTheDocument();
  });
});

describe('bill groups until the household’s zone is known', () => {
  it('shows the loading state, not grouped bills, while the household is pending', async () => {
    const stub = mount(() => new Promise(() => undefined));
    expect(await screen.findByRole('status')).toHaveTextContent('Loading your bills');
    await waitFor(() => {
      expect(stub.calls.some((call) => call.path.includes('/bills'))).toBe(true);
    });
    expect(screen.queryByText('Gas')).toBeNull();
    expect(screen.queryByText('Water')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'This week' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Later' })).toBeNull();
  });

  it('shows the household error with retry, not grouped bills, when the household fails', async () => {
    mount(() => ({ status: 500, body: problemBody(500, 'Internal Server Error') }));
    expect(await screen.findByText("Couldn't load the household. Try again.")).toBeInTheDocument();
    expect(screen.queryByText('Gas')).toBeNull();
    expect(screen.queryByText('Water')).toBeNull();
  });
});
