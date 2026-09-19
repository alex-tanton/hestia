import { ToggleGroup } from 'radix-ui';
import type { ReactElement } from 'react';

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
 * Radix Toggle Group in single selection (Design › Primitives): arrow keys move between
 * segments, Enter or Space selects. The selected segment takes the section color.
 */
export function SegmentedControl({
  label,
  segments,
  value,
  onValueChange,
}: SegmentedControlProps): ReactElement {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        // Pressing the selected segment again would clear the selection; a segmented control
        // always has exactly one segment selected.
        if (next) onValueChange(next);
      }}
      className="flex w-full gap-1 overflow-x-auto rounded-md border border-input bg-raised p-1"
    >
      {segments.map((segment) => (
        <ToggleGroup.Item
          key={segment.value}
          value={segment.value}
          className="min-h-11 min-w-11 flex-1 rounded-sm px-3 text-body-sm font-semibold whitespace-nowrap text-secondary transition-colors duration-150 ease-out data-[state=off]:hover:bg-base data-[state=off]:hover:text-primary data-[state=off]:active:bg-section-tint data-[state=on]:bg-section data-[state=on]:text-on-section"
        >
          {segment.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
