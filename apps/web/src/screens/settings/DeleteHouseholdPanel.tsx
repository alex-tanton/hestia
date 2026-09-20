import { useState, type ReactElement } from 'react';
import type { DeparturePreview } from '@hearth/shared';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { formatList, pluralize } from '../../lib/format.ts';

/** "4 lists, 23 recipes, and 6 chores" — only what the household actually holds. */
export function deletionSummary(counts: DeparturePreview['deletionCounts']): string {
  const parts = [
    [counts.lists, 'list'],
    [counts.pantryItems, 'pantry item'],
    [counts.recipes, 'recipe'],
    [counts.mealPlanEntries, 'planned meal'],
    [counts.chores, 'chore'],
    [counts.errands, 'errand'],
    [counts.bills, 'bill'],
  ] as const;
  const named = parts.filter(([count]) => count > 0).map(([count, noun]) => pluralize(count, noun));
  return named.length === 0
    ? 'It holds nothing yet.'
    : `This deletes ${formatList(named)} permanently.`;
}

export interface DeleteHouseholdPanelProps {
  preview: DeparturePreview;
  isConfirming: boolean;
  disabledReason?: string | undefined;
  onConfirm: (confirmName: string) => void;
}

/**
 * The last member's departure deletes the household and everything in it (Requirements,
 * "Membership lifecycle"). Deletion is irreversible, so it names the counts of what is lost and
 * takes the typed household name — never a single tap (non-negotiable 21).
 */
export function DeleteHouseholdPanel({
  preview,
  isConfirming,
  disabledReason,
  onConfirm,
}: DeleteHouseholdPanelProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [typedName, setTypedName] = useState('');
  const summary = deletionSummary(preview.deletionCounts);
  const matches = typedName === preview.householdName;

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-h2 text-primary">You are the last member</h2>
      <p className="max-w-[70ch] text-body text-secondary">
        Leaving {preview.householdName} deletes it and everything in it. {summary} Your personal
        bills are yours and stay with you.
      </p>
      <Button
        variant="destructive"
        className="self-start"
        disabledReason={disabledReason}
        onClick={() => {
          setIsOpen(true);
        }}
      >
        Delete household and leave
      </Button>

      <ConfirmDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title={`Delete ${preview.householdName}?`}
        description={`${summary} This cannot be undone.`}
        confirmLabel="Delete household"
        isConfirmDisabled={!matches}
        isConfirming={isConfirming}
        onConfirm={() => {
          onConfirm(typedName);
        }}
      >
        <TextField
          label={`Type ${preview.householdName} to confirm`}
          name="confirmHouseholdName"
          autoComplete="off"
          value={typedName}
          onChange={(event) => {
            setTypedName(event.target.value);
          }}
        />
      </ConfirmDialog>
    </Card>
  );
}
