import type { HTMLAttributes, ReactElement } from 'react';
import { cn } from '../../lib/cn.ts';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Raised cards (with shadow-sm) are for the dashboard only. */
  variant?: 'flat' | 'raised';
  as?: 'div' | 'section' | 'article' | 'li';
}

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
        'rounded-md border border-border bg-base p-4',
        variant === 'raised' && 'shadow-sm',
        className,
      )}
    />
  );
}
