import { Plus, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import type { IngredientInput, ParsedIngredient, RecipeIngredient } from '@hestia/shared';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/Field.tsx';

/** A row's controlled-input form of an ingredient; `quantity` stays text until save time. */
export interface EditableIngredient {
  key: string;
  rawText: string | null;
  itemName: string;
  quantity: string;
  unit: string;
}

let nextKey = 0;

function freshKey(): string {
  nextKey += 1;
  return `ingredient-${String(nextKey)}`;
}

export function blankIngredient(): EditableIngredient {
  return { key: freshKey(), rawText: null, itemName: '', quantity: '', unit: '' };
}

export function fromParsedIngredient(parsed: ParsedIngredient): EditableIngredient {
  return {
    key: freshKey(),
    rawText: parsed.rawText,
    itemName: parsed.itemName,
    quantity: parsed.quantity === null ? '' : String(parsed.quantity),
    unit: parsed.unit ?? '',
  };
}

export function fromRecipeIngredient(ingredient: RecipeIngredient): EditableIngredient {
  return {
    key: ingredient.id,
    rawText: ingredient.rawText,
    itemName: ingredient.itemName,
    quantity: ingredient.quantity === null ? '' : String(ingredient.quantity),
    unit: ingredient.unit ?? '',
  };
}

/** A row with a blank item name would save silently as nothing. */
export function ingredientRowError(row: EditableIngredient): string | undefined {
  return row.itemName.trim() === '' ? 'Enter an ingredient.' : undefined;
}

export function toIngredientInput(row: EditableIngredient): IngredientInput {
  const trimmedQuantity = row.quantity.trim();
  const parsedQuantity = trimmedQuantity === '' ? Number.NaN : Number(trimmedQuantity);
  const quantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : null;
  const unit = row.unit.trim();
  return {
    itemName: row.itemName.trim(),
    quantity,
    unit: unit === '' ? null : unit,
    rawText: row.rawText,
  };
}

export interface IngredientEditorProps {
  ingredients: readonly EditableIngredient[];
  onChange: (next: EditableIngredient[]) => void;
  /** Shown once a save attempt flags a row with a blank name. */
  showErrors: boolean;
}

/**
 * Each ingredient shows its original line, with quantity, unit, and item name as editable
 * fields beneath it, so a bad split can be corrected before saving. A manually added row has
 * no original line to show.
 */
export function IngredientEditor({
  ingredients,
  onChange,
  showErrors,
}: IngredientEditorProps): ReactElement {
  const updateRow = (key: string, patch: Partial<EditableIngredient>): void => {
    onChange(ingredients.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-h3 text-primary">Ingredients</h3>
      <ul className="flex flex-col gap-4">
        {ingredients.map((row, index) => {
          const error = showErrors ? ingredientRowError(row) : undefined;
          return (
            <li key={row.key} className="flex flex-col gap-2 rounded-md border border-border p-3">
              {row.rawText !== null && (
                <p className="text-body-sm text-secondary italic">"{row.rawText}"</p>
              )}
              <div className="grid grid-cols-3 gap-2">
                <TextField
                  label="Quantity"
                  inputMode="decimal"
                  value={row.quantity}
                  onChange={(event) => {
                    updateRow(row.key, { quantity: event.target.value });
                  }}
                />
                <TextField
                  label="Unit"
                  value={row.unit}
                  onChange={(event) => {
                    updateRow(row.key, { unit: event.target.value });
                  }}
                />
                <TextField
                  label="Item"
                  value={row.itemName}
                  error={error}
                  onChange={(event) => {
                    updateRow(row.key, { itemName: event.target.value });
                  }}
                />
              </div>
              <Button
                variant="ghost"
                className="self-start px-2"
                onClick={() => {
                  onChange(ingredients.filter((candidate) => candidate.key !== row.key));
                }}
              >
                <Trash2 aria-hidden size={16} strokeWidth={1.5} />
                {`Remove ingredient ${String(index + 1)}`}
              </Button>
            </li>
          );
        })}
      </ul>
      <Button
        variant="secondary"
        className="self-start"
        onClick={() => {
          onChange([...ingredients, blankIngredient()]);
        }}
      >
        <Plus aria-hidden size={20} strokeWidth={1.5} />
        Add ingredient
      </Button>
    </div>
  );
}
