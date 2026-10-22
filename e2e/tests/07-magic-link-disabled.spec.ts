import { expect, test } from '@playwright/test';
import { readStackEnv } from '../support/env.ts';

/**
 * With the magic-link flag off, no magic-link UI is reachable.
 * The flag is a build-time decision — the caddy image build turns HEARTH_MAGIC_LINK_ENABLED into
 * VITE_MAGIC_LINK_ENABLED, so no flag reaches the browser at runtime — which is why this asserts
 * against the built PWA the stack is serving.
 *
 * The screens themselves exist in the source tree, so this is the test that proves building them
 * is not the same as shipping them: with the flag off their routes are never registered and the
 * bundler folds their chunks away.
 */

const MAGIC_LINK_WORDING = /email me a sign-in link|sign-in link|magic link|check your email/i;

/** apps/web/src/screens/onboarding/magic-link.ts: where the two screens live when built. */
const MAGIC_LINK_PATHS = ['/sign-in/link', '/sign-in/code'];

test('the flag the stack was built with is off', () => {
  expect(readStackEnv()['HEARTH_MAGIC_LINK_ENABLED']).toBe('false');
});

test('sign-in offers no way to a magic link', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: 'Sign in', level: 1 })).toBeVisible();

  // The only ways on from sign-in are the two the screen is specified to have.
  const links = await page.getByRole('link').allInnerTexts();
  expect(links.map((text) => text.trim())).toEqual([
    'Skip to main content',
    'Forgot password?',
    'Create an account',
  ]);
  await expect(page.getByText(MAGIC_LINK_WORDING)).toHaveCount(0);
  // No code field either: the six-digit entry is part of the same folded-away path.
  await expect(page.getByLabel(/code/i)).toHaveCount(0);
});

test('the magic-link routes land on the ordinary sign-in screen', async ({ page }) => {
  for (const path of MAGIC_LINK_PATHS) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole('heading', { name: 'Sign in', level: 1 })).toBeVisible();
    await expect(page.getByText(MAGIC_LINK_WORDING)).toHaveCount(0);
  }
});
