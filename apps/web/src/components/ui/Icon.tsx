import type { ReactElement } from 'react';
import { cn } from '../../lib/cn.ts';
import { FILLED_ICON_PATHS, ICON_PATHS, type IconName } from './icon-paths.ts';

export type { IconName };

export interface IconProps {
  name: IconName;
  filled?: boolean | undefined;
  size?: number | undefined;
  className?: string | undefined;
}

/**
 * Curated Material Symbols Rounded inline SVG icon. Renders static `<path>` geometry with
 * `aria-hidden="true"` so screen readers never announce glyph ligature text and Workbox
 * precaches 0 B of font assets.
 */
export function Icon({ name, filled = false, size = 20, className }: IconProps): ReactElement {
  const path = filled ? (FILLED_ICON_PATHS[name] ?? ICON_PATHS[name]) : ICON_PATHS[name];
  return (
    <svg
      viewBox="0 -960 960 960"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <path d={path} />
    </svg>
  );
}
