import { Copy } from 'lucide-react';
import type { ReactElement } from 'react';
import { Button } from './Button.tsx';
import { useToast } from './Toast.tsx';

export interface CopyButtonProps {
  /** Names what is copied, e.g. "Copy invite link". */
  label: string;
  value: string;
  /** The confirmation, past tense and brief. */
  confirmation: string;
}

/**
 * Copies a value the user would otherwise have to transcribe. The clipboard is unavailable in
 * some contexts, so a failure says so rather than looking as though it worked; the value itself
 * stays on screen and selectable either way.
 */
export function CopyButton({ label, value, confirmation }: CopyButtonProps): ReactElement {
  const toast = useToast();

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ variant: 'success', message: confirmation });
    } catch {
      toast({ variant: 'error', message: 'Could not copy. Select the text and copy it by hand.' });
    }
  };

  return (
    <Button
      variant="secondary"
      onClick={() => {
        void copy();
      }}
    >
      <Copy aria-hidden size={20} strokeWidth={1.5} />
      {label}
    </Button>
  );
}
