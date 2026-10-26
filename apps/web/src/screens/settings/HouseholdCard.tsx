import { LogOut } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import type { Membership } from '@hestia/shared';
import { Badge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { ErrorState } from '../../components/states/StateBlocks.tsx';
import { OverflowMenu } from '../../components/ui/OverflowMenu.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { useMembers, useTransferAdmin } from '../../lib/api/hooks.ts';
import { OFFLINE_MESSAGE, userMessage } from '../../lib/api/problem.ts';
import { formatDate, pluralize } from '../../lib/format.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';

export interface HouseholdCardProps {
  membership: Membership;
  currentUserId: string;
  isActive: boolean;
}

/**
 * One household in My Households: its role, its members, a leave action, and — for the admin —
 * remove-member and transfer-admin on each member.
 */
export function HouseholdCard({
  membership,
  currentUserId,
  isActive,
}: HouseholdCardProps): ReactElement {
  const navigate = useNavigate();
  const toast = useToast();
  const isOnline = useOnlineStatus();
  const householdId = membership.householdId;
  const members = useMembers(householdId);
  const transferAdmin = useTransferAdmin(householdId);
  const isAdmin = membership.role === 'admin';
  const offlineReason = isOnline ? undefined : OFFLINE_MESSAGE;

  const openDeparture = (userId: string): void => {
    void navigate(`/settings/households/${householdId}/members/${userId}/depart`);
  };

  const handleTransfer = (userId: string, displayName: string): void => {
    transferAdmin.mutate(userId, {
      onSuccess: () => {
        toast({ variant: 'success', message: `${displayName} is now the admin.` });
      },
      onError: (error) => {
        toast({ variant: 'error', message: userMessage(error) });
      },
    });
  };

  return (
    <Card as="li" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="truncate text-h3 text-primary">{membership.name}</h3>
          <p className="text-body-sm text-secondary">
            {pluralize(membership.memberCount, 'member')} · joined {formatDate(membership.joinedAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isActive && <Badge variant="section">Active</Badge>}
          <Badge>{isAdmin ? 'Admin' : 'Member'}</Badge>
        </div>
      </div>

      {members.isPending && <SkeletonRows label={`Loading ${membership.name} members`} rows={2} />}
      {members.isError && (
        <ErrorState
          message="Couldn't load the members. Try again."
          onRetry={() => {
            void members.refetch();
          }}
        />
      )}
      {members.data && (
        <ul className="divide-y divide-border border-y border-border">
          {members.data.map((member) => {
            const isSelf = member.userId === currentUserId;
            return (
              <li key={member.userId} className="flex min-h-11 items-center gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-primary">
                    {member.displayName}
                    {isSelf && <span className="text-secondary"> (you)</span>}
                  </span>
                  <span className="block text-body-sm text-secondary">
                    {member.role === 'admin' ? 'Admin' : 'Member'} · joined{' '}
                    {formatDate(member.joinedAt)}
                  </span>
                </span>
                {isAdmin && !isSelf && (
                  <OverflowMenu
                    label={`More actions for ${member.displayName}`}
                    items={[
                      {
                        label: 'Make admin',
                        isDisabled: !isOnline,
                        onSelect: () => {
                          handleTransfer(member.userId, member.displayName);
                        },
                      },
                      {
                        label: 'Remove from household',
                        isDestructive: true,
                        isDisabled: !isOnline,
                        onSelect: () => {
                          openDeparture(member.userId);
                        },
                      },
                    ]}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Button
        variant="secondary"
        className="self-start"
        disabledReason={offlineReason}
        onClick={() => {
          openDeparture(currentUserId);
        }}
      >
        <LogOut aria-hidden size={20} strokeWidth={1.5} />
        Leave {membership.name}
      </Button>
    </Card>
  );
}
