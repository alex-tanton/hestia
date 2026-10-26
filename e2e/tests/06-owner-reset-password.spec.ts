import { expect, test } from '@playwright/test';
import { expectSignedIn, signIn } from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { hestiaAdmin } from '../support/db.ts';
import { BASE_URL, SEED } from '../support/env.ts';

/**
 * The owner CLI prints a reset link that lets a user set a new password, and the forgot-password
 * screen tells everyone else to ask the server owner.
 *
 * There is no email-based reset — nothing is ever emailed — so the link comes from `hestia-admin
 * reset-password`, run where it lives: a bin on the service container's PATH. Morgan is the
 * subject, because no other test depends on Morgan's password.
 */

const NEW_PASSWORD = 'hestia-reset-pass-2026';

test('the forgot-password screen points at the server owner', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByRole('link', { name: 'Forgot password?' }).click();

  await expect(page.getByRole('heading', { name: 'Forgot password', level: 1 })).toBeVisible();
  await expect(
    page.getByText('Ask your server owner for a reset link. They can create one for you.'),
  ).toBeVisible();
  // There is no form to fill in: nothing here takes an email address.
  await expect(page.locator('input')).toHaveCount(0);
  await expectAccessible(page, 'forgot password');
});

test('the owner CLI prints a link that sets a new password', async ({ page, browser }) => {
  const printed = hestiaAdmin(['reset-password', SEED.morgan.email]);
  expect(printed.status, printed.stderr).toBe(0);
  const link = printed.stdout.trim();
  expect(link.startsWith(`${BASE_URL}/auth/v1/verify`), link).toBe(true);

  // GoTrue's /verify hands the recovery session to the PWA's set-new-password screen.
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
  await expectAccessible(page, 'set a new password');

  await page.getByLabel('New password').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Set password' }).click();
  await expectSignedIn(page);

  // And the new password is the one that works from a session that never saw the link.
  const fresh = await (await browser.newContext()).newPage();
  await signIn(fresh, SEED.morgan.email, NEW_PASSWORD);
  await expectSignedIn(fresh);
  await fresh.context().close();
});
