import { onlineManager } from '@tanstack/react-query';
import { act, configure, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chore, ChoreDetail } from '@hestia/shared';
import {
  BANNED_GAMIFICATION_WORDS,
  CHORES_EMPTY_COPY,
  DELETE_COMPLETION_CONFIRMATION,
  OFFLINE_ACTION_REASON,
  ROTATION_REQUIRED_ERROR,
  allChoreCopyStrings,
} from '../../components/chores/chore-copy.ts';
import { formatCalendarDate } from '../../lib/format.ts';
import { setOnline, stubCoarsePointer } from '../../test/browser.ts';
import {
  OAK_STREET_ID,
  ALEX_ID,
  SAM_ID,
  JORDAN_ID,
  oakStreetFixture,
  oakStreetMembers,
  profileFixture,
} from '../../test/fixtures.ts';
import {
  CASEY_ID,
  TAKE_OUT_TRASH_ID,
  TODAY,
  VACUUM_COMMON_AREAS_ID,
  choreListFixture,
  cleanBathroomFixture,
  deepCleanFridgeFixture,
  replaceHvacFilterFixture,
  takeOutTrashDetailFixture,
  takeOutTrashFixture,
  vacuumCommonAreasDetailFixture,
  vacuumCommonAreasFixture,
  waterPlantsFixture,
} from '../../test/chore-fixtures.ts';
import {
  createFetchStub,
  problemBody,
  renderScreen,
  type StubHandler,
  WithQueue,
} from '../../test/harness.tsx';
import {
  findMdButton,
  findMdDialog,
  findMdField,
  findMdMenuItem,
  getMdAccessibleName,
  getMdButton,
  getMdField,
} from '../../test/md-queries.ts';
import { addDays } from '../../lib/household-date.ts';
import { ChoreDetailScreen } from './ChoreDetailScreen.tsx';
import { ChoreFormScreen } from './ChoreFormScreen.tsx';
import { ChoresListScreen } from './ChoresListScreen.tsx';

// A route's first render transforms its modules on demand, which can outlast the default wait on a
// busy machine; the screens themselves are far quicker than that.
configure({ asyncUtilTimeout: 5000 });

/*
 * Chores. Dates come from the seed data's "today" (a Sunday), so the fake clock is pinned to
 * noon in New York that day: every "overdue", "today", and "this week" in the assertions is read
 * against the same calendar the fixtures were written for.
 */

const PROFILE: StubHandler = () => ({ status: 200, body: profileFixture });
const MEMBERS: StubHandler = () => ({ status: 200, body: oakStreetMembers });
const HOUSEHOLD: StubHandler = () => ({ status: 200, body: oakStreetFixture });

function mountList(
  handlers: Readonly<Record<string, StubHandler>>,
): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub({
    'GET /api/users/me': PROFILE,
    'GET /api/households/:id/members': MEMBERS,
    'GET /api/households/:id': HOUSEHOLD,
    ...handlers,
  });
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(
    <WithQueue>
      <ChoresListScreen householdId={OAK_STREET_ID} />
    </WithQueue>,
  );
  return stub;
}

function mountDetail(
  handlers: Readonly<Record<string, StubHandler>>,
  choreId = TAKE_OUT_TRASH_ID,
): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub({
    'GET /api/users/me': PROFILE,
    'GET /api/households/:id/members': MEMBERS,
    'GET /api/households/:id': HOUSEHOLD,
    ...handlers,
  });
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(
    <WithQueue>
      <ChoreDetailScreen householdId={OAK_STREET_ID} choreId={choreId} />
    </WithQueue>,
  );
  return stub;
}

function mountForm(
  handlers: Readonly<Record<string, StubHandler>>,
  choreId?: string,
): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub({
    'GET /api/users/me': PROFILE,
    'GET /api/households/:id/members': MEMBERS,
    'GET /api/households/:id': HOUSEHOLD,
    ...handlers,
  });
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(<ChoreFormScreen householdId={OAK_STREET_ID} {...(choreId ? { choreId } : {})} />, {
    initialEntries: ['/'],
  });
  return stub;
}

/** The section a heading labels, so a test reads one group or panel at a time. */
function sectionOf(heading: string): HTMLElement {
  const section = screen.getByRole('heading', { name: heading }).closest('section');
  if (section === null) throw new Error(`no section labelled ${heading}`);
  return section;
}

/** OverflowMenu opens from keyboard activation on the inner shadow button of MdIconButton. */
async function openMenu(user: UserEvent, trigger: HTMLElement): Promise<void> {
  await waitFor(() => {
    expect(trigger.shadowRoot?.querySelector('button')).not.toBeNull();
  });
  const innerButton = trigger.shadowRoot?.querySelector('button');
  if (innerButton === null || innerButton === undefined) {
    throw new Error('Expected shadow button inside md-icon-button');
  }
  innerButton.focus();
  await user.keyboard('{Enter}');
}

function getAllMdButtons(name: string): HTMLElement[] {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'md-filled-button, md-outlined-button, md-text-button, md-icon-button, md-elevated-button, md-filled-tonal-button, button',
    ),
  );
  return candidates.filter((el) => getMdAccessibleName(el) === name);
}

async function getShadowInput(field: HTMLElement): Promise<HTMLInputElement> {
  await waitFor(() => {
    expect(field.shadowRoot?.querySelector('input')).not.toBeNull();
  });
  const input = field.shadowRoot?.querySelector('input');
  if (input === null || input === undefined) {
    throw new Error('Expected shadow input inside md-outlined-text-field');
  }
  return input;
}

function groupOf(heading: string): string[] {
  return within(sectionOf(heading))
    .queryAllByRole('link')
    .map((link) => link.textContent);
}

beforeEach(() => {
  // Pin "today" to the seed data's Sunday, noon in New York; timers keep running for the screens.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-27T16:00:00.000Z'));
  setOnline(true);
  stubCoarsePointer();
});

afterEach(() => {
  onlineManager.setOnline(true);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Chores list', () => {
  it('loading: shows skeleton rows labelled for screen readers', () => {
    mountList({ 'GET /api/households/:id/chores': () => new Promise(() => undefined) });
    expect(screen.getByRole('status')).toHaveTextContent('Loading chores');
  });

  it('first run: an empty household says what this holds and offers the first chore', async () => {
    mountList({ 'GET /api/households/:id/chores': () => ({ status: 200, body: [] }) });
    expect(await screen.findByText(CHORES_EMPTY_COPY)).toBeInTheDocument();
    expect(getAllMdButtons('Add a chore')).toHaveLength(2);
  });

  it('error: says what failed and retries in place', async () => {
    let attempts = 0;
    mountList({
      'GET /api/households/:id/chores': () => {
        attempts += 1;
        return attempts === 1
          ? { status: 500, body: problemBody(500, 'Internal Server Error') }
          : { status: 200, body: [takeOutTrashFixture] };
      },
    });
    expect(await screen.findByText("Couldn't load chores. Try again.")).toBeInTheDocument();
    const retry = getMdButton('Try again');
    await userEvent.click(retry);
    expect(await screen.findByRole('link', { name: /^Take out trash/ })).toBeInTheDocument();
  });

  it('groups into Overdue, Today, This week, and Later, in household time', async () => {
    mountList({
      'GET /api/households/:id/chores': () => ({ status: 200, body: choreListFixture }),
    });
    await screen.findByRole('heading', { level: 2, name: 'Overdue' });

    expect(screen.getByRole('heading', { level: 2, name: 'Overdue' })).toBeInTheDocument();
    expect(groupOf('Overdue')).toHaveLength(1);
    expect(groupOf('Overdue')[0]).toMatch(/^Vacuum common areas/);
    expect(groupOf('Today')).toHaveLength(1);
    expect(groupOf('Today')[0]).toMatch(/^Take out trash/);
    // Water plants is due tomorrow and Deep clean fridge on Saturday, both inside this week.
    const thisWeek = groupOf('This week');
    expect(thisWeek).toHaveLength(3);
    expect(thisWeek[0]).toMatch(/^Water plants/);
    expect(thisWeek[1]).toMatch(/^Clean bathroom/);
    expect(thisWeek[2]).toMatch(/^Deep clean fridge/);
    expect(groupOf('Later')).toHaveLength(1);
    expect(groupOf('Later')[0]).toMatch(/^Replace HVAC filter/);
  });

  it('a row shows recurrence, next due, assignee, and last completed; a rotation names the turn and who is next', async () => {
    mountList({
      'GET /api/households/:id/chores': () => ({
        status: 200,
        body: [takeOutTrashFixture, replaceHvacFilterFixture],
      }),
    });
    const trash = await screen.findByRole('link', { name: /^Take out trash/ });
    expect(trash).toHaveTextContent('Every week');
    expect(trash).toHaveTextContent('Due today');
    expect(trash).toHaveTextContent("Sam Chen's turn, Jordan Blake next");
    expect(trash).toHaveTextContent('Last done 1 week ago');

    const hvac = screen.getByRole('link', { name: /^Replace HVAC filter/ });
    expect(hvac).toHaveTextContent('Every month');
    expect(hvac).toHaveTextContent('Alex Rivera');
  });

  it('overdue says "Overdue" in words with neutral copy, and the danger color is not the only signal', async () => {
    mountList({
      'GET /api/households/:id/chores': () => ({ status: 200, body: [vacuumCommonAreasFixture] }),
    });
    const row = await screen.findByRole('link', { name: /^Vacuum common areas/ });
    expect(within(row).getByText('Overdue 3 days')).toBeInTheDocument();
    expect(row).toHaveTextContent('Unassigned');
    expect(row).toHaveTextContent('Last done 5 weeks ago');
    expect(row.textContent).not.toMatch(/!/);
  });

  it('completing a rotating chore advances the turn and the toast names who is next', async () => {
    let completed = false;
    const afterCompletion: ChoreDetail = {
      ...takeOutTrashDetailFixture,
      currentTurn: JORDAN_ID,
      nextTurn: ALEX_ID,
      dueDate: addDays(TODAY, 7),
      isOverdue: false,
      lastCompletion: {
        id: 'd1111111-0000-4000-8000-000000000009',
        choreId: TAKE_OUT_TRASH_ID,
        occurrenceDate: TODAY,
        completedBy: SAM_ID,
        completedAt: '2026-09-27T16:00:00.000Z',
      },
      completions: takeOutTrashDetailFixture.completions,
    };
    const stub = mountList({
      'GET /api/households/:id/chores': () => ({
        status: 200,
        body: completed
          ? [{ ...afterCompletion, dueDate: addDays(TODAY, 7) }]
          : [takeOutTrashFixture],
      }),
      'POST /api/chores/:id/complete': () => {
        completed = true;
        return { status: 200, body: afterCompletion };
      },
    });

    await userEvent.click(await findMdButton(/Mark (done, )?Take out trash/));

    expect(
      await screen.findByText('Take out trash done. Jordan Blake is next.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(
      stub.calls.some((call) => call.method === 'POST' && call.path.endsWith('/complete')),
    ).toBe(true);
    expect(await screen.findByText("Jordan Blake's turn, Alex Rivera next")).toBeInTheDocument();
  });

  it('Undo deletes the completion and the row reverts to the earlier turn', async () => {
    let completed = false;
    const done: Chore = {
      ...takeOutTrashFixture,
      currentTurn: JORDAN_ID,
      nextTurn: ALEX_ID,
      dueDate: addDays(TODAY, 7),
      isOverdue: false,
    };
    const stub = mountList({
      'GET /api/households/:id/chores': () => ({
        status: 200,
        body: [completed ? done : takeOutTrashFixture],
      }),
      'POST /api/chores/:id/complete': () => {
        completed = true;
        return { status: 200, body: { ...takeOutTrashDetailFixture, ...done, completions: [] } };
      },
      'DELETE /api/chores/:id/completions/:completionId': () => {
        completed = false;
        return { status: 204 };
      },
    });

    await userEvent.click(await findMdButton(/Mark (done, )?Take out trash/));
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));

    expect(await screen.findByRole('link', { name: /^Take out trash/ })).toHaveTextContent(
      "Sam Chen's turn, Jordan Blake next",
    );
    const undo = stub.calls.find((call) => call.method === 'DELETE');
    expect(undo?.path).toMatch(new RegExp(`/api/chores/${TAKE_OUT_TRASH_ID}/completions/`));
  });

  it('the completion snackbar keeps Undo visible persistently until dismissed', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-27T16:00:00.000Z'));
    mountList({
      'GET /api/households/:id/chores': () => ({ status: 200, body: [waterPlantsFixture] }),
      'POST /api/chores/:id/complete': () => ({
        status: 200,
        // The completion endpoint answers with the detail, which carries the completion to undo.
        body: {
          ...waterPlantsFixture,
          previewDates: [],
          completions: [],
          dueDate: addDays(TODAY, 3),
          isOverdue: false,
        },
      }),
    });
    await userEvent.click(await findMdButton(/Mark (done, )?Water plants/));
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5500);
    });
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    });
  });

  it('offline with the household cached: Done is queued, and Add is disabled with the reason', async () => {
    mountList({
      'GET /api/households/:id/chores': () => ({ status: 200, body: [takeOutTrashFixture] }),
    });
    await screen.findByRole('link', { name: /^Take out trash/ });

    setOnline(false);

    const done = await findMdButton(/Mark (done, )?Take out trash/);
    expect(done).toHaveProperty('softDisabled', false);
    expect(screen.getAllByText(OFFLINE_ACTION_REASON).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /^Take out trash/ })).toBeInTheDocument();
    const addButton = getAllMdButtons('Add a chore')[0];
    expect(addButton).toHaveProperty('softDisabled', true);
    expect(addButton).toHaveAccessibleDescription(OFFLINE_ACTION_REASON);
  });

  it('copy: no gamification words in any chore string the screens render or export', async () => {
    mountList({
      'GET /api/households/:id/chores': () => ({
        status: 200,
        body: choreListFixture,
      }),
    });
    await screen.findByRole('heading', { level: 2, name: 'Overdue' });
    const rendered = document.body.textContent.toLowerCase();
    const exported = allChoreCopyStrings().join(' ').toLowerCase();
    for (const word of BANNED_GAMIFICATION_WORDS) {
      expect(rendered, `rendered copy contains "${word}"`).not.toContain(word);
      expect(exported, `exported copy contains "${word}"`).not.toContain(word);
    }
    expect(rendered).not.toContain('!');
  });
});

describe('Chore detail', () => {
  it('shows the recurrence, the next three dates, and the rotation with the current turn and the next', async () => {
    mountDetail({
      'GET /api/chores/:id': () => ({ status: 200, body: takeOutTrashDetailFixture }),
    });
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Take out trash' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Every week')).toBeInTheDocument();
    const dates = within(sectionOf('Next three dates'));
    for (const date of takeOutTrashDetailFixture.previewDates) {
      expect(dates.getByText(formatCalendarDate(date))).toBeInTheDocument();
    }
    const rotation = within(sectionOf('Rotation order'));
    expect(rotation.getByText('1. Alex Rivera')).toBeInTheDocument();
    expect(rotation.getByText('2. Sam Chen')).toBeInTheDocument();
    expect(rotation.getByText('current turn', { exact: false })).toBeInTheDocument();
  });

  it('history lists who completed each occurrence and when, and a departed member reads "Former member"', async () => {
    mountDetail(
      { 'GET /api/chores/:id': () => ({ status: 200, body: vacuumCommonAreasDetailFixture }) },
      VACUUM_COMMON_AREAS_ID,
    );
    await screen.findByRole('heading', { name: 'Completion history' });
    const list = within(sectionOf('Completion history'));
    expect(list.getByText('Former member')).toBeInTheDocument();
    expect(list.getByText(/5 weeks ago/)).toBeInTheDocument();
    expect(vacuumCommonAreasDetailFixture.completions[0]?.completedBy).toBe(CASEY_ID);
  });

  it('only the most recent completion can be deleted, and deleting asks first', async () => {
    const stub = mountDetail({
      'GET /api/chores/:id': () => ({ status: 200, body: takeOutTrashDetailFixture }),
      'DELETE /api/chores/:id/completions/:completionId': () => ({ status: 204 }),
    });
    await screen.findByRole('heading', { level: 2, name: 'Take out trash' });

    const user = userEvent.setup();
    const menus = getAllMdButtons('More actions for this completion');
    expect(menus).toHaveLength(1);
    await openMenu(user, menus[0]!);
    await user.click(await findMdMenuItem(/Delete/));

    const dialog = await findMdDialog('Delete this completion?');
    expect(within(dialog).getByText(DELETE_COMPLETION_CONFIRMATION)).toBeInTheDocument();
    expect(stub.calls.some((call) => call.method === 'DELETE')).toBe(false);

    await userEvent.click(getMdButton('Delete completion', { container: dialog }));
    await waitFor(() => {
      expect(stub.calls.find((call) => call.method === 'DELETE')?.path).toMatch(
        new RegExp(
          `/api/chores/${TAKE_OUT_TRASH_ID}/completions/d1111111-0000-4000-8000-000000000001$`,
        ),
      );
    });
  });

  it('Mark done completes the chore with the same toast as the list', async () => {
    mountDetail({
      'GET /api/chores/:id': () => ({ status: 200, body: takeOutTrashDetailFixture }),
      'POST /api/chores/:id/complete': () => ({
        status: 200,
        body: { ...takeOutTrashDetailFixture, currentTurn: JORDAN_ID },
      }),
    });
    await userEvent.click(await findMdButton('Mark done'));
    expect(
      await screen.findByText('Take out trash done. Jordan Blake is next.'),
    ).toBeInTheDocument();
  });

  it('offline with the household cached: Mark done is queued', async () => {
    mountDetail({
      'GET /api/chores/:id': () => ({ status: 200, body: takeOutTrashDetailFixture }),
    });
    await screen.findByRole('heading', { level: 2, name: 'Take out trash' });
    setOnline(false);
    const markDone = await findMdButton('Mark done');
    expect(markDone).toHaveProperty('softDisabled', false);
  });
});

describe('Chore sheet', () => {
  it('name is required and the interval must be a whole number of 1 or more', async () => {
    mountForm({});
    const user = userEvent.setup();
    const save = await findMdButton('Save chore');
    await waitFor(() => {
      expect(save.shadowRoot?.querySelector('button')).not.toBeNull();
    });
    await user.click(save);
    await waitFor(() => {
      expect(getMdField('Name')).toHaveProperty('errorText', 'Enter a name.');
    });

    await user.type(await getShadowInput(getMdField('Name')), 'Sweep porch');
    const intervalInput = await getShadowInput(getMdField('Interval'));
    fireEvent.input(intervalInput, { target: { value: '' } });
    await user.type(intervalInput, '0');
    await user.click(getMdButton('Save chore'));
    await waitFor(() => {
      expect(getMdField('Interval')).toHaveProperty(
        'errorText',
        'Enter a whole number of 1 or more.',
      );
    });
  });

  it('the anchor defaults to today and the preview shows the next three dates as the unit changes', async () => {
    mountForm({});
    const user = userEvent.setup();
    expect(
      await screen.findByText('Occurs on 09/27/2026, 10/04/2026, 10/11/2026'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Anchor date')).toHaveValue('2026-09-27');

    await user.selectOptions(screen.getByLabelText('Repeats every'), 'month');
    expect(
      await screen.findByText('Occurs on 09/27/2026, 10/27/2026, 11/27/2026'),
    ).toBeInTheDocument();
  });

  it('a rotation is reordered with the keyboard: focus follows the member, and the order is saved', async () => {
    const posted: unknown[] = [];
    mountForm({
      'POST /api/households/:id/chores': ({ body }) => {
        posted.push(body);
        return {
          status: 201,
          body: { ...takeOutTrashDetailFixture, name: 'Sweep porch', previewDates: [] },
        };
      },
    });
    const user = userEvent.setup();
    await user.type(await getShadowInput(await findMdField('Name')), 'Sweep porch');
    await user.selectOptions(screen.getByLabelText('Assignment'), 'rotation');
    await user.selectOptions(screen.getByLabelText('Add to rotation'), ALEX_ID);
    await user.selectOptions(screen.getByLabelText('Add to rotation'), SAM_ID);

    const samUp = getMdButton('Move Sam Chen up');
    await waitFor(() => {
      expect(samUp.shadowRoot?.querySelector('button')).not.toBeNull();
    });
    samUp.shadowRoot?.querySelector('button')?.focus();
    await user.keyboard('{Enter}');

    // Sam now leads the order, so the "up" control has nothing above it and focus moves to "down".
    expect(screen.getByText('1. Sam Chen')).toBeInTheDocument();
    await waitFor(() => {
      expect(getMdButton('Move Sam Chen down')).toHaveFocus();
    });
    expect(getMdButton('Move Sam Chen up')).toHaveProperty('disabled', true);

    await user.click(getMdButton('Save chore'));
    await waitFor(() => {
      expect(posted).toHaveLength(1);
    });
    expect(posted[0]).toMatchObject({
      name: 'Sweep porch',
      assignment: { type: 'rotation', rotationOrder: [SAM_ID, ALEX_ID] },
    });
  });

  it('a rotation needs at least one member before it can be saved', async () => {
    mountForm({});
    const user = userEvent.setup();
    await user.type(await getShadowInput(await findMdField('Name')), 'Sweep porch');
    await user.selectOptions(screen.getByLabelText('Assignment'), 'rotation');
    await user.click(getMdButton('Save chore'));
    expect(await screen.findByText(ROTATION_REQUIRED_ERROR)).toBeInTheDocument();
  });

  it('a single member can be left unassigned, which saves as null', async () => {
    const posted: unknown[] = [];
    mountForm({
      'POST /api/households/:id/chores': ({ body }) => {
        posted.push(body);
        return { status: 201, body: { ...takeOutTrashDetailFixture, previewDates: [] } };
      },
    });
    const user = userEvent.setup();
    await user.type(await getShadowInput(await findMdField('Name')), 'Sweep porch');
    await user.selectOptions(screen.getByLabelText('Assignment'), 'single');
    await user.selectOptions(screen.getByLabelText('Assigned to'), 'Sam Chen');
    await user.selectOptions(screen.getByLabelText('Assigned to'), 'Unassigned');
    await user.click(getMdButton('Save chore'));
    await waitFor(() => {
      expect(posted).toHaveLength(1);
    });
    expect(posted[0]).toMatchObject({ assignment: { type: 'single', assignedTo: null } });
  });

  it('editing a rotation sends the order the user set, not a turn', async () => {
    const patched: unknown[] = [];
    mountForm(
      {
        'GET /api/chores/:id': () => ({ status: 200, body: takeOutTrashDetailFixture }),
        'PATCH /api/chores/:id': ({ body }) => {
          patched.push(body);
          return { status: 200, body: takeOutTrashDetailFixture };
        },
      },
      TAKE_OUT_TRASH_ID,
    );
    const user = userEvent.setup();
    await user.click(await findMdButton('Move Jordan Blake up'));
    await user.click(getMdButton('Save chore'));
    await waitFor(() => {
      expect(patched).toHaveLength(1);
    });
    expect(patched[0]).toMatchObject({
      assignment: { type: 'rotation', rotationOrder: [ALEX_ID, JORDAN_ID, SAM_ID] },
    });
  });

  it('delete is in the overflow menu and asks for confirmation first', async () => {
    const stub = mountForm(
      {
        'GET /api/chores/:id': () => ({ status: 200, body: takeOutTrashDetailFixture }),
        'DELETE /api/chores/:id': () => ({ status: 204 }),
      },
      TAKE_OUT_TRASH_ID,
    );
    const user = userEvent.setup();
    await openMenu(user, await findMdButton('More actions for Take out trash'));
    await user.click(await findMdMenuItem(/Delete/));
    const dialog = await findMdDialog('Delete this chore?');
    expect(within(dialog).getByText(/Delete Take out trash\?/)).toBeInTheDocument();
    expect(stub.calls.some((call) => call.method === 'DELETE')).toBe(false);
    await user.click(getMdButton('Delete chore', { container: dialog }));
    await waitFor(() => {
      expect(stub.calls.some((call) => call.method === 'DELETE')).toBe(true);
    });
  });

  it('offline: the fields and Save are disabled with the reason', async () => {
    // The roster loads while online, as it does in the shell, before the connection drops.
    mountForm({});
    await findMdButton('Save chore');
    setOnline(false);
    expect(await findMdButton('Save chore')).toHaveAccessibleDescription(OFFLINE_ACTION_REASON);
    expect(getMdField('Name')).toHaveProperty('disabled', true);
    expect(getMdField('Interval')).toHaveProperty('disabled', true);
  });
});

describe('Chores screens render no placeholder data', () => {
  it('uses the fixture dates, not the wall clock, for the list', async () => {
    mountList({
      'GET /api/households/:id/chores': () => ({ status: 200, body: [replaceHvacFilterFixture] }),
    });
    expect(await screen.findByText('Due in 11 days')).toBeInTheDocument();
    expect(deepCleanFridgeFixture.dueDate).toBe(addDays(TODAY, 6));
    expect(cleanBathroomFixture.dueDate).toBe(addDays(TODAY, 2));
  });
});
