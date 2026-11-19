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
    <nav aria-label="Main" className="nav-bar">
      <ul className="flex w-full items-center justify-around px-2">
        {TABS.map((tab) => {
          const iconName = TAB_ICONS[tab.id];
          return (
            <li key={tab.id} className="flex-1">
              <NavLink
                to={tab.path}
                end={tab.path === '/'}
                className="group flex flex-col items-center justify-center gap-1 py-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded-lg"
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
