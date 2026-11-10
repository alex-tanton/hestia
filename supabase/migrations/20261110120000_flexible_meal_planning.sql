-- Relax meal_plan_entry.recipe_id / recipe_title requirement to allow standalone custom items (MEAL-01)

alter table public.meal_plan_entry
  add column if not exists custom_title text;

alter table public.meal_plan_entry
  alter column recipe_title drop not null;

alter table public.meal_plan_entry
  add constraint meal_plan_entry_recipe_or_custom check (
    (recipe_id is not null and recipe_title is not null and custom_title is null)
    or (recipe_id is null and custom_title is not null and recipe_title is null and btrim(custom_title) <> '')
    or (recipe_id is null and recipe_title is not null and custom_title is null)
  );

