import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

export interface ScreenChrome {
  /** Replaces the title the path implies. */
  title: string;
  /** Where the back control goes: always the screen this one was pushed from. */
  backTo: string;
  backLabel?: string;
}

interface ChromeStore {
  chrome: ScreenChrome | undefined;
  setChrome: (chrome: ScreenChrome | undefined) => void;
}

const ScreenChromeContext = createContext<ChromeStore>({
  chrome: undefined,
  setChrome: () => undefined,
});

/**
 * A pushed detail screen names itself and where its back control returns to. The top bar then
 * shows that back control in place of the household switcher, and a back control always
 * returns to the screen that opened it, not the tab root.
 */
export function useScreenChrome(chrome: ScreenChrome): void {
  const { setChrome } = useContext(ScreenChromeContext);
  const { title, backTo, backLabel } = chrome;

  useEffect(() => {
    setChrome({ title, backTo, ...(backLabel === undefined ? {} : { backLabel }) });
    return () => {
      setChrome(undefined);
    };
  }, [setChrome, title, backTo, backLabel]);
}

export function useCurrentScreenChrome(): ScreenChrome | undefined {
  return useContext(ScreenChromeContext).chrome;
}

export function ScreenChromeProvider({ children }: { children: ReactNode }): ReactElement {
  const [chrome, setChrome] = useState<ScreenChrome | undefined>(undefined);
  // The hook's cleanup clears the chrome as its screen unmounts, which React runs before the
  // next screen's effects, so a screen that registers nothing shows the path's own title.
  const store = useMemo<ChromeStore>(() => ({ chrome, setChrome }), [chrome]);
  return <ScreenChromeContext value={store}>{children}</ScreenChromeContext>;
}
