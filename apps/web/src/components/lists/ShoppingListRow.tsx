import type { ReactElement } from 'react';
import type { ListItem, ListItemSource } from '@hestia/shared';
import { cn } from '../../lib/cn.ts';
import { Badge } from '../ui/Badge.tsx';
import { Checkbox } from '../ui/Checkbox.tsx';
import { Icon, type IconName } from '../ui/Icon.tsx';
import { OverflowMenu, type OverflowMenuItem } from '../ui/OverflowMenu.tsx';
import { ItemPrice, speakItemPrice } from './ItemPrice.tsx';
import { PENDING_CLASSES, PendingMark } from './PendingMark.tsx';

const SOURCE_ICONS: Record<ListItemSource, IconName> = {
  manual: 'edit',
  from_deal: 'sell',
  from_recipe: 'restaurant',
};

const SOURCE_WORDS: Record<ListItemSource, string> = {
  manual: 'added by hand',
  from_deal: 'from a deal',
  from_recipe: 'from a recipe',
};

export const IN_CART_LABEL = 'In cart';

export interface ShoppingListRowProps {
  item: ListItem;
  /** Display names by user id, so a shared list stays legible. */
  memberNames: ReadonlyMap<string, string>;
  /** The Bought group is not grouped by store, so its rows name their own. */
  showStore?: boolean;
  /** A queued write is in flight for this row. */
  isPending?: boolean;
  /** Another member just changed this row. */
  isChanged?: boolean;
  /** An archived list is read-only apart from unarchiving and deleting it. */
  isReadOnly?: boolean;
  onToggleBought: (isBought: boolean) => void;
  menuItems?: readonly OverflowMenuItem[];
}

function quantityText(item: ListItem): string | undefined {
  if (item.quantityNote !== null) return item.quantityNote;
  if (item.quantity === null) return undefined;
  return item.priceUnit === 'each'
    ? String(item.quantity)
    : `${String(item.quantity)} ${item.priceUnit}`;
}

/**
 * The checkbox is a real input with the row as its label, so it is announced as a checkbox
 * rather than as a clickable div, and the whole row is its target.
 */
export function ShoppingListRow({
  item,
  memberNames,
  showStore = false,
  isPending = false,
  isChanged = false,
  isReadOnly = false,
  onToggleBought,
  menuItems = [],
}: ShoppingListRowProps): ReactElement {
  const quantity = quantityText(item);
  const addedBy = memberNames.get(item.addedBy);
  const isBought = item.status === 'bought';

  const spoken = [
    item.itemName,
    speakItemPrice(item),
    quantity === undefined ? undefined : `quantity ${quantity}`,
    showStore || item.merchantName === null ? (item.merchantName ?? 'Anywhere') : undefined,
    item.conditionalPrice ? 'conditional price' : undefined,
    item.status === 'in_cart' ? IN_CART_LABEL : undefined,
    addedBy === undefined ? undefined : `added by ${addedBy}`,
    SOURCE_WORDS[item.source],
    isPending ? 'waiting to sync' : undefined,
  ]
    .filter((part) => part !== undefined)
    .join(', ');

  return (
    <li
      className={cn(
        'flex min-h-[48px] items-center justify-between gap-3 px-4 py-3 transition-all duration-200',
        isBought && 'bg-[var(--md-sys-color-surface-container-low)]',
        isPending && PENDING_CLASSES,
        // A brief tint marks what another member just changed; it fades with the 2s timer.
        isChanged && 'bg-section-tint',
      )}
    >
      <Checkbox
        variant="in-list"
        className="flex-1"
        checked={isBought}
        aria-label={spoken}
        disabled={isReadOnly}
        onCheckedChange={(checked) => {
          onToggleBought(checked);
        }}
        label={
          <span className="flex min-w-0 flex-col gap-0.5">
            <span
              className={cn(
                'truncate text-body-md select-none transition-all duration-200',
                isBought
                  ? 'line-through text-[var(--md-sys-color-on-surface-variant)]'
                  : 'text-[var(--md-sys-color-on-surface)]',
              )}
            >
              {item.itemName}
            </span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label-md text-[var(--md-sys-color-on-surface-variant)]">
              <Icon name={SOURCE_ICONS[item.source]} size={16} className="shrink-0" />
              {quantity !== undefined && <span className="tabular-nums">{quantity}</span>}
              {showStore && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="storefront" size={16} />
                  {item.merchantName ?? 'Anywhere'}
                </span>
              )}
              {addedBy !== undefined && <span>Added by {addedBy}</span>}
            </span>
          </span>
        }
        detail={
          <span className="flex shrink-0 flex-col items-end gap-1 pl-2">
            <ItemPrice item={item} />
            <span className="flex items-center gap-1">
              {item.status === 'in_cart' && <Badge variant="section">{IN_CART_LABEL}</Badge>}
              {item.conditionalPrice && <Badge variant="warning">Card or coupon</Badge>}
              {isPending && <PendingMark />}
            </span>
          </span>
        }
      />
      {menuItems.length > 0 && (
        <OverflowMenu label={`More actions for ${item.itemName}`} items={menuItems} />
      )}
    </li>
  );
}
