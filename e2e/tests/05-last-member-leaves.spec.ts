import { expect, test } from '@playwright/test';
import { expectSignedIn, openSettings, signIn } from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { queryValue } from '../support/db.ts';
import { SEED } from '../support/env.ts';

/**
 * Handoff, Phase 1 "Done when": the last member leaving deletes the household only after the
 * typed-name confirmation, and their personal bills survive. Casey is Empty House's only member
 * (Seed Data, "Households") and owns the personal Car Insurance bill, which belongs to Casey
 * rather than to any household and so outlives the deletion (Requirements, "Membership
 * lifecycle").
 *
 * There is no bills UI in Phase 1, so the survival is asserted against the database.
 */

function householdCount(name: string): number {
  return Number(queryValue(`select count(*) from public.household where name = '${name}'`));
}

/** How many rows for that bill are still there, still personal, and still Casey's. */
function surviving(billName: string): number {
  return Number(
    queryValue(
      `select count(*) from public.bill b
         join public.profile p on p.id = b.owner_user_id
        where b.name = '${billName}' and b.household_id is null and b.visibility = 'personal'
          and p.email = '${SEED.casey.email}'`,
    ),
  );
}

test('the household goes only after the typed name, and the personal bill stays', async ({
  page,
}) => {
  expect(householdCount(SEED.emptyHouse.name)).toBe(1);

  await signIn(page, SEED.casey.email);
  await openSettings(page);
  await page.getByRole('button', { name: `Leave ${SEED.emptyHouse.name}` }).click();

  await expect(page.getByRole('heading', { name: 'Leave household', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'You are the last member' })).toBeVisible();
  await expectAccessible(page, 'last member’s departure');

  await page.getByRole('button', { name: 'Delete household and leave' }).click();
  const dialog = page.getByRole('alertdialog', { name: `Delete ${SEED.emptyHouse.name}?` });
  const confirm = dialog.getByRole('button', { name: 'Delete household' });
  await expect(confirm).toBeDisabled();
  await expectAccessible(page, 'household deletion confirmation');

  const field = dialog.getByLabel(`Type ${SEED.emptyHouse.name} to confirm`);
  await field.fill('Empty Hous');
  await expect(confirm).toBeDisabled();
  expect(householdCount(SEED.emptyHouse.name)).toBe(1);

  await field.fill(SEED.emptyHouse.name);
  await expect(confirm).toBeEnabled();
  await confirm.click();

  // Casey's active household moves to the longest-held remaining membership, or to onboarding's
  // create-or-join step if there is none (Requirements, "Multi-household membership").
  await expectSignedIn(page);
  await expect(page.getByText(SEED.emptyHouse.name)).toHaveCount(0);

  expect(householdCount(SEED.emptyHouse.name)).toBe(0);
  expect(surviving('Car Insurance')).toBe(1);
});
