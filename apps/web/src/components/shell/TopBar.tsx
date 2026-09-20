import { ChevronLeft, Settings } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { BUTTON_BASE } from '../ui/Button.tsx';
import { cn } from '../../lib/cn.ts';
import { HouseholdSwitcher, type HouseholdSwitcherProps } from './HouseholdSwitcher.tsx';
import type { ScreenChrome } from './screen-chrome.tsx';

export interface TopBarProps {
  title: string;
  switcher: HouseholdSwitcherProps;
  /** Set by a pushed detail screen; its back control takes the switcher's place. */
  chrome?: ScreenChrome | undefined;
}

/** Design › Layout shell › Chrome: household switcher, screen title, settings. */
export function TopBar({ title, switcher, chrome }: TopBarProps): ReactElement {
  return (
    <div className="flex min-h-14 items-center gap-2 px-2">
      <div className="flex max-w-[45%] min-w-0 shrink-0 items-center">
        {chrome ? (
          <Link
            to={chrome.backTo}
            className={cn(
              BUTTON_BASE,
              'gap-1 px-2 text-secondary hover:bg-raised hover:text-primary',
            )}
          >
            <ChevronLeft aria-hidden size={20} strokeWidth={1.5} className="shrink-0" />
            <span className="truncate">{chrome.backLabel ?? 'Back'}</span>
          </Link>
        ) : (
          <HouseholdSwitcher {...switcher} />
        )}
      </div>
      <h1 className="min-w-0 flex-1 truncate text-center text-h3 text-primary lg:text-left">
        {title}
      </h1>
      <Link
        to="/settings"
        aria-label="Settings"
        className={cn(
          BUTTON_BASE,
          'shrink-0 text-secondary hover:bg-raised hover:text-primary active:bg-section-tint',
        )}
      >
        <Settings aria-hidden size={20} strokeWidth={1.5} />
      </Link>
    </div>
  );
}
