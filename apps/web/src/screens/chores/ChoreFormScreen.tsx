import { Trash2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router';
import type { ChoreAssignment, ChoreDetail, Member } from '@hestia/shared';
import {
  RecurrenceFields,
  type RecurrenceValue,
} from '../../components/chores/RecurrenceFields.tsx';
import { RotationEditor } from '../../components/chores/RotationEditor.tsx';
import {
  OFFLINE_ACTION_REASON,
  ROTATION_REQUIRED_ERROR,
  UNASSIGNED_LABEL,
  deleteChoreConfirmation,
} from '../../components/chores/chore-copy.ts';
import { useScreenChrome } from '../../components/shell/screen-chrome.tsx';
import { householdFallback } from '../../components/chores/household-date-fallback.tsx';
import { ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { OverflowMenu } from '../../components/ui/OverflowMenu.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import {
  useChoreDetail,
  useCreateChore,
  useDeleteChore,
  useUpdateChore,
} from '../../lib/api/chore-hooks.ts';
import { useHousehold, useMembers } from '../../lib/api/hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { todayInTimezone } from '../../lib/household-date.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';

type AssignmentType = ChoreAssignment['type'];

const ASSIGNMENT_OPTIONS: readonly { value: AssignmentType; label: string }[] = [
  { value: 'none', label: 'No one' },
  { value: 'single', label: 'One person' },
  { value: 'rotation', label: 'Rotation' },
];

/**
 * Radix options need a non-empty value, so "Unassigned" travels as this sentinel and is mapped
 * back to `null` when the form is saved. Without an option for it, a single assignee could be
 * changed but never cleared (a single member can be left unassigned).
 */
const UNASSIGNED_VALUE = 'unassigned';

export interface ChoreFormScreenProps {
  householdId: string;
  /** Present when editing; absent for "add a chore". */
  choreId?: string;
}

function recurrenceValueFrom(chore: ChoreDetail | undefined, timezone: string): RecurrenceValue {
  if (chore === undefined) {
    return { unit: 'week', interval: '1', anchorDate: todayInTimezone(timezone) };
  }
  return {
    unit: chore.recurrenceUnit,
    interval: String(chore.interval),
    anchorDate: chore.anchorDate,
  };
}

function assignmentTypeFrom(chore: ChoreDetail | undefined): AssignmentType {
  if (chore === undefined) return 'none';
  if (chore.rotationOrder !== null) return 'rotation';
  if (chore.assignedTo !== null) return 'single';
  return 'none';
}

/**
 * Loads the chore to edit, if any, and the roster, before the form itself mounts (the same split
 * `RecipeDetailScreen`/`RecipeForm` use): the form's fields initialize straight from props at
 * mount, with no prefill effect needed, because this wrapper never renders it until the data —
 * when there is any to wait for — has already arrived.
 */
export function ChoreFormScreen({ householdId, choreId }: ChoreFormScreenProps): ReactElement {
  const navigate = useNavigate();
  const members = useMembers(householdId);
  const existing = useChoreDetail(householdId, choreId);
  const household = useHousehold(householdId);
  const isEditing = choreId !== undefined;

  useScreenChrome({
    title: isEditing ? `Edit ${existing.data?.name ?? 'chore'}` : 'Add a chore',
    backTo: isEditing ? `/chores/${choreId}` : '/chores',
    backLabel: isEditing ? (existing.data?.name ?? 'Chore') : 'Chores',
  });

  if (isEditing && existing.isPending && existing.fetchStatus === 'paused') {
    return (
      <OfflineState message="This chore syncs when you reconnect. What you have already opened stays readable." />
    );
  }
  if (isEditing && existing.isPending) return <SkeletonRows label="Loading this chore" />;
  if (isEditing && existing.isError && existing.data === undefined) {
    return (
      <ErrorState
        message="Couldn't load this chore. Try again."
        onRetry={() => {
          void existing.refetch();
        }}
        alternative={{ label: 'Back to chores', onAction: () => void navigate('/chores') }}
      />
    );
  }
  if (members.data === undefined) {
    if (members.isError) {
      return (
        <ErrorState
          message="Couldn't load the household members. Try again."
          onRetry={() => {
            void members.refetch();
          }}
        />
      );
    }
    return <SkeletonRows label="Loading members" />;
  }
  // A new chore's anchor defaults to today in the household's timezone, so the form waits for it.
  if (household.data === undefined) return householdFallback(household, 'Loading members');

  return (
    <ChoreForm
      householdId={householdId}
      choreId={choreId}
      chore={existing.data}
      members={members.data}
      timezone={household.data.timezone}
    />
  );
}

interface ChoreFormProps {
  householdId: string;
  choreId: string | undefined;
  /** Loaded already when editing; absent when creating. */
  chore: ChoreDetail | undefined;
  members: readonly Member[];
  /** The household's timezone, which dates a new chore's default anchor. */
  timezone: string;
}

/**
 * The chore sheet, a pushed screen (not an overlay): name, recurrence editor
 * with a live preview, and assignment as a rotation or a single member. Delete lives in the
 * overflow menu here, with confirmation — only while editing; a chore that was never saved has
 * nothing to delete.
 *
 * Saving a rotation sends its order and nothing else. The service keeps whose turn it is when that
 * member is still in the order and starts the turn at the top only when they were removed, so
 * reordering or adding a member never reassigns the turn from here.
 */
function ChoreForm({
  householdId,
  choreId,
  chore,
  members,
  timezone,
}: ChoreFormProps): ReactElement {
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const toast = useToast();

  const createChore = useCreateChore(householdId);
  const updateChore = useUpdateChore(householdId);
  const deleteChore = useDeleteChore(householdId);

  const [name, setName] = useState(chore?.name ?? '');
  const [recurrence, setRecurrence] = useState<RecurrenceValue>(
    recurrenceValueFrom(chore, timezone),
  );
  const [assignmentType, setAssignmentType] = useState<AssignmentType>(assignmentTypeFrom(chore));
  const [singleAssignee, setSingleAssignee] = useState(chore?.assignedTo ?? '');
  const [rotationOrder, setRotationOrder] = useState<string[]>(chore?.rotationOrder ?? []);
  const [nameError, setNameError] = useState<string>();
  const [intervalError, setIntervalError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [isDeleting, setIsDeleting] = useState(false);

  const offlineReason = isOnline ? undefined : OFFLINE_ACTION_REASON;
  const isSaving = createChore.isPending || updateChore.isPending;
  const isEditing = choreId !== undefined;

  function assignment(): ChoreAssignment {
    if (assignmentType === 'rotation') return { type: 'rotation', rotationOrder };
    if (assignmentType === 'single') {
      return { type: 'single', assignedTo: singleAssignee === '' ? null : singleAssignee };
    }
    return { type: 'none' };
  }

  const handleSave = (): void => {
    setNameError(undefined);
    setIntervalError(undefined);
    setFormError(undefined);

    const trimmedName = name.trim();
    const parsedInterval = Number(recurrence.interval);
    const isValidInterval = Number.isInteger(parsedInterval) && parsedInterval > 0;
    let hasError = false;
    if (trimmedName === '') {
      setNameError('Enter a name.');
      hasError = true;
    }
    if (!isValidInterval) {
      setIntervalError('Enter a whole number of 1 or more.');
      hasError = true;
    }
    if (assignmentType === 'rotation' && rotationOrder.length === 0) {
      setFormError(ROTATION_REQUIRED_ERROR);
      hasError = true;
    }
    if (hasError) return;

    const body = {
      name: trimmedName,
      recurrenceUnit: recurrence.unit,
      interval: parsedInterval,
      anchorDate: recurrence.anchorDate,
      assignment: assignment(),
    };

    if (choreId !== undefined) {
      updateChore.mutate(
        { choreId, body },
        {
          onSuccess: (saved) => {
            toast({ variant: 'success', message: `Saved ${saved.name}.` });
            void navigate(`/chores/${saved.id}`);
          },
          onError: (error) => {
            setFormError(userMessage(error, { fallback: "Couldn't save this chore. Try again." }));
          },
        },
      );
      return;
    }

    createChore.mutate(body, {
      onSuccess: (saved) => {
        toast({ variant: 'success', message: `Added ${saved.name}.` });
        void navigate(`/chores/${saved.id}`);
      },
      onError: (error) => {
        setFormError(userMessage(error, { fallback: "Couldn't add this chore. Try again." }));
      },
    });
  };

  const confirmDelete = (): void => {
    if (choreId === undefined) return;
    deleteChore.mutate(choreId, {
      onSuccess: () => {
        setIsDeleting(false);
        toast({ variant: 'success', message: `Deleted ${chore?.name ?? 'the chore'}.` });
        void navigate('/chores');
      },
      onError: (error) => {
        setIsDeleting(false);
        setFormError(userMessage(error, { fallback: "Couldn't delete this chore. Try again." }));
      },
    });
  };

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-h1 text-primary">
          {isEditing ? `Edit ${chore?.name ?? ''}` : 'Add a chore'}
        </h1>
        {isEditing && (
          <OverflowMenu
            label={`More actions for ${chore?.name ?? 'this chore'}`}
            items={[
              {
                label: 'Delete',
                icon: <Trash2 aria-hidden size={20} strokeWidth={1.5} />,
                isDestructive: true,
                disabledReason: offlineReason,
                onSelect: () => {
                  setIsDeleting(true);
                },
              },
            ]}
          />
        )}
      </header>

      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
      >
        <TextField
          label="Name"
          value={name}
          error={nameError}
          disabledReason={offlineReason}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />

        <RecurrenceFields
          value={recurrence}
          onChange={setRecurrence}
          intervalError={intervalError}
          disabledReason={offlineReason}
        />

        <Select
          label="Assignment"
          value={assignmentType}
          options={ASSIGNMENT_OPTIONS}
          disabledReason={offlineReason}
          onValueChange={(value) => {
            setAssignmentType(value as AssignmentType);
          }}
        />

        {assignmentType === 'single' && (
          <Select
            label="Assigned to"
            value={singleAssignee === '' ? UNASSIGNED_VALUE : singleAssignee}
            disabledReason={offlineReason}
            options={[
              { value: UNASSIGNED_VALUE, label: UNASSIGNED_LABEL },
              ...members.map((member) => ({ value: member.userId, label: member.displayName })),
            ]}
            onValueChange={(value) => {
              setSingleAssignee(value === UNASSIGNED_VALUE ? '' : value);
            }}
          />
        )}

        {assignmentType === 'rotation' && (
          <RotationEditor
            members={members}
            order={rotationOrder}
            onChange={setRotationOrder}
            disabledReason={offlineReason}
          />
        )}

        <FormMessage message={formError} />

        <div className="flex flex-wrap gap-2">
          <Button type="submit" isLoading={isSaving} disabledReason={offlineReason}>
            Save chore
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              void navigate(isEditing ? `/chores/${choreId}` : '/chores');
            }}
          >
            Cancel
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={isDeleting}
        onOpenChange={setIsDeleting}
        title="Delete this chore?"
        description={deleteChoreConfirmation({ name: chore?.name ?? 'this chore' })}
        confirmLabel="Delete chore"
        isConfirming={deleteChore.isPending}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
