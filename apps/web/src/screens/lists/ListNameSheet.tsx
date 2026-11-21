import { useState, type ReactElement, type SyntheticEvent } from 'react';
import { listNameSchema, type ShoppingList, type ShoppingListDetail } from '@hestia/shared';
import { MdDialog } from '../../components/md/MdDialog.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { useCreateList, useRenameList } from '../../lib/api/list-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import { firstIssue } from '../../lib/validation.ts';

export interface ListNameSheetProps {
  householdId: string;
  /** Renaming an existing list, or creating one. */
  list?: ShoppingList | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (list: ShoppingListDetail) => void;
}

/** Creating and renaming are the same one field, so they are the same dialog prompt. */
export function ListNameSheet({
  householdId,
  list,
  open,
  onOpenChange,
  onCreated,
}: ListNameSheetProps): ReactElement {
  const createList = useCreateList(householdId);
  const renameList = useRenameList(householdId);
  const { errors, setErrors, formRef } = useFieldErrors<'name'>();
  const [name, setName] = useState(list?.name ?? '');
  const [formError, setFormError] = useState<string>();

  const isRenaming = list !== undefined;
  const isPending = isRenaming ? renameList.isPending : createList.isPending;
  const title = isRenaming ? 'Rename shopping list' : 'Create shopping list';

  const handleSubmit = async (event?: SyntheticEvent): Promise<void> => {
    event?.preventDefault();
    if (isPending) return;
    setFormError(undefined);
    const parsed = listNameSchema.safeParse(name);
    if (!parsed.success) {
      setErrors({ name: firstIssue(parsed.error) });
      return;
    }
    setErrors({});

    try {
      if (isRenaming) {
        await renameList.mutateAsync({ listId: list.id, name: parsed.data });
      } else {
        onCreated?.(await createList.mutateAsync(parsed.data));
      }
      onOpenChange(false);
    } catch (error) {
      setFormError(
        userMessage(error, {
          fallback: isRenaming
            ? "Couldn't rename the list. Try again."
            : "Couldn't create the list. Try again.",
        }),
      );
    }
  };

  return (
    <MdDialog
      role="dialog"
      open={open}
      quick
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onOpenChange(false);
        }
      }}
    >
      <div
        slot="headline"
        id="list-name-dialog-title"
        className="text-title-lg font-semibold text-[var(--md-sys-color-on-surface)]"
      >
        {title}
      </div>
      <form
        ref={formRef}
        slot="content"
        id="list-name-form"
        noValidate
        className="flex flex-col gap-4 pt-2"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <TextField
          label="List name"
          name="listName"
          autoComplete="off"
          value={name}
          error={errors.name}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- MD3 basic dialog prompt starts keyboard focus on the input field
          autoFocus
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <FormMessage message={formError} />
      </form>
      <div slot="actions" className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            onOpenChange(false);
          }}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          type="submit"
          isLoading={isPending}
          onClick={(event) => {
            void handleSubmit(event);
          }}
        >
          {isRenaming ? 'Save list name' : 'Create shopping list'}
        </Button>
      </div>
    </MdDialog>
  );
}
