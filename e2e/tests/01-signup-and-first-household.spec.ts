import { expect, test, type Page } from '@playwright/test';
import { expectDashboard, switcher } from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { SEED, SEED_PASSWORD } from '../support/env.ts';

/**
 * Journey 1: sign up with email and password, create a household, set the postal code and
 * favorites, reach the dashboard. Favorites are the merchants with an active flyer near the postal
 * code the previous step set, picking none is allowed.
 */

/** E2E-only accounts: one per theme, because each run creates a real account. */
const ACCOUNTS = {
  light: {
    displayName: 'Riley Park',
    email: 'riley@example.com',
    household: 'Maple Court',
  },
  dark: {
    displayName: 'Drew Alvarez',
    email: 'drew@example.com',
    household: 'Birch Lane',
  },
} as const;

async function finishInstallStep(page: Page): Promise<void> {
  // Chromium offers `beforeinstallprompt` when it feels like it, so the step ends on whichever
  // of its two "go to the app" controls this run rendered.
  await page.getByRole('button', { name: /^(Go to Hearth|Not now)$/ }).click();
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`journey 1 — sign up and create a household (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('reaches the dashboard through onboarding', async ({ page }) => {
      const account = ACCOUNTS[theme];

      await page.goto('/sign-up');
      await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
      await expectAccessible(page, `sign up (${theme})`);

      await page.getByLabel('Display name').fill(account.displayName);
      await page.getByLabel('Email').fill(account.email);
      await page.getByLabel('Password').fill(SEED_PASSWORD);
      await page.getByRole('button', { name: 'Create account' }).click();

      await expect(page.getByRole('heading', { name: 'Set up your household' })).toBeVisible();
      await expectAccessible(page, `onboarding, create or join (${theme})`);
      await page.getByRole('button', { name: 'Create a household' }).click();

      await expect(page.getByRole('heading', { name: 'Name your household' })).toBeVisible();
      await page.getByLabel('Household name').fill(account.household);
      await page.getByLabel('ZIP code').fill(SEED.oakStreet.postalCode);
      await expectAccessible(page, `onboarding, name the household (${theme})`);
      await page.getByRole('button', { name: 'Create household' }).click();

      // A brand-new household has no favorites yet; picking none is allowed, so the step lists the
      // merchants near the postal code, all unchecked, and moves on.
      await expect(page.getByRole('heading', { name: 'Favorite stores' })).toBeVisible();
      const stores = page.getByRole('checkbox');
      await expect(stores.first()).toBeVisible();
      for (const checkbox of await stores.all()) {
        await expect(checkbox).not.toBeChecked();
      }
      await expectAccessible(page, `onboarding, favorite stores (${theme})`);
      await page.getByRole('button', { name: 'Continue' }).click();

      await expect(
        page.getByRole('heading', { name: 'Add Hearth to your home screen' }),
      ).toBeVisible();
      await expectAccessible(page, `onboarding, install (${theme})`);
      await finishInstallStep(page);

      await expectDashboard(page, account.household);
      await expect(switcher(page)).toHaveText(new RegExp(account.household));
      await expectAccessible(page, `dashboard (${theme})`);
    });
  });
}
