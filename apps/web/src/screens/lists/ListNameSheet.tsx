import { useState, type ReactElement, type SyntheticEvent } from 'react';
import { listNameSchema, type ShoppingList, type ShoppingListDetail } from '@hearth/shared';
import { Button } from '../../components/ui/Button.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { Sheet } from '../../components/ui/Sheet.tsx';
import { useCreateList, useRenameList } from '../../lib/api/list-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import { firstIssue } from '../../lib/validation.ts';

export interface ListNameSheetProps {
  householdId: string;
  /** Renaming an existing list, or creating one (Design › Screens › 7). */
  list?: ShoppingList | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (list: ShoppingListDetail) => void;
}

/** Creating and renaming are the same one field, so they are the same sheet. */
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

  const handleSubmit = async (event: SyntheticEvent): Promise<void> => {
    event.preventDefault();
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
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={isRenaming ? `Rename ${list.name}` : 'New list'}
    >
      <form
        ref={formRef}
        noValidate
        className="flex flex-col gap-3 px-4"
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
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <FormMessage message={formError} />
        <Button type="submit" isLoading={isPending}>
          {isRenaming ? 'Save name' : 'Create list'}
        </Button>
      </form>
    </Sheet>
  );
}
