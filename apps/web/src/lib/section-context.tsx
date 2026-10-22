import { createContext, useContext, type ReactElement, type ReactNode } from 'react';
import type { SectionId } from './sections.ts';

const SectionContext = createContext<SectionId>('dashboard');

interface SectionProviderProps {
  section: SectionId;
  children: ReactNode;
  className?: string;
}

/**
 * Supplies the section to components. The wrapper's
 * data-section attribute retargets every section-* color utility inside it, so components style
 * themselves with `text-section` and never name a hue.
 */
export function SectionProvider({
  section,
  children,
  className,
}: SectionProviderProps): ReactElement {
  return (
    <SectionContext value={section}>
      <div data-section={section} className={className}>
        {children}
      </div>
    </SectionContext>
  );
}

export function useSection(): SectionId {
  return useContext(SectionContext);
}
