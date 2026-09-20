import { expect, type Locator, type Page } from '@playwright/test';
import { SEED_PASSWORD } from './env.ts';

/** The top bar's household switcher; its accessible name ends ", switch household". */
export function switcher(page: Page): Locator {
  return page.getByRole('button', { name: /switch household$/ });
}

/** The dashboard is where every signed-in journey lands (Design › Screens › 2). */
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
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'My Households' })).toBeVisible();
}

/** Opens the switcher sheet and moves to another household (Design › Screens › 3). */
export async function switchHousehold(page: Page, householdName: string): Promise<void> {
  await switcher(page).click();
  const sheet = page.getByRole('dialog', { name: 'Households' });
  await sheet.getByRole('button', { name: householdName }).click();
  await expect(sheet).toBeHidden();
}

/** Picks a member in one of the departure preview's reassignment selects. */
export async function reassign(page: Page, itemName: string, memberName: string): Promise<void> {
  await page.getByRole('combobox', { name: itemName }).click();
  await page.getByRole('option', { name: memberName }).click();
}
