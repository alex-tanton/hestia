import { isAllowedImageUrl } from '@hestia/shared';
import { ImageOff } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { cn } from '../../lib/cn.ts';

export { isAllowedImageUrl };

export interface DealImageProps {
  url: string | null;
  /** Sizing and shape; the placeholder takes the same box so the layout never shifts. */
  className?: string;
}

/**
 * The deal card's item image from Flipp's CDN, with a neutral placeholder when it is
 * absent. A missing or failed image is ordinary here — flyers often carry none — so it degrades
 * to the placeholder rather than to a broken-image icon.
 *
 * The image is decorative: the item name sits beside it and carries the meaning, so an alt text
 * repeating it would only be heard twice.
 */
export function DealImage({ url, className }: DealImageProps): ReactElement {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const box = cn('shrink-0 overflow-hidden rounded-sm bg-raised', className);
  const hasFailed = failedUrl !== null && failedUrl === (url ?? null);

  if (hasFailed || !isAllowedImageUrl(url)) {
    return (
      <span data-testid="deal-image-placeholder" className={cn(box, 'grid place-items-center')}>
        <ImageOff aria-hidden size={20} strokeWidth={1.5} className="text-muted" />
      </span>
    );
  }

  return (
    <img
      src={url ?? ''}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn(box, 'object-contain')}
      onError={() => {
        setFailedUrl(url ?? null);
      }}
    />
  );
}
