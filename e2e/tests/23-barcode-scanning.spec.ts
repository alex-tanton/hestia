import { expect, test } from '@playwright/test';
import { expectDashboard, openList, signIn } from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { SEED } from '../support/env.ts';

/**
 * Journey 23: Barcode scanning sheet add and shop check-off across color schemes (TEST-03, D-06).
 * Tests the complete barcode lifecycle in the shopping list:
 * 1. Open scanner dialog, switch to manual keypad entry.
 * 2. In 'Add to List' mode, enter seeded barcode '012345678905', verify ItemSheet pre-populates metadata, and add item.
 * 3. In 'Shop & Check Off' mode, enter the same barcode, find the unbought item, mark it bought, and verify in Bought section.
 * 4. Verify WCAG 2.1 AA accessibility across scanner dialog, manual keypad, ItemSheet, and updated list in both light and dark themes.
 */

const TEST_BARCODE = '012345678905';

for (const theme of ['light', 'dark'] as const) {
  test.describe(`journey 23 — barcode scanning and check-off (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('adds an item via manual barcode lookup and marks it bought via barcode check-off', async ({
      page,
    }) => {
      await signIn(page, SEED.alex.email);
      await expectDashboard(page, SEED.oakStreet.name);

      await openList(page, 'This Week');
      await expect(page.getByRole('heading', { name: 'This Week', level: 1 })).toBeVisible();

      // 1. Open Barcode Scanner Dialog
      await page.getByRole('button', { name: /scan barcode/i }).click();
      const scanner = page.getByRole('dialog', { name: 'Barcode Scanner' });
      await expect(scanner).toBeVisible();
      await expectAccessible(page, `barcode scanner camera viewport (${theme})`);

      // 2. Switch to manual keypad entry
      await page.getByRole('button', { name: 'Switch to manual entry' }).click();
      await expect(page.getByLabel('Enter Barcode (UPC / EAN)')).toBeVisible();
      await expectAccessible(page, `barcode scanner manual keypad (${theme})`);

      // 3. Switch mode to 'Add to List'
      await page.getByLabel('Scanner Mode').getByText('Add to List').click();

      // 4. Input seeded test barcode
      await page.getByLabel('Enter Barcode (UPC / EAN)').fill(TEST_BARCODE);

      // 5. Submit barcode to resolve metadata and open ItemSheet
      await page.getByRole('button', { name: 'Add to List', exact: true }).click();

      // Verify ItemSheet opens with pre-populated product name
      const itemSheet = page.getByRole('dialog', { name: /Add (an )?item/i });
      await expect(itemSheet).toBeVisible();
      const nameInput = itemSheet.getByLabel('Item', { exact: true });
      await expect(nameInput).toHaveValue(/Organic Whole Milk/i);
      await expectAccessible(page, `item sheet from barcode resolution (${theme})`);

      // Confirm adding item to list
      await itemSheet.getByRole('button', { name: 'Add item' }).click();
      await expect(itemSheet).toBeHidden();

      // Verify item appears in the list under unbought items
      const addedRow = page.locator('li').filter({ hasText: /Organic Whole Milk/i });
      await expect(addedRow.first()).toBeVisible();
      await expectAccessible(page, `shopping list with barcode item added (${theme})`);

      // 6. Reopen Barcode Scanner in Shop mode to test barcode check-off
      await page.getByRole('button', { name: /scan barcode/i }).click();
      await expect(scanner).toBeVisible();

      // Switch to manual entry
      await page.getByRole('button', { name: 'Switch to manual entry' }).click();
      await expect(page.getByLabel('Enter Barcode (UPC / EAN)')).toBeVisible();

      // Ensure mode is 'Shop & Check Off'
      await page.getByLabel('Scanner Mode').getByText('Shop & Check Off').click();

      // Input the barcode of the newly added item
      await page.getByLabel('Enter Barcode (UPC / EAN)').fill(TEST_BARCODE);

      // Submit check-off
      await page.getByRole('button', { name: 'Find & Mark Bought' }).click();

      // 7. Verify toast confirms check-off
      await expect(page.getByText(/marked bought/i).first()).toBeVisible();

      // 8. Expand Bought section and verify item is moved to Bought with checked checkbox
      const boughtToggle = page.getByRole('button', { name: /^Bought \(\d+\)$/ });
      await boughtToggle.click();

      const boughtRow = page.locator('li').filter({ hasText: /Organic Whole Milk/i });
      await expect(boughtRow.first().getByRole('checkbox')).toBeChecked();
      await expectAccessible(page, `shopping list after barcode check-off (${theme})`);
    });
  });
}
