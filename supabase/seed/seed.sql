-- Development seed data (Seed Data). Run by `pnpm db:seed` after seed-users.ts has created the
-- five users through GoTrue; it is not a migration and never runs in production.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -v invite_token=<token> -f supabase/seed/seed.sql
--
-- Dates are relative to the seed run. It runs once per database: reset first (`supabase db reset`)
-- to seed again. Pillar data (deals, lists, pantry, recipes, meal plan, bills, chores, errands)
-- is added by the phase that builds each pillar, in the marked sections below.

select pg_catalog.set_config('hearth.seed_invite_token', :'invite_token', false);

begin;

do $$
declare
  alex uuid;
  sam uuid;
  jordan uuid;
  morgan uuid;
  casey uuid;
  oak_street uuid;
  rivera_family uuid;
  empty_house uuid;
  this_week uuid;
  weekend_cookout uuid;
  party_supplies uuid;
  rivera_list uuid;
  deal_ext text;
  deal_end date;
begin
  select id into alex from public.profile where email = 'alex@example.com';
  select id into sam from public.profile where email = 'sam@example.com';
  select id into jordan from public.profile where email = 'jordan@example.com';
  select id into morgan from public.profile where email = 'morgan@example.com';
  select id into casey from public.profile where email = 'casey@example.com';
  -- A database with anyone else in it is not a development database. Seeding it would give real
  -- households neighbours whose password is published in the repository.
  if exists (
    select 1 from auth.users
    where email is null or email not in (
      'alex@example.com', 'sam@example.com', 'jordan@example.com', 'morgan@example.com',
      'casey@example.com'
    )
  ) then
    raise exception 'refusing to seed: this database has users other than the seed users';
  end if;
  if alex is null or sam is null or jordan is null or morgan is null or casey is null then
    raise exception 'seed users are missing: run supabase/seed/seed-users.ts first';
  end if;
  if exists (select 1 from public.household_member where user_id = alex) then
    raise exception 'already seeded: run `supabase db reset` before seeding again';
  end if;

  -- -------------------------------------------------------------------------------------------
  -- Households, members, and active households (Seed Data, "Households")
  -- -------------------------------------------------------------------------------------------

  insert into public.household (name, postal_code, timezone, last_active_at, created_by,
    created_at)
  values ('Oak Street', '27514', 'America/New_York', now(), alex, now() - interval '240 days')
  returning id into oak_street;

  insert into public.household (name, postal_code, timezone, last_active_at, created_by,
    created_at)
  values ('Rivera Family', '27601', 'America/New_York', now(), alex, now() - interval '120 days')
  returning id into rivera_family;

  -- Empty House is also the dormant-postal-code fixture: inactive for 20 days, and no
  -- postal_code_refresh or deal rows for 27705.
  insert into public.household (name, postal_code, timezone, last_active_at, created_by,
    created_at)
  values ('Empty House', '27705', 'America/Los_Angeles', now() - interval '20 days', casey,
    now() - interval '60 days')
  returning id into empty_house;

  -- Casey was an Oak Street member who left 5 weeks ago, so there is no membership row; the
  -- records Casey left behind (a chore completion) are seeded with the chores.
  insert into public.household_member (household_id, user_id, role, joined_at) values
    (oak_street, alex, 'admin', now() - interval '240 days'),
    (oak_street, sam, 'member', now() - interval '230 days'),
    (oak_street, jordan, 'member', now() - interval '200 days'),
    (rivera_family, alex, 'admin', now() - interval '120 days'),
    (rivera_family, morgan, 'member', now() - interval '110 days'),
    (empty_house, casey, 'admin', now() - interval '60 days');

  update public.profile set active_household_id = oak_street where id in (alex, sam, jordan);
  update public.profile set active_household_id = rivera_family where id = morgan;
  update public.profile set active_household_id = empty_house where id = casey;

  -- -------------------------------------------------------------------------------------------
  -- Favorite stores (Seed Data, "Stores"), by Flipp's stable merchant ids
  -- -------------------------------------------------------------------------------------------

  insert into public.household_favorite_store (household_id, merchant_id, merchant_name) values
    (oak_street, '2431', 'Harris Teeter'),
    (oak_street, '2100', 'Food Lion'),
    (oak_street, '2264', 'CVS Pharmacy'),
    (rivera_family, '2361', 'Publix'),
    (rivera_family, '2175', 'Walmart'),
    (empty_house, '2431', 'Harris Teeter'),
    (empty_house, '2100', 'Food Lion');

  -- -------------------------------------------------------------------------------------------
  -- Notification settings (Seed Data, "Households")
  -- -------------------------------------------------------------------------------------------

  update public.profile set household_bill_reminders = true where id = jordan;
  update public.profile set quiet_hours_start = '22:00', quiet_hours_end = '07:00'
  where id = sam;
  insert into public.notification_preference (user_id, notification_type, household_id, enabled)
  values (alex, 'weekly_meal_nudge', oak_street, true);

  -- -------------------------------------------------------------------------------------------
  -- Invites (Seed Data, "Edge-case fixtures"). Only SHA-256 hashes are stored, as the service
  -- stores them. The outstanding invite's link token is the one seed-users.ts prints.
  -- -------------------------------------------------------------------------------------------

  insert into public.household_invite (household_id, token_hash, code_hash, created_by,
    created_at, expires_at, revoked_at)
  values
    -- Outstanding, created 2 days ago.
    (oak_street,
      public.sha256_hex(pg_catalog.current_setting('hearth.seed_invite_token')),
      public.sha256_hex('K7M2Q9XA'), alex,
      now() - interval '2 days', now() - interval '2 days' + interval '168 hours', null),
    -- Expired: created 9 days ago, so it lapsed 2 days ago.
    (oak_street,
      public.sha256_hex(pg_catalog.encode(extensions.gen_random_bytes(32), 'hex')),
      public.sha256_hex('EXP9RD2Z'), alex,
      now() - interval '9 days', now() - interval '9 days' + interval '168 hours', null),
    -- Revoked the day after it was created.
    (oak_street,
      public.sha256_hex(pg_catalog.encode(extensions.gen_random_bytes(32), 'hex')),
      public.sha256_hex('RVK4D3NM'), alex,
      now() - interval '4 days', now() - interval '4 days' + interval '168 hours',
      now() - interval '3 days');

  -- -------------------------------------------------------------------------------------------
  -- Deals and postal code refreshes: Phase 2 (Seed Data, "Deal fixtures")
  -- -------------------------------------------------------------------------------------------

  -- -------------------------------------------------------------------------------------------
  -- Pantry (Seed Data, "Pantry"): twenty staples for Oak Street. `normalized_name` is what the
  -- matcher stores, so eggs, bread, and pasta match deals and exercise pantry-beats-sale.
  -- -------------------------------------------------------------------------------------------

  insert into public.pantry_item (household_id, item_name, normalized_name, quantity_note,
    last_updated) values
    (oak_street, 'Olive oil', 'olive oil', null, now() - interval '18 days'),
    (oak_street, 'Salt', 'salt', null, now() - interval '40 days'),
    (oak_street, 'Black pepper', 'black pepper', null, now() - interval '40 days'),
    (oak_street, 'Garlic', 'garlic', null, now() - interval '6 days'),
    (oak_street, 'Rice', 'rice', 'about 2 lb', now() - interval '12 days'),
    (oak_street, 'Flour', 'flour', null, now() - interval '25 days'),
    (oak_street, 'Sugar', 'sugar', null, now() - interval '25 days'),
    (oak_street, 'Butter', 'butter', '1 stick left', now() - interval '4 days'),
    (oak_street, 'Milk', 'milk', 'half gallon', now() - interval '2 days'),
    (oak_street, 'Bread', 'bread', null, now() - interval '3 days'),
    (oak_street, 'Soy sauce', 'soy sauce', null, now() - interval '30 days'),
    (oak_street, 'Cumin', 'cumin', null, now() - interval '45 days'),
    (oak_street, 'Paprika', 'paprika', null, now() - interval '45 days'),
    (oak_street, 'Canned tomatoes', 'canned tomato', '3 cans', now() - interval '9 days'),
    (oak_street, 'Black beans', 'black bean', '2 cans', now() - interval '9 days'),
    (oak_street, 'Chicken broth', 'chicken broth', null, now() - interval '14 days'),
    (oak_street, 'Parmesan', 'parmesan', null, now() - interval '7 days'),
    (oak_street, 'Eggs', 'egg', null, now() - interval '2 days'),
    (oak_street, 'Yellow onions', 'yellow onion', null, now() - interval '5 days'),
    (oak_street, 'Pasta', 'pasta', null, now() - interval '20 days');

  -- -------------------------------------------------------------------------------------------
  -- Shopping lists (Seed Data, "Shopping lists"). The two Oak Street lists are created by Sam
  -- and by Jordan, because the departure preview reassigns the lists a member created.
  --
  -- Deal-sourced items carry a snapshot, not a reference: the prices below are Seed Data's, so
  -- the lists seed identically whether or not the deal rows exist yet. Where a deal row is
  -- there, the item borrows its `external_id` and `valid_to`; where it is not, the link is null
  -- and the validity falls back to the same flyer week.
  --
  -- The three expired items are seeded in the state they were added in, still at last week's
  -- sale price. Repricing runs whenever the list is fetched, which is what turns them into the
  -- three outcomes Seed Data documents — a re-match, a fall back to the regular price, and a
  -- cleared price — rather than the seed asserting them by hand. Two of the three need nothing
  -- else. The broccoli re-matches this week's Food Lion deal only once the deal fixtures above
  -- are seeded; with the `deal` table still empty it has no regular price to fall back to, so
  -- its price clears too and Food Lion subtotals $14.28 with two unpriced rather than Seed
  -- Data's $18.26 with one. Harris Teeter's $7.00, CVS Pharmacy's $10.78, and Anywhere's $0.00
  -- with three unpriced hold either way.
  -- -------------------------------------------------------------------------------------------

  insert into public.shopping_list (household_id, name, created_by, created_at)
  values (oak_street, 'This Week', sam, now() - interval '3 days')
  returning id into this_week;

  insert into public.shopping_list (household_id, name, created_by, created_at)
  values (oak_street, 'Weekend Cookout', jordan, now() - interval '5 days')
  returning id into weekend_cookout;

  insert into public.shopping_list (household_id, name, created_by, created_at, archived_at)
  values (oak_street, 'Party Supplies', alex, now() - interval '40 days',
    now() - interval '30 days')
  returning id into party_supplies;

  insert into public.shopping_list (household_id, name, created_by, created_at)
  values (rivera_family, 'Groceries', morgan, now() - interval '2 days')
  returning id into rivera_list;

  -- Food Lion, from last week's expired broccoli deal: re-matches this week's broccoli deal.
  select d.external_id, d.valid_to into deal_ext, deal_end from public.deal d
  where d.postal_code = '27514' and d.merchant_id = '2100'
    and d.normalized_name = 'broccoli' and d.valid_to < current_date
  order by d.external_id limit 1;
  insert into public.shopping_list_item (list_id, item_name, normalized_name, quantity, status,
    added_by, source, merchant_id, merchant_name, deal_external_id, sale_price, deal_valid_to,
    price_unit, conditional_price, price, created_at)
  values (this_week, 'Broccoli', 'broccoli', 2, 'needed', sam, 'from_deal', '2100', 'Food Lion',
    deal_ext, 1.49, coalesce(deal_end, current_date - 1), 'lb', true, 1.49,
    now() - interval '3 days');

  select d.external_id, d.valid_to into deal_ext, deal_end from public.deal d
  where d.postal_code = '27514' and d.merchant_id = '2100'
    and d.normalized_name = 'chunk or cheese' and d.valid_to >= current_date
  order by d.external_id limit 1;
  insert into public.shopping_list_item (list_id, item_name, normalized_name, quantity, status,
    added_by, source, merchant_id, merchant_name, deal_external_id, sale_price, deal_valid_to,
    price_unit, conditional_price, price, created_at)
  values (this_week, 'Shredded cheese', 'chunk or cheese', 2, 'bought', sam, 'from_deal', '2100',
    'Food Lion', deal_ext, 3.49, coalesce(deal_end, current_date + 5), 'each', true, 3.49,
    now() - interval '3 days' + interval '2 minutes');

  select d.external_id, d.valid_to into deal_ext, deal_end from public.deal d
  where d.postal_code = '27514' and d.merchant_id = '2100'
    and d.normalized_name = 'lean ground beef' and d.valid_to >= current_date
  order by d.external_id limit 1;
  insert into public.shopping_list_item (list_id, item_name, normalized_name, quantity, status,
    added_by, source, merchant_id, merchant_name, deal_external_id, sale_price, deal_valid_to,
    price_unit, conditional_price, price, created_at)
  values (this_week, 'Ground beef', 'lean ground beef', 1, 'in_cart', jordan, 'from_deal', '2100',
    'Food Lion', deal_ext, 7.29, coalesce(deal_end, current_date + 5), 'lb', true, 7.29,
    now() - interval '3 days' + interval '4 minutes');

  -- Food Lion bacon, expired with a known regular price: reprices to the regular price.
  select d.external_id, d.valid_to into deal_ext, deal_end from public.deal d
  where d.postal_code = '27514' and d.merchant_id = '2100'
    and d.normalized_name = 'oscar mayer bacon' and d.valid_to < current_date
  order by d.external_id limit 1;
  insert into public.shopping_list_item (list_id, item_name, normalized_name, quantity, status,
    added_by, source, merchant_id, merchant_name, deal_external_id, sale_price, regular_price,
    deal_valid_to, price_unit, conditional_price, price, created_at)
  values (this_week, 'Oscar Mayer Sliced Bacon', 'oscar mayer bacon', 1, 'needed', alex,
    'from_deal', '2100', 'Food Lion', deal_ext, 5.99, 6.99,
    coalesce(deal_end, current_date - 1), 'each', true, 5.99,
    now() - interval '3 days' + interval '6 minutes');

  select d.external_id, d.valid_to into deal_ext, deal_end from public.deal d
  where d.postal_code = '27514' and d.merchant_id = '2431'
    and d.normalized_name = 'artesano bakery bread' and d.valid_to >= current_date
  order by d.external_id limit 1;
  insert into public.shopping_list_item (list_id, item_name, normalized_name, quantity, status,
    added_by, source, merchant_id, merchant_name, deal_external_id, sale_price, deal_valid_to,
    price_unit, conditional_price, price, created_at)
  values (this_week, 'Artesano Bakery Bread', 'artesano bakery bread', 2, 'needed', sam,
    'from_deal', '2431', 'Harris Teeter', deal_ext, 3.50,
    coalesce(deal_end, current_date + 5), 'each', true, 3.50,
    now() - interval '3 days' + interval '8 minutes');

  select d.external_id, d.valid_to into deal_ext, deal_end from public.deal d
  where d.postal_code = '27514' and d.merchant_id = '2264' and d.valid_to >= current_date
    and d.normalized_name =
      'colgate optic white advanced charcoal purple sensitive or stain fighter'
  order by d.external_id limit 1;
  insert into public.shopping_list_item (list_id, item_name, normalized_name, quantity, status,
    added_by, source, merchant_id, merchant_name, deal_external_id, sale_price, regular_price,
    deal_valid_to, price_unit, conditional_price, price, created_at)
  values (this_week, 'Colgate Optic White',
    'colgate optic white advanced charcoal purple sensitive or stain fighter', 1, 'needed', alex,
    'from_deal', '2264', 'CVS Pharmacy', deal_ext, 4.79, 9.79,
    coalesce(deal_end, current_date + 5), 'each', true, 4.79,
    now() - interval '3 days' + interval '10 minutes');

  -- CVS shampoo, expired with no regular price: its price is cleared, never guessed.
  select d.external_id, d.valid_to into deal_ext, deal_end from public.deal d
  where d.postal_code = '27514' and d.merchant_id = '2264'
    and d.normalized_name = 'garnier fructis shampoo conditioner' and d.valid_to < current_date
  order by d.external_id limit 1;
  insert into public.shopping_list_item (list_id, item_name, normalized_name, quantity, status,
    added_by, source, merchant_id, merchant_name, deal_external_id, sale_price, deal_valid_to,
    price_unit, price, created_at)
  values (this_week, 'GARNIER Fructis shampoo', 'garnier fructis shampoo conditioner', 1,
    'needed', sam, 'from_deal', '2264', 'CVS Pharmacy', deal_ext, 4.49,
    coalesce(deal_end, current_date - 1), 'each', 4.49,
    now() - interval '3 days' + interval '12 minutes');

  -- Manual items: a store may be assigned or left off, and a price may be typed in.
  -- Recipe-sourced items keep their aggregated quantities; Phase 3 fills in
  -- `contributing_recipe_ids` when it seeds the recipes that contributed them.
  insert into public.shopping_list_item (list_id, item_name, normalized_name, quantity,
    quantity_note, status, added_by, source, merchant_id, merchant_name, price_unit, price,
    created_at) values
    (this_week, 'Apples', 'apple', null, '3 lb', 'needed', jordan, 'manual', '2100', 'Food Lion',
      'each', null, now() - interval '3 days' + interval '14 minutes'),
    (this_week, 'Trash bags', 'trash', 1, null, 'needed', alex, 'manual', '2431',
      'Harris Teeter', 'each', null, now() - interval '3 days' + interval '16 minutes'),
    (this_week, 'Paper towels', 'paper towel', 1, null, 'needed', alex, 'manual', '2264',
      'CVS Pharmacy', 'each', 5.99, now() - interval '3 days' + interval '18 minutes'),
    -- Two recipes contributed one red onion each, in matching units, so the quantities summed.
    (this_week, 'Red onion', 'red onion', 2, null, 'needed', alex, 'from_recipe', null, null,
      'each', null, now() - interval '2 days'),
    -- Mismatched units merge into one item that keeps both, with no conversion attempted.
    (this_week, 'Salsa', 'salsa', null, '1 cup + 16 oz', 'needed', alex, 'from_recipe', null,
      null, 'each', null, now() - interval '2 days' + interval '2 minutes'),
    (this_week, 'Celery', 'celery', 1, null, 'needed', alex, 'from_recipe', null, null, 'each',
      null, now() - interval '2 days' + interval '4 minutes'),
    (this_week, 'Lemon', 'lemon', 1, null, 'bought', alex, 'from_recipe', null, null, 'each',
      null, now() - interval '2 days' + interval '6 minutes'),
    (this_week, 'Dish soap', 'dish soap', 1, null, 'bought', sam, 'manual', null, null, 'each',
      null, now() - interval '2 days' + interval '8 minutes');

  -- All bought, for the all-bought summary and "Add bought items to pantry".
  insert into public.shopping_list_item (list_id, item_name, normalized_name, quantity, status,
    added_by, source, created_at) values
    (weekend_cookout, 'Hot dogs', 'hot dog', 2, 'bought', jordan, 'manual',
      now() - interval '5 days'),
    (weekend_cookout, 'Buns', 'bun', 2, 'bought', jordan, 'manual',
      now() - interval '5 days' + interval '2 minutes'),
    (weekend_cookout, 'Charcoal', 'charcoal', 1, 'bought', sam, 'manual',
      now() - interval '5 days' + interval '4 minutes'),
    (weekend_cookout, 'Ketchup', 'ketchup', 1, 'bought', sam, 'manual',
      now() - interval '5 days' + interval '6 minutes');

  -- The archived list, read-only in the app and kept for its history.
  insert into public.shopping_list_item (list_id, item_name, normalized_name, quantity, status,
    added_by, source, created_at) values
    (party_supplies, 'Paper plates', 'paper plate', 2, 'bought', alex, 'manual',
      now() - interval '40 days'),
    (party_supplies, 'Napkins', 'napkin', 1, 'bought', alex, 'manual',
      now() - interval '40 days' + interval '2 minutes'),
    (party_supplies, 'Plastic cups', 'plastic cup', 2, 'bought', alex, 'manual',
      now() - interval '40 days' + interval '4 minutes'),
    (party_supplies, 'Birthday candles', 'birthday candle', 1, 'bought', jordan, 'manual',
      now() - interval '40 days' + interval '6 minutes'),
    (party_supplies, 'Balloons', 'balloon', 1, 'bought', jordan, 'manual',
      now() - interval '40 days' + interval '8 minutes'),
    (party_supplies, 'Ice', 'ice', 2, 'bought', sam, 'manual',
      now() - interval '40 days' + interval '10 minutes'),
    (party_supplies, 'Tortilla chips', 'tortilla chip', 3, 'bought', sam, 'manual',
      now() - interval '40 days' + interval '12 minutes'),
    (party_supplies, 'Lemonade', 'lemonade', 2, 'bought', casey, 'manual',
      now() - interval '40 days' + interval '14 minutes');

  -- Rivera Family's list stays empty, for the empty-list state; rivera_list is read by no
  -- other row here, and is kept so the insert above reads like its neighbours.

  -- -------------------------------------------------------------------------------------------
  -- Recipes, readiness, match overrides, and meal plan: Phase 3 (Seed Data, "Recipes")
  -- -------------------------------------------------------------------------------------------

  -- -------------------------------------------------------------------------------------------
  -- Bills and payment history: Phase 4 (Seed Data, "Bills")
  -- -------------------------------------------------------------------------------------------

  -- -------------------------------------------------------------------------------------------
  -- Chores, completions (including Casey's), and errands: Phase 4 (Seed Data, "Chores",
  -- "Errands")
  -- -------------------------------------------------------------------------------------------

  -- -------------------------------------------------------------------------------------------
  -- App errors, for System health (Seed Data, "App errors"). The fingerprint is the SHA-256 of
  -- source, error name, and route or job, newline-separated (Technical Architecture, "Error
  -- recording").
  -- -------------------------------------------------------------------------------------------

  insert into public.app_error (fingerprint, message, count, first_seen, last_seen) values
    (public.sha256_hex(e'service\nFlippFetchError\nrefresh-deals'),
      'FlippFetchError: 503 from flyers endpoint', 14,
      now() - interval '3 days', now() - interval '2 hours'),
    (public.sha256_hex(e'web\nTypeError\n/lists/:id'),
      'TypeError: Cannot read properties of undefined (reading ''merchantName'')', 3,
      now() - interval '1 day', now() - interval '5 hours'),
    (public.sha256_hex(e'service\nRecipeParseError\nPOST /api/households/:id/recipes/parse'),
      'RecipeParseError: no JSON-LD found', 1,
      now() - interval '30 days', now() - interval '30 days');
end
$$;

commit;
