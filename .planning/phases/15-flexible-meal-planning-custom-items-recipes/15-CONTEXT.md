# Phase 15: Flexible Meal Planning (Custom Items & Recipes) - Context

**Gathered:** 2026-11-10
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous mode)

<domain>
## Phase Boundary

Support standalone food items (e.g. banana, yogurt, snack) directly on the meal planner alongside existing recipes without requiring fake 1-ingredient recipe creation.

Requirements:
- **MEAL-01**: Database migration relaxes `meal_plan_entry.recipe_id NOT NULL` to allow standalone custom items with `custom_title`.
- **MEAL-02**: PWA meal planner provides a quick entry action to place standalone food items (e.g., banana, yogurt, snack) into any meal slot (breakfast, lunch, dinner).
- **MEAL-03**: Standalone custom meal items can be added directly to shopping lists via existing "Add to list" actions.

Success Criteria:
1. Database migration adds `custom_title text` to `meal_plan_entry` with integrity check ensuring either recipe or custom title is present.
2. User can add standalone custom food items to breakfast, lunch, or dinner slots on the meal planner via a dedicated quick-entry sheet.
3. Placed custom food items appear cleanly on the planner grid alongside recipes and can be added directly to shopping lists via "Add to list" and "Add week to list".

</domain>

<decisions>
## Implementation Decisions

### Data Model & Schema Migration (MEAL-01)
- **D-01 (Table columns)**: Add nullable `custom_title text` to `meal_plan_entry` table, make `recipe_title text` nullable, and add a check constraint: `check ((recipe_id is not null and recipe_title is not null) or (recipe_id is null and custom_title is not null) or (recipe_id is null and recipe_title is not null))`. This preserves existing deleted-recipe snapshot behavior (`recipe_id` null, `recipe_title` set) while supporting custom items (`recipe_id` null, `custom_title` set).
- **D-02 (Shared schemas)**: In `@hestia/shared/src/api/meal-plan.ts`, update `mealPlanEntrySchema` to include `customTitle: z.string().nullable()`, update `recipeTitle: z.string().nullable()`, and maintain `readinessPercent: z.int().min(0).max(100).nullable()`. Custom items have `recipeId: null`, `recipeTitle: null`, `customTitle: string`, and `readinessPercent: null`.
- **D-03 (Creation contract)**: Update `createMealPlanEntryRequestSchema` in `@hestia/shared` to accept either `{ recipeId: string, plannedDate, mealType }` OR `{ customTitle: string, plannedDate, mealType }`.
- **D-04 (Deleted recipe disambiguation)**: Explicitly distinguish deleted recipes (`recipeId === null && recipeTitle !== null && customTitle === null`) from custom items (`customTitle !== null`). Custom items never show the deleted recipe notice or styling.

### Planner UI & Quick-Entry Interaction (MEAL-02)
- **D-05 (Unified placement sheet)**: Enhance the placement dialog/sheet from `PlannerDay` "Add to [meal]" into a unified sheet with tabs: "Recipe" (existing recipe search and deal-matched suggestion ranking) and "Quick Item" (a clean input field with instant submit button and quick food suggestions).
- **D-06 (Ergonomics)**: Submitting a custom item creates the entry and immediately closes the sheet with a success toast (`Placed [item].`), matching existing recipe placement ergonomics.
- **D-07 (Planner grid presentation)**: In `MealSlotEntry.tsx`, render custom items in primary body text (`text-body text-primary`) with an understated bullet/icon and no hyperlink, differentiating them clearly from linked recipes and muted deleted recipes.
- **D-08 (Read-only & offline behavior)**: Adhere strictly to Hestia conventions: past weeks are read-only, offline disables add/remove actions with clear disabledReason tooltip, current and future weeks are fully editable when online.

### Shopping List Integration (MEAL-03)
- **D-09 (Single item "Add to list")**: The overflow menu for custom items displays "Add to list". Selecting it opens `ListPickerSheet`, and upon choosing a list, calls `POST /api/households/:id/lists/:listId/items` with `name = customTitle`, quantity = 1, status = `needed`.
- **D-10 (Week-level "Add week to list")**: In `apps/service/src/services/meal-plan.ts` and `routes/meal-plan.ts`, enhance the add-week-to-list action to aggregate both missing ingredients from planned recipes AND all standalone custom items planned in the specified week.
- **D-11 (Default quantity & units)**: Custom items added to lists default to quantity = 1 and unit = null, preserving the item title as entered and letting the user customize quantity on the grocery list screen.
- **D-12 (Feedback)**: Show standard success toast ("Added [item] to [List Name]") upon completion without disrupting the user's planner view.

</decisions>

<code_context>
## Existing Code Insights

- `supabase/migrations/20260919070000_schema.sql`: defines `meal_plan_entry` table with `foreign key (recipe_id, household_id) references public.recipe(id, household_id) on delete set null (recipe_id)`.
- `packages/shared/src/api/meal-plan.ts`: defines `mealPlanEntrySchema`, `createMealPlanEntryRequestSchema`, `addToListRequestSchema`, `weekAddToListRequestSchema`.
- `apps/service/src/services/meal-plan.ts`: implements `getMealPlanWeek`, `createMealPlanEntry`, `deleteMealPlanEntry`, `requireMealPlanEntryRecipeId`, `recipeIdsForWeek`.
- `apps/service/src/routes/meal-plan.ts`: Fastify route plugin for meal planning operations.
- `apps/service/src/services/lists.ts`: implements `addListItem` for shopping lists.
- `apps/web/src/components/meals/MealSlotEntry.tsx`: renders individual entries in day slots with overflow menu.
- `apps/web/src/components/meals/RecipePickerSheet.tsx`: picker sheet for recipes.
- `apps/web/src/components/meals/PlannerDay.tsx`: day column with breakfast, lunch, and dinner cards.
- `apps/web/src/screens/meals/PlannerScreen.tsx`: main meal planner screen managing week state, placement, deletion, and list additions.

</code_context>

<specifics>
## Specific Ideas

- Allow typing any quick food or snack title (e.g. "Honeycrisp Apple", "Greek Yogurt", "Leftover Pizza", "Protein Shake").
- Maintain high contrast and clean typography consistent with the Warm Editorial aesthetic.
- Ensure all mutation endpoints validate household isolation and active status via RLS and `markHouseholdActive`.

</specifics>

<deferred>
## Deferred Ideas

- None — scoped strictly to MEAL-01, MEAL-02, and MEAL-03.
</deferred>
