import { ShoppingCart } from 'lucide-react';
import { useId, type ReactElement } from 'react';
import { Link } from 'react-router';
import { BUTTON_BASE } from '../ui/Button.tsx';
import { Card } from '../ui/Card.tsx';
import { cn } from '../../lib/cn.ts';
import { SectionProvider } from '../../lib/section-context.tsx';

export const FIRST_RUN_HEADING = 'Start with a list';
export const FIRST_RUN_COPY =
  'This Week shows what is due, planned, and left to buy. Nothing is here yet, so start with a shopping list.';

/**
 * Design › Screens › 2: when every *shipped* pillar is empty, one first-run panel replaces those
 * pillars' empty cards. Placeholders for unshipped pillars are unaffected and keep their place,
 * so the layout never reflows as pillars arrive. Lists is the first pillar to ship, and a list is
 * what the other three eventually feed, so it is the action the panel offers.
 */
export function DashboardFirstRun(): ReactElement {
  const headingId = useId();
  return (
    <SectionProvider section="lists">
      <Card as="section" variant="raised" aria-labelledby={headingId}>
        <h2 id={headingId} className="mb-2 flex items-center gap-2 text-h2 text-section">
          <ShoppingCart aria-hidden size={20} strokeWidth={1.5} className="text-section-accent" />
          {FIRST_RUN_HEADING}
        </h2>
        <p className="mb-3 max-w-[70ch] text-body text-secondary">{FIRST_RUN_COPY}</p>
        <Link
          to="/lists"
          className={cn(BUTTON_BASE, 'bg-section px-4 text-on-section hover:bg-section/90')}
        >
          Create a list
        </Link>
      </Card>
    </SectionProvider>
  );
}
