import type { ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';
import { Icon } from './Icon.tsx';

export type BadgeVariant = 'neutral' | 'section' | 'warning' | 'danger' | 'personal';

export interface BadgeProps {
  variant?: BadgeVariant;
  children?: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral:
    'bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]',
  personal:
    'bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]',
  section:
    'bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]',
  warning:
    'bg-[var(--md-sys-color-warning-container)] text-[var(--md-sys-color-on-warning-container)]',
  danger: 'bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]',
};

/**
 * Tonal MD3 badge pairs all meet >= 4.5:1 AA contrast. Danger carries an `error` icon so
 * the state is never read from color alone; Personal carries the `person` icon and its word.
 */
export function Badge({ variant = 'neutral', children, className }: BadgeProps): ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--md-sys-shape-corner-extra-small)] px-2 py-0.5 text-caption whitespace-nowrap',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {variant === 'danger' && <Icon name="error" size={14} />}
      {variant === 'personal' && <Icon name="person" size={14} />}
      {variant === 'personal' ? (children ?? 'Personal') : children}
    </span>
  );
}
