import { describe, expect, it } from 'vitest';
import {
  apples,
  broccoli,
  groundBeef,
  listItem,
  shreddedCheese,
  thisWeekDetailFixture,
} from '../../test/list-fixtures.ts';
import { findItem, withItemPatch, withNewItem } from './list-cache.ts';

const detail = thisWeekDetailFixture;

function groupFor(result: typeof detail, merchantName: string | null): number {
  return result.storeGroups.find((group) => group.merchantName === merchantName)?.items.length ?? 0;
}

describe('optimistic list edits', () => {
  it('moves a checked item into the bought group at once', () => {
    const result = withItemPatch(detail, broccoli.id, { status: 'bought' });
    expect(findItem(result, broccoli.id)?.status).toBe('bought');
    expect(result.bought.map((item) => item.id)).toContain(broccoli.id);
    expect(groupFor(result, 'Food Lion')).toBe(3);
  });

  it('moves an unchecked item back out of the bought group', () => {
    const result = withItemPatch(detail, shreddedCheese.id, { status: 'needed' });
    expect(result.bought.map((item) => item.id)).not.toContain(shreddedCheese.id);
    expect(groupFor(result, 'Food Lion')).toBe(5);
  });

  it('accepts "in cart" as the absolute value it is, not a toggle', () => {
    const result = withItemPatch(detail, broccoli.id, { status: 'in_cart' });
    expect(findItem(result, broccoli.id)?.status).toBe('in_cart');
    // The documented quirk: a late "in cart" can move a bought item back.
    const late = withItemPatch(detail, shreddedCheese.id, { status: 'in_cart' });
    expect(findItem(late, shreddedCheese.id)?.status).toBe('in_cart');
    expect(late.bought.map((item) => item.id)).not.toContain(shreddedCheese.id);
  });

  it('never recomputes money: a group keeps the subtotal the server sent', () => {
    const result = withItemPatch(detail, broccoli.id, { status: 'bought' });
    const foodLion = result.storeGroups.find((group) => group.merchantName === 'Food Lion');
    expect(foodLion?.subtotalCents).toBe(1826);
    expect(foodLion?.unpricedCount).toBe(1);
  });

  it('keeps the counts honest while a write is in flight', () => {
    const result = withItemPatch(detail, broccoli.id, { status: 'bought' });
    expect(result.itemCount).toBe(15);
    expect(result.outstandingCount).toBe(11);
  });

  it('moves an item between store groups when its store changes', () => {
    const result = withItemPatch(detail, apples.id, {
      merchantId: '1301',
      merchantName: 'Harris Teeter',
    });
    expect(groupFor(result, 'Food Lion')).toBe(3);
    expect(groupFor(result, 'Harris Teeter')).toBe(3);
  });

  it('drops a store group that has lost its last item', () => {
    const emptied = [groundBeef, broccoli, apples].reduce(
      (current, item) => withItemPatch(current, item.id, { status: 'bought' }),
      withItemPatch(detail, 'a0000001-0000-4000-8000-000000000003', { status: 'bought' }),
    );
    expect(emptied.storeGroups.map((group) => group.merchantName)).not.toContain('Food Lion');
  });

  it('ignores a patch for an item that is no longer on the list', () => {
    expect(withItemPatch(detail, 'missing', { status: 'bought' })).toBe(detail);
  });

  it('adds a new item into its store group and counts it', () => {
    const added = listItem({
      id: 'c0000001-0000-4000-8000-000000000001',
      itemName: 'Milk',
      merchantId: '1204',
      merchantName: 'Food Lion',
      priceCents: 399,
    });
    const result = withNewItem(detail, added);
    expect(groupFor(result, 'Food Lion')).toBe(5);
    expect(result.itemCount).toBe(16);
    expect(result.outstandingCount).toBe(13);
  });

  it('opens a group for a store the list did not have yet', () => {
    const added = listItem({
      id: 'c0000001-0000-4000-8000-000000000002',
      itemName: 'Bananas',
      merchantId: '9999',
      merchantName: 'Aldi',
    });
    const result = withNewItem(detail, added);
    const aldi = result.storeGroups.find((group) => group.merchantName === 'Aldi');
    expect(aldi?.items).toHaveLength(1);
    // Nothing of that group's money is the client's to invent.
    expect(aldi?.subtotalCents).toBe(0);
    // The unassigned group still sorts last.
    expect(result.storeGroups.at(-1)?.merchantId).toBeNull();
  });

  it('replaying an add with the same client id changes nothing', () => {
    const once = withNewItem(detail, listItem({ id: broccoli.id, itemName: 'Broccoli' }));
    expect(once).toBe(detail);
  });
});
