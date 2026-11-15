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

export function NavigationRail(): ReactElement {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col items-center justify-between border-r border-border bg-surface py-4 min-[600px]:flex"
    >
      <div className="flex w-full flex-col items-center gap-3">
        {/* Top spacer / brand anchor */}
        <div className="flex h-12 w-12 items-center justify-center" />
        <ul className="flex w-full flex-col items-center gap-2 px-1">
          {TABS.map((tab) => {
            const iconName = TAB_ICONS[tab.id];
            return (
              <li key={tab.id} className="w-full">
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
      </div>

      <div className="flex w-full flex-col items-center gap-2 px-1 pb-2">
        <hr className="w-12 border-border" />
        <NavLink
          to="/settings"
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
                <Icon name="settings" filled={isActive} size={24} />
              </div>
              <span
                className={`text-label truncate ${
                  isActive ? 'font-semibold text-primary' : 'font-normal text-secondary'
                }`}
              >
                Settings
              </span>
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}
