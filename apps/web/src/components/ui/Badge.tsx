import { CircleAlert, User } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';

export type BadgeVariant = 'neutral' | 'section' | 'warning' | 'danger' | 'personal';

export interface BadgeProps {
  variant?: BadgeVariant;
  children?: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-neutral-badge text-on-neutral-badge',
  personal: 'bg-neutral-badge text-on-neutral-badge',
  section: 'bg-section-badge text-on-section-badge',
  warning: 'bg-warning-badge text-on-warning-badge',
  danger: 'bg-danger-badge text-on-danger-badge',
};

/**
 * Badge pairs are from Branding › Badges (all 4.5:1 at caption size). Danger carries an icon so
 * the state is never read from red alone; Personal carries the Lucide `user` icon and its word.
 */
export function Badge({ variant = 'neutral', children, className }: BadgeProps): ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-caption whitespace-nowrap',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {variant === 'danger' && <CircleAlert aria-hidden size={14} strokeWidth={2} />}
      {variant === 'personal' && <User aria-hidden size={14} strokeWidth={2} />}
      {variant === 'personal' ? (children ?? 'Personal') : children}
    </span>
  );
}
