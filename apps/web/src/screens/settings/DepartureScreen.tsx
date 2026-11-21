import { useState, type ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { DeparturePreview, Member } from '@hestia/shared';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useScreenChrome } from '../../components/shell/screen-chrome.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { useDepart, useDeparturePreview, useMembers, useProfile } from '../../lib/api/hooks.ts';
import { ApiError, OFFLINE_MESSAGE, userMessage } from '../../lib/api/problem.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { DeleteHouseholdPanel } from './DeleteHouseholdPanel.tsx';
import { ReassignmentList, RotationNotes, ownedItemIds } from './ReassignmentList.tsx';

interface DepartureBodyProps {
  preview: DeparturePreview;
  members: readonly Member[];
  isSelf: boolean;
  householdId: string;
  userId: string;
}

function DepartureBody({
  preview,
  members,
  isSelf,
  householdId,
  userId,
}: DepartureBodyProps): ReactElement {
  const navigate = useNavigate();
  const toast = useToast();
  const isOnline = useOnlineStatus();
  const depart = useDepart(householdId, userId, isSelf);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const departing = members.find((member) => member.userId === userId);
  const remaining = members.filter((member) => member.userId !== userId);
  const owned = ownedItemIds(preview);
  const isEverythingAssigned = owned.every((id) => assignments[id] !== undefined);
  const offlineReason = isOnline ? undefined : OFFLINE_MESSAGE;

  const run = (confirmName?: string): void => {
    setFormError(undefined);
    depart.mutate(
      { reassignments: assignments, ...(confirmName === undefined ? {} : { confirmName }) },
      {
        onSuccess: (result) => {
          toast({
            variant: 'success',
            message: result.householdDeleted
              ? `${preview.householdName} deleted.`
              : isSelf
                ? `You left ${preview.householdName}.`
                : `${departing?.displayName ?? 'The member'} was removed.`,
          });
          void navigate(isSelf ? '/' : '/settings/households', { replace: true });
        },
        onError: (error) => {
          setFormError(
            userMessage(error, {
              byStatus: {
                409: 'Reassign everything before they leave.',
                400: 'The household name does not match.',
              },
              fallback: 'Could not finish. Try again.',
            }),
          );
        },
      },
    );
  };

  if (preview.isLastMember) {
    return (
      <div className="flex flex-col gap-4">
        <DeleteHouseholdPanel
          preview={preview}
          isConfirming={depart.isPending}
          disabledReason={offlineReason}
          onConfirm={run}
        />
        <FormMessage message={formError} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card
        variant="flat"
        className="bg-[var(--md-sys-color-surface-container-low)] rounded-2xl p-4 flex flex-col gap-2"
      >
        <span className="text-title-sm font-semibold text-[var(--md-sys-color-on-surface)]">
          Household reassignment
        </span>
        <p className="max-w-[70ch] text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
          {isSelf
            ? `Before you leave ${preview.householdName}, hand over everything you own here.`
            : `Before ${departing?.displayName ?? 'this member'} leaves ${preview.householdName}, their lists, chores, errands, and bills need a new owner.`}
        </p>
      </Card>

      {owned.length === 0 ? (
        <Card variant="flat" className="p-4">
          <p className="max-w-[70ch] text-body text-secondary">There is nothing to reassign.</p>
        </Card>
      ) : (
        <ReassignmentList
          preview={preview}
          remainingMembers={remaining}
          assignments={assignments}
          isDisabled={!isOnline}
          disabledReason={offlineReason}
          onAssign={(itemId, assignedTo) => {
            setAssignments((current) => ({ ...current, [itemId]: assignedTo }));
          }}
        />
      )}

      <RotationNotes preview={preview} members={members} />
      <FormMessage message={formError} />

      <Button
        variant="destructive"
        className="self-start"
        isLoading={depart.isPending}
        disabled={!isEverythingAssigned}
        disabledReason={
          offlineReason ??
          (isEverythingAssigned ? undefined : 'Choose someone for each item above first.')
        }
        onClick={() => {
          setIsConfirmOpen(true);
        }}
      >
        {isSelf ? 'Leave household' : `Remove ${departing?.displayName ?? 'member'}`}
      </Button>

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title={
          isSelf ? 'Confirm household departure' : `Remove ${departing?.displayName ?? 'member'}?`
        }
        description={
          isSelf
            ? `Leave ${preview.householdName}? Everything you own will be reassigned as selected.`
            : `Remove ${departing?.displayName ?? 'this member'} from ${preview.householdName}? Their owned items will be reassigned.`
        }
        confirmLabel="Confirm member departure"
        isConfirming={depart.isPending}
        onConfirm={() => {
          setIsConfirmOpen(false);
          run();
        }}
      />
    </div>
  );
}

/**
 * Progressive departure flow: reassignments with MdSelect and destructive ConfirmDialog verification.
 */
export function DepartureScreen(): ReactElement {
  const params = useParams();
  const householdId = params['householdId'] ?? '';
  const userId = params['userId'] ?? '';
  const profile = useProfile();
  const preview = useDeparturePreview(householdId, userId);
  const members = useMembers(householdId);
  const isSelf = profile.data?.id === userId;

  useScreenChrome({
    title: 'Depart household',
    backTo: '/settings/households',
    backLabel: 'Households',
  });

  if (preview.isPending || members.isPending || profile.isPending) {
    return <SkeletonRows label="Loading the departure preview" rows={4} />;
  }

  if (preview.isError || members.isError) {
    const error = preview.error ?? members.error;
    if (error instanceof ApiError && error.isOffline) {
      return (
        <OfflineState message="Leaving a household needs a connection. Try again when you are back online." />
      );
    }
    return (
      <ErrorState
        message="Couldn't load departure details. Check your network connection and reload."
        retryLabel="Reload departure"
        onRetry={() => {
          void preview.refetch();
          void members.refetch();
        }}
      />
    );
  }

  return (
    <DepartureBody
      preview={preview.data}
      members={members.data}
      isSelf={isSelf}
      householdId={householdId}
      userId={userId}
    />
  );
}
