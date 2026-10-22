import { Ellipsis } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';
import { useSection } from '../../lib/section-context.tsx';
import { Button } from './Button.tsx';

export interface OverflowMenuItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  isDestructive?: boolean;
  isDisabled?: boolean;
  /**
   * Why the action is unavailable ("Needs a connection."). It disables the item and sits beneath
   * the label: a row's actions live in this menu, so the one line explaining an offline-disabled
   * control belongs here too.
   */
  disabledReason?: string | undefined;
}

export interface OverflowMenuProps {
  /** Names what the menu acts on, e.g. "More actions for Rent". */
  label: string;
  items: readonly OverflowMenuItem[];
}

/**
 * The "More" menu: the single-pointer alternative to every swipe action (WCAG 2.5.1).
 */
export function OverflowMenu({ label, items }: OverflowMenuProps): ReactElement {
  const section = useSection();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" isIconOnly aria-label={label} className="text-secondary">
          <Ellipsis aria-hidden size={20} strokeWidth={1.5} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          data-section={section}
          align="end"
          sideOffset={4}
          className="z-50 min-w-48 rounded-md border border-border bg-base p-1 shadow-md"
        >
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              disabled={(item.isDisabled ?? false) || item.disabledReason !== undefined}
              onSelect={item.onSelect}
              className={cn(
                'flex min-h-11 cursor-default items-center gap-2 rounded-sm px-3 py-1.5 text-body outline-none select-none data-disabled:opacity-50 data-highlighted:bg-raised data-highlighted:outline-2 data-highlighted:-outline-offset-2 data-highlighted:outline-section-accent',
                item.isDestructive ? 'text-danger' : 'text-primary',
              )}
            >
              {item.icon}
              <span className="flex flex-col">
                {item.label}
                {item.disabledReason !== undefined && (
                  <span className="text-body-sm text-secondary">{item.disabledReason}</span>
                )}
              </span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
