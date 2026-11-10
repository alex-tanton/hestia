# Phase 15: Flexible Meal Planning (Custom Items & Recipes) - Pattern Map

**Mapped:** 2026-11-10  
**Files analyzed:** 15  
**Analogs found:** 15 / 15  

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/20261110120000_flexible_meal_planning.sql` | migration | batch / transform | `supabase/migrations/20261110000000_barcode_products.sql` & `supabase/migrations/20260919070000_schema.sql` | exact |
| `packages/shared/src/api/meal-plan.ts` | model | request-response | `packages/shared/src/api/meal-plan.ts` & `packages/shared/src/api/lists.ts` | exact |
| `packages/shared/src/api/meal-plan.test.ts` | test | request-response | `packages/shared/src/api/lists.test.ts` | exact |
| `apps/service/src/services/meal-plan.ts` | service | CRUD | `apps/service/src/services/meal-plan.ts` & `apps/service/src/services/lists.ts` | exact |
| `apps/service/src/services/meal-plan.test.ts` | test | transform | `apps/service/src/services/meal-plan.test.ts` | exact |
| `apps/service/src/services/add-to-list.ts` | service | batch / transform | `apps/service/src/services/add-to-list.ts` | exact |
| `apps/service/src/routes/meal-plan.ts` | route | request-response | `apps/service/src/routes/meal-plan.ts` | exact |
| `apps/service/src/meal-plan.integration.test.ts` | test | request-response / CRUD | `apps/service/src/meal-plan.integration.test.ts` | exact |
| `apps/web/src/components/meals/MealPlacementSheet.tsx` | component | event-driven / request-response | `apps/web/src/components/meals/RecipePickerSheet.tsx` & `apps/web/src/components/ui/Tabs.tsx` | exact |
| `apps/web/src/components/meals/MealPlacementSheet.test.tsx` | test | event-driven | `apps/web/src/components/lists/ItemSheet.test.tsx` & `apps/web/src/components/meals/meal-components.test.tsx` | role-match |
| `apps/web/src/components/meals/MealSlotEntry.tsx` | component | event-driven | `apps/web/src/components/meals/MealSlotEntry.tsx` | exact |
| `apps/web/src/components/meals/meal-copy.ts` | utility | static | `apps/web/src/components/meals/meal-copy.ts` | exact |
| `apps/web/src/components/meals/PlannerDay.tsx` | component | event-driven | `apps/web/src/components/meals/PlannerDay.tsx` | exact |
| `apps/web/src/screens/meals/PlannerScreen.tsx` | component | request-response | `apps/web/src/screens/meals/PlannerScreen.tsx` | exact |
| `apps/web/src/components/meals/meal-components.test.tsx` | test | event-driven | `apps/web/src/components/meals/meal-components.test.tsx` | exact |
| `apps/web/src/screens/meals/planner.test.tsx` | test | request-response | `apps/web/src/screens/meals/planner.test.tsx` | exact |

---

## Pattern Assignments

### 1. `supabase/migrations/20261110120000_flexible_meal_planning.sql` (migration, batch/transform)

**Analog:** `supabase/migrations/20261110000000_barcode_products.sql` & `supabase/migrations/20260919070000_schema.sql` (lines 331-344)

**Core Schema Pattern** (lines 331-344 of `20260919070000_schema.sql` and lines 15-20 of `20261110000000_barcode_products.sql`):
```sql
-- Pattern for modifying existing table columns and constraints:
alter table public.meal_plan_entry
  add column if not exists custom_title text;

alter table public.meal_plan_entry
  alter column recipe_title drop not null;

-- Add check constraint ensuring exactly one of:
-- 1. Recipe item: recipe_id NOT NULL, recipe_title NOT NULL, custom_title NULL
-- 2. Standalone custom item: recipe_id NULL, custom_title NOT NULL (non-empty), recipe_title NULL
-- 3. Deleted recipe snapshot: recipe_id NULL, recipe_title NOT NULL, custom_title NULL
alter table public.meal_plan_entry
  add constraint meal_plan_entry_recipe_or_custom check (
    (recipe_id is not null and recipe_title is not null and custom_title is null)
    or (recipe_id is null and custom_title is not null and recipe_title is null and btrim(custom_title) <> '')
    or (recipe_id is null and recipe_title is not null and custom_title is null)
  );
```

---

### 2. `packages/shared/src/api/meal-plan.ts` (model, request-response)

**Analog:** `packages/shared/src/api/meal-plan.ts` (lines 1-56) & `packages/shared/src/api/lists.ts` (lines 142-147)

**Imports pattern** (lines 1-3):
```typescript
import { z } from 'zod';
import { calendarDateSchema, idSchema, timestampSchema } from './common.js';
```

**Core Model Pattern** (lines 17-45):
```typescript
export const mealPlanEntrySchema = z.object({
  id: idSchema,
  householdId: idSchema,
  recipeId: idSchema.nullable(),
  recipeTitle: z.string().nullable(),
  customTitle: z.string().nullable(),
  readinessPercent: z.int().min(0).max(100).nullable(),
  plannedDate: calendarDateSchema,
  mealType: mealTypeSchema,
  addedBy: idSchema,
  createdAt: timestampSchema,
});
export type MealPlanEntry = z.infer<typeof mealPlanEntrySchema>;

const createRecipeEntrySchema = z.object({
  recipeId: idSchema,
  plannedDate: calendarDateSchema,
  mealType: mealTypeSchema,
});

const createCustomItemEntrySchema = z.object({
  customTitle: z.string().trim().min(1, 'Enter an item name.').max(200),
  plannedDate: calendarDateSchema,
  mealType: mealTypeSchema,
});

export const createMealPlanEntryRequestSchema = z.union([
  createRecipeEntrySchema,
  createCustomItemEntrySchema,
]);
export type CreateMealPlanEntryRequest = z.infer<typeof createMealPlanEntryRequestSchema>;
```

---

### 3. `packages/shared/src/api/meal-plan.test.ts` (test, request-response)

**Analog:** `packages/shared/src/api/lists.test.ts` (lines 1-26)

**Imports & Test Structure pattern**:
```typescript
import { describe, expect, it } from 'vitest';
import {
  createMealPlanEntryRequestSchema,
  mealPlanEntrySchema,
} from './meal-plan.js';

describe('createMealPlanEntryRequestSchema', () => {
  it('accepts a recipe placement with recipeId, plannedDate, mealType', () => {
    expect(
      createMealPlanEntryRequestSchema.safeParse({
        recipeId: '3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b',
        plannedDate: '2026-11-15',
        mealType: 'dinner',
      }).success,
    ).toBe(true);
  });

  it('accepts a custom standalone item with customTitle, plannedDate, mealType', () => {
    expect(
      createMealPlanEntryRequestSchema.safeParse({
        customTitle: 'Greek Yogurt & Honey',
        plannedDate: '2026-11-15',
        mealType: 'breakfast',
      }).success,
    ).toBe(true);
  });

  it('rejects an empty or whitespace-only customTitle', () => {
    expect(
      createMealPlanEntryRequestSchema.safeParse({
        customTitle: '   ',
        plannedDate: '2026-11-15',
        mealType: 'breakfast',
      }).success,
    ).toBe(false);
  });

  it('rejects when neither recipeId nor customTitle is provided', () => {
    expect(
      createMealPlanEntryRequestSchema.safeParse({
        plannedDate: '2026-11-15',
        mealType: 'lunch',
      }).success,
    ).toBe(false);
  });
});
```

---

### 4. `apps/service/src/services/meal-plan.ts` (service, CRUD)

**Analog:** `apps/service/src/services/meal-plan.ts` (lines 20-63, 128-153)

**Row & Query Mapping Pattern** (lines 20-63):
```typescript
interface EntryRow {
  id: string;
  household_id: string;
  recipe_id: string | null;
  recipe_title: string | null;
  custom_title: string | null;
  planned_date: string;
  meal_type: MealPlanEntry['mealType'];
  added_by: string;
  created_at: Date | string;
  readiness_percent: number | null;
}

function toEntry(row: EntryRow): MealPlanEntry {
  return {
    id: row.id,
    householdId: row.household_id,
    recipeId: row.recipe_id,
    recipeTitle: row.recipe_title,
    customTitle: row.custom_title,
    // Null when the recipe was deleted, when it is a custom item, or defensively
    // when it has never been computed.
    readinessPercent: row.recipe_id === null ? null : row.readiness_percent,
    plannedDate: row.planned_date,
    mealType: row.meal_type,
    addedBy: row.added_by,
    createdAt: iso(row.created_at),
  };
}

function entryQuery(db: Kysely<Database>) {
  return db
    .selectFrom('meal_plan_entry')
    .leftJoin('recipe_readiness', 'recipe_readiness.recipe_id', 'meal_plan_entry.recipe_id')
    .select([
      'meal_plan_entry.id',
      'meal_plan_entry.household_id',
      'meal_plan_entry.recipe_id',
      'meal_plan_entry.recipe_title',
      'meal_plan_entry.custom_title',
      'meal_plan_entry.planned_date',
      'meal_plan_entry.meal_type',
      'meal_plan_entry.added_by',
      'meal_plan_entry.created_at',
      'recipe_readiness.readiness_percent',
    ]);
}
```

**Creation Pattern with Recipe vs Custom Branching** (lines 128-153):
```typescript
export async function createMealPlanEntry(
  db: Kysely<Database>,
  householdId: string,
  userId: string,
  input: CreateMealPlanEntryRequest,
): Promise<MealPlanEntry> {
  const isCustom = 'customTitle' in input && input.customTitle !== undefined;
  let recipe: { id: string; title: string } | null = null;
  if (!isCustom) {
    recipe = await requireHouseholdRecipe(db, householdId, input.recipeId);
  }

  const row = await db
    .insertInto('meal_plan_entry')
    .values({
      household_id: householdId,
      recipe_id: recipe ? recipe.id : null,
      recipe_title: recipe ? recipe.title : null,
      custom_title: isCustom ? input.customTitle.trim() : null,
      planned_date: input.plannedDate,
      meal_type: input.mealType,
      added_by: userId,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();

  const created = await entryQuery(db).where('meal_plan_entry.id', '=', row.id).executeTakeFirst();
  if (created === undefined) throw new Error('meal plan entry vanished immediately after insert');
  return toEntry(created);
}
```

**Single Entry List Export Helper**:
```typescript
export interface MealPlanEntryTarget {
  kind: 'recipe';
  recipeId: string;
} | {
  kind: 'custom';
  customTitle: string;
}

export async function requireMealPlanEntryTarget(
  db: Kysely<Database>,
  id: string,
): Promise<MealPlanEntryTarget> {
  const row = await db
    .selectFrom('meal_plan_entry')
    .select(['household_id', 'recipe_id', 'custom_title'])
    .where('id', '=', id)
    .executeTakeFirst();
  if (row === undefined) throw fail(404, 'Meal plan entry not found.');
  await markHouseholdActive(db, row.household_id);

  if (row.custom_title !== null) {
    return { kind: 'custom', customTitle: row.custom_title };
  }
  if (row.recipe_id !== null) {
    return { kind: 'recipe', recipeId: row.recipe_id };
  }
  throw fail(404, 'Recipe not found.');
}
```

---

### 5. `apps/service/src/routes/meal-plan.ts` (route, request-response)

**Analog:** `apps/service/src/routes/meal-plan.ts` (lines 26-84)

**Route Pattern with Authentication, Validation & Delegation**:
```typescript
  app.post('/api/meal-plan/:id/add-to-list', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(mealPlanEntryIdParamsSchema, request.params);
    const body = parse(addToListRequestSchema, request.body);
    return ctx.asUser(user, async (db) => {
      const target = await requireMealPlanEntryTarget(db, id);
      if (target.kind === 'recipe') {
        return addMissingIngredientsToList(
          db,
          body.listId,
          [target.recipeId],
          user.id,
          logDroppedCopy(request.log),
        );
      }
      return addListItem(
        db,
        body.listId,
        user.id,
        {
          source: 'manual',
          itemName: target.customTitle,
          quantity: 1,
        },
        logDroppedCopy(request.log),
      );
    });
  });

  app.post('/api/households/:id/meal-plan/add-to-list', async (request) => {
    const user = await ctx.authenticate(request);
    const { id } = parse(householdIdParamsSchema, request.params);
    const body = parse(weekAddToListRequestSchema, request.body);
    return ctx.inHousehold(user, id, async (db) => {
      return addWeekMealsToList(
        db,
        id,
        body.listId,
        body.week,
        user.id,
        logDroppedCopy(request.log),
      );
    });
  });
```

---

### 6. `apps/service/src/meal-plan.integration.test.ts` (test, request-response/CRUD)

**Analog:** `apps/service/src/meal-plan.integration.test.ts` (lines 130-162)

**Integration Test Pattern**:
```typescript
async function planCustomItem(
  home: Home,
  customTitle: string,
  plannedDate: string,
  mealType: 'breakfast' | 'lunch' | 'dinner' = 'breakfast',
): Promise<MealPlanEntry> {
  const response = await as(
    app,
    home.user,
    'POST',
    `/api/households/${home.household.id}/meal-plan`,
    { customTitle, plannedDate, mealType },
  );
  expectStatus(response, 201);
  return response.json<MealPlanEntry>();
}

it('places a custom standalone item and lists it back with null readiness', async () => {
  const home = await household(app);
  const sunday = await currentSunday(home);
  const entry = await planCustomItem(home, 'Banana & Peanut Butter', sunday, 'breakfast');

  expect(entry.customTitle).toBe('Banana & Peanut Butter');
  expect(entry.recipeId).toBeNull();
  expect(entry.recipeTitle).toBeNull();
  expect(entry.readinessPercent).toBeNull();

  const listResponse = await as(
    app,
    home.user,
    'GET',
    `/api/households/${home.household.id}/meal-plan?week=${sunday}`,
  );
  expectStatus(listResponse, 200);
  const week = listResponse.json<MealPlanWeekResponse>();
  expect(week.entries).toEqual(
    expect.arrayContaining([expect.objectContaining({ customTitle: 'Banana & Peanut Butter' })]),
  );
});

it('adds a standalone custom meal item to a shopping list with source manual and qty 1', async () => {
  const home = await household(app);
  const sunday = await currentSunday(home);
  const list = await createList(home, 'Weekly Grocery');
  const entry = await planCustomItem(home, 'Greek Yogurt', sunday, 'breakfast');

  const addRes = await as(app, home.user, 'POST', `/api/meal-plan/${entry.id}/add-to-list`, {
    listId: list.id,
  });
  expectStatus(addRes, 200);
  const updatedList = addRes.json<ShoppingListDetail>();
  const item = itemNamed(updatedList, 'Greek Yogurt');
  expect(item.quantity).toBe(1);
  expect(item.source).toBe('manual');
});
```

---

### 7. `apps/web/src/components/meals/MealPlacementSheet.tsx` (component, event-driven/request-response)

**Analog:** `apps/web/src/components/meals/RecipePickerSheet.tsx` (lines 1-101) & `apps/web/src/components/ui/Tabs.tsx` (lines 1-58)

**Imports pattern**:
```typescript
import { useState, type ReactElement } from 'react';
import { useRecipes, useSuggestions } from '../../lib/api/meal-hooks.ts';
import { ErrorState } from '../states/StateBlocks.tsx';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/Field.tsx';
import { ListRow } from '../ui/ListRow.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { SkeletonRows } from '../ui/Skeleton.tsx';
import { Tabs } from '../ui/Tabs.tsx';
import { breakdownLine } from './meal-copy.ts';
import { mergeReadiness, sortSuggestions } from './recipe-sort.ts';
```

**Tabs & Sheet Layout Pattern**:
```typescript
export interface MealPlacementSheetProps {
  householdId: string;
  onPickRecipe: (recipeId: string, recipeTitle: string) => void;
  onPickCustom: (customTitle: string) => void;
  onOpenChange: (open: boolean) => void;
}

const QUICK_SUGGESTIONS = [
  'Banana',
  'Greek Yogurt',
  'Apple',
  'Oatmeal',
  'Protein Shake',
  'Leftovers',
  'Salad',
  'Sandwich',
] as const;

export function MealPlacementSheet({
  householdId,
  onPickRecipe,
  onPickCustom,
  onOpenChange,
}: MealPlacementSheetProps): ReactElement {
  const [tab, setTab] = useState<'recipe' | 'custom'>('recipe');
  const [customTitle, setCustomTitle] = useState('');
  const [search, setSearch] = useState('');

  const submitCustom = (title: string): void => {
    const trimmed = title.trim();
    if (trimmed === '') return;
    onPickCustom(trimmed);
  };

  // Recipe tab content renders the existing RecipePickerSheet search + suggestions logic
  // Quick Item tab content renders the TextField + suggestion chips + submit Button
  ...
```

---

### 8. `apps/web/src/components/meals/MealPlacementSheet.test.tsx` (test, event-driven)

**Analog:** `apps/web/src/components/lists/ItemSheet.test.tsx` (lines 42-60) & `apps/web/src/components/meals/meal-components.test.tsx` (lines 78-98)

**Component Interaction Test Pattern**:
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MealPlacementSheet } from './MealPlacementSheet.tsx';

describe('MealPlacementSheet', () => {
  it('switches to Quick Item tab and submits a custom food item', async () => {
    const user = userEvent.setup();
    const onPickCustom = vi.fn();
    render(
      <MealPlacementSheet
        householdId="h1"
        onPickRecipe={vi.fn()}
        onPickCustom={onPickCustom}
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Quick Item' }));
    const input = screen.getByLabelText(/Item name/i);
    await user.type(input, 'Greek Yogurt');
    await user.click(screen.getByRole('button', { name: 'Place item' }));

    expect(onPickCustom).toHaveBeenCalledWith('Greek Yogurt');
  });

  it('allows clicking quick suggestion chips to submit directly', async () => {
    const user = userEvent.setup();
    const onPickCustom = vi.fn();
    render(
      <MealPlacementSheet
        householdId="h1"
        onPickRecipe={vi.fn()}
        onPickCustom={onPickCustom}
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Quick Item' }));
    await user.click(screen.getByRole('button', { name: 'Banana' }));

    expect(onPickCustom).toHaveBeenCalledWith('Banana');
  });
});
```

---

### 9. `apps/web/src/components/meals/MealSlotEntry.tsx` (component, event-driven)

**Analog:** `apps/web/src/components/meals/MealSlotEntry.tsx` (lines 22-80)

**Presentation Disambiguation Pattern** (D-04, D-07):
```typescript
export function MealSlotEntry({
  entry,
  isReadOnly,
  offlineReason,
  onAddMissing,
  onRemove,
}: MealSlotEntryProps): ReactElement {
  const isCustom = entry.customTitle !== null;
  const isDeleted = entry.recipeId === null && !isCustom;
  const displayTitle = entry.customTitle ?? entry.recipeTitle ?? '';

  const title = isCustom ? (
    <span className="flex items-center gap-1.5 truncate text-body text-primary font-medium">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-secondary shrink-0" aria-hidden />
      <span className="truncate">{entry.customTitle}</span>
    </span>
  ) : isDeleted ? (
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-body text-secondary">{entry.recipeTitle}</span>
      <span className="sr-only">{DELETED_RECIPE_NOTE}</span>
    </span>
  ) : (
    <Link
      to={`/meals/recipes/${String(entry.recipeId)}`}
      className="truncate text-body text-section underline"
    >
      {entry.recipeTitle}
      {entry.readinessPercent !== null && (
        <span className="ml-1 text-body-sm text-secondary">{entry.readinessPercent}%</span>
      )}
    </Link>
  );

  return (
    <li className="flex items-center gap-1">
      <span className="min-w-0 flex-1 py-1">{title}</span>
      {!isReadOnly && (
        <OverflowMenu
          label={`More actions for ${displayTitle}`}
          items={[
            ...(isDeleted
              ? []
              : [
                  {
                    label: isCustom ? 'Add to list' : 'Add missing to list',
                    disabledReason: offlineReason,
                    onSelect: () => {
                      onAddMissing(entry);
                    },
                  },
                ]),
            {
              label: 'Remove',
              icon: <Trash2 aria-hidden size={16} strokeWidth={1.5} />,
              isDestructive: true,
              disabledReason: offlineReason,
              onSelect: () => {
                onRemove(entry);
              },
            },
          ]}
        />
      )}
    </li>
  );
}
```

---

### 10. `apps/web/src/screens/meals/PlannerScreen.tsx` (component, request-response)

**Analog:** `apps/web/src/screens/meals/PlannerScreen.tsx` (lines 95-167, 279-287)

**Unified Placement and Feedback Flow**:
```typescript
  const placeRecipe = (recipeId: string, recipeTitle: string): void => {
    if (placing === undefined) return;
    createEntry.mutate(
      { recipeId, plannedDate: placing.date, mealType: placing.mealType },
      {
        onSuccess: () => {
          setPlacing(undefined);
          toast({ variant: 'success', message: `Placed ${recipeTitle}.` });
        },
        onError: (error) => {
          toast({
            variant: 'error',
            message: userMessage(error, { fallback: "Couldn't place that meal. Try again." }),
          });
        },
      },
    );
  };

  const placeCustom = (customTitle: string): void => {
    if (placing === undefined) return;
    createEntry.mutate(
      { customTitle, plannedDate: placing.date, mealType: placing.mealType },
      {
        onSuccess: () => {
          setPlacing(undefined);
          toast({ variant: 'success', message: `Placed ${customTitle}.` });
        },
        onError: (error) => {
          toast({
            variant: 'error',
            message: userMessage(error, { fallback: "Couldn't place that meal. Try again." }),
          });
        },
      },
    );
  };
```

**Sheet Rendering**:
```tsx
      {placing !== undefined && (
        <MealPlacementSheet
          householdId={householdId}
          onPickRecipe={placeRecipe}
          onPickCustom={placeCustom}
          onOpenChange={(open) => {
            if (!open) setPlacing(undefined);
          }}
        />
      )}
```

---

## Shared Patterns

### 1. Authentication & Route Isolation
**Source:** `apps/service/src/routes/meal-plan.ts` (lines 26-50)
**Apply to:** All Fastify meal plan routes
```typescript
const user = await ctx.authenticate(request);
const { id } = parse(householdIdParamsSchema, request.params);
return ctx.inHousehold(user, id, (db) => ...);
// or for resource-level lookup where id belongs to the row:
const { id } = parse(mealPlanEntryIdParamsSchema, request.params);
return ctx.asUser(user, (db) => ...);
```

### 2. RFC 9457 Problem Errors & Schema Parsing
**Source:** `apps/service/src/http/context.ts` & `apps/service/src/problem.ts`
**Apply to:** Request parameter, query, and body parsing across services and routes
```typescript
import { parse } from '../http/context.js';
import { fail } from '../problem.js';

const body = parse(createMealPlanEntryRequestSchema, request.body);
if (invalidCondition) throw fail(400, 'Custom error message');
```

### 3. Read-Only Past & Offline Disabled Actions
**Source:** `apps/web/src/screens/meals/PlannerScreen.tsx` (lines 84-91)
**Apply to:** `PlannerScreen`, `PlannerDay`, `MealSlotEntry`
```typescript
const offlineReason = isOnline ? undefined : OFFLINE_ACTION_REASON;
const isPastWeek = week < currentWeek;
const isReadOnly = isPastWeek;

// Passed down to components as:
// isReadOnly hides write controls entirely (past is history)
// offlineReason keeps controls visible but disables them with tooltip (never fail silently)
```

### 4. Advisory Transaction Locking for Shopping List Mutators
**Source:** `apps/service/src/services/add-to-list.ts` (lines 35-37)
**Apply to:** Single and week-level meal plan list exports
```typescript
await sql`select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(${`add-to-list:${listId}`}, 0))`.execute(
  db,
);
```

### 5. Radix Tabs In-Screen Navigation
**Source:** `apps/web/src/components/ui/Tabs.tsx` (lines 30-56)
**Apply to:** `MealPlacementSheet` ("Recipe" vs "Quick Item" tabs)
```typescript
<RadixTabs.Root value={value} onValueChange={onValueChange} className="...">
  <RadixTabs.List aria-label={label} className="...">
    {items.map((item) => (
      <RadixTabs.Trigger key={item.value} value={item.value} className="...">
        {item.label}
      </RadixTabs.Trigger>
    ))}
  </RadixTabs.List>
  {items.map((item) => (
    <RadixTabs.Content key={item.value} value={item.value}>
      {item.content}
    </RadixTabs.Content>
  ))}
</RadixTabs.Root>
```

---

## No Analog Found

None. All 15 files have exact or role-matched analogs in the codebase.

---

## Metadata

**Analog search scope:**
- `supabase/migrations/`
- `packages/shared/src/api/`
- `apps/service/src/services/`
- `apps/service/src/routes/`
- `apps/service/src/`
- `apps/web/src/components/meals/`
- `apps/web/src/components/ui/`
- `apps/web/src/screens/meals/`

**Files scanned:** 22  
**Pattern extraction date:** 2026-11-10  
