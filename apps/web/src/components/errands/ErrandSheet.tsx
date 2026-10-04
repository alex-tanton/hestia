import { useState, type ReactElement } from 'react';
import type { Errand, Member } from '@hearth/shared';
import { UNASSIGNED_LABEL } from '../chores/chore-copy.ts';
import { useCreateErrand, useUpdateErrand } from '../../lib/api/chore-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { FormMessage } from '../ui/FormMessage.tsx';
import { TextField } from '../ui/Field.tsx';
import { Button } from '../ui/Button.tsx';
import { Select } from '../ui/Select.tsx';
import { Sheet } from '../ui/Sheet.tsx';

/** Radix options need a non-empty value; "Unassigned" is mapped back to `null` on save. */
const UNASSIGNED_VALUE = 'unassigned';

export interface ErrandSheetProps {
  householdId: string;
  members: readonly Member[];
  /** Present when editing; absent for quick-add. */
  errand?: Errand;
  onOpenChange: (open: boolean) => void;
  onSaved: (errand: Errand) => void;
  disabledReason?: string | undefined;
}

/**
 * Design › "18. Errands": quick-add via a bottom sheet (name, optional due date, optional
 * assignee); tapping an errand opens the same sheet, prefilled, for editing.
 */
export function ErrandSheet({
  householdId,
  members,
  errand,
  onOpenChange,
  onSaved,
  disabledReason,
}: ErrandSheetProps): ReactElement {
  const [name, setName] = useState(errand?.name ?? '');
  const [dueDate, setDueDate] = useState(errand?.dueDate ?? '');
  const [assignedTo, setAssignedTo] = useState(errand?.assignedTo ?? '');
  const [nameError, setNameError] = useState<string>();
  const [formError, setFormError] = useState<string>();

  const createErrand = useCreateErrand(householdId);
  const updateErrand = useUpdateErrand(householdId);
  const isSaving = createErrand.isPending || updateErrand.isPending;

  const handleSave = (): void => {
    setNameError(undefined);
    setFormError(undefined);
    const trimmed = name.trim();
    if (trimmed === '') {
      setNameError('Enter a name.');
      return;
    }

    const body = {
      name: trimmed,
      dueDate: dueDate === '' ? null : dueDate,
      assignedTo: assignedTo === '' ? null : assignedTo,
    };

    if (errand !== undefined) {
      updateErrand.mutate(
        { errandId: errand.id, body },
        {
          onSuccess: (saved) => {
            onSaved(saved);
            onOpenChange(false);
          },
          onError: (error) => {
            setFormError(userMessage(error, { fallback: "Couldn't save this errand. Try again." }));
          },
        },
      );
      return;
    }

    createErrand.mutate(body, {
      onSuccess: (saved) => {
        onSaved(saved);
        onOpenChange(false);
      },
      onError: (error) => {
        setFormError(userMessage(error, { fallback: "Couldn't add this errand. Try again." }));
      },
    });
  };

  return (
    <Sheet
      open
      onOpenChange={onOpenChange}
      title={errand === undefined ? 'Add an errand' : 'Edit errand'}
    >
      <form
        noValidate
        className="flex flex-col gap-3 px-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
      >
        <TextField
          label="Name"
          value={name}
          error={nameError}
          disabledReason={disabledReason}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <TextField
          label="Due date"
          type="date"
          hint="Optional"
          value={dueDate}
          disabledReason={disabledReason}
          onChange={(event) => {
            setDueDate(event.target.value);
          }}
        />
        <Select
          label="Assigned to"
          value={assignedTo === '' ? UNASSIGNED_VALUE : assignedTo}
          disabledReason={disabledReason}
          options={[
            { value: UNASSIGNED_VALUE, label: UNASSIGNED_LABEL },
            ...members.map((member) => ({ value: member.userId, label: member.displayName })),
          ]}
          onValueChange={(value) => {
            setAssignedTo(value === UNASSIGNED_VALUE ? '' : value);
          }}
        />
        <FormMessage message={formError} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" isLoading={isSaving} disabledReason={disabledReason}>
            Save errand
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
