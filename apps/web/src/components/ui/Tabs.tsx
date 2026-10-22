import { Tabs as RadixTabs } from 'radix-ui';
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';

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

/** In-screen tabs, such as the week planner's day selection. */
export function Tabs({ label, items, value, onValueChange }: TabsProps): ReactElement {
  const listRef = useRef<HTMLDivElement>(null);

  // A row wider than the viewport (the planner's seven day tabs) scrolls, so the value
  // set on mount or changed programmatically — such as the planner's default of today — needs to
  // be scrolled into view itself; Radix does not do this for a value change alone.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-state="active"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [value]);

  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange} className="flex flex-col gap-4">
      <RadixTabs.List
        ref={listRef}
        aria-label={label}
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            // `shrink-0` keeps each trigger at its natural label width: without it, flex's
            // default shrink lets seven day tabs ("Sun 09/27") squeeze below their text width,
            // which nothing then clips, so the overset text bleeds into its neighbors. The
            // `overflow-x-auto` on the list is what a longer row scrolls with instead.
            className="-mb-px min-h-11 min-w-11 shrink-0 border-b-2 border-transparent px-3 text-body-sm font-semibold whitespace-nowrap text-secondary transition-colors duration-150 ease-out hover:text-primary active:bg-section-tint data-[state=active]:border-section-accent data-[state=active]:text-section"
          >
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) => (
        <RadixTabs.Content key={item.value} value={item.value}>
          {item.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
