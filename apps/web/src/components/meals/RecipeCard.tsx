import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { pluralize } from '../../lib/format.ts';
import { Card } from '../ui/Card.tsx';
import { breakdownLine, readinessSentence } from './meal-copy.ts';

export interface ReadinessRingProps {
  percent: number;
  size?: number;
}

/**
 * The readiness percentage ring. Purely decorative — `aria-hidden`, because the text carries
 * the meaning — the percentage is also drawn as text inside it.
 */
export function ReadinessRing({ percent, size = 44 }: ReadinessRingProps): ReactElement {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, percent)) / 100);
  const center = size / 2;
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      className="shrink-0"
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={4}
        className="stroke-[var(--md-sys-color-surface-container-highest)]"
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${String(center)} ${String(center)})`}
        className="stroke-[var(--md-sys-color-primary)] transition-[stroke-dashoffset] duration-150 ease-out motion-reduce:transition-none"
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size / 4}
        className="fill-[var(--md-sys-color-on-surface)] font-semibold"
      >
        {percent}%
      </text>
    </svg>
  );
}

export interface RecipeCardProps {
  recipeId: string;
  title: string;
  readinessPercent: number;
  onSaleCount: number;
  inPantryCount: number;
  toBuyCount: number;
  /** Suggestions do not carry servings (the API's `Suggestion` shape has none); library cards do. */
  servings?: number | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
}

/** Tonal MD3 RecipeCard using Card variant="flat" (surfaceContainerLow) per MEAL-06. */
export function RecipeCard({
  recipeId,
  title,
  readinessPercent,
  onSaleCount,
  inPantryCount,
  toBuyCount,
  servings,
  prepTimeMinutes,
  cookTimeMinutes,
}: RecipeCardProps): ReactElement {
  const total = onSaleCount + inPantryCount + toBuyCount;
  const ready = onSaleCount + inPantryCount;
  const totalTime = (prepTimeMinutes ?? 0) + (cookTimeMinutes ?? 0);

  return (
    <Card
      variant="flat"
      className="p-0 transition-colors duration-150 ease-out hover:bg-[var(--md-sys-color-surface-container)]"
    >
      <Link to={`/meals/recipes/${recipeId}`} className="flex items-center gap-3 p-4">
        <ReadinessRing percent={readinessPercent} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="sr-only">{readinessSentence(ready, total)}</span>
          <h2 className="truncate text-title-medium font-semibold text-[var(--md-sys-color-on-surface)]">
            {title}
          </h2>
          <span className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
            {breakdownLine(onSaleCount, inPantryCount, toBuyCount)}
          </span>
          <div className="flex items-center gap-2 pt-0.5 text-caption text-[var(--md-sys-color-on-surface-variant)]">
            {servings !== null && servings !== undefined && (
              <span>{pluralize(servings, 'serving')}</span>
            )}
            {totalTime > 0 && <span>• {totalTime} min</span>}
          </div>
        </span>
      </Link>
    </Card>
  );
}
