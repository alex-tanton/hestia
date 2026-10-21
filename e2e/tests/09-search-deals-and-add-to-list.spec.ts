import { expect, test } from '@playwright/test';
import { expectDashboard, openList, signIn } from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { SEED } from '../support/env.ts';

/**
 * Journey 2: search deals, add an item to a list from the result, verify its store and price
 * snapshot, check it off, and see it move to the Bought group.
 *
 * Both targets are real 27514 favorite-store groceries, seeded by `supabase/seed/seed.sql`, at Food
 * Lion, one of Oak Street's favorites. Neither is already on "This Week". Each theme searches for
 * and adds a different one, so the two runs never touch the same row; each search is a
 * `deal_query_cache` hit this unit's `e2e-seed.sql` warms, so neither run ever calls Flipp
 * (see `12-deal-rate-discipline.spec.ts`).
 */

const TARGETS = {
  light: { query: 'Rainbow Bell Peppers', name: 'Food Lion Rainbow Bell Peppers', price: '$2.99' },
  dark: { query: 'Baby Cut Carrots', name: 'Food Lion Baby Cut Carrots', price: '$0.99' },
} as const;

for (const theme of ['light', 'dark'] as const) {
  test.describe(`journey 2 — search deals, add to a list, check it off (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('adds a real deal to This Week and moves it to Bought', async ({ page }) => {
      const target = TARGETS[theme];

      await signIn(page, SEED.alex.email);
      await expectDashboard(page, SEED.oakStreet.name);

      await page.goto('/lists/deals');
      await expect(page.getByRole('heading', { name: 'Deals', level: 1 })).toBeVisible();

      await page.getByLabel('Search deals').fill(target.query);
      await page.getByRole('button', { name: 'Search' }).click();

      const card = page.getByRole('article', { name: new RegExp(target.name) });
      await expect(card).toBeVisible();
      await expectAccessible(page, `deal search results (${theme})`);

      await card.getByRole('button', { name: `Add ${target.name} to a list` }).click();

      // Oak Street has two active lists ("This Week" and "Weekend Cookout"), so the picker opens
      // rather than adding straight away.
      const picker = page.getByRole('dialog', { name: 'Add to which list?' });
      await expect(picker).toBeVisible();
      await expectAccessible(page, `add-to-list picker (${theme})`);
      await picker.getByRole('button', { name: /^This Week/ }).click();
      await expect(picker).toBeHidden();
      // The toast's own text and its screen-reader-only live-region echo both say it, so this is
      // the one place in the suite a text lookup needs `.first()` rather than a unique match.
      await expect(page.getByText('Added to This Week.').first()).toBeVisible();

      await openList(page, 'This Week');
      // The store group is a labelled region (`StoreGroupHeader`'s `aria-labelledby`), not just any
      // section that happens to contain the heading text — the screen's own outer section does too.
      const foodLion = page.getByRole('region', { name: 'Food Lion' });
      const activeCheckbox = foodLion.getByRole('checkbox', { name: target.name });
      await expect(activeCheckbox).toBeVisible();
      await expect(foodLion).toContainText(target.price);
      await expectAccessible(page, `This Week with the new deal (${theme})`);

      // A plain click, not `.check()`: checking it off moves the row out of this group entirely
      // (into the initially-collapsed Bought list), so the element `.check()` would keep watching
      // for its own state to change is the one about to be removed from the DOM.
      await activeCheckbox.click();
      await expect(foodLion.getByRole('checkbox', { name: target.name })).toHaveCount(0);

      const boughtToggle = page.getByRole('button', { name: /^Bought \(\d+\)$/ });
      await boughtToggle.click();
      const boughtRow = page.locator('li').filter({ hasText: target.name });
      await expect(boughtRow.getByRole('checkbox', { name: target.name })).toBeChecked();
      await expect(boughtRow).toContainText('Food Lion');
      await expect(boughtRow).toContainText(target.price);
      await expectAccessible(page, `This Week after checking it off (${theme})`);
    });
  });
}
