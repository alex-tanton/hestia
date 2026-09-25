-- Seed Data rows the Phase 1 departure journeys need, applied after `pnpm db:seed`
-- (Seed Data, "E2E departure fixtures").
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f e2e/fixtures/e2e-seed.sql
--
-- Every row below is one of the fixtures Seed Data already specifies. They live here rather than
-- in supabase/seed/seed.sql because that file adds each pillar's data in the phase that builds
-- the pillar, and chores, errands, and bills belong to Phase 4. When that phase seeds them, this
-- file loses the rows it takes over, as it already has for Phase 2's shopping lists.
--
-- The departure preview asks for a new owner for the lists a member created, the chores and open
-- errands assigned to them, and the unarchived household bills they own, so journey 8 needs at
-- least one of those per departing member. Casey's personal bill is the one that has to outlive
-- the deletion of Empty House.

begin;

do $$
declare
  alex uuid;
  sam uuid;
  jordan uuid;
  casey uuid;
  oak_street uuid;
begin
  select id into alex from public.profile where email = 'alex@example.com';
  select id into sam from public.profile where email = 'sam@example.com';
  select id into jordan from public.profile where email = 'jordan@example.com';
  select id into casey from public.profile where email = 'casey@example.com';
  select id into oak_street from public.household where name = 'Oak Street';
  if alex is null or sam is null or jordan is null or casey is null or oak_street is null then
    raise exception 'run `pnpm db:seed` before the E2E fixtures';
  end if;
  if exists (select 1 from public.errand where household_id = oak_street) then
    raise exception 'already applied: reset the database before applying the E2E fixtures again';
  end if;

  -- The two Oak Street lists journey 8 reassigns ('This Week' created by Sam, 'Weekend Cookout'
  -- created by Jordan) now come from supabase/seed/seed.sql, with the rest of Phase 2's lists.

  -- Seed Data, "Errands": open, assigned to Sam, due in three weeks.
  insert into public.errand (household_id, name, due_date, status, added_by, assigned_to)
  values (oak_street, 'Renew car registration', (now() + interval '21 days')::date, 'open', alex,
    sam);

  -- Seed Data, "Bills". Duke Energy is Sam's and Water and Sewer is Jordan's; Casey's Car
  -- Insurance is personal, so it has no household and survives Empty House's deletion.
  insert into public.bill (household_id, owner_user_id, name, amount, recurrence_unit,
    anchor_date, autopay, visibility, is_subscription, created_at)
  values
    (oak_street, sam, 'Duke Energy', 142.30, 'month', (now() - interval '6 months')::date, false,
      'household', false, now() - interval '6 months'),
    (oak_street, jordan, 'Water and Sewer', 58.40, 'month', (now() - interval '3 months')::date,
      false, 'household', false, now() - interval '3 months'),
    (null, casey, 'Car Insurance', 128.00, 'month', (now() - interval '3 months')::date, false,
      'personal', false, now() - interval '3 months');

  -- Seed Data, "Chores". A rotation is never reassigned, so this is what the preview's rotation
  -- note is read from: removing Sam passes the turn to the next member in the order.
  insert into public.chore (household_id, name, recurrence_unit, "interval", anchor_date,
    rotation_order, rotation_offset, created_by)
  values (oak_street, 'Take out trash', 'week', 1, (now() - interval '56 days')::date,
    array[alex, sam, jordan], 2, alex);
end
$$;

commit;
