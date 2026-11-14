import { onlineManager } from '@tanstack/react-query';
import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BANNED_GAMIFICATION_WORDS,
  ERRANDS_ALL_DONE_COPY,
  ERRANDS_EMPTY_COPY,
  OFFLINE_ACTION_REASON,
  allChoreCopyStrings,
} from '../../components/chores/chore-copy.ts';
import { openMenu, setOnline, stubCoarsePointer } from '../../test/browser.ts';
import {
  findMdButton,
  findMdCheckbox,
  findMdDialog,
  findMdField,
  findMdMenuItem,
  getMdAccessibleName,
  getMdButton,
} from '../../test/md-queries.ts';
import {
  ALEX_ID,
  OAK_STREET_ID,
  SAM_ID,
  oakStreetFixture,
  oakStreetMembers,
  profileFixture,
} from '../../test/fixtures.ts';
import {
  BIRTHDAY_CARD_ID,
  birthdayCardFixture,
  dryCleaningFixture,
  errandListFixture,
  returnPackageFixture,
} from '../../test/chore-fixtures.ts';
import {
  createFetchStub,
  problemBody,
  renderScreen,
  type StubHandler,
  WithQueue,
} from '../../test/harness.tsx';
import { ErrandsListScreen } from './ErrandsListScreen.tsx';

// A route's first render transforms its modules on demand, which can outlast the default wait on a
// busy machine; the screens themselves are far quicker than that.
configure({ asyncUtilTimeout: 5000 });

/*
 * Errands. The clock is pinned to the seed data's "today" (a Sunday, noon in New York), so the due
 * dates and completion stamps in the fixtures read as they are written.
 */

function mount(
  handlers: Readonly<Record<string, StubHandler>> = {},
): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub({
    'GET /api/users/me': () => ({ status: 200, body: profileFixture }),
    'GET /api/households/:id/members': () => ({ status: 200, body: oakStreetMembers }),
    'GET /api/households/:id': () => ({ status: 200, body: oakStreetFixture }),
    'GET /api/households/:id/errands': () => ({ status: 200, body: errandListFixture }),
    ...handlers,
  });
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(
    <WithQueue>
      <ErrandsListScreen householdId={OAK_STREET_ID} />
    </WithQueue>,
  );
  return stub;
}

async function findFieldInput(name: string, container?: HTMLElement): Promise<HTMLElement> {
  const host = await findMdField(name, { container });
  if (host instanceof HTMLInputElement || host instanceof HTMLTextAreaElement) {
    return host;
  }
  return waitFor(() => {
    const input = host.shadowRoot?.querySelector<HTMLElement>('input, textarea');
    if (input === null || input === undefined) {
      throw new Error(`Expected shadow input inside <${host.localName}>`);
    }
    return input;
  });
}

function getAllMdButtons(name: string): HTMLElement[] {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'md-filled-button, md-outlined-button, md-text-button, md-icon-button, md-elevated-button, md-filled-tonal-button, button',
    ),
  );
  return candidates.filter((el) => getMdAccessibleName(el) === name);
}

/** The open list, which sits above the collapsed done group. */
function openList(): HTMLElement {
  const first = screen.getByRole('button', { name: /^Return Amazon package/ });
  const list = first.closest('ul');
  if (list === null) throw new Error('no open list');
  return list;
}

beforeEach(() => {
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

describe('Errands list', () => {
  it('open errands come first, in order, with due dates and assignees', async () => {
    mount();
    await screen.findByRole('button', { name: /^Return Amazon package/ });
    // The overflow "More" buttons are labelled; the errand's own tap target is not.
    const names = within(openList())
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-label') === null)
      .map((button) => button.textContent);
    expect(names[0]).toMatch(/^Return Amazon package/);
    expect(names[1]).toMatch(/^Pick up dry cleaning/);
    expect(names[2]).toMatch(/^Renew car registration/);
    expect(names[3]).toMatch(/^Buy birthday card/);

    const amazon = screen.getByRole('button', { name: /^Return Amazon package/ });
    expect(amazon).toHaveTextContent('Due in 2 days');
    expect(amazon).toHaveTextContent('Alex Rivera');
  });

  it('an overdue errand says "Overdue" in words', async () => {
    mount({
      'GET /api/households/:id/errands': () => ({ status: 200, body: [dryCleaningFixture] }),
    });
    const row = await screen.findByRole('button', { name: /^Pick up dry cleaning/ });
    expect(within(row).getByText('Overdue 2 days')).toBeInTheDocument();
  });

  it('done errands collapse below, each with who completed it and when', async () => {
    mount();
    const summary = await screen.findByText('2 completed');
    const details = summary.closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    expect(
      within(details ?? document.body).getByText('Completed by Alex Rivera · 4 days ago'),
    ).toBeInTheDocument();
    expect(
      within(details ?? document.body).getByText('Completed by Sam Chen · 6 days ago'),
    ).toBeInTheDocument();
  });

  it('empty first run: says what this holds and offers the first errand', async () => {
    mount({ 'GET /api/households/:id/errands': () => ({ status: 200, body: [] }) });
    expect(await screen.findByText(ERRANDS_EMPTY_COPY)).toBeInTheDocument();
    expect(getAllMdButtons('Add an errand')).toHaveLength(2);
  });

  it('nothing open says so, without celebrating', async () => {
    mount({
      'GET /api/households/:id/errands': () => ({
        status: 200,
        body: [
          {
            ...dryCleaningFixture,
            status: 'done',
            completedAt: '2026-09-25T12:00:00.000Z',
            completedBy: ALEX_ID,
          },
        ],
      }),
    });
    expect(await screen.findByText(ERRANDS_ALL_DONE_COPY)).toBeInTheDocument();
  });

  it('error: says what failed and retries in place', async () => {
    let attempts = 0;
    mount({
      'GET /api/households/:id/errands': () => {
        attempts += 1;
        return attempts === 1
          ? { status: 500, body: problemBody(500, 'Internal Server Error') }
          : { status: 200, body: [returnPackageFixture] };
      },
    });
    expect(await screen.findByText("Couldn't load errands. Try again.")).toBeInTheDocument();
    await userEvent.click(getMdButton('Try again'));
    expect(
      await screen.findByRole('button', { name: /^Return Amazon package/ }),
    ).toBeInTheDocument();
  });

  it('the checkbox marks an errand done, and reopening it clears the completion', async () => {
    const patched: unknown[] = [];
    mount({
      'PATCH /api/errands/:id': ({ body }) => {
        patched.push(body);
        return { status: 200, body: { ...birthdayCardFixture, status: 'done' } };
      },
    });
    await userEvent.click(await findMdCheckbox('Mark Buy birthday card as done'));
    await waitFor(() => {
      expect(patched).toHaveLength(1);
    });
    // The done carries the moment it was marked, which is the pinned clock here.
    expect(patched[0]).toEqual({ status: 'done', doneAt: '2026-09-27T16:00:00.000Z' });
  });

  it('delete is in the overflow menu and asks for confirmation first', async () => {
    const stub = mount({
      'DELETE /api/errands/:id': () => ({ status: 204 }),
    });
    const user = userEvent.setup();
    await openMenu(user, 'More actions for Buy birthday card');
    await user.click(await findMdMenuItem(/Delete/));
    const dialog = await findMdDialog('Delete this errand?');
    expect(within(dialog).getByText('Delete Buy birthday card?')).toBeInTheDocument();
    expect(stub.calls.some((call) => call.method === 'DELETE')).toBe(false);
    await user.click(getMdButton('Delete errand', { container: dialog }));
    await waitFor(() => {
      expect(stub.calls.find((call) => call.method === 'DELETE')?.path).toMatch(
        new RegExp(`/api/errands/${BIRTHDAY_CARD_ID}$`),
      );
    });
  });
});

describe('Errand quick-add and edit sheet', () => {
  it('name is required', async () => {
    mount();
    const user = userEvent.setup();
    await user.click(await findMdButton('Add an errand'));
    const dialog = await findMdDialog('Add an errand');
    await user.click(getMdButton('Save errand', { container: dialog }));
    const nameField = await findMdField('Name', { container: dialog });
    await waitFor(() => {
      expect(nameField).toHaveProperty('errorText', 'Enter a name.');
    });
  });

  it('quick-add with only a name sends no due date and no assignee', async () => {
    const posted: unknown[] = [];
    mount({
      'POST /api/households/:id/errands': ({ body }) => {
        posted.push(body);
        return {
          status: 201,
          body: {
            ...birthdayCardFixture,
            id: 'e9999999-0000-4000-8000-000000000009',
            name: 'Post card',
          },
        };
      },
    });
    const user = userEvent.setup();
    await user.click(await findMdButton('Add an errand'));
    const dialog = await findMdDialog('Add an errand');
    const nameInput = await findFieldInput('Name', dialog);
    fireEvent.input(nameInput, { target: { value: 'Post card' } });
    await user.click(getMdButton('Save errand', { container: dialog }));
    await waitFor(() => {
      expect(posted).toHaveLength(1);
    });
    expect(posted[0]).toEqual({ name: 'Post card', dueDate: null, assignedTo: null });
  });

  it('quick-add takes an optional due date and assignee', async () => {
    const posted: unknown[] = [];
    mount({
      'POST /api/households/:id/errands': ({ body }) => {
        posted.push(body);
        return { status: 201, body: { ...birthdayCardFixture, name: 'Mail package' } };
      },
    });
    const user = userEvent.setup();
    await user.click(await findMdButton('Add an errand'));
    const dialog = await findMdDialog('Add an errand');
    const nameInput = await findFieldInput('Name', dialog);
    fireEvent.input(nameInput, { target: { value: 'Mail package' } });
    const dueInput = await findFieldInput('Due date', dialog);
    fireEvent.change(dueInput, {
      target: { value: '2026-10-01' },
    });
    await user.selectOptions(within(dialog).getByLabelText('Assigned to'), SAM_ID);
    await user.click(getMdButton('Save errand', { container: dialog }));
    await waitFor(() => {
      expect(posted).toHaveLength(1);
    });
    expect(posted[0]).toEqual({ name: 'Mail package', dueDate: '2026-10-01', assignedTo: SAM_ID });
  });

  it('tapping an errand opens the same sheet, prefilled, and saves as an edit', async () => {
    const patched: unknown[] = [];
    mount({
      'PATCH /api/errands/:id': ({ body }) => {
        patched.push(body);
        return { status: 200, body: { ...returnPackageFixture, name: 'Return package' } };
      },
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^Return Amazon package/ }));
    const dialog = await findMdDialog('Edit errand');
    const nameField = await findMdField('Name', { container: dialog });
    expect(nameField).toHaveProperty('value', 'Return Amazon package');
    expect(within(dialog).getByLabelText('Due date')).toHaveValue('2026-09-29');
    expect(within(dialog).getByLabelText('Assigned to')).toHaveValue(ALEX_ID);

    const nameInput = await findFieldInput('Name', dialog);
    fireEvent.input(nameInput, { target: { value: 'Return package' } });
    await user.click(getMdButton('Save errand', { container: dialog }));
    await waitFor(() => {
      expect(patched).toHaveLength(1);
    });
    expect(patched[0]).toEqual({
      name: 'Return package',
      dueDate: '2026-09-29',
      assignedTo: ALEX_ID,
    });
  });

  it('an errand with no due date and no assignee opens to empty fields', async () => {
    mount();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^Buy birthday card/ }));
    const dialog = await findMdDialog('Edit errand');
    expect(within(dialog).getByLabelText('Due date')).toHaveValue('');
    expect(within(dialog).getByLabelText('Assigned to')).toHaveDisplayValue('Unassigned');
  });
});

describe('Errands offline', () => {
  it('with the household cached, marking done is queued; Add is disabled with the reason', async () => {
    mount();
    await screen.findByRole('button', { name: /^Return Amazon package/ });
    setOnline(false);

    const checkbox = await findMdCheckbox('Mark Buy birthday card as done');
    expect(checkbox).not.toHaveProperty('disabled', true);
    expect(screen.getAllByText(OFFLINE_ACTION_REASON).length).toBeGreaterThan(0);
    expect(getAllMdButtons('Add an errand')[0]).toHaveProperty('softDisabled', true);
    expect(screen.getByRole('button', { name: /^Return Amazon package/ })).toBeInTheDocument();
  });
});

describe('Errand copy', () => {
  it('no gamification words in any errand string the screen renders or exports', async () => {
    mount();
    await screen.findByRole('button', { name: /^Return Amazon package/ });
    const rendered = document.body.textContent.toLowerCase();
    const exported = allChoreCopyStrings().join(' ').toLowerCase();
    for (const word of BANNED_GAMIFICATION_WORDS) {
      expect(rendered, `rendered copy contains "${word}"`).not.toContain(word);
      expect(exported, `exported copy contains "${word}"`).not.toContain(word);
    }
    expect(rendered).not.toContain('!');
  });
});
