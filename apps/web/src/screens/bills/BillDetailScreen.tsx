import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router';
import type { BillPayment } from '@hestia/shared';
import { BillForm, type BillDraft } from '../../components/bills/BillForm.tsx';
import { OFFLINE_ACTION_REASON } from '../../components/bills/bills-copy.ts';
import {
  PaymentEditSheet,
  type PaymentEditDraft,
} from '../../components/bills/PaymentEditSheet.tsx';
import { PaymentHistory } from '../../components/bills/PaymentHistory.tsx';
import { recurrencePreviewSentence } from '../../lib/bills/recurrence-preview.ts';
import { useScreenChrome } from '../../components/shell/screen-chrome.tsx';
import { ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { Icon } from '../../components/ui/Icon.tsx';
import { OverflowMenu } from '../../components/ui/OverflowMenu.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import {
  useArchiveBill,
  useBill,
  useDeleteBill,
  useDeleteBillPayment,
  usePayBill,
  useSkipBill,
  useUpdateBill,
  useUpdateBillPayment,
} from '../../lib/api/bills-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { formatCalendarDate, formatCents } from '../../lib/format.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';

export interface BillDetailScreenProps {
  householdId: string;
  billId: string;
}

/**
 * Bill detail view: single <h1> in Top App Bar, tonal summary card, direct Edit action,
 * multi-item overflow menu (Archive, Delete), and PaymentHistory with direct inline delete
 * and persistent Undo feedback (D-11, D-12, BILL-02).
 */
export function BillDetailScreen({ householdId, billId }: BillDetailScreenProps): ReactElement {
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const toast = useToast();
  const bill = useBill(householdId, billId);
  const updateBill = useUpdateBill(householdId);
  const archiveBill = useArchiveBill(householdId);
  const deleteBill = useDeleteBill(householdId);
  const updatePayment = useUpdateBillPayment(householdId);
  const deletePayment = useDeleteBillPayment(householdId);
  const payBill = usePayBill(householdId);
  const skipBill = useSkipBill(householdId);

  const [isEditing, setIsEditing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingPayment, setEditingPayment] = useState<BillPayment>();

  const offlineReason = isOnline ? undefined : OFFLINE_ACTION_REASON;

  useScreenChrome({ title: bill.data?.name ?? 'Bill', backTo: '/bills', backLabel: 'Bills' });

  const handleUpdate = (draft: BillDraft): void => {
    updateBill.mutate(
      { billId, body: draft },
      {
        onSuccess: (saved) => {
          setIsEditing(false);
          toast({ variant: 'success', message: `Saved ${saved.name}.` });
        },
        onError: (error) => {
          toast({
            variant: 'error',
            message: userMessage(error, { fallback: "Couldn't save this bill. Try again." }),
          });
        },
      },
    );
  };

  const confirmArchive = (): void => {
    const name = bill.data?.name ?? 'this bill';
    archiveBill.mutate(billId, {
      onSuccess: () => {
        setIsArchiving(false);
        toast({ variant: 'success', message: `Archived ${name}.` });
        void navigate('/bills');
      },
      onError: (error) => {
        setIsArchiving(false);
        toast({
          variant: 'error',
          message: userMessage(error, { fallback: `Couldn't archive ${name}. Try again.` }),
        });
      },
    });
  };

  const confirmDelete = (): void => {
    const name = bill.data?.name ?? 'this bill';
    deleteBill.mutate(billId, {
      onSuccess: () => {
        setIsDeleting(false);
        toast({ variant: 'success', message: `Deleted ${name}.` });
        void navigate('/bills');
      },
      onError: (error) => {
        setIsDeleting(false);
        toast({
          variant: 'error',
          message: userMessage(error, { fallback: `Couldn't delete ${name}. Try again.` }),
        });
      },
    });
  };

  const handleEditPayment = (draft: PaymentEditDraft): void => {
    if (editingPayment === undefined) return;
    updatePayment.mutate(
      { billId, paymentId: editingPayment.id, body: draft },
      {
        onSuccess: () => {
          setEditingPayment(undefined);
          toast({ variant: 'success', message: 'Saved payment.' });
        },
        onError: (error) => {
          toast({
            variant: 'error',
            message: userMessage(error, { fallback: "Couldn't save this payment. Try again." }),
          });
        },
      },
    );
  };

  const handleDeletePayment = (payment: BillPayment): void => {
    const name = bill.data?.name ?? 'bill';
    deletePayment.mutate(
      { billId, paymentId: payment.id },
      {
        onSuccess: () => {
          toast({
            variant: 'success',
            message: `Removed payment for ${name}`,
            action: {
              label: 'Undo',
              onAction: () => {
                if (payment.isSkipped) {
                  skipBill.mutate(billId);
                } else {
                  payBill.mutate({
                    billId,
                    body: {
                      paidDate: payment.paidDate ?? undefined,
                      amountPaidCents: payment.amountPaidCents ?? undefined,
                    },
                  });
                }
              },
            },
          });
        },
        onError: (error) => {
          toast({
            variant: 'error',
            message: userMessage(error, { fallback: "Couldn't delete this payment. Try again." }),
          });
        },
      },
    );
  };

  if (bill.isPending && bill.fetchStatus === 'paused') {
    return (
      <OfflineState message="This bill syncs when you reconnect. What you have already opened stays readable." />
    );
  }
  if (bill.isPending) return <SkeletonRows label="Loading this bill" />;
  if (bill.isError && bill.data === undefined) {
    return (
      <ErrorState
        message="Couldn't load this bill. Try again."
        onRetry={() => {
          void bill.refetch();
        }}
        alternative={{ label: 'Back to bills', onAction: () => void navigate('/bills') }}
      />
    );
  }

  const data = bill.data;
  const recurrencePreview = recurrencePreviewSentence({
    unit: data.recurrenceUnit,
    interval: data.interval,
    anchorDate: data.anchorDate,
  });

  return (
    <section className="flex flex-col gap-4">
      {bill.isError && (
        <StaleNotice
          updatedAt={bill.dataUpdatedAt}
          onRetry={() => {
            void bill.refetch();
          }}
        />
      )}

      {/* Tonal Summary Card per D-11 and UI-SPEC */}
      <Card
        variant="flat"
        className="p-4 flex flex-col gap-3 rounded-2xl bg-[var(--md-sys-color-surface-container-low)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 text-display-sm font-semibold tabular-nums text-[var(--md-sys-color-on-surface)]">
              {formatCents(data.amountCents)}
              {data.visibility === 'personal' && <Badge variant="personal" />}
              {data.autopay && <Badge variant="neutral">Autopay</Badge>}
              {data.isOverdue && <Badge variant="danger">Overdue</Badge>}
            </div>
            <p className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
              {`Due ${formatCalendarDate(data.currentOccurrenceDate)}${data.category !== null ? ` · ${data.category}` : ''}`}
            </p>
            {recurrencePreview !== undefined && (
              <p className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">
                {recurrencePreview}
              </p>
            )}
            <p className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">{`Reminds ${String(data.reminderDaysBefore)} days before.`}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              disabledReason={offlineReason}
              onClick={() => {
                setIsEditing(true);
              }}
              aria-label="Edit bill"
            >
              <Icon name="edit" size={20} />
              Edit bill
            </Button>
            <OverflowMenu
              label={`More actions for ${data.name}`}
              items={[
                {
                  label: 'Archive',
                  icon: <Icon name="archive" size={20} />,
                  disabledReason: offlineReason,
                  onSelect: () => {
                    setIsArchiving(true);
                  },
                },
                {
                  label: 'Delete',
                  icon: <Icon name="delete" size={20} />,
                  isDestructive: true,
                  disabledReason: offlineReason,
                  onSelect: () => {
                    setIsDeleting(true);
                  },
                },
              ]}
            />
          </div>
        </div>
      </Card>

      <section aria-labelledby="payment-history-heading" className="flex flex-col gap-2">
        <h2
          id="payment-history-heading"
          className="text-title-md font-semibold text-[var(--md-sys-color-on-surface)]"
        >
          Payment history
        </h2>
        <PaymentHistory
          payments={data.payments}
          offlineReason={offlineReason}
          onEdit={setEditingPayment}
          onDelete={handleDeletePayment}
        />
      </section>

      {isEditing && (
        <BillForm
          open
          onOpenChange={setIsEditing}
          bill={data}
          isSaving={updateBill.isPending}
          onSubmit={handleUpdate}
        />
      )}

      {editingPayment !== undefined && (
        <PaymentEditSheet
          open
          payment={editingPayment}
          onOpenChange={(open) => {
            if (!open) setEditingPayment(undefined);
          }}
          isSaving={updatePayment.isPending}
          onSubmit={handleEditPayment}
        />
      )}

      <ConfirmDialog
        open={isArchiving}
        onOpenChange={setIsArchiving}
        title="Archive this bill?"
        description={`Archive ${data.name}? It stops showing up and sends no more reminders; its history is kept.`}
        confirmLabel="Archive bill"
        isConfirming={archiveBill.isPending}
        onConfirm={confirmArchive}
      />

      <ConfirmDialog
        open={isDeleting}
        onOpenChange={setIsDeleting}
        title="Delete this bill?"
        description={`Delete ${data.name}? Its payment history is removed with it.`}
        confirmLabel="Delete bill"
        isConfirming={deleteBill.isPending}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
