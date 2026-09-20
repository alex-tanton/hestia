import { useState, type ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { DeparturePreview, Member } from '@hearth/shared';
import { Button } from '../../components/ui/Button.tsx';
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

  const departing = members.find((member) => member.userId === userId);
  const remaining = members.filter((member) => member.userId !== userId);
  const owned = ownedItemIds(preview);
  const isEverythingAssigned = owned.every((id) => assignments[id] !== undefined);
  // Design › Offline rules: membership changes need a connection, and say so rather than failing.
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
          void navigate(isSelf ? '/' : '/settings', { replace: true });
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
    <div className="flex flex-col gap-4">
      <p className="max-w-[70ch] text-body text-secondary">
        {isSelf
          ? `Before you leave ${preview.householdName}, hand over everything you own here.`
          : `Before ${departing?.displayName ?? 'this member'} leaves ${preview.householdName}, their lists, chores, errands, and bills need a new owner.`}
      </p>

      {owned.length === 0 ? (
        <p className="max-w-[70ch] text-body text-secondary">There is nothing to reassign.</p>
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
          run();
        }}
      >
        {isSelf ? 'Leave household' : `Remove ${departing?.displayName ?? 'member'}`}
      </Button>
    </div>
  );
}

/**
 * The departure preview (Design › Screens › 4, "Leaving and removing"). Leaving and removing open
 * the same pushed screen: what the member owns, a picker for each, rotations for information,
 * and — for the last member — the household deletion instead.
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
    title: isSelf ? 'Leave household' : 'Remove member',
    backTo: '/settings',
    backLabel: 'Settings',
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
        message="Couldn't load what needs reassigning. Try again."
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
