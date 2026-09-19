import { Tabs as RadixTabs } from 'radix-ui';
import type { ReactElement, ReactNode } from 'react';

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

/** In-screen tabs, such as the week planner's day selection (Design › Primitives). */
export function Tabs({ label, items, value, onValueChange }: TabsProps): ReactElement {
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange} className="flex flex-col gap-4">
      <RadixTabs.List
        aria-label={label}
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            className="-mb-px min-h-11 min-w-11 border-b-2 border-transparent px-3 text-body-sm font-semibold whitespace-nowrap text-secondary transition-colors duration-150 ease-out hover:text-primary active:bg-section-tint data-[state=active]:border-section-accent data-[state=active]:text-section"
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
