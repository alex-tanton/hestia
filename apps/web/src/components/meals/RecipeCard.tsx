import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { pluralize } from '../../lib/format.ts';
import { breakdownLine, readinessSentence } from './meal-copy.ts';

export interface ReadinessRingProps {
  percent: number;
  size?: number;
}

/**
 * Design › `RecipeCard`: "readiness percentage ring". Purely decorative — `aria-hidden`, per
 * Accessibility › "Specific patterns" ("the ring visual is `aria-hidden` and the text carries the
 * meaning") — the percentage is also drawn as text inside it, so sighted users get the number
 * without relying on the arc's length alone, and the surrounding card carries the announced
 * sentence separately.
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
        className="stroke-border"
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
        className="stroke-section-accent transition-[stroke-dashoffset] duration-150 ease-out motion-reduce:transition-none"
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size / 4}
        className="fill-primary font-semibold"
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
}

/** Design › Composite components › `RecipeCard` (Library, Suggestions). */
export function RecipeCard({
  recipeId,
  title,
  readinessPercent,
  onSaleCount,
  inPantryCount,
  toBuyCount,
  servings,
}: RecipeCardProps): ReactElement {
  const total = onSaleCount + inPantryCount + toBuyCount;
  const ready = onSaleCount + inPantryCount;
  return (
    <Link
      to={`/meals/recipes/${recipeId}`}
      className="flex items-center gap-3 rounded-md border border-border bg-base p-4 transition-colors duration-150 ease-out hover:bg-raised"
    >
      <ReadinessRing percent={readinessPercent} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="sr-only">{readinessSentence(ready, total)}</span>
        {/* The library and suggestions screens have no section heading above the card list, so
            this is the page's next heading after its h1 — axe's heading-order check (Design ›
            Accessibility, "Verification") wants no level skipped. */}
        <h2 className="truncate text-h3 text-primary">{title}</h2>
        <span className="text-body-sm text-secondary">
          {breakdownLine(onSaleCount, inPantryCount, toBuyCount)}
        </span>
        {servings !== null && servings !== undefined && (
          <span className="text-caption text-muted">{pluralize(servings, 'serving')}</span>
        )}
      </span>
    </Link>
  );
}
