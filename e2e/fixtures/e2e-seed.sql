-- Extra seed rows the Phase 1 departure journeys need, applied after `pnpm db:seed`.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f e2e/fixtures/e2e-seed.sql
--
-- Every row below is one of the seed data's fixtures. They live here rather than
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
  if exists (select 1 from public.bill where owner_user_id = casey and name = 'Car Insurance') then
    raise exception 'already applied: reset the database before applying the E2E fixtures again';
  end if;

  -- The two Oak Street lists journey 8 reassigns ('This Week' created by Sam, 'Weekend Cookout'
  -- created by Jordan) now come from supabase/seed/seed.sql, with the rest of Phase 2's lists.

  -- Phase 4 has landed, so supabase/seed/seed.sql now carries Oak Street's errands ('Renew car
  -- registration', assigned to Sam), its chores (including 'Take out trash', rotation Alex, Sam,
  -- Jordan at offset 2, which is the rotation the departure preview reads), and its household
  -- bills (Duke Energy, Sam's; Water and Sewer, Jordan's). Inserting them again here would
  -- duplicate them, so only the personal bill that is not in that file remains.

  -- Casey's Car Insurance is personal, so it has no household and survives
  -- Empty House's deletion.
  insert into public.bill (household_id, owner_user_id, name, amount, recurrence_unit,
    anchor_date, autopay, visibility, is_subscription, created_at)
  values
    (null, casey, 'Car Insurance', 128.00, 'month', (now() - interval '3 months')::date, false,
      'personal', false, now() - interval '3 months');

  -- -------------------------------------------------------------------------------------------
  -- Journey 2's search cache. `supabase/seed/seed.sql`
  -- seeds the deals themselves — Food Lion's Rainbow Bell Peppers and Baby Cut Carrots, both real
  -- 27514 favorite-store groceries — but its own
  -- `deal_query_cache` rows are "saffron" and "chicken", neither a favorited-merchant deal a
  -- journey can add to a list. A row per theme, already warm, is what lets the journey's search be
  -- a cache hit rather than a live Flipp call the suite must never make: each
  -- `normalized_query` is exactly what `@hestia/matching` normalizes the raw item name to, which is
  -- also what the journey types into the search box.
  -- -------------------------------------------------------------------------------------------

  insert into public.deal_query_cache (postal_code, normalized_query, deal_ids, cached_at) values
    ('27514', 'rainbow bell pepper',
      array(select id from public.deal where postal_code = '27514'
        and external_id = '1039542198'),
      now()),
    ('27514', 'baby cut carrot',
      array(select id from public.deal where postal_code = '27514'
        and external_id = '1039534752'),
      now()),
    ('27514', 'pure pumpkin',
      array(select id from public.deal where postal_code = '27514'
        and external_id = '1040206686'),
      now()),
    ('27514', 'stouffer',
      array(select id from public.deal where postal_code = '27514'
        and external_id = '1039937762'),
      now());

  -- Pre-warmed barcode cache for Journey 23 (TEST-03, D-05)
  insert into public.barcode_products (barcode, product_name, brands, quantity, image_url, raw_payload)
  values (
    '012345678905',
    'Organic Whole Milk',
    'Horizon Organic',
    '1 gal',
    'https://images.openfoodfacts.org/1.jpg',
    '{"status":"success","product":{"product_name":"Organic Whole Milk","brands":"Horizon Organic","quantity":"1 gal"}}'::jsonb
  )
  on conflict (barcode) do nothing;
end
$$;

commit;
