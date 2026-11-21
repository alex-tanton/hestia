import { useState, type ReactElement } from 'react';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { showInstallPrompt, useInstallMethod } from '../../lib/use-install-prompt.ts';

export const IOS_INSTALL_MESSAGE =
  'On iPhone and iPad, Hestia has to be on the home screen before it can send notifications. Tap the Share button, then Add to Home Screen. You can turn notifications on afterwards, in Settings.';

export const INSTALL_MESSAGE =
  'Install Hestia to open it from your home screen and keep your lists a tap away.';

/**
 * The install prompt, offered once onboarding completes rather than on first paint. iOS gets the sequence explained instead of a prompt it
 * does not have, and no notification permission is requested here — that is asked for later,
 * when a person turns a notification type on.
 */
export function InstallStep({ onDone }: { onDone: () => void }): ReactElement {
  const method = useInstallMethod();
  const [isPrompting, setIsPrompting] = useState(false);

  const handleInstall = async (): Promise<void> => {
    setIsPrompting(true);
    try {
      await showInstallPrompt();
    } finally {
      setIsPrompting(false);
      onDone();
    }
  };

  if (method === 'ios-share') {
    return (
      <Card
        variant="flat"
        className="w-full max-w-[440px] mx-auto p-6 bg-[var(--md-sys-color-surface-container)] flex flex-col gap-4"
      >
        <p className="flex items-start gap-3 text-body-md text-body text-[var(--md-sys-color-on-surface)]">
          <Icon
            name="share"
            size={24}
            className="mt-0.5 shrink-0 text-[var(--md-sys-color-primary)]"
          />
          <span className="max-w-[70ch]">{IOS_INSTALL_MESSAGE}</span>
        </p>
        <Button variant="primary" onClick={onDone}>
          Go to Hestia
        </Button>
      </Card>
    );
  }

  if (method === 'prompt') {
    return (
      <Card
        variant="flat"
        className="w-full max-w-[440px] mx-auto p-6 bg-[var(--md-sys-color-surface-container)] flex flex-col gap-4"
      >
        <p className="flex items-start gap-3 text-body-md text-body text-[var(--md-sys-color-on-surface)]">
          <Icon
            name="smartphone"
            size={24}
            className="mt-0.5 shrink-0 text-[var(--md-sys-color-primary)]"
          />
          <span className="max-w-[70ch]">{INSTALL_MESSAGE}</span>
        </p>
        <Button
          variant="primary"
          isLoading={isPrompting}
          onClick={() => {
            void handleInstall();
          }}
        >
          Install Hestia app
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Not now
        </Button>
      </Card>
    );
  }

  return (
    <Card
      variant="flat"
      className="w-full max-w-[440px] mx-auto p-6 bg-[var(--md-sys-color-surface-container)] flex flex-col gap-4"
    >
      <p className="max-w-[70ch] text-body-md text-body text-[var(--md-sys-color-on-surface-variant)]">
        Your household is ready.
      </p>
      <Button variant="primary" onClick={onDone}>
        Go to Hestia
      </Button>
    </Card>
  );
}
