import { expect, test } from '@playwright/test';
import { DESKTOP, PHONE, group, screenshotsInto } from '../support/bills.ts';
import { expectDashboard, signIn } from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { SEED } from '../support/env.ts';

/**
 * Bills and subscriptions, against the seeded stack. Figures and orders are the seed data's
 * oracles: Alex sees Spectrum Internet and Spotify for $86.98 a month, Sam sees Spectrum Internet
 * and Adobe for $134.98, and Adobe is invisible to Alex. Hearth never moves money, so the journeys
 * only record payments and skips.
 */

const shoot = screenshotsInto('u4-4');

for (const theme of ['light', 'dark'] as const) {
  test.describe(`bills and subscriptions, read-only (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('the dashboard card, groups, detail, and subscriptions match the seed', async ({
      page,
    }) => {
      await page.setViewportSize(DESKTOP);
      await signIn(page, SEED.alex.email);
      await expectDashboard(page, SEED.oakStreet.name);

      // The Bills card flags the overdue bill in words, not only color.
      const card = page.getByRole('region', { name: /^Bills/ });
      await expect(card.getByText('Duke Energy')).toBeVisible();
      await expect(card.getByText('Overdue')).toBeVisible();
      await shoot(page, `dashboard-${theme}-1280`);

      // The bills list: Overdue, This week, Later. Alex's own and household bills only.
      await page.goto('/bills');
      const overdue = group(page, 'Overdue');
      await expect(overdue.getByRole('link', { name: /^Duke Energy/ })).toContainText('$142.30');
      await expect(overdue.getByRole('link', { name: /^Duke Energy/ })).toContainText('Overdue');
      // Which week a bill lands in depends on the weekday the suite runs, so this journey checks
      // each row's own labels; the grouping rule itself is covered by the unit tests.
      await expect(page.getByRole('link', { name: /^Spectrum Internet/ })).toContainText('Autopay');
      await expect(page.getByRole('link', { name: /^Spotify/ })).toContainText('Personal');
      // Sam's personal bill is invisible to Alex.
      await expect(page.getByText('Adobe Creative Cloud')).toHaveCount(0);
      await expectAccessible(page, `bills dashboard (${theme})`);
      await shoot(page, `bills-${theme}-1280`);
      await page.setViewportSize(PHONE);
      await shoot(page, `bills-${theme}-390`);
      await expectAccessible(page, `bills dashboard (${theme}, 390px)`);
      await page.setViewportSize(DESKTOP);

      // Bill detail: automatic payments are labelled "Autopay" in the history; Spectrum has three.
      await page.getByRole('link', { name: /^Spectrum Internet/ }).click();
      await expect(
        page.getByRole('heading', { name: 'Spectrum Internet', level: 1 }),
      ).toBeVisible();
      const history = group(page, 'Payment history');
      await expect(history.getByText('Autopay')).toHaveCount(3);
      await expect(page.getByText(/^Next due dates: /)).toBeVisible();
      await expectAccessible(page, `bill detail (${theme})`);
      await shoot(page, `bill-detail-${theme}-1280`);
      await page.setViewportSize(PHONE);
      await expectAccessible(page, `bill detail (${theme}, 390px)`);
      await shoot(page, `bill-detail-${theme}-390`);
      await page.setViewportSize(DESKTOP);

      // Subscriptions: the total is the API's figure; rows are ordered by monthly cost, descending.
      await page.goto('/bills/subscriptions');
      await expect(page.getByText('Total per month')).toBeVisible();
      await expect(page.getByText('$86.98', { exact: true })).toBeVisible();
      const rows = page.getByRole('main').getByRole('listitem');
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(0)).toContainText('Spectrum Internet');
      await expect(rows.nth(0)).toContainText('$74.99/mo');
      await expect(rows.nth(0)).toContainText('$899.88/yr');
      await expect(rows.nth(1)).toContainText('Spotify');
      await expect(rows.nth(1)).toContainText('Personal');
      await expect(rows.nth(1)).toContainText('$143.88/yr');
      await expectAccessible(page, `subscriptions (${theme})`);
      await shoot(page, `subscriptions-${theme}-1280`);
      await page.setViewportSize(PHONE);
      await shoot(page, `subscriptions-${theme}-390`);
      await expectAccessible(page, `subscriptions (${theme}, 390px)`);
    });
  });
}

test.describe('bills and subscriptions, writes', () => {
  test.use({ colorScheme: 'light' });

  test('marks Duke Energy paid, skips Water and Sewer, and shows the offline explanation', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await signIn(page, SEED.alex.email);
    await page.goto('/bills');

    // Paying writes the log for the current occurrence, so the overdue group empties.
    await group(page, 'Overdue')
      .getByRole('button', { name: /^Mark paid, Duke Energy/ })
      .click();
    // Toast plus its live-region echo, as with the skip toast below.
    await expect(page.getByText('Marked Duke Energy paid.').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Overdue', level: 2 })).toHaveCount(0);

    // Skip is in the overflow menu and names the bill and date before anything is written.
    await page.getByRole('button', { name: 'More actions for Water and Sewer' }).click();
    await page.getByRole('menuitem', { name: 'Skip' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Skip this bill?' });
    await expect(dialog).toContainText(
      /Skip the \d{2}\/\d{2}\/\d{4} Water and Sewer bill\? It won't be marked paid\./,
    );
    await dialog.getByRole('button', { name: 'Skip bill' }).click();
    // The toast and its screen-reader live-region echo both say it, so the text matches twice.
    await expect(page.getByText('Skipped Water and Sewer.').first()).toBeVisible();

    // Offline: writes are disabled with the one-line reason, and the list stays readable.
    await page.context().setOffline(true);
    await expect(page.getByRole('button', { name: 'Add a bill' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(page.getByText('Needs a connection.').first()).toBeVisible();
    await expect(group(page, 'Later').getByRole('link', { name: /^Spotify/ })).toBeVisible();
    await expectAccessible(page, 'bills dashboard, offline (light)');
    await shoot(page, 'bills-offline-light-1280');
    await page.context().setOffline(false);
  });

  test("Still using resets the 60-day clock on Sam's personal subscription", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signIn(page, SEED.sam.email);
    await expectDashboard(page, SEED.oakStreet.name);
    await page.goto('/bills/subscriptions');

    // The API flags Adobe (confirmed 70 days ago) and not Spectrum for Sam. The client only
    // renders the flag it is given.
    const adobe = page.getByRole('listitem').filter({ hasText: 'Adobe Creative Cloud' });
    const spectrum = page.getByRole('listitem').filter({ hasText: 'Spectrum Internet' });
    await expect(adobe).toContainText('Still using this?');
    await expect(adobe).toContainText('Personal');
    await expect(spectrum).not.toContainText('Still using this?');
    await expect(page.getByText('$134.98', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Still using, Adobe Creative Cloud' }).click();
    await expect(adobe).not.toContainText('Still using this?');
    // Confirming usage keeps the subscription tracked and its total unchanged.
    await expect(adobe).toBeVisible();
    await expect(page.getByText('$134.98', { exact: true })).toBeVisible();
    await expectAccessible(page, 'subscriptions after still using (light)');
  });
});
