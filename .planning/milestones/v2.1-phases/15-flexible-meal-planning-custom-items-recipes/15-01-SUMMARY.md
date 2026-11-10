---
phase: 15-flexible-meal-planning-custom-items-recipes
plan: "01"
subsystem: service
tags:
  - meal-plan
  - postgres
  - shared-schemas
  - fastify
  - lists
requires:
  - phase: 14-barcode-scanning-grocery-list-integration
    provides: List item schema and shopping list persistence
provides:
  - Database schema relaxation, custom_title column, and integrity check constraint in Postgres
  - Discriminated shared schemas and contracts for custom standalone food items and recipe placements
  - Service methods createMealPlanEntry and requireMealPlanEntryTarget supporting custom items
  - Single item and week-level shopping list additions for standalone custom food items
  - Comprehensive unit and integration test coverage across shared and service packages
affects:
  - "15-02"
  - web
  - meal-plan
  - lists
actuals:
  tokens: 44000
  tasks: 3
  commits: 2
tech-stack:
  added: []
  patterns:
    - Mutually exclusive check constraint for recipe XOR custom meal plan entries
    - Zod discriminated union request schema for flexible endpoint input
    - Transaction-scoped advisory locking for batch shopping list insertion
key-files:
  created:
    - supabase/migrations/20261110120000_flexible_meal_planning.sql
    - packages/shared/src/api/meal-plan.test.ts
  modified:
    - apps/service/src/db/types.ts
    - packages/shared/src/api/meal-plan.ts
    - apps/service/src/services/meal-plan.ts
    - apps/service/src/services/meal-plan.test.ts
    - apps/service/src/routes/meal-plan.ts
    - apps/service/src/meal-plan.integration.test.ts
key-decisions:
  - "D-01: Relax recipe_title to nullable, add custom_title text, and add check constraint meal_plan_entry_recipe_or_custom supporting active recipes, deleted recipes, and custom items"
  - "D-02: Update mealPlanEntrySchema with customTitle and nullable recipeTitle, readinessPercent null when custom item"
  - "D-03: Create discriminated union createMealPlanEntryRequestSchema supporting recipeId or customTitle"
  - "D-09: Single custom meal entry add-to-list inserts into target shopping list with quantity 1 and source manual"
  - "D-10: Week add-to-list aggregates recipe ingredients and standalone custom items with duplicate prevention"
patterns-established:
  - "Custom food items have recipeId: null, recipeTitle: null, customTitle: string, and readinessPercent: null"
  - "Advisory lock on add-to-list:${listId} ensures atomicity and eliminates race conditions on duplicate custom item insertion"
requirements-completed:
  - MEAL-01
  - MEAL-03
duration: 15 min
completed: 2026-11-10
status: complete
---

# Phase 15 Plan 01: Database Migration, Shared Contracts, Service Persistence, and List Integration Summary

**Delivered schema migration, Kysely types, shared Zod schemas, service persistence, and Fastify routes for standalone custom meal plan items and shopping list export.**

## Accomplishments

- Created database migration `20261110120000_flexible_meal_planning.sql` relaxing `meal_plan_entry.recipe_title` to nullable, adding `custom_title text`, and establishing a check constraint ensuring valid states (recipe, deleted recipe snapshot, custom food item).
- Updated Kysely types in `apps/service/src/db/types.ts` with `custom_title: string | null` and nullable `recipe_title`.
- Updated `@hestia/shared/src/api/meal-plan.ts` with `mealPlanEntrySchema` supporting `customTitle`, and `createMealPlanEntryRequestSchema` union accepting either `{ recipeId, plannedDate, mealType }` or `{ customTitle, plannedDate, mealType }`.
- Implemented `createMealPlanEntry` in `apps/service/src/services/meal-plan.ts` handling both recipes and standalone custom food items with title trimming and validation.
- Implemented `requireMealPlanEntryTarget` returning discriminated target (`recipe` vs `custom`) and updated single item `POST /api/meal-plan/:id/add-to-list` to insert custom items as manual shopping list items.
- Implemented `addWeekMealsToList` taking advisory locks and aggregating recipe ingredients alongside standalone custom items with duplicate avoidance.
- Added comprehensive unit tests in `packages/shared/src/api/meal-plan.test.ts` and `apps/service/src/services/meal-plan.test.ts`, plus integration tests in `apps/service/src/meal-plan.integration.test.ts`.

## Task Commits

1. **Task 15-01-01: End-to-end custom meal item persistence: migration to route (MEAL-01)** - `c1974a5` (feat)
2. **Task 15-01-02 & 15-01-03: Test suites & shopping list integration (MEAL-01, MEAL-03)** - `b126120` (test)

## Files Created/Modified

- `supabase/migrations/20261110120000_flexible_meal_planning.sql` - Database schema relaxation and check constraint
- `apps/service/src/db/types.ts` - Kysely types for meal_plan_entry
- `packages/shared/src/api/meal-plan.ts` - Shared validation schemas and TypeScript types
- `packages/shared/src/api/meal-plan.test.ts` - Shared schema unit tests
- `apps/service/src/services/meal-plan.ts` - Service layer persistence and shopping list aggregation
- `apps/service/src/services/meal-plan.test.ts` - Service pure function unit tests
- `apps/service/src/routes/meal-plan.ts` - Fastify route handlers
- `apps/service/src/meal-plan.integration.test.ts` - Integration tests against service stack
- `apps/web/src/components/meals/ListPickerSheet.tsx` - List picker prop flexibility
- `apps/web/src/screens/DashboardRoute.tsx` - Dashboard meal item title fallback
- `apps/web/src/screens/meals/PlannerScreen.tsx` - Planner screen remove and picker adjustments
