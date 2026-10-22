import { expect, test, type Page } from '@playwright/test';
import { expectDashboard, openList, signIn } from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { SEED } from '../support/env.ts';

/**
 * Journey 3: two browser contexts on one list, assert realtime propagation between members within
 * a second. Neither context ever reloads or clicks a retry — `useListRealtime` invalidates the
 * list query on a Postgres change, and TanStack Query's own refetch is what the other member sees.
 *
 * Alex and Casey are both Oak Street members by this point in the suite (Casey joined by code in
 * `03-invites-link-and-code.spec.ts`, and keeps that membership after `05-last-member-leaves.spec.ts`
 * deletes her own Empty House). Not Morgan: `06-owner-reset-password.spec.ts` changes her password
 * on purpose, and "no other test depends on Morgan's password" is that test's own comment. Each
 * theme adds and checks off its own item, so the two runs never race the same row.
 */

const TARGETS = { light: 'Sparkling Water', dark: 'Kettle Chips' } as const;

/** A tight bound: proof this arrived by realtime push, not a slower fallback poll. */
const REALTIME_TIMEOUT = 3_000;

async function addItem(page: Page, itemName: string): Promise<void> {
  await page.getByRole('button', { name: 'Add an item' }).click();
  await page.getByRole('dialog', { name: 'Add an item' }).getByLabel('Item').fill(itemName);
  await page.getByRole('button', { name: 'Add item' }).click();
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`journey 3 — realtime propagation between members (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('one member’s add and check-off appear for the other without a reload', async ({
      page,
      browser,
    }) => {
      const itemName = TARGETS[theme];

      const otherContext = await browser.newContext({ colorScheme: theme });
      const other = await otherContext.newPage();

      await signIn(page, SEED.alex.email);
      await expectDashboard(page, SEED.oakStreet.name);
      await openList(page, 'This Week');

      await signIn(other, SEED.casey.email);
      await expectDashboard(other, SEED.oakStreet.name);
      await openList(other, 'This Week');
      await expectAccessible(other, `This Week, second member (${theme})`);

      await addItem(page, itemName);
      await expect(page.getByRole('checkbox', { name: itemName })).toBeVisible();

      // Morgan's screen is never told to refetch by this test; only the realtime subscription can
      // put the row there.
      await expect(other.getByRole('checkbox', { name: itemName })).toBeVisible({
        timeout: REALTIME_TIMEOUT,
      });
      await expectAccessible(other, `This Week after the other member’s add (${theme})`);

      // A plain click, not `.check()`: checking it off moves the row into the (collapsed) Bought
      // group, so the element `.check()` would keep watching for its own state to change is the
      // one about to leave the DOM.
      await other.getByRole('checkbox', { name: itemName }).click();

      await expect(page.getByRole('checkbox', { name: itemName })).toHaveCount(0, {
        timeout: REALTIME_TIMEOUT,
      });
      await page.getByRole('button', { name: /^Bought \(\d+\)$/ }).click();
      await expect(
        page.locator('li').filter({ hasText: itemName }).getByRole('checkbox', { name: itemName }),
      ).toBeChecked();
      await expectAccessible(page, `This Week after the other member’s check-off (${theme})`);

      await otherContext.close();
    });
  });
}
