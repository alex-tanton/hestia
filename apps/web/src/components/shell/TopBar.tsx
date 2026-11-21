import { useEffect, useState, type ReactElement } from 'react';
import { Link } from 'react-router';
import { Icon } from '../ui/Icon.tsx';
import { HouseholdSwitcher, type HouseholdSwitcherProps } from './HouseholdSwitcher.tsx';
import type { ScreenChrome } from './screen-chrome.tsx';

export interface TopBarProps {
  title: string;
  switcher: HouseholdSwitcherProps;
  /** Set by a pushed detail screen; its back control takes the switcher's place. */
  chrome?: ScreenChrome | undefined;
}

/** Small Top App Bar (64px) with scroll-aware tonal tint and single-h1 hierarchy. */
export function TopBar({ title, switcher, chrome }: TopBarProps): ReactElement {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = (): void => {
      setIsScrolled(window.scrollY > 4);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div className={`top-app-bar-content ${isScrolled ? 'scrolled' : ''}`}>
      <div className="flex shrink-0 items-center">
        {chrome ? (
          <Link
            to={chrome.backTo}
            aria-label={chrome.backLabel ? `Back to ${chrome.backLabel}` : 'Back'}
            className="flex h-10 w-10 items-center justify-center rounded-full text-secondary hover:bg-surface-container-high"
          >
            <Icon name="arrow_back" size={24} />
          </Link>
        ) : (
          <HouseholdSwitcher {...switcher} />
        )}
      </div>

      <h1 className="top-app-bar-title">{title}</h1>

      <div className="top-bar-settings-link flex shrink-0 items-center">
        <Link
          to="/settings"
          aria-label="Settings"
          className="flex h-10 w-10 items-center justify-center rounded-full text-secondary hover:bg-surface-container-high"
        >
          <Icon name="settings" size={24} />
        </Link>
      </div>
    </div>
  );
}
