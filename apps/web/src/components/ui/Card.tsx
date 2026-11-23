import type { HTMLAttributes, ReactElement } from 'react';
import { cn } from '../../lib/cn.ts';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Raised cards (with MD3 elevation level 1) are for the dashboard only. */
  variant?: 'flat' | 'raised';
  as?: 'div' | 'section' | 'article' | 'li';
}

/**
 * Borderless tonal MD3 card surface (`surfaceContainerLow` flat, `surfaceContainer` + elevation-1
 * raised). Omits `overflow-hidden` so child popovers and menus are never clipped; `@media
 * (forced-colors: active)` restores a 1px CanvasText border via `.hestia-card`.
 */
export function Card({
  variant = 'flat',
  as: Element = 'div',
  className,
  ...rest
}: CardProps): ReactElement {
  return (
    <Element
      {...rest}
      className={cn(
        'hestia-card rounded-[var(--md-sys-shape-corner-large)] p-6 text-[var(--md-sys-color-on-surface)]',
        variant === 'raised'
          ? 'bg-[var(--md-sys-color-surface-container)] shadow-[var(--md-sys-elevation-1)]'
          : 'bg-[var(--md-sys-color-surface-container-low)]',
        className,
      )}
    />
  );
}
