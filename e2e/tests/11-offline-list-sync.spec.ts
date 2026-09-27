import { expect, test } from '@playwright/test';
import { accessToken, addListItemStatus } from '../support/api.ts';
import { expectDashboard, openList, signIn, waitForServiceWorker } from '../support/app.ts';
import { expectAccessible } from '../support/axe.ts';
import { queryValue } from '../support/db.ts';
import { SEED } from '../support/env.ts';

/**
 * Journey 7, list portion (Engineering Practices › E2E journeys; the chores/errands portion is
 * Phase 5 and explicitly out of scope here): go offline, check a list item off and back on, and
 * add one; return online; assert the queue survives a reload and replays in order, and that
 * replaying an already-synced write changes nothing (Handoff, Phase 2 "Done when").
 *
 * "Trash bags" starts Needed at Harris Teeter with no price (Seed Data, "Shopping lists").
 * Checking it off and back on while offline, in that order, is the order-sensitive half of this
 * journey: a list's queued writes share one mutation scope and replay in the order they were made
 * (Engineering Practices › "The write queue"), so only an in-order replay leaves it Needed again.
 * Out-of-order delivery — or two writes racing the network independently — would leave it Bought.
 */

const TARGETS = { light: 'Paper Napkins', dark: 'Aluminum Foil' } as const;

function thisWeekId(): string {
  return queryValue(`select id from public.shopping_list where name = 'This Week'`);
}

function itemId(listId: string, itemName: string): string {
  return queryValue(
    `select id from public.shopping_list_item where list_id = '${listId}' and item_name = '${itemName}'`,
  );
}

function itemCount(listId: string, itemName: string): number {
  return Number(
    queryValue(
      `select count(*) from public.shopping_list_item where list_id = '${listId}' and item_name = '${itemName}'`,
    ),
  );
}

function itemStatus(listId: string, itemName: string): string {
  return queryValue(
    `select status from public.shopping_list_item where list_id = '${listId}' and item_name = '${itemName}'`,
  );
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`journey 7 — offline list writes (${theme})`, () => {
    test.use({ colorScheme: theme });

    test('queues in order, survives a reload, syncs on reconnect, and a replay changes nothing', async ({
      page,
      request,
    }) => {
      const newItem = TARGETS[theme];

      await signIn(page, SEED.alex.email);
      await expectDashboard(page, SEED.oakStreet.name);
      await openList(page, 'This Week');
      // Precached before the loss of network, so the coming reload has an app shell to serve
      // (Engineering Practices › "Service worker").
      await waitForServiceWorker(page);

      await page.context().setOffline(true);

      // The store group is a labelled region (`StoreGroupHeader`'s `aria-labelledby`), not just any
      // section that happens to contain the heading text.
      const harrisTeeter = page.getByRole('region', { name: 'Harris Teeter' });
      // A plain click, not `.check()`: checking it off moves the row out of this group entirely
      // (into the initially-collapsed Bought list), so the element `.check()` would keep watching
      // for its own state to change is the one about to be removed from the DOM.
      await harrisTeeter.getByRole('checkbox', { name: 'Trash bags' }).click();

      const boughtToggle = page.getByRole('button', { name: /^Bought \(\d+\)$/ });
      await boughtToggle.click();
      const boughtTrashBags = page
        .locator('li')
        .filter({ hasText: 'Trash bags' })
        .getByRole('checkbox', { name: 'Trash bags' });
      await expect(boughtTrashBags).toBeChecked();
      await expect(boughtTrashBags).toHaveAccessibleName(/waiting to sync/i);
      // Same reasoning in reverse: unchecking moves it back out of the Bought list.
      await boughtTrashBags.click();

      await page.getByRole('button', { name: 'Add an item' }).click();
      await page.getByRole('dialog', { name: 'Add an item' }).getByLabel('Item').fill(newItem);
      await page.getByRole('button', { name: 'Add item' }).click();

      const newCheckbox = page.getByRole('checkbox', { name: newItem });
      await expect(newCheckbox).toBeVisible();
      await expect(newCheckbox).toHaveAccessibleName(/waiting to sync/i);
      await expect(harrisTeeter.getByRole('checkbox', { name: 'Trash bags' })).not.toBeChecked();
      await expectAccessible(page, `This Week, offline with queued writes (${theme})`);

      // Survives a reload (Engineering Practices › "The write queue"): still offline, both the
      // optimistic state and the queue itself come back from IndexedDB, not from memory.
      await page.reload();
      await expect(page.getByRole('heading', { name: 'This Week', level: 1 })).toBeVisible();
      await expect(page.getByRole('checkbox', { name: newItem })).toHaveAccessibleName(
        /waiting to sync/i,
      );
      await expect(
        page.getByRole('region', { name: 'Harris Teeter' }).getByRole('checkbox', {
          name: 'Trash bags',
        }),
      ).not.toBeChecked();

      await page.context().setOffline(false);

      // No manual retry and no reload: the queue drains itself once TanStack sees the browser is
      // back online, replaying all three writes in the order they were queued.
      await expect(page.getByRole('checkbox', { name: /waiting to sync/i })).toHaveCount(0);
      // The toast's own text and its screen-reader-only live-region echo both say it (see
      // `09-search-deals-and-add-to-list.spec.ts`), so this is the other place that needs
      // `.first()` rather than a unique match.
      await expect(page.getByText('3 changes synced.').first()).toBeVisible();
      await expectAccessible(page, `This Week, synced after reconnecting (${theme})`);

      const listId = thisWeekId();
      expect(itemStatus(listId, 'Trash bags')).toBe('needed');
      expect(itemCount(listId, newItem)).toBe(1);

      // The duplicate replay (Handoff non-negotiable 9): the same id, sent again directly, is
      // exactly what a queued write replaying after its own success already looked like, and it
      // changes nothing.
      const token = await accessToken(request, SEED.alex.email);
      const addedId = itemId(listId, newItem);
      const replayStatus = await addListItemStatus(request, token, listId, {
        source: 'manual',
        id: addedId,
        itemName: newItem,
      });
      expect(replayStatus).toBe(201);
      expect(itemCount(listId, newItem)).toBe(1);
    });
  });
}
