import { ChevronLeft } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { SectionProvider } from '../../lib/section-context.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { OfflineBanner } from '../../components/shell/OfflineBanner.tsx';
import { ToastProvider } from '../../components/ui/Toast.tsx';

export interface OnboardingLayoutProps {
  /** The onboarding headline (Branding › Typography: `display`). */
  title: string;
  description?: string | undefined;
  /** A back control, where the step has somewhere to go back to. */
  onBack?: { label: string; onBack: () => void };
  children: ReactNode;
}

/**
 * The frame every onboarding and account-recovery screen sits in (Design › Screens › 1). It is
 * outside the app shell: there is no household yet, so there is no switcher, no tab bar, and no
 * section but the neutral Dashboard slate.
 */
export function OnboardingLayout({
  title,
  description,
  onBack,
  children,
}: OnboardingLayoutProps): ReactElement {
  return (
    <SectionProvider section="dashboard" className="min-h-dvh bg-base text-primary">
      <ToastProvider>
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-base px-4 py-3 text-body font-semibold text-section focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to main content
        </a>
        <OfflineBanner />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-120 flex-col gap-6 px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] outline-none"
        >
          <header className="flex flex-col gap-2">
            {onBack && (
              <Button
                variant="ghost"
                onClick={onBack.onBack}
                className="-ml-4 self-start text-secondary"
              >
                <ChevronLeft aria-hidden size={20} strokeWidth={1.5} />
                {onBack.label}
              </Button>
            )}
            <p className="text-caption tracking-[0.04em] text-muted uppercase">Hearth</p>
            <h1 className="text-display text-primary">{title}</h1>
            {description !== undefined && (
              <p className="max-w-[70ch] text-body text-secondary">{description}</p>
            )}
          </header>
          {children}
        </main>
      </ToastProvider>
    </SectionProvider>
  );
}
