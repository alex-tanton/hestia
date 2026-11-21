import type { ReactElement, ReactNode } from 'react';
import { Button } from '../../components/ui/Button.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { OfflineBanner } from '../../components/shell/OfflineBanner.tsx';
import { ToastProvider } from '../../components/ui/Toast.tsx';

export interface OnboardingLayoutProps {
  /** The onboarding headline (`display` type). */
  title: string;
  description?: string | undefined;
  /** A back control, where the step has somewhere to go back to. */
  onBack?: { label: string; onBack: () => void };
  children: ReactNode;
}

/**
 * The frame every onboarding and account-recovery screen sits in. It is outside the app shell:
 * there is no household yet, so there is no switcher, no tab bar, and no section but the neutral
 * Dashboard slate.
 */
export function OnboardingLayout({
  title,
  description,
  onBack,
  children,
}: OnboardingLayoutProps): ReactElement {
  return (
    <div className="min-h-dvh bg-surface bg-[var(--md-sys-color-surface)] text-on-surface text-[var(--md-sys-color-on-surface)]">
      <ToastProvider>
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-[var(--md-sys-color-surface)] px-4 py-3 text-body font-semibold text-[var(--md-sys-color-primary)] focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
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
                className="-ml-4 self-start text-[var(--md-sys-color-on-surface-variant)]"
              >
                <Icon name="arrow_back" size={20} />
                {onBack.label}
              </Button>
            )}
            <p className="text-label text-caption tracking-wider uppercase text-[var(--md-sys-color-on-surface-variant)]">
              Hestia
            </p>
            <h1 className="text-display font-semibold text-on-surface text-[var(--md-sys-color-on-surface)]">
              {title}
            </h1>
            {description !== undefined && (
              <p className="max-w-[70ch] text-body-md text-body text-[var(--md-sys-color-on-surface-variant)]">
                {description}
              </p>
            )}
          </header>
          {children}
        </main>
      </ToastProvider>
    </div>
  );
}
