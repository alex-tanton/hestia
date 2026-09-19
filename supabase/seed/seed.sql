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
  -- Shopping lists and pantry: Phase 2 (Seed Data, "Shopping lists", "Pantry")
  -- -------------------------------------------------------------------------------------------

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
