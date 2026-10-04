import { Archive, Pencil, Trash2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router';
import type { BillPayment } from '@hearth/shared';
import { BillForm, type BillDraft } from '../../components/bills/BillForm.tsx';
import {
  OFFLINE_ACTION_REASON,
  archiveBillConfirmation,
  deleteBillConfirmation,
  deletePaymentConfirmation,
} from '../../components/bills/bills-copy.ts';
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
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { OverflowMenu } from '../../components/ui/OverflowMenu.tsx';
import { SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import {
  useArchiveBill,
  useBill,
  useDeleteBill,
  useDeleteBillPayment,
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
 * Design › Screens › 15: the bill's own fields (editable) plus its full payment history. The
 * overflow menu holds only archive and delete — pay and skip stay on the dashboard row (Screen
 * 14), since recording a payment here would duplicate that action rather than add one.
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

  const [isEditing, setIsEditing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingPayment, setEditingPayment] = useState<BillPayment>();
  const [deletingPayment, setDeletingPayment] = useState<BillPayment>();

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

  const confirmDeletePayment = (): void => {
    if (deletingPayment === undefined) return;
    deletePayment.mutate(
      { billId, paymentId: deletingPayment.id },
      {
        onSuccess: () => {
          setDeletingPayment(undefined);
          toast({ variant: 'success', message: 'Deleted payment.' });
        },
        onError: (error) => {
          setDeletingPayment(undefined);
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

      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="flex flex-wrap items-center gap-2 text-body text-primary">
            {formatCents(data.amountCents)}
            {data.visibility === 'personal' && <Badge variant="personal" />}
            {data.autopay && <Badge variant="neutral">Autopay</Badge>}
            {data.isOverdue && <Badge variant="danger">Overdue</Badge>}
          </p>
          <p className="text-body-sm text-secondary">
            {`Due ${formatCalendarDate(data.currentOccurrenceDate)}${data.category !== null ? ` · ${data.category}` : ''}`}
          </p>
          {recurrencePreview !== undefined && (
            <p className="text-body-sm text-secondary">{recurrencePreview}</p>
          )}
          <p className="text-body-sm text-secondary">{`Reminds ${String(data.reminderDaysBefore)} days before.`}</p>
        </div>
        <OverflowMenu
          label={`More actions for ${data.name}`}
          items={[
            {
              label: 'Archive',
              icon: <Archive aria-hidden size={20} strokeWidth={1.5} />,
              disabledReason: offlineReason,
              onSelect: () => {
                setIsArchiving(true);
              },
            },
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
      </header>

      <Button
        variant="secondary"
        disabledReason={offlineReason}
        onClick={() => {
          setIsEditing(true);
        }}
      >
        <Pencil aria-hidden size={20} strokeWidth={1.5} />
        Edit bill
      </Button>

      <section aria-labelledby="payment-history-heading" className="flex flex-col gap-2">
        <h2 id="payment-history-heading" className="text-h2 text-primary">
          Payment history
        </h2>
        <PaymentHistory
          payments={data.payments}
          offlineReason={offlineReason}
          onEdit={setEditingPayment}
          onDelete={setDeletingPayment}
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
        description={archiveBillConfirmation(data)}
        confirmLabel="Archive bill"
        isConfirming={archiveBill.isPending}
        onConfirm={confirmArchive}
      />

      <ConfirmDialog
        open={isDeleting}
        onOpenChange={setIsDeleting}
        title="Delete this bill?"
        description={deleteBillConfirmation(data)}
        confirmLabel="Delete bill"
        isConfirming={deleteBill.isPending}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={deletingPayment !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeletingPayment(undefined);
        }}
        title="Delete this payment?"
        description={deletingPayment === undefined ? '' : deletePaymentConfirmation(data)}
        confirmLabel="Delete payment"
        isConfirming={deletePayment.isPending}
        onConfirm={confirmDeletePayment}
      />
    </section>
  );
}
