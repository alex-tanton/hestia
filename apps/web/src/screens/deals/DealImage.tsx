import { ImageOff } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { cn } from '../../lib/cn.ts';

/**
 * The only image hosts the Content-Security-Policy allows (Technical Architecture, "Routing"):
 * `f.wishabi.net` serves Flipp item and flyer images, `images.wishabi.net` serves merchant logos.
 * Anything else would be blocked by the browser and render as a broken image, so it takes the
 * placeholder instead — the CSP is the rule, and this is the UI keeping to it.
 */
const ALLOWED_IMAGE_ORIGINS: readonly string[] = [
  'https://f.wishabi.net',
  'https://images.wishabi.net',
];

export function isAllowedImageUrl(url: string | null): boolean {
  if (url === null) return false;
  try {
    return ALLOWED_IMAGE_ORIGINS.includes(new URL(url).origin);
  } catch {
    return false;
  }
}

export interface DealImageProps {
  url: string | null;
  /** Sizing and shape; the placeholder takes the same box so the layout never shifts. */
  className?: string;
}

/**
 * Design › `DealCard`: the item image from Flipp's CDN, with a neutral placeholder when it is
 * absent. A missing or failed image is ordinary here — flyers often carry none — so it degrades
 * to the placeholder rather than to a broken-image icon.
 *
 * The image is decorative: the item name sits beside it and carries the meaning, so an alt text
 * repeating it would only be heard twice (Design › Accessibility, "Semantic HTML first").
 */
export function DealImage({ url, className }: DealImageProps): ReactElement {
  const [hasFailed, setHasFailed] = useState(false);
  const box = cn('shrink-0 overflow-hidden rounded-sm bg-raised', className);

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
        setHasFailed(true);
      }}
    />
  );
}
