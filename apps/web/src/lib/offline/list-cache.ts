import type {
  ListItem,
  ShoppingListDetail,
  StoreGroup,
  UpdateListItemRequest,
} from '@hestia/shared';

/*
 * Optimistic edits to a cached list. Every offline-queueable write is applied at once and rolled
 * back visibly on failure.
 *
 * Money is deliberately untouched: `subtotalCents` and `unpricedCount` belong to the server, and
 * the client never does money arithmetic. A group holding a pending write therefore shows its last
 * server-known subtotal, marked pending, until the write lands and the response replaces the whole
 * list.
 */

/** Store groups sort by merchant name with the unassigned "Anywhere" group last. */
function byMerchant(left: StoreGroup, right: StoreGroup): number {
  if (left.merchantId === null) return right.merchantId === null ? 0 : 1;
  if (right.merchantId === null) return -1;
  return (left.merchantName ?? '').localeCompare(right.merchantName ?? '');
}

export function allItems(detail: ShoppingListDetail): ListItem[] {
  return [...detail.storeGroups.flatMap((group) => group.items), ...detail.bought];
}

export function findItem(detail: ShoppingListDetail, itemId: string): ListItem | undefined {
  return allItems(detail).find((item) => item.id === itemId);
}

/** Counts are not money, so the client keeps them honest while a write is in flight. */
function recount(detail: ShoppingListDetail): ShoppingListDetail {
  const items = allItems(detail);
  return {
    ...detail,
    itemCount: items.length,
    outstandingCount: items.filter((item) => item.status !== 'bought').length,
  };
}

/** Drops an item from every group, leaving each group's server-computed money alone. */
function withoutItem(detail: ShoppingListDetail, itemId: string): ShoppingListDetail {
  return {
    ...detail,
    storeGroups: detail.storeGroups
      .map((group) => ({ ...group, items: group.items.filter((item) => item.id !== itemId) }))
      .filter((group) => group.items.length > 0),
    bought: detail.bought.filter((item) => item.id !== itemId),
  };
}

/** Puts an item back where its status and store say it belongs. */
function withItem(detail: ShoppingListDetail, item: ListItem): ShoppingListDetail {
  if (item.status === 'bought') return { ...detail, bought: [...detail.bought, item] };

  const existing = detail.storeGroups.find((group) => group.merchantId === item.merchantId);
  if (existing) {
    return {
      ...detail,
      storeGroups: detail.storeGroups.map((group) =>
        group === existing ? { ...group, items: [...group.items, item] } : group,
      ),
    };
  }
  // A store with nothing on the list yet has no server subtotal to show; it arrives with the
  // response, so the group opens at zero and is marked pending until then.
  const created: StoreGroup = {
    merchantId: item.merchantId,
    merchantName: item.merchantName,
    subtotalCents: 0,
    unpricedCount: 0,
    items: [item],
  };
  return { ...detail, storeGroups: [...detail.storeGroups, created].sort(byMerchant) };
}

/**
 * Applies an absolute-value patch (never a toggle). A status or store
 * change moves the row between groups, which is what makes checking an item off visible at once.
 */
export function withItemPatch(
  detail: ShoppingListDetail,
  itemId: string,
  patch: UpdateListItemRequest,
): ShoppingListDetail {
  const current = findItem(detail, itemId);
  if (current === undefined) return detail;

  const next: ListItem = {
    ...current,
    ...(patch.itemName === undefined ? {} : { itemName: patch.itemName }),
    ...(patch.quantity === undefined ? {} : { quantity: patch.quantity }),
    ...(patch.quantityNote === undefined ? {} : { quantityNote: patch.quantityNote }),
    ...(patch.status === undefined ? {} : { status: patch.status }),
    ...(patch.priceCents === undefined ? {} : { priceCents: patch.priceCents }),
    ...(patch.priceUnit === undefined ? {} : { priceUnit: patch.priceUnit }),
    ...(patch.merchantId === undefined
      ? {}
      : { merchantId: patch.merchantId, merchantName: patch.merchantName ?? null }),
  };

  return recount(withItem(withoutItem(detail, itemId), next));
}

/** A client-generated row, so replaying the add after a reconnect changes nothing. */
export function withNewItem(detail: ShoppingListDetail, item: ListItem): ShoppingListDetail {
  if (findItem(detail, item.id) !== undefined) return detail;
  return recount(withItem(detail, item));
}
