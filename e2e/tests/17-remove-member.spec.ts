import { expect, test } from '@playwright/test';
import { expectDashboard, openSettings, reassign, signIn } from '../support/app.ts';
import { accessToken, householdStatus, removeMemberStatus } from '../support/api.ts';
import { expectAccessible } from '../support/axe.ts';
import { queryValue } from '../support/db.ts';
import { SEED } from '../support/env.ts';

/**
 * Journey 8: remove a member, assert the reassignment prompt appears and blocks until resolved,
 * and that the removed user loses access immediately (Handoff, Phase 1 "Done when").
 *
 * The two themes remove two different Oak Street members, because a removal cannot be repeated:
 * Sam owns a list, an open errand, and a household bill, Jordan owns a list and a bill, and both
 * are in the "Take out trash" rotation (Seed Data, "E2E departure fixtures"). Each is Oak Street's
 * only membership, so each lands on onboarding's create-or-join step afterwards, which is where
 * Requirements says a user with no membership left belongs.
 *
 * This file sorts last in the suite on purpose: its removals take Sam and Jordan out of Oak Street,
 * and every journey before it expects the full seed. Keep any later journey's number below this one
 * or move this file again.
 */

const REMOVALS = {
  light: {
    member: SEED.sam,
    owned: ['This Week', 'Renew car registration', 'Duke Energy'],
  },
  dark: {
    member: SEED.jordan,
    owned: ['Weekend Cookout', 'Water and Sewer'],
  },
} as const;

function oakStreetId(): string {
  return queryValue(`select id from public.household where name = '${SEED.oakStreet.name}'`);
}

function memberId(email: string): string {
  return queryValue(`select id from public.profile where email = '${email}'`);
}

function listOwner(listName: string): string {
  return queryValue(
    `select p.display_name from public.shopping_list l
       join public.profile p on p.id = l.created_by
      where l.name = '${listName}'`,
  );
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`journey 8 — remove a member (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('blocks on reassignment, then ends the removed member’s access', async ({
      page,
      browser,
      request,
    }) => {
      const { member, owned } = REMOVALS[theme];
      const householdId = oakStreetId();

      // The same token throughout: what ends is the membership, not the session.
      const memberToken = await accessToken(request, member.email);
      expect(await householdStatus(request, memberToken, householdId)).toBe(200);

      const memberPage = await (await browser.newContext()).newPage();
      await signIn(memberPage, member.email);
      await expectDashboard(memberPage, SEED.oakStreet.name);

      await signIn(page, SEED.alex.email);
      await expectDashboard(page, SEED.oakStreet.name);
      await openSettings(page);
      await page.getByRole('button', { name: `More actions for ${member.name}` }).click();
      await page.getByRole('menuitem', { name: 'Remove from household' }).click();

      await expect(page.getByRole('heading', { name: 'Remove member', level: 1 })).toBeVisible();
      // Everything they own needs a new owner; rotations are listed without a picker.
      for (const item of owned) {
        await expect(page.getByRole('combobox', { name: item })).toBeVisible();
      }
      await expect(
        page.getByText(/Take out trash: will be removed from rotation; the turn passes to /),
      ).toBeVisible();

      const confirm = page.getByRole('button', { name: `Remove ${member.name}` });
      await expect(confirm).toBeDisabled();
      await expect(page.getByText('Choose someone for each item above first.')).toBeVisible();
      await expectAccessible(page, `departure preview (${theme})`);

      // The block is a server rule, not a disabled button: the same removal sent straight to the
      // API with nothing reassigned is refused, and the member is still here afterwards.
      const adminToken = await accessToken(request, SEED.alex.email);
      expect(
        await removeMemberStatus(request, adminToken, householdId, memberId(member.email), {}),
      ).toBe(409);
      expect(await householdStatus(request, memberToken, householdId)).toBe(200);

      for (const item of owned) await reassign(page, item, SEED.alex.name);
      await expect(confirm).toBeEnabled();
      await confirm.click();

      // Back on Settings, with the member gone from Oak Street's card.
      await expect(page.getByRole('heading', { name: 'My Households' })).toBeVisible();
      await expect(page.getByText(member.name)).toHaveCount(0);
      await expectAccessible(page, `settings after the removal (${theme})`);

      // The reassignment and the departure happened together.
      expect(listOwner(owned[0])).toBe(SEED.alex.name);
      expect(await householdStatus(request, memberToken, householdId)).toBe(404);

      // Their next request fails, and the app puts them where a member of nothing belongs.
      await memberPage.reload();
      await expect(
        memberPage.getByRole('heading', { name: 'Set up your household' }),
      ).toBeVisible();
      await expectAccessible(memberPage, `removed member’s next screen (${theme})`);
      await memberPage.context().close();
    });
  });
}
