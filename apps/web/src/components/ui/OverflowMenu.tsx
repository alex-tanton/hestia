import { useId, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';
import { useSection } from '../../lib/section-context.tsx';
import { MdIconButton } from '../md/MdButton.tsx';
import { MdMenu, MdMenuItem } from '../md/MdMenu.tsx';
import { Icon } from './Icon.tsx';

export interface OverflowMenuItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode | undefined;
  isDestructive?: boolean | undefined;
  isDisabled?: boolean | undefined;
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
  const anchorId = useId();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div data-section={section} className="relative inline-flex">
      <MdIconButton
        id={anchorId}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="min-h-11 min-w-11 text-[var(--md-sys-color-on-surface-variant)]"
        onClick={() => {
          setIsOpen((prev) => !prev);
        }}
      >
        <Icon name="more_vert" />
      </MdIconButton>
      <MdMenu
        anchor={anchorId}
        positioning="fixed"
        open={isOpen}
        onClosed={() => {
          setIsOpen(false);
        }}
      >
        {items.map((item) => {
          const isItemDisabled = (item.isDisabled ?? false) || item.disabledReason !== undefined;
          return (
            <MdMenuItem
              key={item.label}
              disabled={isItemDisabled}
              className={cn(
                'min-h-11',
                item.isDestructive === true &&
                  '[--md-menu-item-hover-label-text-color:var(--md-sys-color-error)] [--md-menu-item-label-text-color:var(--md-sys-color-error)] [--md-menu-item-leading-icon-color:var(--md-sys-color-error)]',
              )}
              onClick={() => {
                if (isItemDisabled) {
                  return;
                }
                setIsOpen(false);
                item.onSelect();
              }}
            >
              {item.icon !== undefined && (
                <span slot="start" aria-hidden="true" className="inline-flex items-center">
                  {item.icon}
                </span>
              )}
              <span slot="headline">{item.label}</span>
              {item.disabledReason !== undefined && (
                <span slot="supporting-text">{item.disabledReason}</span>
              )}
            </MdMenuItem>
          );
        })}
      </MdMenu>
    </div>
  );
}
