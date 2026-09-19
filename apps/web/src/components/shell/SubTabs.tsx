import type { ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { activeSubTab, type Pillar } from '../../lib/sections.ts';
import { SegmentedControl } from '../ui/SegmentedControl.tsx';

/** The segmented control directly below the top bar that switches a tab's sections. */
export function SubTabs({ pillar }: { pillar: Pillar }): ReactElement {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current = activeSubTab(pillar, pathname) ?? pillar.subTabs[0];

  return (
    <nav aria-label={`${pillar.label} sections`}>
      <SegmentedControl
        label={`${pillar.label} sections`}
        segments={pillar.subTabs.map((tab) => ({ value: tab.path, label: tab.label }))}
        value={current?.path ?? ''}
        onValueChange={(path) => {
          void navigate(path);
        }}
      />
    </nav>
  );
}
