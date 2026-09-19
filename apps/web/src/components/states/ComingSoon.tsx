import type { ReactElement } from 'react';
import type { Pillar } from '../../lib/sections.ts';

/**
 * Design › Staged releases: an unshipped pillar's tab opens this state. It uses the pillar's
 * section color and icon, names what the section will do in one line, and offers nothing to
 * tap — including the pillar's sub-tabs, which appear only once it ships.
 */
export function ComingSoon({ pillar }: { pillar: Pillar }): ReactElement {
  const Icon = pillar.icon;
  return (
    <section
      aria-labelledby="coming-soon-heading"
      className="flex flex-col items-center gap-4 px-4 py-12 text-center"
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-section-tint">
        <Icon aria-hidden size={32} strokeWidth={1.5} className="text-section-accent" />
      </span>
      <h2 id="coming-soon-heading" className="text-h2 text-section">
        Coming soon
      </h2>
      <p className="max-w-[70ch] text-body text-secondary">{pillar.comingSoon}</p>
    </section>
  );
}
