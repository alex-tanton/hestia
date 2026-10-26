import { Ticket } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import type { CreatedInvite } from '@hestia/shared';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { CopyButton } from '../../components/ui/CopyButton.tsx';
import { EmptyState, ErrorState } from '../../components/states/StateBlocks.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { useCreateInvite, useInvites, useRevokeInvite } from '../../lib/api/hooks.ts';
import { OFFLINE_MESSAGE, userMessage } from '../../lib/api/problem.ts';
import { formatDate } from '../../lib/format.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { SettingsSection } from './SettingsSection.tsx';

/**
 * Invites (admin only). Creating one shows the link and the 8-character
 * code exactly once — afterwards only their digests exist — so the panel stays until it is
 * dismissed.
 */
export function InvitesSection({ householdId }: { householdId: string }): ReactElement {
  const isOnline = useOnlineStatus();
  const toast = useToast();
  const invites = useInvites(householdId, true);
  const createInvite = useCreateInvite(householdId);
  const revokeInvite = useRevokeInvite(householdId);
  const [created, setCreated] = useState<CreatedInvite>();
  const offlineReason = isOnline ? undefined : OFFLINE_MESSAGE;

  const handleCreate = (): void => {
    createInvite.mutate(undefined, {
      onSuccess: setCreated,
      onError: (error) => {
        toast({
          variant: 'error',
          message: userMessage(error, { fallback: 'Could not create an invite. Try again.' }),
        });
      },
    });
  };

  const handleRevoke = (inviteId: string): void => {
    revokeInvite.mutate(inviteId, {
      onSuccess: () => {
        if (created?.invite.id === inviteId) setCreated(undefined);
        toast({ variant: 'success', message: 'Invite revoked.' });
      },
      onError: (error) => {
        toast({
          variant: 'error',
          message: userMessage(error, { fallback: 'Could not revoke the invite. Try again.' }),
        });
      },
    });
  };

  return (
    <SettingsSection
      title="Invites"
      description="One invite works for as many people as you like, until you revoke it or it expires after 7 days."
    >
      {created && (
        <Card className="flex flex-col gap-3 border-section">
          <h3 className="text-h3 text-primary">Share this invite</h3>
          <p className="text-body-sm text-secondary">
            The link and code are shown only now. Copy them before you close this.
          </p>
          <div className="flex flex-col gap-2">
            <span className="text-body-sm font-semibold text-primary">Link</span>
            <span className="text-body-sm break-all text-secondary">{created.link}</span>
            <CopyButton
              label="Copy invite link"
              value={created.link}
              confirmation="Invite link copied."
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-body-sm font-semibold text-primary">Code</span>
            <span className="text-h2 tracking-[0.12em] text-primary tabular-nums">
              {created.code}
            </span>
            <CopyButton label="Copy code" value={created.code} confirmation="Invite code copied." />
          </div>
          <Button
            variant="ghost"
            className="self-start"
            onClick={() => {
              setCreated(undefined);
            }}
          >
            Done
          </Button>
        </Card>
      )}

      <Button
        className="self-start"
        isLoading={createInvite.isPending}
        disabledReason={offlineReason}
        onClick={handleCreate}
      >
        Create an invite
      </Button>

      {invites.isPending && <SkeletonRows label="Loading invites" rows={2} />}
      {invites.isError && (
        <ErrorState
          message="Couldn't load the outstanding invites. Try again."
          onRetry={() => {
            void invites.refetch();
          }}
        />
      )}
      {invites.data?.length === 0 && (
        <EmptyState
          icon={Ticket}
          message="No invites are outstanding. Create one to add someone to this household."
        />
      )}
      {invites.data && invites.data.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {invites.data.map((invite) => (
            <li key={invite.id} className="flex min-h-11 items-center gap-2 px-4 py-3">
              <span className="min-w-0 flex-1 text-body-sm text-secondary">
                Created {formatDate(invite.createdAt)} · expires {formatDate(invite.expiresAt)}
              </span>
              <Button
                variant="ghost"
                className="shrink-0 text-danger"
                disabledReason={offlineReason}
                onClick={() => {
                  handleRevoke(invite.id);
                }}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </SettingsSection>
  );
}
