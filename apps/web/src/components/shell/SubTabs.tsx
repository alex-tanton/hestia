import type { ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { activeSubTab, type Pillar } from '../../lib/sections.ts';
import { MdPrimaryTab, MdTabs } from '../md/MdTabs.tsx';

/** The primary tabs directly below the top bar that switch a pillar's sections. */
export function SubTabs({ pillar }: { pillar: Pillar }): ReactElement {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current = activeSubTab(pillar, pathname) ?? pillar.subTabs[0];
  const activeIndex = pillar.subTabs.findIndex((t) => t.path === current?.path);

  return (
    <nav aria-label={`${pillar.label} sections`} className="overflow-x-auto no-scrollbar">
      <MdTabs
        role="tablist"
        aria-label={`${pillar.label} sections`}
        activeTabIndex={activeIndex >= 0 ? activeIndex : 0}
        onChange={(event) => {
          const target = event.target as { activeTabIndex?: number } | null;
          const currentTarget = event.currentTarget as { activeTabIndex?: number } | null;
          const eventWithDetail = event as { detail?: { activeTabIndex?: number } };
          const tabIndex =
            eventWithDetail.detail?.activeTabIndex ??
            currentTarget?.activeTabIndex ??
            target?.activeTabIndex;
          if (typeof tabIndex === 'number') {
            const nextTab = pillar.subTabs[tabIndex];
            if (nextTab && nextTab.path !== pathname) {
              void navigate(nextTab.path);
              window.scrollTo(0, 0);
            }
          }
        }}
      >
        {pillar.subTabs.map((tab, index) => {
          const isSelected = index === (activeIndex >= 0 ? activeIndex : 0);
          return (
            <MdPrimaryTab
              key={tab.path}
              role="tab"
              aria-selected={isSelected ? 'true' : 'false'}
              aria-label={tab.label}
            >
              {tab.label}
            </MdPrimaryTab>
          );
        })}
      </MdTabs>
    </nav>
  );
}
