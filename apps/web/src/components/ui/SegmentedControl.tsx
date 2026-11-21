import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { cn } from '../../lib/cn.ts';
import { Icon } from './Icon.tsx';

export interface Segment {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  /** Accessible name of the group ("Lists sections"). */
  label: string;
  segments: readonly Segment[];
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * Light-DOM MD3 single-select radiogroup pill strip with roving Arrow/Home/End keyboard
 * movement, horizontal scroll strip (`shrink-0`), and `scrollIntoView` on selection change.
 * Clicking or activating the already-selected segment leaves the selection locked.
 */
export function SegmentedControl({
  label,
  segments,
  value,
  onValueChange,
}: SegmentedControlProps): ReactElement {
  const groupRef = useRef<HTMLDivElement>(null);
  const [focusedValue, setFocusedValue] = useState<string | null>(null);

  const selectedIndex = segments.findIndex((segment) => segment.value === value);
  const fallbackIndex = selectedIndex === -1 ? 0 : selectedIndex;
  const focusedIndex =
    focusedValue !== null ? segments.findIndex((segment) => segment.value === focusedValue) : -1;
  const activeFocusIndex = focusedIndex === -1 ? fallbackIndex : focusedIndex;

  useEffect(() => {
    const selected = groupRef.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [value, segments.length]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const isLeft = event.key === 'ArrowLeft';
    const isRight = event.key === 'ArrowRight';
    const isHome = event.key === 'Home';
    const isEnd = event.key === 'End';
    if ((!isLeft && !isRight && !isHome && !isEnd) || segments.length < 2) {
      return;
    }
    const groupEl = groupRef.current;
    if (groupEl === null) {
      return;
    }
    const buttons = Array.from(groupEl.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    if (buttons.length < 2) {
      return;
    }
    const isRtl = getComputedStyle(groupEl).direction === 'rtl';
    const forwards = isRtl ? isLeft : isRight;

    let nextIndex: number;
    if (isHome) {
      nextIndex = 0;
    } else if (isEnd) {
      nextIndex = buttons.length - 1;
    } else {
      nextIndex = forwards
        ? (index + 1) % buttons.length
        : (index - 1 + buttons.length) % buttons.length;
    }

    const nextButton = buttons[nextIndex];
    if (nextButton === undefined) {
      return;
    }
    event.preventDefault();
    nextButton.focus();
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      className="flex w-full items-center gap-1 overflow-x-auto rounded-[var(--md-sys-shape-corner-full)] border border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface)] p-1"
    >
      {segments.map((segment, index) => {
        const isSelected = segment.value === value;
        const isFocused = index === activeFocusIndex;
        return (
          <button
            key={segment.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isFocused ? 0 : -1}
            onClick={() => {
              if (segment.value !== value) {
                onValueChange(segment.value);
              }
            }}
            onFocus={() => {
              setFocusedValue(segment.value);
            }}
            onBlur={(event) => {
              if (!groupRef.current?.contains(event.relatedTarget)) {
                setFocusedValue(null);
              }
            }}
            onKeyDown={(event) => {
              handleKeyDown(event, index);
            }}
            className={cn(
              'inline-flex min-h-11 min-w-11 flex-1 shrink-0 items-center justify-center gap-1.5 rounded-[var(--md-sys-shape-corner-full)] px-3 text-body-sm font-semibold whitespace-nowrap transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--md-sys-color-primary)]',
              isSelected
                ? 'bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]'
                : 'text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-on-surface)]/8 hover:text-[var(--md-sys-color-on-surface)] active:bg-[var(--md-sys-color-on-surface)]/12',
            )}
          >
            {isSelected && <Icon name="check" size={16} />}
            <span>{segment.label}</span>
          </button>
        );
      })}
    </div>
  );
}
