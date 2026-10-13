import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { expectDashboard, signIn } from '../support/app.ts';
import { expectAccessible, settleAnimations } from '../support/axe.ts';
import { addDays, currentInstant, dateInZone } from '../support/clock.ts';
import { REPO_ROOT, SEED } from '../support/env.ts';

/**
 * Chores and errands on the real stack (Design › Screens › 17 and 18; PRD › "Chores and errands",
 * "Rotation"; Handoff, Phase 4 done-when: a rotating chore advances on completion, Undo reverts it,
 * and the rotation edit keeps the turn with the same member).
 *
 * Oak Street's chores and errands come from `supabase/seed/seed.sql` (Seed Data, "Chores" and
 * "Errands"). The light run mutates them, in file order, and the dark run reads what the light
 * run left, so the two themes never fight over a row. Screenshots of each screen at phone and
 * desktop width go to `shots/u4-5/`, and axe runs on each screen in both themes.
 */

const SHOTS = join(REPO_ROOT, 'shots', 'u4-5');
mkdirSync(SHOTS, { recursive: true });

async function shoot(page: Page, name: string, theme: string): Promise<void> {
  for (const [label, width, height] of [
    ['390', 390, 844],
    ['1280', 1280, 800],
  ] as const) {
    await page.setViewportSize({ width, height });
    // The layout change at this width can run a transition; the shot is taken once none is left.
    await settleAnimations(page);
    await page.screenshot({ path: join(SHOTS, `${name}-${theme}-${label}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
}

/** The turn-holder line of a rotation row, e.g. "2. Alex Rivera · current turn". */
function rotationRow(page: Page, text: RegExp) {
  return page.getByRole('listitem').filter({ hasText: text });
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`chores and errands on the real stack (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('walks the Chores and Errands screens, with the mutating steps in the light run', async ({
      page,
    }) => {
      await signIn(page, SEED.alex.email);
      await expectDashboard(page, SEED.oakStreet.name);

      // Dashboard: the Chores card lists what is due today and overdue, overdue first.
      const chores = page.getByRole('region', { name: /^Chores/ });
      await expect(chores).toContainText('Vacuum common areas');
      await expect(chores).toContainText('Overdue');
      await shoot(page, 'dashboard', theme);
      await expectAccessible(page, `dashboard (${theme})`);

      // The list, grouped by when each chore is due.
      await page.goto('/chores');
      await expect(
        page.locator('#main').getByRole('heading', { name: 'Overdue', level: 2 }),
      ).toBeVisible();
      await expect(
        page.locator('#main').getByRole('heading', { name: 'Today', level: 2 }),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: /^Take out trash/ })).toContainText(
        "Sam Chen's turn, Jordan Blake next",
      );
      await shoot(page, 'chores-list', theme);
      await expectAccessible(page, `chores list (${theme})`);

      if (theme === 'light') {
        // Completing the rotating chore due today advances the turn and the toast names who is next.
        await page.getByRole('button', { name: 'Mark Take out trash done' }).click();
        // One toast, one match: the Radix live-region copy must not make this ambiguous.
        const completionToast = page.getByText('Take out trash done. Jordan Blake is next.', {
          exact: true,
        });
        await expect(completionToast).toHaveCount(1);
        await expect(completionToast).toBeVisible();
        await expect(page.getByRole('link', { name: /^Take out trash/ })).toContainText(
          "Jordan Blake's turn, Alex Rivera next",
        );

        // Undo, inside its window, deletes the completion and the turn comes back to Sam.
        await page.getByRole('button', { name: 'Undo' }).click();
        await expect(page.getByRole('link', { name: /^Take out trash/ })).toContainText(
          "Sam Chen's turn, Jordan Blake next",
        );
      }

      // The detail: next dates, rotation, and history with the departed member named as such.
      await page.getByRole('link', { name: /^Take out trash/ }).click();
      await expect(
        page.locator('#main').getByRole('heading', { name: 'Next three dates', level: 2 }),
      ).toBeVisible();
      await expect(rotationRow(page, /Sam Chen · current turn/)).toBeVisible();
      await shoot(page, 'chore-detail', theme);
      await expectAccessible(page, `chore detail (${theme})`);

      // Vacuum's one completion was Casey's. The seed has her gone from Oak Street (Seed Data,
      // "Chores"), but journey 3 joins her back, so her record is named again (PRD, departure
      // rules: a name follows the current roster). "Former member" is for someone who has left.
      await page.goto('/chores');
      await page.getByRole('link', { name: /^Vacuum common areas/ }).click();
      await expect(
        page
          .getByRole('region', { name: 'Completion history' })
          .getByRole('listitem')
          .filter({ hasText: 'Casey Nguyen' }),
      ).toBeVisible();
      await expect(page.getByText('Former member')).toHaveCount(0);

      if (theme === 'light') {
        // Rotation edit on the real service: a pure reorder keeps Alex's turn, and appending Jordan
        // does too (PRD, "Rotation": a manual edit keeps the turn with the same member).
        await page.goto('/chores');
        await page.getByRole('link', { name: /^Deep clean fridge/ }).click();
        await page.getByRole('button', { name: 'More actions for Deep clean fridge' }).focus();
        await page.keyboard.press('Enter');
        await page.getByRole('menuitem', { name: 'Edit' }).click();
        await expect(
          page.locator('#main').getByRole('heading', { name: /^Edit Deep clean fridge/ }),
        ).toBeVisible();

        const samUp = page.getByRole('button', { name: 'Move Sam Chen up' });
        await samUp.focus();
        await page.keyboard.press('Enter');
        // Sam moved to the top and focus followed him, so "up" is now the disabled one.
        await expect(page.getByRole('button', { name: 'Move Sam Chen down' })).toBeFocused();
        await expect(page.getByRole('button', { name: 'Move Sam Chen up' })).toBeDisabled();
        await page.getByRole('button', { name: 'Save chore' }).click();
        await expect(
          page.locator('#main').getByRole('heading', { name: 'Deep clean fridge', level: 1 }),
        ).toBeVisible();
        await expect(rotationRow(page, /^2\. Alex Rivera/)).toContainText('current turn');

        await page.getByRole('button', { name: 'More actions for Deep clean fridge' }).click();
        await page.getByRole('menuitem', { name: 'Edit' }).click();
        await page.getByRole('combobox', { name: 'Add to rotation' }).click();
        await page.getByRole('option', { name: 'Jordan Blake' }).click();
        await page.getByRole('button', { name: 'Save chore' }).click();
        await expect(rotationRow(page, /^2\. Alex Rivera/)).toContainText('current turn');
        await expect(rotationRow(page, /^3\. Jordan Blake/)).toBeVisible();
      }

      // Errands: open first, with a quick-add sheet; done collapses with who and when.
      await page.goto('/chores/errands');
      await expect(page.getByRole('button', { name: /^Return Amazon package/ })).toBeVisible();
      if (theme === 'light') {
        await page.getByRole('button', { name: 'Add an errand' }).click();
        const sheet = page.getByRole('dialog', { name: 'Add an errand' });
        await sheet.getByLabel('Name').fill('Mail the warranty card');
        // A month out in the household's zone: a fixed calendar date would fall behind the suite's
        // "today" and turn the new errand into an overdue one once that day has passed.
        const due = addDays(dateInZone('America/New_York', currentInstant()), 30);
        await sheet.getByLabel('Due date').fill(due);
        await sheet.getByRole('button', { name: 'Save errand' }).click();
        await expect(page.getByRole('button', { name: /^Mail the warranty card/ })).toBeVisible();

        await page.getByRole('checkbox', { name: 'Mark Mail the warranty card as done' }).click();
        await page.getByText(/completed$/).click();
        await expect(page.getByText(/Completed by Alex Rivera · today/)).toBeVisible();
      }
      await shoot(page, 'chores-errands', theme);
      await expectAccessible(page, `errands (${theme})`);

      // The add sheet itself, for the screenshot and the axe pass.
      await page.getByRole('button', { name: 'Add an errand' }).click();
      await expect(page.getByRole('dialog', { name: 'Add an errand' })).toBeVisible();
      await shoot(page, 'errand-sheet', theme);
      await expectAccessible(page, `add errand sheet (${theme})`);
      await page.keyboard.press('Escape');

      // The chore sheet, for the screenshot and the axe pass.
      await page.goto('/chores');
      await page.getByRole('link', { name: /^Replace HVAC filter/ }).click();
      await page.getByRole('button', { name: 'More actions for Replace HVAC filter' }).click();
      await page.getByRole('menuitem', { name: 'Edit' }).click();
      await expect(page.getByLabel('Name')).toHaveValue('Replace HVAC filter');
      await shoot(page, 'chore-sheet', theme);
      await expectAccessible(page, `chore sheet (${theme})`);
    });
  });
}
