import { expect, test } from '@playwright/test';
import { expectDashboard } from '../support/app.ts';
import { readStackEnv, SEED } from '../support/env.ts';
import {
  extractConfirmationUrl,
  extractOtpCode,
  purgeMailbox,
  waitForLatestEmail,
} from '../support/inbucket.ts';

test('the flag the stack was built with is on', () => {
  expect(readStackEnv()['HESTIA_MAGIC_LINK_ENABLED']).toBe('true');
});

test('sign-in offers the secondary magic link button with or divider', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible();
  await expect(page.getByText('or', { exact: true })).toBeVisible();
});

test('uninvited email address is rejected without dispatching email', async ({ page }) => {
  await purgeMailbox('uninvited');
  await page.goto('/sign-in/link');
  await page.getByLabel('Email').fill('uninvited@example.com');
  await page.getByRole('button', { name: 'Send sign-in link' }).click();

  await expect(
    page.getByText('No account found with this email. Ask your household admin for an invite.'),
  ).toBeVisible();

  // Wait 1.5s to ensure no email arrived in Inbucket
  let arrived = false;
  try {
    await waitForLatestEmail('uninvited@example.com', 1500);
    arrived = true;
  } catch {
    // Expected timeout
  }
  expect(arrived).toBe(false);
});

test('valid user receives OTP email and signs in with 6-digit code', async ({ page }) => {
  await purgeMailbox(SEED.alex.email);
  await page.goto('/sign-in/link');
  await page.getByLabel('Email').fill(SEED.alex.email);
  await page.getByRole('button', { name: 'Send sign-in link' }).click();

  await page.getByRole('button', { name: 'Enter the code' }).click();
  await expect(page).toHaveURL(/\/sign-in\/code$/);

  const email = await waitForLatestEmail(SEED.alex.email);
  expect(email.from).toContain('auth@aberrance.app');
  expect(email.subject).toBe('Your Magic Link');

  const code = extractOtpCode(email);
  await page.getByLabel('6-digit code').fill(code);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expectDashboard(page, 'Rivera Family');
});

test('invalid OTP code displays error message', async ({ page }) => {
  await page.goto('/sign-in/link');
  await page.getByLabel('Email').fill(SEED.alex.email);
  await page.getByRole('button', { name: 'Send sign-in link' }).click();

  await page.getByRole('button', { name: 'Enter the code' }).click();
  await expect(page).toHaveURL(/\/sign-in\/code$/);

  await page.getByLabel('6-digit code').fill('000000');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(
    page.getByText('That code is incorrect or has expired. Ask for a new one.'),
  ).toBeVisible();
});

test('valid user signs in directly via confirmation link in email', async ({ browser }) => {
  await purgeMailbox(SEED.sam.email);
  const context = await browser.newContext();
  const fresh = await context.newPage();

  try {
    await fresh.goto('/sign-in/link');
    await fresh.getByLabel('Email').fill(SEED.sam.email);
    await fresh.getByRole('button', { name: 'Send sign-in link' }).click();

    const email = await waitForLatestEmail(SEED.sam.email);
    const confirmationUrl = extractConfirmationUrl(email);

    await fresh.goto(confirmationUrl);
    await expectDashboard(fresh, 'Oak Street');
  } finally {
    await context.close();
  }
});

test('resend code button enforces 30-second cooldown timer', async ({ page }) => {
  await page.goto('/sign-in/link');
  await page.getByLabel('Email').fill(SEED.alex.email);
  await page.getByRole('button', { name: 'Send sign-in link' }).click();

  await page.getByRole('button', { name: 'Enter the code' }).click();
  await expect(page).toHaveURL(/\/sign-in\/code$/);

  const resendButton = page.getByRole('button', { name: /Send a new code/i });
  await expect(resendButton).toBeDisabled();
  await expect(page.getByText(/You can ask for a new code in/)).toBeVisible();
});

test('rejects open redirects outside the application origin', async ({ request }) => {
  const apikey = readStackEnv()['ANON_KEY'] ?? '';
  const response = await request.post('/auth/v1/otp', {
    headers: { apikey },
    data: {
      email: SEED.jordan.email,
      create_user: false,
    },
    params: {
      redirect_to: 'https://malicious-site.example/steal',
    },
  });

  expect(response.ok()).toBe(false);
  expect([400, 422, 429]).toContain(response.status());
});
