import type { ReactElement } from 'react';
import { NavLink } from 'react-router';
import { Icon, type IconName } from '../ui/Icon.tsx';
import { TABS, type SectionId } from '../../lib/sections.ts';

const TAB_ICONS: Record<SectionId, IconName> = {
  dashboard: 'dashboard',
  lists: 'shopping_cart',
  meals: 'restaurant',
  bills: 'receipt_long',
  chores: 'checklist',
};

export function NavigationBar(): ReactElement {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex h-20 min-h-[80px] items-center justify-around bg-surface-container pb-[env(safe-area-inset-bottom)] min-[600px]:hidden"
    >
      <ul className="flex w-full items-center justify-around px-2">
        {TABS.map((tab) => {
          const iconName = TAB_ICONS[tab.id];
          return (
            <li key={tab.id} className="flex-1">
              <NavLink
                to={tab.path}
                end={tab.path === '/'}
                className="group flex flex-col items-center justify-center gap-1 py-1 text-center outline-none"
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-150 ${
                        isActive
                          ? 'bg-secondary-container text-on-secondary-container'
                          : 'text-secondary hover:bg-surface-container-high'
                      }`}
                    >
                      <Icon name={iconName} filled={isActive} size={24} />
                    </div>
                    <span
                      className={`text-label truncate ${
                        isActive ? 'font-semibold text-primary' : 'font-normal text-secondary'
                      }`}
                    >
                      {tab.label}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
