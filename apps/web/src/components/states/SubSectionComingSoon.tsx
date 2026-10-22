import type { ReactElement } from 'react';
import { PILLARS } from '../../lib/sections.ts';
import { useSection } from '../../lib/section-context.tsx';
import { ComingSoonPanel } from './ComingSoon.tsx';

/**
 * A sub-section of a pillar that has shipped but whose own screen has not. The coming-soon
 * state covers a whole unshipped pillar; a pillar releases its sub-tabs together with itself, so
 * this is the same panel scoped to the one sub-section, in the pillar's color and icon.
 */
export function SubSectionComingSoon({ section }: { section: string }): ReactElement {
  const sectionId = useSection();
  const pillar = sectionId === 'dashboard' ? PILLARS.lists : PILLARS[sectionId];
  return (
    <ComingSoonPanel
      icon={pillar.icon}
      message={`${section} arrives with the rest of this release. Your lists and pantry work now.`}
    />
  );
}
