import { Share, Smartphone } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Button } from '../../components/ui/Button.tsx';
import { showInstallPrompt, useInstallMethod } from '../../lib/use-install-prompt.ts';

export const IOS_INSTALL_MESSAGE =
  'On iPhone and iPad, Hearth has to be on the home screen before it can send notifications. Tap the Share button, then Add to Home Screen. You can turn notifications on afterwards, in Settings.';

export const INSTALL_MESSAGE =
  'Install Hearth to open it from your home screen and keep your lists a tap away.';

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
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2 text-body text-secondary">
          <Share aria-hidden size={20} strokeWidth={1.5} className="mt-0.5 shrink-0 text-section" />
          <span className="max-w-[70ch]">{IOS_INSTALL_MESSAGE}</span>
        </p>
        <Button onClick={onDone}>Go to Hearth</Button>
      </div>
    );
  }

  if (method === 'prompt') {
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2 text-body text-secondary">
          <Smartphone
            aria-hidden
            size={20}
            strokeWidth={1.5}
            className="mt-0.5 shrink-0 text-section"
          />
          <span className="max-w-[70ch]">{INSTALL_MESSAGE}</span>
        </p>
        <Button
          isLoading={isPrompting}
          onClick={() => {
            void handleInstall();
          }}
        >
          Install Hearth
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Not now
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[70ch] text-body text-secondary">Your household is ready.</p>
      <Button onClick={onDone}>Go to Hearth</Button>
    </div>
  );
}
