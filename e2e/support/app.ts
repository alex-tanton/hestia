import { expect, type Locator, type Page } from '@playwright/test';
import { SEED_PASSWORD } from './env.ts';

/** The top bar's household switcher; its accessible name ends ", switch household". */
export function switcher(page: Page): Locator {
  return page.getByRole('button', { name: /switch household$/ });
}

/** The dashboard is where every signed-in journey lands. */
export async function expectDashboard(page: Page, householdName: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'This Week', level: 1 })).toBeVisible();
  await expect(switcher(page)).toHaveText(new RegExp(householdName));
}

/**
 * Where a signed-in user lands when which household is theirs is not the point: the dashboard, or
 * onboarding's create-or-join step for someone with no membership left.
 */
export async function expectSignedIn(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { name: /^(This Week|Set up your household)$/, level: 1 }),
  ).toBeVisible();
}

export async function signIn(
  page: Page,
  email: string,
  password: string = SEED_PASSWORD,
): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const submit = page.getByRole('button', { name: 'Sign in' });
  await submit.click();
  // The screen is replaced on success, so this is what tells a caller the session exists before
  // it navigates somewhere of its own.
  await expect(submit).toHaveCount(0);
}

export async function openSettings(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Settings' }).first().click();
  await expect(
    page.getByRole('heading', { name: /^(Settings|My Households)$/, level: 1 }),
  ).toBeVisible();
}

/** Navigates to the pushed Households & Invites settings sub-route. */
export async function openHouseholdSettings(page: Page): Promise<void> {
  await openSettings(page);
  const button = page.getByRole('button', { name: /Households & Invites/ });
  if (await button.isVisible()) {
    await button.click();
    await expect(page.getByRole('heading', { name: 'Households', level: 1 })).toBeVisible();
  }
}

/** Navigates to the pushed Account settings sub-route. */
export async function openAccountSettings(page: Page): Promise<void> {
  await openSettings(page);
  const button = page.getByRole('button', { name: /^Account/ });
  if (await button.isVisible()) {
    await button.click();
    await expect(page.getByRole('heading', { name: 'Account', level: 1 })).toBeVisible();
  }
}

/** Navigates to the pushed Notifications settings sub-route. */
export async function openNotificationSettings(page: Page): Promise<void> {
  await openSettings(page);
  const button = page.getByRole('button', { name: /^Notifications/ });
  if (await button.isVisible()) {
    await button.click();
    await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible();
  }
}

/** Opens the switcher sheet and moves to another household. */
export async function switchHousehold(page: Page, householdName: string): Promise<void> {
  const switchButton = switcher(page);
  if (!(await switchButton.isVisible())) {
    const back = page.getByRole('link', { name: /Back/ });
    if (await back.isVisible()) {
      await back.click();
    } else {
      await page.goto('/');
    }
  }
  await switcher(page).click();
  const sheet = page.getByRole('dialog', { name: 'Households' });
  await sheet.getByRole('button', { name: new RegExp(householdName) }).click();
  await expect(sheet).toBeHidden();
}

/** Picks a member in one of the departure preview's reassignment selects. */
export async function reassign(page: Page, itemName: string, memberName: string): Promise<void> {
  const select = page.getByRole('combobox', { name: itemName });
  const isNative = await select.evaluate((el) => el.tagName.toLowerCase() === 'select');
  if (isNative) {
    await select.selectOption({ label: memberName });
    return;
  }
  await select.click();
  const option = select
    .locator('md-select-option')
    .filter({ hasText: memberName })
    .or(select.getByRole('option', { name: memberName }))
    .first();
  await option.click();
}

/** Opens a list from the Lists index by name. */
export async function openList(page: Page, listName: string): Promise<void> {
  await page.goto('/lists');
  await page.getByRole('link', { name: new RegExp(`^${listName}`) }).click();
  await expect(page.getByRole('heading', { name: listName, level: 1 })).toBeVisible();
}

/**
 * Waits for the service worker to finish installing and activating, so a caller about to go
 * offline knows the precache is actually there to serve a reload. First activation needs no user
 * prompt — only an update to an already-controlling worker does — so this resolves on the very
 * first visit.
 */
export async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
}
