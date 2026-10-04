import { expect, test, type Page } from '@playwright/test';
import { accessToken, billState, householdBillIds } from '../support/api.ts';
import { expectDashboard, signIn } from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { DESKTOP, PHONE, group, screenshotsInto } from '../support/bills.ts';
import { SEED } from '../support/env.ts';

/**
 * Phase 4, journey 5: a monthly household bill is paid late, and its next due date stays on the
 * anchor's schedule rather than moving to completion plus one interval (Requirements, "Recurrence
 * is anchored and derived on read"; Design › Screens › 14 and 15; Seed Data › "Bills").
 *
 * The bill is created here, not taken from the seed, so the dates can be pinned to the run: the
 * anchor is the 10th three months before this month in the household's timezone. The first three
 * occurrences are therefore already past whatever day the suite runs, and the third is past too,
 * which is what the "unpaid stays overdue" step depends on. The bill is archived at the end, so
 * the Overdue group the later journeys read is left as the seed left it.
 */

const HOUSEHOLD_TZ = 'America/New_York';
const shoot = screenshotsInto('u4-journey5');

/** Today's calendar date in the household's timezone, as YYYY-MM-DD. */
function householdToday(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HOUSEHOLD_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** The given day of the month, `months` away from `date` (YYYY-MM-DD). */
function shiftMonths(date: string, months: number, day: number): string {
  const [year = 1970, month = 1] = date.split('-').map(Number);
  const index = year * 12 + (month - 1) + months;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${String(y)}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** How the app shows a calendar date: MM/DD/YYYY (Design › Screens › 14). */
function shown(date: string): string {
  return `${date.slice(5, 7)}/${date.slice(8, 10)}/${date.slice(0, 4)}`;
}

function fixture(theme: 'light' | 'dark') {
  const today = householdToday();
  return {
    name: `Gas late ${theme}`,
    today,
    first: shiftMonths(today, -3, 10),
    second: shiftMonths(today, -2, 10),
    third: shiftMonths(today, -1, 10),
  };
}

/** The bill's row in the Overdue group, by its name. */
function overdueRow(page: Page, name: string) {
  return group(page, 'Overdue').getByRole('link', { name: new RegExp(`^${name}`) });
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`bill paid late keeps its anchor (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('a late payment advances to the next anchor date, and an unpaid occurrence stays overdue', async ({
      page,
      request,
    }) => {
      const f = fixture(theme);
      // The fixture's shape is what the assertions below rely on; if it ever fails, the test is
      // wrong, not the recurrence rule.
      expect(f.third < f.today, 'fixture: the third occurrence has passed').toBe(true);

      await page.setViewportSize(DESKTOP);
      await signIn(page, SEED.alex.email);
      await expectDashboard(page, SEED.oakStreet.name);
      await page.goto('/bills');

      // Create a monthly household bill anchored on the 10th, three months back, with autopay off.
      await page.getByRole('button', { name: 'Add a bill' }).click();
      const sheet = page.getByRole('dialog', { name: 'Add a bill' });
      await sheet.getByLabel('Name').fill(f.name);
      await sheet.getByLabel('Amount').fill('64.20');
      await sheet.getByRole('combobox', { name: 'Repeats' }).click();
      await page.getByRole('option', { name: 'Monthly' }).click();
      await sheet.getByLabel('Every').fill('1');
      await sheet.getByLabel('First due date').fill(f.first);
      // The sheet's preview runs the anchored rule forward from the anchor (Design › Screens › 15).
      await expect(sheet).toContainText(
        `Next due dates: ${shown(f.first)}, ${shown(f.second)}, and ${shown(f.third)}.`,
      );
      await expectAccessible(page, `add bill sheet (${theme})`);
      await shoot(page, `add-bill-sheet-${theme}-1280`);
      await sheet.getByRole('button', { name: 'Add bill' }).click();
      await expect(sheet).toBeHidden();

      // The first occurrence is unpaid and past due, so the new bill opens in Overdue.
      const row = overdueRow(page, f.name);
      await expect(row).toContainText(`Due ${shown(f.first)}`);
      await expect(row).toContainText('$64.20');
      await expect(row).toContainText('Overdue');
      const href = await row.getAttribute('href');
      const billId = (href ?? '').split('/').at(-1) ?? '';
      expect(billId, 'the row links to its bill').not.toBe('');

      const token = await accessToken(request, SEED.alex.email);
      const created = await billState(request, token, billId);
      expect(created.currentOccurrenceDate).toBe(f.first);
      expect(created.isOverdue).toBe(true);
      expect(created.payments).toEqual([]);
      const householdId = created.householdId ?? '';
      expect(householdId, 'the bill belongs to a household').not.toBe('');

      // Mark the first occurrence paid. Today is after its date, so this payment is late.
      await group(page, 'Overdue')
        .getByRole('button', { name: `Mark paid, ${f.name}` })
        .click();
      await expect(page.getByText(`Marked ${f.name} paid.`).first()).toBeVisible();

      // The row stays in Overdue on the second occurrence, the 10th of the following month, not on
      // the payment date plus one month.
      await expect(row).toContainText(`Due ${shown(f.second)}`);
      await expect(row).not.toContainText(`Due ${shown(f.first)}`);
      await expect(row).toContainText('Overdue');

      const paid = await billState(request, token, billId);
      const payment = paid.payments[0];
      expect(paid.payments).toHaveLength(1);
      expect(payment).toMatchObject({
        occurrenceDate: f.first,
        paidDate: f.today,
        amountPaidCents: 6420,
        isAuto: false,
        isSkipped: false,
      });
      expect(paid.currentOccurrenceDate).toBe(f.second);
      expect(paid.isOverdue).toBe(true);
      // The next due date falls before the payment, so it cannot be completion plus one interval.
      expect(paid.currentOccurrenceDate < f.today).toBe(true);

      await expectAccessible(page, `bills dashboard after late payment (${theme})`);
      await shoot(page, `bills-after-late-payment-${theme}-1280`);
      await page.setViewportSize(PHONE);
      await expect(row).toContainText(`Due ${shown(f.second)}`);
      await expectAccessible(page, `bills dashboard after late payment (${theme}, 390px)`);
      await shoot(page, `bills-after-late-payment-${theme}-390`);
      await page.setViewportSize(DESKTOP);

      // Bill detail: the current due date, and the paid occurrence in the history.
      await row.click();
      await expect(page.getByRole('heading', { name: f.name, level: 1 })).toBeVisible();
      await expect(page.getByText(`Due ${shown(f.second)}`, { exact: true })).toBeVisible();
      const history = group(page, 'Payment history');
      await expect(history.getByText(`Paid on ${shown(f.today)} · $64.20`)).toBeVisible();
      await expect(
        history.getByRole('button', { name: `More actions for the ${shown(f.first)} payment` }),
      ).toBeVisible();
      await expectAccessible(page, `bill detail after late payment (${theme})`);
      await shoot(page, `bill-detail-after-late-payment-${theme}-1280`);
      await page.setViewportSize(PHONE);
      await expectAccessible(page, `bill detail after late payment (${theme}, 390px)`);
      await page.setViewportSize(DESKTOP);

      // Unpaid stays overdue: the second occurrence has no payment or skip, and the third date has
      // passed too. Neither makes the bill current in "This week" or "Later"; it stays Overdue.
      await page.goto('/bills');
      await expect(overdueRow(page, f.name)).toContainText(`Due ${shown(f.second)}`);
      await expect(
        group(page, 'This week').getByRole('link', { name: new RegExp(`^${f.name}`) }),
      ).toHaveCount(0);
      await expect(
        group(page, 'Later').getByRole('link', { name: new RegExp(`^${f.name}`) }),
      ).toHaveCount(0);
      const still = await billState(request, token, billId);
      expect(still.currentOccurrenceDate).toBe(f.second);
      expect(still.isOverdue).toBe(true);
      expect(still.payments).toHaveLength(1);

      // Clean up: archive hides the bill from every view, so no later journey sees it in Overdue.
      // The server's list is checked directly, then the Bills tab, reached in-app.
      await overdueRow(page, f.name).click();
      await page.getByRole('button', { name: `More actions for ${f.name}` }).click();
      await page.getByRole('menuitem', { name: 'Archive' }).click();
      await page
        .getByRole('alertdialog', { name: 'Archive this bill?' })
        .getByRole('button', { name: 'Archive bill' })
        .click();
      await expect(page.getByText(`Archived ${f.name}.`).first()).toBeVisible();
      expect(await householdBillIds(request, token, householdId)).not.toContain(billId);
      await page.getByRole('radio', { name: 'Bills' }).first().click();
      await expect(page.getByRole('link', { name: new RegExp(`^${f.name}`) })).toHaveCount(0);
    });
  });
}
