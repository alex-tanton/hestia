import { randomBytes } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import {
  expectDashboard,
  openSettings,
  signIn,
  switcher,
  waitForServiceWorker,
} from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { hearthAdmin } from '../support/db.ts';
import { SEED, SEED_PASSWORD } from '../support/env.ts';

/**
 * The screen states no journey passes through (axe-core runs on every screen in both themes). Each
 * one needs a special seed, an offline connection, a device or browser the suite fakes, or a dialog
 * a journey does not open. Every state runs in both themes.
 *
 * Accounts: Riley (light) and Drew (dark) each own a household journey 1 created with no data
 * and no favorite stores, so it is the first-run household. Alex owns Oak Street, which is read
 * here, not changed, because later journeys depend on it.
 *
 * This file sorts before journeys 18 to 20 and runs after journey 16, so its reads see the seed as
 * journeys 1 to 16 left it. Any state it changes is in a household it owns, or is put back.
 */

const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

/** The first-run household journey 1 created for each theme's account. */
const FIRST_RUN: Record<Theme, { email: string; household: string }> = {
  light: { email: 'riley@example.com', household: 'Maple Court' },
  dark: { email: 'drew@example.com', household: 'Birch Lane' },
};

const IOS_IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/** The copy each state shows, as the screens word it. */
const COPY = {
  signInEmail: 'Enter your email address.',
  resetExpired: 'This reset link has expired. Ask your server owner for a new one.',
  firstRunHeading: 'Start with a list',
  noFavorites: 'No favorite stores yet. Showing every store near you.',
  searchPrompt: 'Search this week’s deals at the stores near you.',
  searchFilteredEmpty: 'No deals match these filters.',
  searchOffline: 'Deal search needs a connection. Your lists still work.',
  flyersOffline: 'Browsing flyers needs a connection. Your lists still work.',
  flyersNoFavorites: 'No active flyers at your favorite stores this week.',
  needsConnection: 'Needs a connection.',
  archivedEmpty: 'No archived lists. Archiving one keeps it readable.',
  allBought: 'Everything on this list is bought.',
  pantryEmpty:
    'Nothing in the pantry yet. Add what you keep on hand so meal planning knows about it.',
  recipesEmpty: 'No recipes yet. Paste a link or add one by hand.',
  suggestionsEmpty: 'No recipes yet. Add one to see what you can make this week.',
  billsEmpty:
    'Hearth tracks what you owe and when — it never pays a bill or touches your accounts. Add a bill to start.',
  choresEmpty: 'No chores yet. Add one to start tracking what needs doing.',
  errandsEmpty: 'No errands yet. Add one to keep track of it.',
  saving: 'Saving…',
  saveError: "Couldn't save that setting. Try again.",
  denied: "Notifications are blocked for Hearth in this browser, so this device won't get them.",
  dismissed: 'Notifications stay off on this device until you allow them.',
  failed: "Couldn't turn on notifications on this device. Try again.",
  unsupported: "Notifications aren't available in this browser. Hearth still works without them.",
  iosInstall:
    'On iPhone and iPad, Hearth has to be on the home screen before it can send notifications.',
} as const;

/** A notification preference write, which the save states hold open or fail on purpose. */
const PREFERENCES_URL = /\/api\/users\/me\/notification-preferences/;

/** Makes the page report one notification permission, as a browser with that answer would. */
async function setPermission(page: Page, value: NotificationPermission): Promise<void> {
  await page.addInitScript((state) => {
    Object.defineProperty(Notification, 'permission', { configurable: true, get: () => state });
  }, value);
}

/**
 * Signs up a new account, which has no household, so the screen after sign-up is create-or-join.
 * The address carries a random suffix so a rerun on a kept stack still gets a fresh account; the
 * account is never used again.
 */
async function signUpWithoutHousehold(page: Page, name: string): Promise<void> {
  const email = `${name.toLowerCase()}-${randomBytes(3).toString('hex')}@example.com`;
  await page.goto('/sign-up');
  await page.getByLabel('Display name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Set up your household' })).toBeVisible();
}

async function openNotificationSettings(page: Page): Promise<void> {
  await openSettings(page);
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
}

for (const theme of THEMES) {
  test.describe(`accessibility states (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('sign-in with empty fields', async ({ page }) => {
      await page.goto('/sign-in');
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByText(COPY.signInEmail)).toBeVisible();
      await expectAccessible(page, `sign in, empty fields (${theme})`);
    });

    test('sign-in with a wrong password', async ({ page }) => {
      await page.goto('/sign-in');
      await page.getByLabel('Email').fill(SEED.alex.email);
      await page.getByLabel('Password', { exact: true }).fill('not-the-password');
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByRole('alert').locator('p')).toBeVisible();
      await expectAccessible(page, `sign in, wrong password (${theme})`);
    });

    test('forgot password', async ({ page }) => {
      await page.goto('/forgot-password');
      await expect(page.getByRole('heading', { name: 'Forgot password', level: 1 })).toBeVisible();
      await expectAccessible(page, `forgot password (${theme})`);
    });

    test('set a new password from an expired link', async ({ page }) => {
      await page.goto(
        '/set-password#error=access_denied&error_code=otp_expired' +
          '&error_description=Email+link+is+invalid+or+has+expired',
      );
      await expect(page.getByText(COPY.resetExpired)).toBeVisible();
      await expectAccessible(page, `set a new password, expired link (${theme})`);
    });

    test('set a new password that is too short', async ({ page }) => {
      // The owner's reset link is the only route to a recovery session. Morgan is the subject, as
      // in journey 6, and nothing is submitted with a password that would be accepted.
      const printed = hearthAdmin(['reset-password', SEED.morgan.email]);
      expect(printed.status, printed.stderr).toBe(0);
      await page.goto(printed.stdout.trim());
      await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
      await page.getByLabel('New password').fill('short');
      await page.getByRole('button', { name: 'Set password' }).click();
      await expect(page.getByLabel('New password')).toHaveAttribute('aria-invalid', 'true');
      await expectAccessible(page, `set a new password, too short (${theme})`);
    });

    test('join with a code: empty and unknown codes', async ({ page }) => {
      await signUpWithoutHousehold(page, theme === 'light' ? 'Taylor' : 'Jesse');
      await page.getByRole('button', { name: 'Join with a code' }).click();
      await expect(page.getByRole('heading', { name: 'Join a household' })).toBeVisible();
      await page.getByRole('button', { name: 'Join household' }).click();
      await expect(page.getByLabel('Invite code')).toHaveAttribute('aria-invalid', 'true');
      await expectAccessible(page, `join with a code, empty (${theme})`);

      await page.getByLabel('Invite code').fill('AAAAAAAA');
      await page.getByRole('button', { name: 'Join household' }).click();
      await expect(page.getByRole('alert').locator('p')).toBeVisible();
      await expectAccessible(page, `join with a code, unknown code (${theme})`);
    });

    test('dashboard on a household with no data yet', async ({ page }) => {
      const account = FIRST_RUN[theme];
      await signIn(page, account.email);
      await expectDashboard(page, account.household);
      await expect(page.getByRole('heading', { name: COPY.firstRunHeading })).toBeVisible();
      await expectAccessible(page, `dashboard, first run (${theme})`);
    });

    test('household switcher sheet open', async ({ page }) => {
      await signIn(page, SEED.alex.email);
      await expectDashboard(page, SEED.oakStreet.name);
      await switcher(page).click();
      await expect(page.getByRole('dialog', { name: 'Households' })).toBeVisible();
      await expectAccessible(page, `switcher sheet (${theme})`);
    });

    test('account forms open in settings', async ({ page }) => {
      await signIn(page, SEED.alex.email);
      await openSettings(page);
      await page.getByRole('button', { name: 'Change email' }).click();
      await page.getByRole('button', { name: 'Change password' }).click();
      await expect(page.getByLabel('Current password').first()).toBeVisible();
      await expectAccessible(page, `settings, account forms open (${theme})`);
    });

    test('system health for the owner', async ({ page }) => {
      await signIn(page, SEED.alex.email);
      await page.goto('/settings/system-health');
      await expect(page.getByRole('heading', { name: 'System health' })).toBeVisible();
      await expectAccessible(page, `system health (${theme})`);
    });

    test('last-member departure and household deletion dialog, cancelled', async ({ page }) => {
      const account = FIRST_RUN[theme];
      await signIn(page, account.email);
      await openSettings(page);
      await page.getByRole('button', { name: `Leave ${account.household}` }).click();
      await expect(page.getByRole('heading', { name: 'You are the last member' })).toBeVisible();
      await expectAccessible(page, `last member, first run (${theme})`);

      await page.getByRole('button', { name: 'Delete household and leave' }).click();
      const dialog = page.getByRole('alertdialog', { name: `Delete ${account.household}?` });
      await expect(dialog).toBeVisible();
      await expectAccessible(page, `household deletion dialog (${theme})`);
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden();
    });

    test('deal search: first load, filtered empty, and offline', async ({ page, context }) => {
      await signIn(page, SEED.alex.email);
      await waitForServiceWorker(page);
      await page.goto('/lists/deals');
      await expect(page.getByText(COPY.searchPrompt)).toBeVisible();
      await expectAccessible(page, `deal search, no query (${theme})`);

      await page.getByRole('searchbox', { name: 'Search deals' }).fill('milk');
      await page.getByRole('textbox', { name: 'Lowest price' }).fill('999');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await expect(page.getByText(COPY.searchFilteredEmpty)).toBeVisible();
      await expectAccessible(page, `deal search, filtered empty (${theme})`);

      await context.setOffline(true);
      await expect(page.getByText(COPY.searchOffline)).toBeVisible();
      await expectAccessible(page, `deal search, offline (${theme})`);
      await context.setOffline(false);
    });

    test('deal search with no match at the favorite stores', async ({ page }) => {
      // Publix's fixture deals are only at a store Oak Street has not favorited, so the favorites
      // scope has nothing to show for "publix" (the fixture captures exist for that query).
      await signIn(page, SEED.alex.email);
      await page.goto('/lists/deals');
      await page.getByRole('searchbox', { name: 'Search deals' }).fill('publix');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await expect(page.getByText('No deals match “publix” at these stores.')).toBeVisible();
      await expectAccessible(page, `deal search, no match (${theme})`);
    });

    test('deal search on a household with no favorite stores', async ({ page }) => {
      const account = FIRST_RUN[theme];
      await signIn(page, account.email);
      await page.goto('/lists/deals');
      await expect(page.getByText(COPY.noFavorites)).toBeVisible();
      await expectAccessible(page, `deal search, no favorites (${theme})`);
    });

    test('flyers with favorite stores, then one flyer', async ({ page }) => {
      await signIn(page, SEED.alex.email);
      await page.goto('/lists/flyers');
      const flyer = page.locator('a[href*="/lists/flyers/"]').first();
      await expect(flyer).toBeVisible();
      await expectAccessible(page, `flyers, favorite stores (${theme})`);

      await flyer.click();
      await expect(page).toHaveURL(/\/lists\/flyers\/\d+/);
      await expectAccessible(page, `flyer items (${theme})`);
    });

    test('flyers with no favorite stores, then offline', async ({ page, context }) => {
      const account = FIRST_RUN[theme];
      await signIn(page, account.email);
      await page.goto('/lists/flyers');
      await expect(page.getByText(COPY.flyersNoFavorites)).toBeVisible();
      await expectAccessible(page, `flyers, no favorites (${theme})`);

      await page.getByRole('button', { name: 'Browse all stores' }).click();
      await expect(page.locator('a[href*="/lists/flyers/"]').first()).toBeVisible();
      await expectAccessible(page, `flyers, all stores (${theme})`);

      await waitForServiceWorker(page);
      await context.setOffline(true);
      await expect(page.getByText(COPY.flyersOffline)).toBeVisible();
      await expectAccessible(page, `flyers, offline (${theme})`);
      await context.setOffline(false);
    });

    test('pantry on a household with nothing in it', async ({ page }) => {
      const account = FIRST_RUN[theme];
      await signIn(page, account.email);
      await page.goto('/lists/pantry');
      await expect(page.getByText(COPY.pantryEmpty)).toBeVisible();
      await expectAccessible(page, `pantry, empty (${theme})`);
    });

    test('pantry with items', async ({ page }) => {
      await signIn(page, SEED.alex.email);
      await page.goto('/lists/pantry');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText(COPY.pantryEmpty)).toBeHidden();
      await expectAccessible(page, `pantry, with items (${theme})`);
    });

    test('planner filled, with the recipe picker open', async ({ page }) => {
      await signIn(page, SEED.alex.email);
      await page.goto('/meals');
      await expect(page.getByRole('navigation', { name: 'Week' })).toBeVisible();
      await expectAccessible(page, `planner, filled (${theme})`);

      await page
        .getByRole('button', { name: /^Add to / })
        .first()
        .click();
      const picker = page.getByRole('dialog', { name: 'Place which recipe?' });
      await expect(picker).toBeVisible();
      await expectAccessible(page, `planner, recipe picker (${theme})`);
      await picker.getByRole('button', { name: 'Close' }).click();
      await expect(picker).toBeHidden();
    });

    test('suggestions with recipes and deals', async ({ page }) => {
      await signIn(page, SEED.alex.email);
      await page.goto('/meals/suggestions');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectAccessible(page, `suggestions (${theme})`);
    });

    test('archived lists, an all-bought list, and the delete-list dialog', async ({ page }) => {
      const account = FIRST_RUN[theme];
      await signIn(page, account.email);

      await page.goto('/lists/archived');
      await expect(page.getByText(COPY.archivedEmpty)).toBeVisible();
      await expectAccessible(page, `archived lists, empty (${theme})`);

      await page.goto('/lists');
      await page.getByRole('button', { name: 'New list' }).click();
      // A suffix keeps a rerun on a kept stack from matching the list the previous run archived.
      const listName = `Audit ${randomBytes(2).toString('hex')}`;
      await page.getByLabel('List name').fill(listName);
      await page.getByRole('button', { name: 'Create list' }).click();
      await expect(page.getByRole('heading', { name: listName, level: 1 })).toBeVisible();

      await page.getByRole('button', { name: 'Add an item' }).first().click();
      await page.getByRole('dialog').getByLabel('Item', { exact: true }).fill('Milk');
      await page.getByRole('button', { name: 'Add item' }).click();
      // A plain click: the checked row moves into the collapsed Bought group, so there is no
      // checked state left in the list for `.check()` to read back.
      await page.getByRole('checkbox', { name: 'Milk' }).click();
      await expect(page.getByText(COPY.allBought)).toBeVisible();
      await expectAccessible(page, `list, all bought (${theme})`);

      await page.goto('/lists');
      await page.getByRole('button', { name: `More actions for ${listName}` }).click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      const dialog = page.getByRole('alertdialog', { name: 'Delete this list?' });
      await expect(dialog).toBeVisible();
      await expectAccessible(page, `delete list dialog (${theme})`);
      await dialog.getByRole('button', { name: 'Cancel' }).click();

      await page.getByRole('button', { name: `More actions for ${listName}` }).click();
      await page.getByRole('menuitem', { name: 'Archive' }).click();
      await page.goto('/lists/archived');
      await expect(page.getByRole('link', { name: new RegExp(`^${listName}`) })).toBeVisible();
      await expectAccessible(page, `archived lists, with a list (${theme})`);

      // The list is removed again, so the archived view is empty for the next run on this stack.
      await page.getByRole('button', { name: `More actions for ${listName}` }).click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page
        .getByRole('alertdialog', { name: 'Delete this list?' })
        .getByRole('button', { name: 'Delete list' })
        .click();
      await expect(page.getByText(COPY.archivedEmpty)).toBeVisible();
    });

    test('recipes, suggestions, and planner on a household with none', async ({ page }) => {
      const account = FIRST_RUN[theme];
      await signIn(page, account.email);

      await page.goto('/meals/recipes');
      await expect(page.getByText(COPY.recipesEmpty)).toBeVisible();
      await expectAccessible(page, `recipe library, empty (${theme})`);

      await page.goto('/meals/suggestions');
      await expect(page.getByText(COPY.suggestionsEmpty)).toBeVisible();
      await expectAccessible(page, `suggestions, empty (${theme})`);

      await page.goto('/meals');
      await expectAccessible(page, `planner, empty (${theme})`);
    });

    test('bills, chores, and errands on a household with none', async ({ page }) => {
      const account = FIRST_RUN[theme];
      await signIn(page, account.email);

      await page.goto('/bills');
      await expect(page.getByText(COPY.billsEmpty)).toBeVisible();
      await expectAccessible(page, `bills, first run (${theme})`);

      await page.goto('/chores');
      await expect(page.getByText(COPY.choresEmpty)).toBeVisible();
      await expectAccessible(page, `chores, first run (${theme})`);

      await page.goto('/chores/errands');
      await expect(page.getByText(COPY.errandsEmpty)).toBeVisible();
      await expectAccessible(page, `errands, first run (${theme})`);
    });

    test('Oak Street skip-bill, delete-recipe and delete-chore dialogs, cancelled', async ({
      page,
    }) => {
      await signIn(page, SEED.alex.email);

      await page.goto('/bills');
      await page
        .getByRole('button', { name: /^More actions for / })
        .first()
        .click();
      await page.getByRole('menuitem', { name: 'Skip' }).click();
      const skip = page.getByRole('alertdialog', { name: 'Skip this bill?' });
      await expect(skip).toBeVisible();
      await expectAccessible(page, `skip bill dialog (${theme})`);
      await skip.getByRole('button', { name: 'Cancel' }).click();

      await page.goto('/meals/recipes');
      await page.locator('a[href*="/meals/recipes/"]').first().click();
      await expect(page).toHaveURL(/\/meals\/recipes\/[^/]+$/);
      await page.getByRole('button', { name: /^More actions for / }).click();
      await page.getByRole('menuitem', { name: 'Edit' }).click();
      const editor = page.getByRole('dialog', { name: /^Edit / });
      await expect(editor).toBeVisible();
      await expectAccessible(page, `recipe edit form (${theme})`);
      await editor.getByRole('button', { name: 'Close' }).click();
      await expect(editor).toBeHidden();

      await page.getByRole('button', { name: /^More actions for / }).click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      const recipe = page.getByRole('alertdialog', { name: 'Delete this recipe?' });
      await expect(recipe).toBeVisible();
      await expectAccessible(page, `delete recipe dialog (${theme})`);
      await recipe.getByRole('button', { name: 'Cancel' }).click();

      await page.goto('/chores');
      await page.getByRole('link', { name: /^Take out trash/ }).click();
      await expect(page).toHaveURL(/\/chores\/[^/]+$/);
      await page.getByRole('button', { name: 'More actions for Take out trash' }).click();
      await page.getByRole('menuitem', { name: 'Edit' }).click();
      await expect(page).toHaveURL(/\/chores\/[^/]+\/edit$/);
      await page.getByRole('button', { name: 'More actions for Take out trash' }).click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      const chore = page.getByRole('alertdialog', { name: 'Delete this chore?' });
      await expect(chore).toBeVisible();
      await expectAccessible(page, `delete chore dialog (${theme})`);
      await chore.getByRole('button', { name: 'Cancel' }).click();
    });

    test('bills offline', async ({ page, context }) => {
      await signIn(page, SEED.alex.email);
      await waitForServiceWorker(page);
      await page.goto('/bills');
      // Offline only shows once the bills are cached, so wait for the seeded household bill first.
      await expect(page.getByText('Duke Energy').first()).toBeVisible();
      await context.setOffline(true);
      await expect(page.getByText(COPY.needsConnection).first()).toBeVisible();
      await expectAccessible(page, `bills, offline (${theme})`);
      await context.setOffline(false);
    });

    test('notification settings: device denied', async ({ page }) => {
      await setPermission(page, 'denied');
      await signIn(page, SEED.alex.email);
      await openNotificationSettings(page);
      await expect(page.getByText(COPY.denied)).toBeVisible();
      await expectAccessible(page, `notifications, denied (${theme})`);
    });

    test('notification settings: permission dismissed', async ({ page }) => {
      await setPermission(page, 'default');
      await signIn(page, SEED.alex.email);
      await openNotificationSettings(page);
      await expect(page.getByText(COPY.dismissed)).toBeVisible();
      await expectAccessible(page, `notifications, dismissed (${theme})`);
    });

    test('notification settings: browser without push', async ({ page }) => {
      await page.addInitScript(() => {
        delete (window as unknown as { PushManager?: unknown }).PushManager;
      });
      await signIn(page, SEED.alex.email);
      await openNotificationSettings(page);
      await expect(page.getByText(COPY.unsupported)).toBeVisible();
      await expectAccessible(page, `notifications, unsupported (${theme})`);
    });

    test('notification settings: iPhone not on the home screen', async ({ page }) => {
      await page.addInitScript((ua) => {
        Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => ua });
      }, IOS_IPHONE_UA);
      await signIn(page, SEED.alex.email);
      await openNotificationSettings(page);
      await expect(page.getByText(COPY.iosInstall)).toBeVisible();
      await expectAccessible(page, `notifications, iOS not installed (${theme})`);
    });

    test('notification type: saving, then a failed save', async ({ page }) => {
      await setPermission(page, 'granted');
      await signIn(page, SEED.alex.email);
      await openNotificationSettings(page);

      // The write is held open, so the screen stays saving and the server never receives it.
      await page.route(PREFERENCES_URL, (route) => {
        if (route.request().method() === 'PATCH') return;
        void route.continue();
      });
      await page.getByRole('switch').first().click();
      await expect(page.getByText(COPY.saving)).toBeVisible();
      await expectAccessible(page, `notifications, saving (${theme})`);
      await page.unroute(PREFERENCES_URL);

      // The write is refused, so the stored setting is unchanged.
      await page.route(PREFERENCES_URL, (route) => {
        if (route.request().method() !== 'PATCH') return route.continue();
        return route.fulfill({
          status: 500,
          contentType: 'application/problem+json',
          body: JSON.stringify({ title: 'Server error', status: 500 }),
        });
      });
      await page.getByRole('switch').first().click();
      await expect(page.getByText(COPY.saveError)).toBeVisible();
      await expectAccessible(page, `notifications, save failed (${theme})`);
    });

    test('notification type on, but this device cannot register', async ({ page }) => {
      // The preference saves, then the browser refuses the push subscription. The type is turned
      // back off afterwards, so the seeded preferences are what the later journeys find.
      await setPermission(page, 'granted');
      await page.addInitScript(() => {
        PushManager.prototype.subscribe = () =>
          Promise.reject(new Error('push service unavailable'));
      });
      await signIn(page, SEED.alex.email);
      await openNotificationSettings(page);

      // The list keeps its order, so the first switch that is off is the same one after the save.
      const switches = page.getByRole('switch');
      const count = await switches.count();
      let index = -1;
      for (let i = 0; i < count && index < 0; i += 1) {
        if (!(await switches.nth(i).isChecked())) index = i;
      }
      expect(index).toBeGreaterThanOrEqual(0);
      const off = switches.nth(index);
      await off.click();
      await expect(page.getByText(COPY.failed)).toBeVisible();
      await expectAccessible(page, `notifications, registration failed (${theme})`);

      await off.click();
      await expect(off).not.toBeChecked();
    });

    test('notifications offline', async ({ page, context }) => {
      await setPermission(page, 'granted');
      await signIn(page, SEED.alex.email);
      await waitForServiceWorker(page);
      await openNotificationSettings(page);
      await context.setOffline(true);
      await expect(page.getByText(COPY.needsConnection).first()).toBeVisible();
      await expectAccessible(page, `notifications, offline (${theme})`);
      await context.setOffline(false);
    });
  });
}
