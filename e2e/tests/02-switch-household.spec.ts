import { expect, test, type Page } from '@playwright/test';
import {
  expectDashboard,
  openSettings,
  signIn,
  switchHousehold,
  switcher,
} from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { SEED } from '../support/env.ts';

/**
 * Journey 9: switch household, and assert no data from the previous household remains visible.
 * Alex belongs to Oak Street and Rivera Family, which is the fixture this exists for. In Phase 1
 * the household-scoped surfaces are the switcher, Household settings, and the admin's invite list;
 * My Households is the caller's own membership list, one of the two responses Requirements lets
 * span households, so both names belong there.
 */

const NO_INVITES = 'No invites are outstanding. Create one to add someone to this household.';

/** The switcher sheet marks exactly one household as the current one. */
async function expectCurrentInSwitcher(page: Page, householdName: string): Promise<void> {
  await switcher(page).click();
  const sheet = page.getByRole('dialog', { name: 'Households' });
  await expect(sheet.getByRole('button', { name: householdName })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(sheet.getByText('Current')).toHaveCount(1);
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toBeHidden();
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`journey 9 — switch household (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('swaps the whole context, leaving nothing of the old household', async ({ page }) => {
      await signIn(page, SEED.alex.email);
      await expectDashboard(page, SEED.oakStreet.name);
      await expectAccessible(page, `dashboard, Oak Street (${theme})`);
      await expectCurrentInSwitcher(page, SEED.oakStreet.name);

      await openSettings(page);
      await expect(page.getByLabel('Household name')).toHaveValue(SEED.oakStreet.name);
      await expect(page.getByLabel('ZIP code')).toHaveValue(SEED.oakStreet.postalCode);
      // Oak Street has an outstanding invite, so it has a
      // revocable row here. Its expired and revoked invites are not outstanding and never show.
      await expect(page.getByRole('button', { name: 'Revoke' })).not.toHaveCount(0);
      await expect(page.getByText(NO_INVITES)).toHaveCount(0);
      await expectAccessible(page, `settings, Oak Street (${theme})`);

      await switchHousehold(page, SEED.riveraFamily.name);
      await expectDashboard(page, SEED.riveraFamily.name);
      await expectCurrentInSwitcher(page, SEED.riveraFamily.name);

      await openSettings(page);
      // The household-scoped settings are Rivera Family's, and only Rivera Family's.
      await expect(page.getByLabel('Household name')).toHaveValue(SEED.riveraFamily.name);
      await expect(page.getByLabel('ZIP code')).toHaveValue(SEED.riveraFamily.postalCode);
      // Oak Street's outstanding invite does not follow the user across the switch.
      await expect(page.getByRole('button', { name: 'Revoke' })).toHaveCount(0);
      await expect(page.getByText(NO_INVITES)).toBeVisible();
      await expectAccessible(page, `settings, Rivera Family (${theme})`);

      // Back again, so the next run starts where this one did and the swap is proven both ways.
      await switchHousehold(page, SEED.oakStreet.name);
      await expectDashboard(page, SEED.oakStreet.name);
      await openSettings(page);
      await expect(page.getByLabel('ZIP code')).toHaveValue(SEED.oakStreet.postalCode);
    });
  });
}
