import { useEffect, useLayoutEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { SectionProvider } from '../../lib/section-context.tsx';
import {
  PILLARS,
  RELEASED_PILLARS,
  activeSubTab,
  sectionForPath,
  type SectionId,
} from '../../lib/sections.ts';
import { useWriteQueue } from '../../lib/offline/use-write-queue.ts';
import { ToastProvider } from '../ui/Toast.tsx';
import type { HouseholdSwitcherProps } from './HouseholdSwitcher.tsx';
import { OfflineBanner } from './OfflineBanner.tsx';
import { ScreenChromeProvider, useCurrentScreenChrome } from './screen-chrome.tsx';
import { TabBar } from './TabBar.tsx';
import { TopBar } from './TopBar.tsx';

export interface AppShellProps {
  switcher: HouseholdSwitcherProps;
  /** The service-worker update strip; a slot so tests need no service worker. */
  updatePrompt?: ReactNode;
  children: ReactNode;
}

/** The screen title the top bar shows for a path. */
export function titleForPath(pathname: string): string {
  if (pathname === '/settings' || pathname.startsWith('/settings/')) return 'Settings';
  const section = sectionForPath(pathname);
  if (section === 'dashboard') return 'This Week';
  const pillar = PILLARS[section];
  // An unshipped pillar shows only its coming-soon state, so its sub-tab names never surface.
  if (!RELEASED_PILLARS.has(section)) return pillar.label;
  const subTab = activeSubTab(pillar, pathname);
  return subTab && subTab !== pillar.subTabs[0] ? subTab.label : pillar.label;
}

/**
 * Design › Navigation rules: a tab switch lands on the tab's root but keeps that tab's scroll
 * position; switching household forgets every tab's position.
 */
function useTabScrollMemory(section: SectionId, householdId: string | undefined): void {
  const positions = useRef(new Map<SectionId, number>());
  const current = useRef(section);

  useEffect(() => {
    const record = (): void => {
      positions.current.set(current.current, window.scrollY);
    };
    window.addEventListener('scroll', record, { passive: true });
    return () => {
      window.removeEventListener('scroll', record);
    };
  }, []);

  useLayoutEffect(() => {
    positions.current.clear();
  }, [householdId]);

  useLayoutEffect(() => {
    if (current.current === section) return;
    current.current = section;
    window.scrollTo(0, positions.current.get(section) ?? 0);
  }, [section]);
}

/**
 * A queued write's toast can arrive long after the screen that made it has gone — after a
 * reconnect, or after a reload — so the queue is wired in at the shell, inside the toast
 * provider (Design › Offline rules).
 */
function WriteQueue(): null {
  useWriteQueue();
  return null;
}

function ShellFrame({ switcher, updatePrompt, children }: AppShellProps): ReactElement {
  const { pathname } = useLocation();
  const section = sectionForPath(pathname);
  const chrome = useCurrentScreenChrome();
  const title = chrome?.title ?? titleForPath(pathname);

  useTabScrollMemory(section, switcher.activeHouseholdId);

  useEffect(() => {
    document.title = `${title} · Hearth`;
  }, [title]);

  return (
    <SectionProvider section={section} className="min-h-dvh bg-base text-primary">
      <ToastProvider>
        <WriteQueue />
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-base px-4 py-3 text-body font-semibold text-section focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:px-4 focus:py-3"
        >
          Skip to main content
        </a>
        <div className="lg:pl-56">
          <header className="sticky top-0 z-20 border-b border-border bg-base pt-[env(safe-area-inset-top)]">
            <div className="mx-auto max-w-240">
              <TopBar title={title} switcher={switcher} chrome={chrome} />
            </div>
            <OfflineBanner />
            {updatePrompt}
          </header>
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full max-w-160 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] outline-none lg:max-w-240 lg:pb-8"
          >
            {children}
          </main>
        </div>
        <TabBar />
      </ToastProvider>
    </SectionProvider>
  );
}

export function AppShell(props: AppShellProps): ReactElement {
  return (
    <ScreenChromeProvider>
      <ShellFrame {...props} />
    </ScreenChromeProvider>
  );
}
