import type { ReactElement } from 'react';
import type { IngredientInput, ParsedIngredient, RecipeIngredient } from '@hestia/shared';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/Field.tsx';
import { Icon } from '../ui/Icon.tsx';

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
 * Rapid inline row editor with borderless quantity, unit, and item fields per D-03.
 * Pressing Enter inside the item field automatically adds and focuses the next ingredient row.
 */
export function IngredientEditor({
  ingredients,
  onChange,
  showErrors,
}: IngredientEditorProps): ReactElement {
  const updateRow = (key: string, patch: Partial<EditableIngredient>): void => {
    onChange(ingredients.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const handleAppendRow = (): void => {
    const newRow = blankIngredient();
    onChange([...ingredients, newRow]);
    setTimeout(() => {
      const rows = document.querySelectorAll<HTMLElement>('[data-ingredient-row]');
      const lastRow = rows[rows.length - 1];
      const targetInput = lastRow?.querySelector<HTMLElement>(
        'md-outlined-text-field, input, textarea',
      );
      targetInput?.focus();
    }, 50);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-title-small font-semibold text-primary">Ingredients</h3>
        <Button type="button" variant="ghost" className="px-2" onClick={handleAppendRow}>
          <Icon name="add" size={18} />
          Add ingredient
        </Button>
      </div>

      <ul className="flex flex-col divide-y divide-[var(--md-sys-color-outline-variant)]">
        {ingredients.map((row, index) => {
          const error = showErrors ? ingredientRowError(row) : undefined;
          return (
            <li key={row.key} data-ingredient-row className="flex flex-col gap-2 py-3">
              {row.rawText !== null && (
                <p className="text-body-sm text-secondary italic">"{row.rawText}"</p>
              )}
              <div className="flex items-start gap-2">
                <div className="w-24 shrink-0">
                  <TextField
                    label="Quantity"
                    inputMode="decimal"
                    value={row.quantity}
                    onChange={(event) => {
                      updateRow(row.key, { quantity: event.target.value });
                    }}
                  />
                </div>
                <div className="w-28 shrink-0">
                  <TextField
                    label="Unit"
                    value={row.unit}
                    onChange={(event) => {
                      updateRow(row.key, { unit: event.target.value });
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <TextField
                    label="Item"
                    value={row.itemName}
                    error={error}
                    onChange={(event) => {
                      updateRow(row.key, { itemName: event.target.value });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleAppendRow();
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  isIconOnly
                  className="mt-2 shrink-0 text-secondary hover:text-error"
                  aria-label={`Remove ingredient ${String(index + 1)}`}
                  onClick={() => {
                    onChange(ingredients.filter((candidate) => candidate.key !== row.key));
                  }}
                >
                  <Icon name="delete" size={18} />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
