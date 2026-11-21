import {
  useEffect,
  useId,
  useRef,
  type ComponentRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { MdPrimaryTab, MdTabs } from '../md/MdTabs.tsx';

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  label: string;
  items: readonly TabItem[];
  value: string;
  onValueChange: (value: string) => void;
}

function readActiveTabIndex(target: EventTarget | null): number | undefined {
  if (target !== null && 'activeTabIndex' in target && typeof target.activeTabIndex === 'number') {
    return target.activeTabIndex;
  }
  return undefined;
}

/** In-screen tabs, such as the week planner's day selection. */
export function Tabs({ label, items, value, onValueChange }: TabsProps): ReactElement {
  const baseId = useId();
  const listRef = useRef<ComponentRef<typeof MdTabs>>(null);

  const matchedIndex = items.findIndex((item) => item.value === value);
  const activeIndex = items.length === 0 ? 0 : matchedIndex === -1 ? 0 : matchedIndex;
  const activeItem = items[activeIndex];

  // A row wider than the viewport (the planner's seven day tabs) scrolls, so the value
  // set on mount or changed programmatically — such as the planner's default of today — needs to
  // be scrolled into view itself.
  useEffect(() => {
    const activeTab = listRef.current?.querySelectorAll<HTMLElement>('md-primary-tab')[activeIndex];
    activeTab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeIndex, value, items.length]);

  const handleChange = (event: Event): void => {
    const nextIndex = readActiveTabIndex(event.currentTarget);
    const nextItem = nextIndex !== undefined ? items[nextIndex] : undefined;
    if (nextItem !== undefined && nextItem.value !== value) {
      onValueChange(nextItem.value);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const isLeft = event.key === 'ArrowLeft';
    const isRight = event.key === 'ArrowRight';
    const isHome = event.key === 'Home';
    const isEnd = event.key === 'End';
    if (event.defaultPrevented || (!isLeft && !isRight && !isHome && !isEnd) || items.length < 2) {
      return;
    }
    const listEl = listRef.current;
    if (listEl === null) {
      return;
    }
    const tabElements = Array.from(listEl.querySelectorAll<HTMLElement>('md-primary-tab'));
    if (tabElements.length < 2) {
      return;
    }
    const activeEl = listEl.ownerDocument.activeElement;
    const focusedIndex = tabElements.findIndex((tab) => tab === activeEl || tab.contains(activeEl));
    const baseIndex = focusedIndex === -1 ? activeIndex : focusedIndex;
    const isRtl = getComputedStyle(listEl).direction === 'rtl';
    const forwards = isRtl ? isLeft : isRight;

    let nextIndex: number;
    if (isHome) {
      nextIndex = 0;
    } else if (isEnd) {
      nextIndex = tabElements.length - 1;
    } else {
      nextIndex = forwards
        ? (baseIndex + 1) % tabElements.length
        : (baseIndex - 1 + tabElements.length) % tabElements.length;
    }

    const nextItem = items[nextIndex];
    const nextTab = tabElements[nextIndex];
    if (nextItem === undefined || nextTab === undefined) {
      return;
    }
    event.preventDefault();
    nextTab.focus();
    if (nextItem.value !== value) {
      onValueChange(nextItem.value);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <MdTabs
        ref={listRef}
        aria-label={label}
        autoActivate
        activeTabIndex={activeIndex}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="overflow-x-auto"
      >
        {items.map((item, index) => (
          <MdPrimaryTab
            key={item.value}
            id={`${baseId}-tab-${String(index)}`}
            aria-controls={`${baseId}-panel-${String(index)}`}
            active={index === activeIndex}
            tabIndex={index === activeIndex ? 0 : -1}
            className="shrink-0"
          >
            {item.label}
          </MdPrimaryTab>
        ))}
      </MdTabs>
      {activeItem !== undefined && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${String(activeIndex)}`}
          aria-labelledby={`${baseId}-tab-${String(activeIndex)}`}
        >
          {activeItem.content}
        </div>
      )}
    </div>
  );
}
