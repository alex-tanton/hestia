import { randomBytes } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  expectDashboard,
  openSettings,
  signIn,
  switchHousehold,
  switcher,
} from '../support/app.ts';
import { accessToken } from '../support/api.ts';
import { expectAccessible } from '../support/axe.ts';
import { addDays, currentInstant, dateInZone, hourInZone } from '../support/clock.ts';
import { query, queryValue } from '../support/db.ts';
import { SEED } from '../support/env.ts';
import { parsePushBody, recordedDeliveries, runDispatchAt } from '../support/push.ts';

/**
 * Notifications on the real stack, with the push double in place of the push service (Handoff,
 * Phase 5; PRD, "Notifications"; Engineering Practices › Testing, "E2E environment").
 *
 * Alex turns on one type that is off by default, meal reminders (PRD, "Types and defaults"). The
 * browser's push half is faked in the page, and the service records each push instead of sending it
 * (HEARTH_PUSH_TRANSPORT=test-double), so no push service is contacted from the browser or the stack.
 * The reminder is then due because the suite runs the dispatch job at a chosen instant, on the day
 * whose 08:00 send time is still inside the job's retry window (`reminderDay`). That day's dinner is
 * the seeded one, or one the journey plans through the meal-plan API. The job's own schedule is every
 * two minutes, and the suite does not wait for it.
 *
 * The light run does the work and ends with Oak Street active again, which is where journey 20 expects
 * Alex. The dark run only checks the settings screen with that reminder on.
 */

interface PreferenceRow {
  type: string;
  householdId: string | null;
  enabled: boolean;
}

/** A device's push subscription as the page creates it; only the endpoint is checked in the DB. */
async function fakeBrowserPush(page: Page, endpoint: string): Promise<void> {
  await page.addInitScript(
    ({ endpoint, p256dh, auth }) => {
      // The browser would hand its push service a real subscription; the page gets this one, so no
      // push service is ever contacted. The subscribe call is what the app reaches on first enable.
      let current: PushSubscription | null = null;
      const subscription = {
        endpoint,
        toJSON: () => ({ endpoint, keys: { p256dh, auth } }),
        unsubscribe: () => {
          current = null;
          return Promise.resolve(true);
        },
      } as unknown as PushSubscription;
      PushManager.prototype.subscribe = () => {
        current = subscription;
        return Promise.resolve(subscription);
      };
      PushManager.prototype.getSubscription = () => Promise.resolve(current);
      // The permission the user would have granted. Headless Chromium's own answer is not reliable
      // here, and a prompt that comes back dismissed would skip the subscription without an error.
      Object.defineProperty(Notification, 'permission', {
        configurable: true,
        get: () => 'granted',
      });
      Notification.requestPermission = () => Promise.resolve('granted');
    },
    {
      endpoint,
      p256dh: randomBytes(65).toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
    },
  );
}

function oakStreetId(): string {
  return queryValue(`select id from public.household where name = '${SEED.oakStreet.name}'`);
}

function subscriptionRows(endpoint: string): string {
  return queryValue(
    `select count(*) from public.push_subscription s
       join public.profile p on p.id = s.user_id
      where p.email = '${SEED.alex.email}' and s.endpoint = '${endpoint}'`,
  );
}

const NEW_YORK = 'America/New_York';

/**
 * The day whose 08:00 reminder the dispatch run sends now, and the clock to run it at. The job deletes
 * an unsent row once its send time is more than 24 hours behind the database clock, so the day is
 * today once 08:00 has passed in Oak Street's zone, and yesterday before then. The job only writes the
 * reminders of its clock's date, so yesterday is run at a time inside that date.
 */
function reminderDay(now: Date): { date: string; clock: Date } {
  const today = dateInZone(NEW_YORK, now);
  if (hourInZone(NEW_YORK, now) >= 8) return { date: today, clock: now };
  const yesterday = addDays(today, -1);
  return { date: yesterday, clock: new Date(`${yesterday}T17:00:00Z`) };
}

/**
 * The dish the day's reminder names: its first planned meal, in the order the producer uses, or
 * '' when the day has none planned yet (Saturday in Seed Data, until `ensureDinnerOn` plans one).
 * Unlike `queryValue`, zero rows is an expected outcome here, not a bug to throw on.
 */
function firstMealOn(oakId: string, date: string): string {
  const rows = query(
    `select recipe_title from public.meal_plan_entry
      where household_id = '${oakId}' and planned_date = '${date}'
      order by case meal_type when 'breakfast' then 0 when 'lunch' then 1 else 2 end, created_at, id
      limit 1`,
  );
  return rows[0]?.[0] ?? '';
}

/**
 * Seed Data plans dinner on Sunday to Friday and none on Saturday, so a reminder day with no entry
 * gets one through the app's own meal-plan API, as Alex, before the dispatch run.
 */
async function ensureDinnerOn(
  request: APIRequestContext,
  token: string,
  oakId: string,
  date: string,
): Promise<void> {
  if (firstMealOn(oakId, date) !== '') return;
  const recipe = queryValue(
    `select id from public.recipe where household_id = '${oakId}' and title = 'Shrimp Pad Thai'`,
  );
  const response = await request.post(`/api/households/${oakId}/meal-plan`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { recipeId: recipe, plannedDate: date, mealType: 'dinner' },
  });
  expect(response.ok(), 'plan a dinner for the reminder day').toBe(true);
}

test.describe('notifications — meal reminder with the push double (light)', () => {
  test.use({ colorScheme: 'light' });

  test('enables a type, delivers its reminder once, and a tap opens its household', async ({
    page,
    request,
  }) => {
    const endpoint = `https://push.hearth-e2e.test/device/${randomBytes(6).toString('hex')}`;
    await fakeBrowserPush(page, endpoint);

    await signIn(page, SEED.alex.email);
    await expectDashboard(page, SEED.oakStreet.name);
    // Rivera Family is active first, so the reminder for Oak Street is one a tap must switch to.
    await switchHousehold(page, SEED.riveraFamily.name);
    await expect(switcher(page)).toHaveText(new RegExp(SEED.riveraFamily.name));

    await openSettings(page);
    const mealReminders = page.getByRole('switch', { name: 'Meal reminders' });
    await expect(mealReminders).not.toBeChecked();
    await mealReminders.click();
    await expect(mealReminders).toBeChecked();
    // The device registers after the preference is saved (Design › Screens › 4), so the subscription
    // is awaited before anything is dispatched: a web-first poll, not a fixed wait.
    await expect.poll(() => subscriptionRows(endpoint)).toBe('1');

    // The same preference through the API: the type is on, and it is user-level (no household).
    const token = await accessToken(request, SEED.alex.email);
    const response = await request.get('/api/users/me/notification-preferences', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(200);
    const { preferences } = (await response.json()) as { preferences: PreferenceRow[] };
    expect(preferences).toContainEqual({ type: 'meal_reminder', householdId: null, enabled: true });

    // The dispatch job runs at the chosen instant for the reminder day, and the reminder is written
    // and sent in that run.
    const oakStreet = oakStreetId();
    const { date, clock } = reminderDay(currentInstant());
    await ensureDinnerOn(request, token, oakStreet, date);
    const dish = firstMealOn(oakStreet, date);
    expect(await runDispatchAt(request, clock)).toBe(true);

    // Exactly one push for this device carries Oak Street's meal reminder for that day: the household
    // id is in the body, and both copy lines are within the 60-character limit (PRD, "Notifications").
    const pushes = (await recordedDeliveries(request))
      .filter((delivery) => delivery.endpoint === endpoint)
      .map((delivery) => parsePushBody(delivery.message))
      .filter(
        (push) =>
          push.url === '/meals' && push.householdId === oakStreet && push.title.includes(dish),
      );
    expect(pushes).toHaveLength(1);
    const [push] = pushes;
    if (push === undefined) throw new Error('no meal reminder was recorded for Oak Street');
    expect(push.title).toContain(dish);
    expect(push.title.length).toBeLessThanOrEqual(60);
    expect(push.body.length).toBeLessThanOrEqual(60);

    // Tapping opens the notification's screen in its household. A tap with no window open lands
    // on the URL the worker builds (`openTarget`: the path plus `?household=`), which the page
    // reads once, switches on, and removes.
    await page.goto(`${push.url}?household=${encodeURIComponent(oakStreet)}`);
    await expect(switcher(page)).toHaveText(new RegExp(SEED.oakStreet.name));
    await expect(page).toHaveURL(/\/meals$/);
    const profile = await request.get('/api/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(((await profile.json()) as { activeHouseholdId: string }).activeHouseholdId).toBe(
      oakStreet,
    );
    await expectAccessible(page, 'meals after a notification tap (light)');
  });
});

for (const theme of ['light', 'dark'] as const) {
  test.describe(`notification settings with a reminder on (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('the settings screen with a notification type on passes axe', async ({ page }) => {
      await signIn(page, SEED.alex.email);
      await expectDashboard(page, SEED.oakStreet.name);
      await openSettings(page);
      await expect(page.getByRole('switch', { name: 'Meal reminders' })).toBeChecked();
      await expectAccessible(page, `notification settings (${theme})`);
    });
  });
}
