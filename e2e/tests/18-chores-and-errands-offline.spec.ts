import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectDashboard, signIn, waitForServiceWorker } from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { queryValue } from '../support/db.ts';
import { SEED } from '../support/env.ts';

/**
 * Journey 7, chores and errands portion: as Oak Street's member, complete a rotating chore and mark
 * an errand done, with the household's date labels; then go offline, complete a chore and mark an
 * errand done, reload, and assert the queued marks survive the reload and that the two writes replay
 * in order on reconnect, with the toast naming how many synced.
 *
 * The online steps change Oak Street, so they run in the light run only, as journey 15 does. The
 * dark run's offline writes go to different rows, so the two themes never fight over one. Take out
 * trash is left alone on purpose: journey 20 removes Sam, whose turn it is there, and expects that.
 */

/** The rows each theme's offline writes go to. Light also does the online steps on other rows. */
const OFFLINE_ROWS = {
  light: { chore: 'Water plants', errand: 'Pick up dry cleaning' },
  dark: { chore: 'Replace HVAC filter', errand: 'Buy birthday card' },
} as const;

const PENDING = 'Waiting to sync';

function oakStreetId(): string {
  return queryValue(`select id from public.household where name = '${SEED.oakStreet.name}'`);
}

function errandStatus(name: string): string {
  return queryValue(
    `select status from public.errand where household_id = '${oakStreetId()}' and name = '${name}'`,
  );
}

/**
 * The list row an item sits in; a queued write is marked inside it, not beside it. Only the innermost
 * list item in the main content counts: the completion toast repeats the item's name, and a list item
 * wrapping a row would match the same text as well.
 */
function rowFor(page: Page, text: string): Locator {
  return page.locator('#main li:not(:has(li))').filter({ hasText: text });
}

/** Light run only: the online completion, the labels, and the history it leaves behind. */
async function onlineSteps(page: Page): Promise<void> {
  // Household-timezone labels: "today" and "in 2 days" are counted in Oak Street's zone, so they
  // are the same whatever zone the browser is in.
  await page.goto('/chores');
  await expect(page.getByRole('link', { name: /^Take out trash/ })).toContainText('Due today');
  await expect(page.getByRole('link', { name: /^Clean bathroom/ })).toContainText('in 2 days');

  // Completing a rotating chore passes its turn on: Jordan had Clean bathroom, and Alex is next.
  await page.getByRole('button', { name: 'Mark Clean bathroom done' }).click();
  await expect(
    page.getByText('Clean bathroom done. Alex Rivera is next.', { exact: true }),
  ).toHaveCount(1);
  await expect(page.getByRole('link', { name: /^Clean bathroom/ })).toContainText(
    "Alex Rivera's turn, Sam Chen next",
  );

  // The completion is in the chore's history under the member who made it.
  await page.getByRole('link', { name: /^Clean bathroom/ }).click();
  await expect(
    page
      .getByRole('region', { name: 'Completion history' })
      .getByRole('listitem')
      .filter({ hasText: 'Alex Rivera' }),
  ).toBeVisible();

  // Errands: due in two days, then marked done and collapsed with who and when.
  await page.goto('/chores/errands');
  await expect(page.getByRole('button', { name: /^Return Amazon package/ })).toContainText(
    'Due in 2 days',
  );
  await expect(page.getByRole('button', { name: /^Pick up dry cleaning/ })).toContainText(
    'Overdue 2 days',
  );
  await page.getByRole('checkbox', { name: 'Mark Return Amazon package as done' }).click();
  await page.getByText(/completed$/).click();
  // Scoped to this errand's row: journey 15 has already completed another one today, with the same words.
  await expect(
    page
      .locator('#main li:not(:has(li))')
      .filter({ hasText: 'Return Amazon package' })
      .filter({ hasText: /Completed by Alex Rivera · today/ }),
  ).toBeVisible();
}

async function offlineWrites(page: Page, theme: 'light' | 'dark'): Promise<void> {
  const { chore, errand } = OFFLINE_ROWS[theme];

  // Both lists are loaded while online, so each has its data in memory before the connection goes:
  // the offline screens show what was already opened, and a list never opened online has nothing.
  const subTabs = page.getByRole('navigation', { name: 'Chores sections' });
  await page.goto('/chores/errands');
  await expect(page.getByRole('checkbox', { name: new RegExp(`^Mark ${errand}`) })).toBeVisible();
  await subTabs.getByText('Chores', { exact: true }).click();
  await expect(page.getByRole('button', { name: `Mark ${chore} done` })).toBeVisible();
  // Precached before the loss of network, so the reload below has an app shell to serve.
  await waitForServiceWorker(page);
  await page.context().setOffline(true);

  await page.getByRole('button', { name: `Mark ${chore} done` }).click();
  await expect(rowFor(page, chore)).toContainText(PENDING);

  await subTabs.getByText('Errands', { exact: true }).click();
  await page.getByRole('checkbox', { name: `Mark ${errand} as done` }).click();
  // The done box shows at once and the row is marked while it waits; its checkbox is held until the
  // write lands, so the errand is not toggled again offline.
  await expect(page.getByRole('checkbox', { name: `Mark ${errand} as open` })).toBeChecked();
  await expect(rowFor(page, errand)).toContainText(PENDING);
  await expectAccessible(page, `chores and errands, offline with queued writes (${theme})`);

  // Survives a reload: still offline, and both the marks and the queue come back from IndexedDB,
  // not from memory.
  await subTabs.getByText('Chores', { exact: true }).click();
  await expect(rowFor(page, chore)).toContainText(PENDING);
  await page.reload();
  await expect(rowFor(page, chore)).toContainText(PENDING);
  await subTabs.getByText('Errands', { exact: true }).click();
  await expect(rowFor(page, errand)).toContainText(PENDING);

  await page.context().setOffline(false);

  // No manual retry: the queue drains once the browser is back online. Two writes were queued, the
  // chore's completion and the errand's done, and they replay in that order.
  await expect(page.getByText(PENDING)).toHaveCount(0);
  await expect(page.getByText('2 changes synced.').first()).toBeVisible();
  expect(errandStatus(errand)).toBe('done');
  await expectAccessible(page, `chores and errands, synced after reconnecting (${theme})`);
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`journey 7 — chores and errands (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('completes online with household dates, then queues offline and replays on reconnect', async ({
      page,
    }) => {
      await signIn(page, SEED.alex.email);
      await expectDashboard(page, SEED.oakStreet.name);

      if (theme === 'light') await onlineSteps(page);

      await offlineWrites(page, theme);
    });
  });
}
