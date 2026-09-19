import type { ReactElement } from 'react';
import { NavLink } from 'react-router';
import { TABS } from '../../lib/sections.ts';

/**
 * The five tabs (PRD › Navigation shell): a fixed bottom bar below 1025px and a labelled left
 * sidebar above it (Design › Breakpoints). NavLink sets aria-current="page" on the active tab.
 * The active tab takes the section color *and* a heavier label plus an indicator bar, so the
 * state is never shown by color alone.
 */
export function TabBar(): ReactElement {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-base pb-[env(safe-area-inset-bottom)] lg:inset-y-0 lg:right-auto lg:left-0 lg:w-56 lg:border-t-0 lg:border-r lg:pt-4 lg:pb-0"
    >
      <ul className="mx-auto flex max-w-160 lg:max-w-none lg:flex-col lg:gap-1 lg:px-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <li key={tab.id} data-section={tab.id} className="flex-1 lg:flex-none">
              <NavLink
                to={tab.path}
                end={tab.path === '/'}
                className="group relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-caption text-muted transition-colors duration-150 ease-out hover:text-primary aria-[current=page]:text-section lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-md lg:px-3 lg:text-body lg:hover:bg-raised"
              >
                <span
                  aria-hidden
                  className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-transparent group-aria-[current=page]:bg-section-accent lg:inset-x-auto lg:inset-y-2 lg:left-0 lg:h-auto lg:w-0.5"
                />
                <Icon
                  aria-hidden
                  size={24}
                  strokeWidth={1.5}
                  className="group-aria-[current=page]:text-section-accent"
                />
                <span className="font-normal group-aria-[current=page]:font-semibold">
                  {tab.label}
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
