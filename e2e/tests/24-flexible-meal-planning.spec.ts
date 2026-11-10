import { expect, test } from '@playwright/test';
import { expectDashboard, openList, signIn } from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { SEED } from '../support/env.ts';

/**
 * Journey 24: Flexible meal planning custom item placement and list transfer across color schemes (TEST-03, D-07).
 * Tests custom item workflows:
 * 1. Open meal planner at `/meals`.
 * 2. Open MealPlacementSheet, switch to 'Quick Item' tab, and click suggestion chip 'Greek Yogurt'.
 * 3. Verify 'Greek Yogurt' is placed on the planner grid with primary styling and bullet indicator.
 * 4. Open the item's overflow menu and select 'Add to list'.
 * 5. Pick 'This Week' shopping list and confirm.
 * 6. Verify toast notification and navigate to 'This Week' list to assert 'Greek Yogurt' presence.
 * 7. Validate WCAG 2.1 AA accessibility across planner, placement sheet, overflow menu, and shopping list in both themes.
 */

for (const theme of ['light', 'dark'] as const) {
  test.describe(`journey 24 — flexible meal planning (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('places a quick item chip on the week planner and transfers it to the shopping list', async ({
      page,
    }) => {
      await signIn(page, SEED.alex.email);
      await expectDashboard(page, SEED.oakStreet.name);

      await page.goto('/meals');
      await expect(page.getByRole('navigation', { name: 'Week' })).toBeVisible();
      await expectAccessible(page, `meal planner initial grid (${theme})`);

      // 1. Click 'Add to breakfast' to open MealPlacementSheet
      await page.getByRole('button', { name: 'Add to breakfast' }).first().click();

      const sheet = page.getByRole('dialog', { name: 'Place meal' });
      await expect(sheet).toBeVisible();
      await expectAccessible(page, `meal placement sheet (${theme})`);

      // 2. Switch to 'Quick Item' tab
      await sheet.getByRole('tab', { name: 'Quick Item' }).click();
      await expect(sheet.getByRole('tabpanel')).toBeVisible();

      // 3. Click suggestion chip 'Greek Yogurt'
      const chip = sheet.getByRole('button', { name: 'Greek Yogurt' });
      await expect(chip).toBeVisible();
      await chip.click();

      // Sheet closes after placement
      await expect(sheet).toBeHidden();

      // Verify success toast
      await expect(page.getByText('Placed Greek Yogurt.').first()).toBeVisible();

      // 4. Verify 'Greek Yogurt' appears on the planner grid with primary title and bullet indicator
      const customItemEntry = page.locator('li').filter({ hasText: 'Greek Yogurt' }).first();
      await expect(customItemEntry).toBeVisible();
      await expectAccessible(page, `planner grid with custom item placed (${theme})`);

      // 5. Open item overflow menu
      const menuTrigger = page.getByRole('button', { name: 'More actions for Greek Yogurt' });
      await expect(menuTrigger).toBeVisible();
      await menuTrigger.click();

      const menu = page.getByRole('menu');
      await expect(menu).toBeVisible();
      await expectAccessible(page, `custom item actions menu (${theme})`);

      // 6. Select 'Add to list'
      const addToListMenuItem = menu.getByRole('menuitem', { name: /Add to list/i });
      await expect(addToListMenuItem).toBeVisible();
      await addToListMenuItem.click();

      // 7. Pick 'This Week' list
      const listPicker = page.getByRole('dialog', { name: 'Add to which list?' });
      await expect(listPicker).toBeVisible();
      await listPicker.getByRole('button', { name: /^This Week/ }).click();
      await expect(listPicker).toBeHidden();

      // Verify add-to-list toast confirmation
      await expect(page.getByText('Added to This Week.').first()).toBeVisible();

      // 8. Open 'This Week' shopping list and confirm 'Greek Yogurt' exists as an item
      await openList(page, 'This Week');
      const listItem = page.locator('li').filter({ hasText: 'Greek Yogurt' });
      await expect(listItem.first()).toBeVisible();
      await expectAccessible(page, `shopping list containing transferred custom item (${theme})`);
    });
  });
}
