import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { RecipeDetail } from '@hearth/shared';
import {
  blankIngredient,
  fromParsedIngredient,
  fromRecipeIngredient,
  ingredientRowError,
  toIngredientInput,
  IngredientEditor,
  type EditableIngredient,
} from '../../components/meals/IngredientEditor.tsx';
import { PARSE_FAILED_COPY, PARSE_INCOMPLETE_COPY } from '../../components/meals/meal-copy.ts';
import { Button } from '../../components/ui/Button.tsx';
import { TextField, TextAreaField } from '../../components/ui/Field.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { Sheet } from '../../components/ui/Sheet.tsx';
import { useCreateRecipe, useParseRecipe, useUpdateRecipe } from '../../lib/api/meal-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';

type Mode = 'choose' | 'url' | 'edit';

export interface RecipeFormProps {
  householdId: string;
  /** Present when editing; its own fields and ingredients prefill the form. */
  recipe?: RecipeDetail;
  onOpenChange: (open: boolean) => void;
  onSaved: (recipe: RecipeDetail) => void;
}

/**
 * Design › Screens › 11 and 12: the add flow (paste a link, parse, editable preview, or manual
 * entry) and the edit flow ("the same editable form as the add flow") are one component. Each mode
 * change is a view swap, so focus moves into whatever replaced the prior view rather than falling
 * back to the document (Design › Accessibility › Focus management; the same idiom as
 * `ChangePasswordForm`).
 */
export function RecipeForm({
  householdId,
  recipe,
  onOpenChange,
  onSaved,
}: RecipeFormProps): ReactElement {
  const [mode, setMode] = useState<Mode>(recipe ? 'edit' : 'choose');
  const [url, setUrl] = useState('');
  const [needsManualEntry, setNeedsManualEntry] = useState(false);
  const [isIncomplete, setIsIncomplete] = useState(false);
  const [title, setTitle] = useState(recipe?.title ?? '');
  const [sourceUrl, setSourceUrl] = useState(recipe?.sourceUrl ?? '');
  const [servings, setServings] = useState(
    recipe?.servings !== null && recipe?.servings !== undefined ? String(recipe.servings) : '',
  );
  const [instructions, setInstructions] = useState(recipe?.instructions ?? '');
  const [ingredients, setIngredients] = useState<EditableIngredient[]>(
    recipe ? recipe.ingredients.map(fromRecipeIngredient) : [],
  );
  const [showIngredientErrors, setShowIngredientErrors] = useState(false);
  const { errors, setErrors, formRef } = useFieldErrors<'title' | 'url'>();
  const [formError, setFormError] = useState<string>();

  const parseRecipe = useParseRecipe(householdId);
  const createRecipe = useCreateRecipe(householdId);
  const updateRecipe = useUpdateRecipe(householdId);
  const isSaving = createRecipe.isPending || updateRecipe.isPending;

  const containerRef = useRef<HTMLDivElement>(null);
  const previousMode = useRef(mode);
  useEffect(() => {
    if (previousMode.current === mode) return;
    previousMode.current = mode;
    containerRef.current?.querySelector<HTMLElement>('input, textarea')?.focus();
  }, [mode]);

  const handleParse = async (): Promise<void> => {
    setErrors({});
    if (url.trim() === '') {
      setErrors({ url: 'Enter a URL.' });
      return;
    }
    try {
      const result = await parseRecipe.mutateAsync(url.trim());
      setNeedsManualEntry(result.needsManualEntry);
      setIsIncomplete(
        !result.needsManualEntry &&
          (result.title === null ||
            result.instructions === null ||
            result.servings === null ||
            result.ingredients.length === 0),
      );
      setTitle(result.title ?? '');
      setSourceUrl(result.sourceUrl);
      setServings(result.servings === null ? '' : String(result.servings));
      setInstructions(result.instructions ?? '');
      setIngredients(result.ingredients.map(fromParsedIngredient));
      setMode('edit');
    } catch {
      // Design › Screens › 11: parse failure falls back cleanly to the manual form, prefilled
      // with whatever could be salvaged — here, just the URL the member typed. Every fetch
      // failure the parser reports (Technical Architecture › "Recipe fetching":
      // invalid_url/private_address → 400, timeout → 504, too_large/http_error/network_error →
      // 502) falls back the same way, so the reason is not distinguished further; the
      // `needsManualEntry` banner below states it in Design's own words.
      setNeedsManualEntry(true);
      setIsIncomplete(false);
      setSourceUrl(url.trim());
      setMode('edit');
    }
  };

  const enterByHand = (): void => {
    setNeedsManualEntry(false);
    setIsIncomplete(false);
    setIngredients([blankIngredient()]);
    setMode('edit');
  };

  const handleSave = async (): Promise<void> => {
    setFormError(undefined);
    const trimmedTitle = title.trim();
    const rowErrors = ingredients.some((row) => ingredientRowError(row) !== undefined);
    if (trimmedTitle === '' || rowErrors) {
      setErrors(trimmedTitle === '' ? { title: 'Enter a title.' } : {});
      setShowIngredientErrors(rowErrors);
      return;
    }
    setErrors({});
    setShowIngredientErrors(false);

    const parsedServings = servings.trim() === '' ? null : Number(servings.trim());
    const body = {
      title: trimmedTitle,
      sourceUrl: sourceUrl.trim() === '' ? null : sourceUrl.trim(),
      instructions: instructions.trim() === '' ? null : instructions.trim(),
      servings: parsedServings !== null && Number.isFinite(parsedServings) ? parsedServings : null,
      ingredients: ingredients.map(toIngredientInput),
    };

    try {
      const saved =
        recipe === undefined
          ? await createRecipe.mutateAsync(body)
          : await updateRecipe.mutateAsync({ recipeId: recipe.id, body });
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      setFormError(userMessage(error, { fallback: "Couldn't save this recipe. Try again." }));
    }
  };

  const sheetTitle = recipe === undefined ? 'Add a recipe' : `Edit ${recipe.title}`;

  return (
    <Sheet open onOpenChange={onOpenChange} title={sheetTitle}>
      <div ref={containerRef} className="flex flex-col gap-4 px-4">
        {mode === 'choose' && (
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => {
                setMode('url');
              }}
            >
              Paste a link
            </Button>
            <Button variant="secondary" onClick={enterByHand}>
              Enter by hand
            </Button>
          </div>
        )}

        {mode === 'url' && (
          <form
            ref={formRef}
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleParse();
            }}
          >
            <TextField
              label="Recipe URL"
              type="url"
              autoComplete="off"
              value={url}
              error={errors.url}
              onChange={(event) => {
                setUrl(event.target.value);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" isLoading={parseRecipe.isPending}>
                Parse
              </Button>
              <Button variant="ghost" onClick={enterByHand}>
                Enter by hand instead
              </Button>
            </div>
          </form>
        )}

        {mode === 'edit' && (
          <form
            ref={formRef}
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
          >
            {needsManualEntry && <FormMessage message={PARSE_FAILED_COPY} />}
            {isIncomplete && <FormMessage message={PARSE_INCOMPLETE_COPY} />}
            <TextField
              label="Title"
              value={title}
              error={errors.title}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
            />
            <TextField
              label="Source URL"
              type="url"
              hint="Optional"
              value={sourceUrl}
              onChange={(event) => {
                setSourceUrl(event.target.value);
              }}
            />
            <TextField
              label="Servings"
              inputMode="numeric"
              hint="Optional"
              value={servings}
              onChange={(event) => {
                setServings(event.target.value);
              }}
            />
            <TextAreaField
              label="Instructions"
              hint="Optional"
              value={instructions}
              onChange={(event) => {
                setInstructions(event.target.value);
              }}
            />
            <IngredientEditor
              ingredients={ingredients}
              onChange={setIngredients}
              showErrors={showIngredientErrors}
            />
            <FormMessage message={formError} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" isLoading={isSaving}>
                Save recipe
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </Sheet>
  );
}
