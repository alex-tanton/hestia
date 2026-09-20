import { CircleAlert } from 'lucide-react';
import type { ReactElement } from 'react';

/**
 * A form-level failure: what failed and what to do, announced when it appears (Branding › Copy
 * patterns; Design › Error rules). Field-level errors belong to the field itself.
 */
export function FormMessage({ message }: { message: string | undefined }): ReactElement {
  return (
    <div role="alert">
      {message !== undefined && (
        <p className="flex items-start gap-2 text-body-sm text-danger">
          <CircleAlert aria-hidden size={20} strokeWidth={1.5} className="mt-px shrink-0" />
          <span className="max-w-[70ch]">{message}</span>
        </p>
      )}
    </div>
  );
}
