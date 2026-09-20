import type { LucideIcon } from 'lucide-react';
import { useId, type ReactElement } from 'react';
import type { Pillar } from '../../lib/sections.ts';

export interface ComingSoonPanelProps {
  icon: LucideIcon;
  /** One line naming what this will do; never more (Design › Staged releases). */
  message: string;
  heading?: string;
  /** 3 where the panel sits inside a section that already has a heading, as in Settings. */
  headingLevel?: 2 | 3;
}

/**
 * Design › Staged releases: the coming-soon state. It uses the section's color and icon, names
 * what the section will do in one line, and offers nothing to tap. It is the pattern for
 * anything the shell shows before its release — an unshipped pillar's tab, and the settings a
 * later phase owns.
 */
export function ComingSoonPanel({
  icon: Icon,
  message,
  heading = 'Coming soon',
  headingLevel = 2,
}: ComingSoonPanelProps): ReactElement {
  const headingId = useId();
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col items-center gap-4 px-4 py-12 text-center"
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-section-tint">
        <Icon aria-hidden size={32} strokeWidth={1.5} className="text-section-accent" />
      </span>
      <Heading id={headingId} className="text-h2 text-section">
        {heading}
      </Heading>
      <p className="max-w-[70ch] text-body text-secondary">{message}</p>
    </section>
  );
}

/** A pillar's tab before the pillar ships; its sub-tabs appear only once it does. */
export function ComingSoon({ pillar }: { pillar: Pillar }): ReactElement {
  return <ComingSoonPanel icon={pillar.icon} message={pillar.comingSoon} />;
}
