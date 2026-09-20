import { expect, test, type Browser, type Page } from '@playwright/test';
import { expectDashboard, openSettings, signIn } from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { queryValue } from '../support/db.ts';
import { SEED } from '../support/env.ts';

/**
 * Handoff, Phase 1 "Done when": a user signs up with a password, creates a household, invites a
 * second user, and that user joins by link and a third by code. Journey 1 covers the signup and
 * the household; this covers the invite, both ways in.
 *
 * Morgan takes the link the admin has just created; Casey types the code Seed Data publishes for
 * Oak Street's outstanding invite, which also checks that a seeded invite is redeemable.
 */

function memberCount(householdName: string): number {
  return Number(
    queryValue(
      `select count(*) from public.household_member m
         join public.household h on h.id = m.household_id
        where h.name = '${householdName}'`,
    ),
  );
}

async function signedInPage(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, email);
  return page;
}

test('an admin invites, one member joins by link and another by code', async ({
  page,
  browser,
}) => {
  const before = memberCount(SEED.oakStreet.name);

  await signIn(page, SEED.alex.email);
  await expectDashboard(page, SEED.oakStreet.name);
  await openSettings(page);

  await page.getByRole('button', { name: 'Create an invite' }).click();
  await expect(page.getByRole('heading', { name: 'Share this invite' })).toBeVisible();
  await expectAccessible(page, 'settings, a new invite');

  // The link and the code are returned once, by the creating request, and never again.
  const link = (await page.getByText(/\/join#token=/).innerText()).trim();
  expect(link).toContain('/join#token=');

  const morgan = await signedInPage(browser, SEED.morgan.email);
  await morgan.goto(link);
  const installStep = morgan.getByRole('heading', { name: 'Add Hearth to your home screen' });
  await expect(installStep).toBeVisible();
  await morgan.getByRole('button', { name: /^(Go to Hearth|Not now)$/ }).click();
  await expectDashboard(morgan, SEED.oakStreet.name);
  await expectAccessible(morgan, 'dashboard after joining by link');
  await morgan.context().close();

  const casey = await signedInPage(browser, SEED.casey.email);
  await expectDashboard(casey, SEED.emptyHouse.name);
  await openSettings(casey);
  await casey.getByRole('button', { name: 'Join or create a household' }).click();
  await expect(casey.getByRole('heading', { name: 'Set up your household' })).toBeVisible();
  await casey.getByRole('button', { name: 'Join with a code' }).click();
  await casey.getByLabel('Invite code').fill(SEED.outstandingInviteCode);
  await casey.getByRole('button', { name: 'Join household' }).click();
  await expectDashboard(casey, SEED.oakStreet.name);
  await casey.context().close();

  expect(memberCount(SEED.oakStreet.name)).toBe(before + 2);
});
