import { CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router';
import type { RecipeDetail } from '@hearth/shared';
import { ListPickerSheet } from '../../components/meals/ListPickerSheet.tsx';
import { PlaceOnPlannerSheet } from '../../components/meals/PlaceOnPlannerSheet.tsx';
import { ReadinessBreakdown } from '../../components/meals/ReadinessBreakdown.tsx';
import { deleteRecipeConfirmation } from '../../components/meals/meal-copy.ts';
import { ErrorState, OfflineState } from '../../components/states/StateBlocks.tsx';
import { StaleNotice } from '../../components/states/StaleNotice.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { OverflowMenu } from '../../components/ui/OverflowMenu.tsx';
import { Skeleton, SkeletonRows } from '../../components/ui/Skeleton.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import { useHousehold } from '../../lib/api/hooks.ts';
import { useAddRecipeToList, useDeleteRecipe, useRecipeDetail } from '../../lib/api/meal-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { pluralize } from '../../lib/format.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { RecipeForm } from './RecipeForm.tsx';

const OFFLINE_ACTION_REASON = 'Needs a connection.';

export interface RecipeDetailScreenProps {
  householdId: string;
  recipeId: string;
}

/** Title, servings, source link, readiness, ingredients, instructions. */
export function RecipeDetailScreen({
  householdId,
  recipeId,
}: RecipeDetailScreenProps): ReactElement {
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const toast = useToast();
  const household = useHousehold(householdId);
  const timezone = household.data?.timezone;
  const recipe = useRecipeDetail(householdId, recipeId);
  const deleteRecipe = useDeleteRecipe(householdId);
  const addToList = useAddRecipeToList(householdId);

  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isListPickerOpen, setIsListPickerOpen] = useState(false);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);

  const offlineReason = isOnline ? undefined : OFFLINE_ACTION_REASON;

  if (recipe.isPending && recipe.fetchStatus === 'paused') {
    return (
      <OfflineState message="This recipe syncs when you reconnect. What you have already opened stays readable." />
    );
  }
  if (recipe.isPending) return <SkeletonRows label="Loading this recipe" />;
  if (recipe.isError && recipe.data === undefined) {
    return (
      <ErrorState
        message="Couldn't load this recipe. Try again."
        onRetry={() => {
          void recipe.refetch();
        }}
        alternative={{ label: 'Back to recipes', onAction: () => void navigate('/meals/recipes') }}
      />
    );
  }

  const data = recipe.data;

  const addMissingToList = (listId: string, listName: string): void => {
    addToList.mutate(
      { recipeId, listId },
      {
        onSuccess: () => {
          setIsListPickerOpen(false);
          toast({ variant: 'success', message: `Added to ${listName}.` });
        },
        onError: (error) => {
          toast({
            variant: 'error',
            message: userMessage(error, { fallback: "Couldn't add those ingredients. Try again." }),
          });
        },
      },
    );
  };

  const confirmDelete = (): void => {
    deleteRecipe.mutate(recipeId, {
      onSuccess: () => {
        setIsDeleting(false);
        toast({ variant: 'success', message: `Deleted ${data.title}.` });
        void navigate('/meals/recipes');
      },
      onError: (error) => {
        setIsDeleting(false);
        toast({
          variant: 'error',
          message: userMessage(error, { fallback: `Couldn't delete ${data.title}. Try again.` }),
        });
      },
    });
  };

  return (
    <section className="flex flex-col gap-4">
      {recipe.isError && (
        <StaleNotice
          updatedAt={recipe.dataUpdatedAt}
          onRetry={() => {
            void recipe.refetch();
          }}
        />
      )}

      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1 text-primary">{data.title}</h1>
          <p className="text-body-sm text-secondary">
            {data.servings !== null ? pluralize(data.servings, 'serving') : 'Servings not recorded'}
          </p>
          {data.sourceUrl !== null && (
            <a
              href={data.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-body-sm text-section underline"
            >
              View source
            </a>
          )}
        </div>
        <OverflowMenu
          label={`More actions for ${data.title}`}
          items={[
            {
              label: 'Edit',
              icon: <Pencil aria-hidden size={20} strokeWidth={1.5} />,
              disabledReason: offlineReason,
              onSelect: () => {
                setIsEditing(true);
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

      <div className="flex flex-wrap gap-2">
        <Button
          disabledReason={offlineReason}
          onClick={() => {
            setIsListPickerOpen(true);
          }}
        >
          Add missing to list
        </Button>
        {/* The planner's default day is today in the household's timezone, so until that zone is
        known the button is a disabled placeholder rather than an action that opens a dated sheet. */}
        {timezone === undefined ? (
          <Button variant="secondary" disabled aria-label="Place on week planner">
            <Skeleton className="h-5 w-40" />
          </Button>
        ) : (
          <Button
            variant="secondary"
            disabledReason={offlineReason}
            onClick={() => {
              setIsPlannerOpen(true);
            }}
          >
            <CalendarPlus aria-hidden size={20} strokeWidth={1.5} />
            Place on week planner
          </Button>
        )}
      </div>

      <ReadinessBreakdown
        householdId={householdId}
        recipe={data}
        overrides={data.matchOverrides}
        offlineReason={offlineReason}
      />

      {data.instructions !== null && (
        <section aria-labelledby="instructions-heading" className="flex flex-col gap-2">
          <h2 id="instructions-heading" className="text-h2 text-primary">
            Instructions
          </h2>
          <p className="max-w-[70ch] text-body whitespace-pre-wrap text-primary">
            {data.instructions}
          </p>
        </section>
      )}

      {isEditing && (
        <RecipeForm
          householdId={householdId}
          recipe={data}
          onOpenChange={setIsEditing}
          onSaved={(saved: RecipeDetail) => {
            toast({ variant: 'success', message: `Saved ${saved.title}.` });
          }}
        />
      )}

      {isListPickerOpen && (
        <ListPickerSheet
          householdId={householdId}
          title="Add missing to which list?"
          description={data.title}
          isPicking={addToList.isPending}
          onPick={addMissingToList}
          onOpenChange={setIsListPickerOpen}
        />
      )}

      {isPlannerOpen && timezone !== undefined && (
        <PlaceOnPlannerSheet
          householdId={householdId}
          timezone={timezone}
          recipeId={recipeId}
          recipeTitle={data.title}
          onOpenChange={setIsPlannerOpen}
        />
      )}

      <ConfirmDialog
        open={isDeleting}
        onOpenChange={setIsDeleting}
        title="Delete this recipe?"
        description={deleteRecipeConfirmation(data)}
        confirmLabel="Delete recipe"
        isConfirming={deleteRecipe.isPending}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
