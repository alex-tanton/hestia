import type { ReactElement } from 'react';
import { Icon } from './Icon.tsx';

/**
 * A form-level failure: what failed and what to do, announced when it appears. Field-level
 * errors belong to the field itself.
 */
export function FormMessage({ message }: { message: string | undefined }): ReactElement {
  return (
    <div role="alert">
      {message !== undefined && (
        <p className="flex items-start gap-2 text-body-sm text-[var(--md-sys-color-error)]">
          <Icon name="error" size={20} className="mt-px shrink-0" />
          <span className="max-w-[70ch]">{message}</span>
        </p>
      )}
    </div>
  );
}
