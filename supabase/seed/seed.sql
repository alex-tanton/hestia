-- Development seed data. Run by `pnpm db:seed` after seed-users.ts has created the
-- five users through GoTrue; it is not a migration and never runs in production.
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -v invite_token=<token> -f supabase/seed/seed.sql
--
-- Dates are relative to the seed run. It runs once per database: reset first (`supabase db reset`)
-- to seed again. Pillar data (deals, lists, pantry, recipes, meal plan, bills, chores, errands)
-- is added by the phase that builds each pillar, in the marked sections below.

select pg_catalog.set_config('hearth.seed_invite_token', :'invite_token', false);

begin;

-- Session-local helper for the bills section below: the same clamped-month-add
-- `packages/recurrence` uses: monthly and yearly
-- anchors past the 28th clamp to the last day of shorter months, and each occurrence is
-- computed from the anchor, never from the previous clamped date. Postgres's own
-- `date + interval 'N months'` does not clamp — it overflows into the following month when the
-- day does not exist there (Jan 31 + 1 month lands on Mar 3, not Feb 28) — so computing seeded
-- bill occurrences with plain interval arithmetic would quietly disagree with how the service
-- itself derives them whenever the seed happens to run on the 29th through 31st. This mirrors
-- `addClampedMonths` exactly: the target month is the base month plus the offset, and the day is
-- the base's own day-of-month, clamped to that target month's last day.
create function pg_temp.clamped_month_add(base date, months int) returns date
language sql immutable as $$
  select (date_trunc('month', base) + make_interval(months => months))::date
    + (least(
         extract(day from base)::int,
         extract(day from (
           date_trunc('month', base) + make_interval(months => months + 1) - interval '1 day'
         ))::int
       ) - 1)
$$;

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
  recipe_id uuid;
  deal_ext text;
  deal_end date;
  trash_chore uuid;
  bathroom_chore uuid;
  vacuum_chore uuid;
  water_chore uuid;
  -- Deal validity is a calendar date in the store's own local offset, and every 27514 household
  -- is in America/New_York. Using the server's `current_date` instead would put "yesterday" on
  -- today's date for a seed run made in the evening Eastern time, and the three expired deals
  -- would not be expired in the timezone that owns them.
  local_today date := (pg_catalog.now() at time zone 'America/New_York')::date;
  -- The current week's Sunday in the same timezone, the same "current week" the week planner's
  -- own default computes.
  this_sunday date := local_today - extract(dow from local_today)::int;
  -- Bills: each bill's own current occurrence ("C" below), from which
  -- its anchor_date is derived. Every household bill here is in Oak Street, whose timezone is the
  -- same America/New_York every owner's profile uses too, so local_today owns every one of these.
  rent_c date;
  rent_anchor date;
  rent_id uuid;
  duke_c date;
  duke_anchor date;
  duke_id uuid;
  spectrum_c date;
  spectrum_anchor date;
  spectrum_id uuid;
  water_c date;
  water_anchor date;
  water_id uuid;
  renters_anchor date;
  renters_id uuid;
  spotify_c date;
  spotify_anchor date;
  spotify_id uuid;
  adobe_c date;
  adobe_anchor date;
  adobe_id uuid;
  gym_c date;
  gym_anchor date;
  gym_id uuid;
  old_phone_anchor date;
  old_phone_id uuid;
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
  -- Households, members, and active households
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
  -- Favorite stores, by Flipp's stable merchant ids
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
  -- Notification settings
  -- -------------------------------------------------------------------------------------------

  update public.profile set household_bill_reminders = true where id = jordan;
  update public.profile set quiet_hours_start = '22:00', quiet_hours_end = '07:00'
  where id = sam;
  insert into public.notification_preference (user_id, notification_type, household_id, enabled)
  values (alex, 'weekly_meal_nudge', oak_street, true);

  -- -------------------------------------------------------------------------------------------
  -- Invites. Only SHA-256 hashes are stored, as the service
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
  -- Deals and postal code refreshes
  --
  -- Every current row is a real 27514 item, quoted from the committed normalized fixtures in
  -- `e2e/fixtures/flipp/normalized/`, down to its `external_id`, `flyer_id`, and `display_price`.
  -- Money is `numeric(10, 2)` here and integer cents everywhere above it. `normalized_name` is
  -- what `@hearth/matching` produces from the raw name, because that is the key repricing and
  -- readiness match on.
  --
  -- Validity is relative to the seed run, not the capture: the current rows span this week and
  -- the three expired ones ended yesterday, so the data never goes stale. The expired rows are
  -- last week's flyers, which no capture holds, so their ids are the one invented part.
  -- -------------------------------------------------------------------------------------------

  insert into public.deal (external_id, merchant_id, merchant_name, name, normalized_name,
    unit_price, price_unit, original_price, discount_percent, display_price, conditional_price,
    conditional_reason, category, image_url, source_url, flyer_id, postal_code, valid_from,
    valid_to, fetched_at) values
    -- Clean prices: a shelf price with nothing attached to it.
    ('1038943471', '2431', 'Harris Teeter',
      'Harris Teeter Peanut Butter Chocolate Puffs Cereal', 'peanut butter chocolate puff cereal',
      3.19, 'each', null, null, '$3.19 each', false, null, 'Food Items',
      'https://f.wishabi.net/page_items/433190342/1788758837/extra_large.jpg', null, '8125654',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1040207155', '2431', 'Harris Teeter', 'Woodbridge Cabernet or Chardonnay',
      'woodbridge cabernet or chardonnay', 7.19, 'each', 8.99, 20, '$7.19', false, null,
      'Beverages', 'https://f.wishabi.net/page_items/433697067/1789221953/extra_large.jpg', null,
      '8132883', '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1039540717', '2100', 'Food Lion', 'Sargento Balanced Breaks', 'sargento balanced break',
      3.49, 'each', 3.99, 12, '$3.49', false, null, 'Food Items',
      'https://f.wishabi.net/page_items/433395659/1788948259/extra_large.jpg', null, '8128502',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1039937866', '2469', 'Lowes Foods', 'JUMBO YELLOW ONIONS', 'jumbo yellow onion',
      1.49, 'lb', null, null, '$1.49 PER LB', false, null, 'Food Items',
      'https://f.wishabi.net/page_items/433638854/1789120573/extra_large.jpg', null, '8132169',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1039937947', '2469', 'Lowes Foods', 'HASS AVOCADOS', 'hass avocado',
      1.79, 'each', null, null, '$1.79 EACH', false, null, 'Food Items',
      'https://f.wishabi.net/page_items/433638867/1789120585/extra_large.jpg', null, '8132169',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),

    -- Multi-buy: parsed by division, with `display_price` keeping the original copy. "3/$5.00" is
    -- the half-up rounding case (500 / 3 = 167 cents, 596 / 3 = 199).
    ('1040206850', '2431', 'Harris Teeter', 'Egg-Land''s Best Extra Large Eggs',
      'egg land s best egg', 2.50, 'each', null, null, '2/$5.00', true, 'loyalty_card',
      'Food Items', 'https://f.wishabi.net/page_items/433696191/1789219830/extra_large.jpg', null,
      '8132883', '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1040207255', '2431', 'Harris Teeter', 'Farmers Market Cucumbers', 'farmer market cucumber',
      1.00, 'each', null, null, '5/$5.00', true, 'loyalty_card', 'Food Items',
      'https://f.wishabi.net/page_items/433697090/1789219832/extra_large.jpg', null, '8132883',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1039534632', '2100', 'Food Lion', 'Food Lion Mini Potatoes', 'mini potato',
      2.50, 'each', null, null, 'MVP 2/$5.00', true, 'loyalty_card', 'Food Items',
      'https://f.wishabi.net/page_items/433393877/1788948217/extra_large.jpg', null, '8128502',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1040206686', '2431', 'Harris Teeter', 'Harris Teeter 100% Pure Pumpkin', 'pure pumpkin',
      1.67, 'each', 1.99, 16, '3/$5.00', true, 'loyalty_card', 'Food Items',
      'https://f.wishabi.net/page_items/433696179/1789219816/extra_large.jpg', null, '8132883',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1039937762', '2469', 'Lowes Foods', 'Stouffer''s Entrees', 'stouffer s entree',
      2.00, 'each', 3.00, 33, 'FINAL PRICE 2/$4.00', true, 'coupon', 'Food Items',
      'https://f.wishabi.net/page_items/433638770/1789120562/extra_large.jpg', null, '8132169',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),

    -- BOGO with a base price: half of it, rounded half-up, at the 50% the offer states.
    ('1039947403', '2361', 'Publix', 'Mifroma Le Gruyère AOP Cheese† BOGO*',
      'mifroma le gruyère aop cheese bogo', 4.75, 'each', 9.49, 50, 'Buy 1 Get 1 FREE* $9.49',
      false, null, 'Food Items',
      'https://f.wishabi.net/page_items/433383502/1789120410/extra_large.jpg', null, '8128353',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),

    -- Conditional prices, which the UI badges. The Colgate row is also the secondary-rebate case:
    -- its sale story offers ExtraBucks on top, and the card still wins, because the card is what
    -- the $4.79 shelf price requires.
    ('1040206076', '2431', 'Harris Teeter', 'Harris Teeter Snack Cheese', 'snack cheese',
      3.00, 'each', null, null, '2/$6.00', true, 'loyalty_card', 'Food Items',
      'https://f.wishabi.net/page_items/433696117/1789219821/extra_large.jpg', null, '8132883',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1039937779', '2469', 'Lowes Foods', 'Fa!rlife Milk', 'fa rlife milk',
      3.99, 'each', 4.99, 20, 'FINAL PRICE $3.99', true, 'coupon', 'Beverages',
      'https://f.wishabi.net/page_items/433638776/1789120568/extra_large.jpg', null, '8132169',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1038126719', '2264', 'CVS Pharmacy',
      'Colgate Optic White Advanced 3.2 oz, Charcoal, Purple, Sensitive 3.8-4.2 oz, Total 3 oz or hello adult toothpaste.',
      'colgate optic white advanced charcoal purple sensitive total or hello adult toothpaste',
      4.79, 'each', null, null, '$4.79 WITH CARD', true, 'loyalty_card', 'Personal Care',
      'https://f.wishabi.net/page_items/432762238/1788338899/extra_large.jpg', null, '8120827',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),

    -- Favorite-store groceries, which the readiness scores are computed against. Bone-In Pork
    -- Chops is the OCR case: its post-price text reads "per Ib", and it still prices per pound.
    -- It is also the one unconditional grocery row, so the screens have an unbadged deal.
    ('1039535334', '2100', 'Food Lion', 'Broccoli Crowns', 'broccoli',
      1.99, 'lb', null, null, 'MVP $1.99 LB', true, 'loyalty_card', 'Food Items',
      'https://f.wishabi.net/page_items/433393873/1788948214/extra_large.jpg', null, '8128502',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1039542198', '2100', 'Food Lion', 'Food Lion Rainbow Bell Peppers', 'rainbow bell pepper',
      2.99, 'each', null, null, 'MVP $2.99 EA', true, 'loyalty_card', 'Food Items',
      'https://f.wishabi.net/page_items/433457738/1788948233/extra_large.jpg', null, '8128502',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1039534752', '2100', 'Food Lion', 'Food Lion Baby Cut Carrots', 'baby cut carrot',
      0.99, 'each', null, null, 'MVP $0.99 EA', true, 'loyalty_card', 'Food Items',
      'https://f.wishabi.net/page_items/433393874/1788948215/extra_large.jpg', null, '8128502',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1039534387', '2100', 'Food Lion', 'Food Lion Mini Cucumbers', 'mini cucumber',
      2.49, 'each', null, null, 'MVP $2.49 EA', true, 'loyalty_card', 'Food Items',
      'https://f.wishabi.net/page_items/433393870/1788948212/extra_large.jpg', null, '8128502',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1039534825', '2100', 'Food Lion', 'Nature''s Promise Organic Potatoes',
      'nature s promise potato', 3.99, 'each', null, null, 'MVP $3.99 EA', true, 'loyalty_card',
      'Food Items', 'https://f.wishabi.net/page_items/433393878/1788948218/extra_large.jpg', null,
      '8128502', '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1039530648', '2100', 'Food Lion', 'Food Lion Pasta', 'pasta',
      0.99, 'each', null, null, 'MVP $0.99 EA', true, 'loyalty_card', 'Food Items',
      'https://f.wishabi.net/page_items/433393310/1788948217/extra_large.jpg', null, '8128502',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1039540409', '2100', 'Food Lion', 'Food Lion Chunk or Shredded Cheese', 'chunk or cheese',
      3.49, 'each', null, null, 'MVP $3.49 EA', true, 'loyalty_card', 'Food Items',
      'https://f.wishabi.net/page_items/433395662/1788948261/extra_large.jpg', null, '8128502',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1039535162', '2100', 'Food Lion', 'Nature''s Promise Jumbo Chicken Breast',
      'nature s promise jumbo chicken breast', 3.49, 'lb', null, null, 'MVP $3.49 LB', true,
      'loyalty_card', 'Food Items',
      'https://f.wishabi.net/page_items/433395195/1788948253/extra_large.jpg', null, '8128502',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1039535590', '2100', 'Food Lion', '93% Lean Fresh Ground Beef', 'lean ground beef',
      7.29, 'lb', null, null, 'MVP $7.29 LB', true, 'loyalty_card', 'Food Items',
      'https://f.wishabi.net/page_items/433395201/1788948258/extra_large.jpg', null, '8128502',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1039534923', '2100', 'Food Lion', 'Beef Chuck Roast', 'beef chuck roast',
      7.99, 'lb', null, null, 'MVP $7.99 LB', true, 'loyalty_card', 'Food Items',
      'https://f.wishabi.net/page_items/433395200/1788948257/extra_large.jpg', null, '8128502',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1040206685', '2431', 'Harris Teeter', 'Bone-In Pork Chops', 'bone in pork chop',
      3.49, 'lb', null, null, '$3.49 per Ib', false, null, 'Food Items',
      'https://f.wishabi.net/page_items/433696710/1789221951/extra_large.jpg', null, '8132883',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),
    ('1040206901', '2431', 'Harris Teeter', 'Artesano Bakery Bread', 'artesano bakery bread',
      3.50, 'each', null, null, '2/$7.00', true, 'loyalty_card', 'Food Items',
      'https://f.wishabi.net/page_items/433696196/1789219836/extra_large.jpg', null, '8132883',
      '27514', local_today - 2, local_today + 4, now() - interval '6 hours'),

    -- Expired: last week's flyers, ended yesterday, attached to the items
    -- on the "This Week" list that exercise the three repricing outcomes — a re-match to this
    -- week's broccoli deal, a fall back to a known regular price, and a cleared price.
    ('1038221844', '2100', 'Food Lion', 'Broccoli Crowns', 'broccoli',
      1.49, 'lb', null, null, 'MVP $1.49 LB', true, 'loyalty_card', 'Food Items',
      'https://f.wishabi.net/page_items/433393873/1788948214/extra_large.jpg', null, '8121874',
      '27514', local_today - 9, local_today - 1, now() - interval '8 days'),
    ('1038221907', '2100', 'Food Lion', 'Oscar Mayer Sliced Bacon', 'oscar mayer bacon',
      5.99, 'each', 6.99, 14, 'MVP $5.99 EA', true, 'loyalty_card', 'Food Items', null, null,
      '8121874', '27514', local_today - 9, local_today - 1, now() - interval '8 days'),
    ('1037905512', '2264', 'CVS Pharmacy', 'GARNIER Fructis shampoo/conditioner',
      'garnier fructis shampoo conditioner', 4.49, 'each', null, null, '$4.49 WITH CARD', true,
      'loyalty_card', 'Personal Care', null, null, '8114312', '27514',
      local_today - 9, local_today - 1, now() - interval '8 days');

  -- Refresh bookkeeping. 27514 and 27601 were covered by this morning's run; 27705 has no row at
  -- all, which is the dormant fixture: opening Empty House's flyers shows the "no cache,
  -- refreshing" state and queues one on-demand refresh for the UTC day.
  insert into public.postal_code_refresh (postal_code, last_refreshed_at, last_on_demand_at)
  values
    ('27514', now() - interval '6 hours', null),
    ('27601', now() - interval '6 hours', null);

  -- Search cache. "saffron" is the filtered-empty state.
  -- "chicken" is cached 7 hours ago, past the 6-hour TTL, so it re-fetches; when that fetch
  -- fails, this row is what the stale "as of" state renders.
  insert into public.deal_query_cache (postal_code, normalized_query, deal_ids, cached_at) values
    ('27514', 'saffron', '{}', now() - interval '1 hour'),
    ('27514', 'chicken',
      array(
        select d.id from public.deal d
        where d.postal_code = '27514'
          and d.normalized_name in ('nature s promise jumbo chicken breast', 'lean ground beef',
            'beef chuck roast')
        order by d.unit_price
      ),
      now() - interval '7 hours');

  -- -------------------------------------------------------------------------------------------
  -- Pantry: twenty staples for Oak Street. `normalized_name` is what the
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
  -- Shopping lists. The two Oak Street lists are created by Sam
  -- and by Jordan, because the departure preview reassigns the lists a member created.
  --
  -- Deal-sourced items carry a snapshot, not a reference: the prices below are the seed data's, so
  -- the lists seed identically whether or not the deal rows exist yet. Where a deal row is
  -- there, the item borrows its `external_id` and `valid_to`; where it is not, the link is null
  -- and the validity falls back to the same flyer week.
  --
  -- The three expired items are seeded in the state they were added in, still at last week's
  -- sale price. Repricing runs whenever the list is fetched, which is what turns them into the
  -- three outcomes — a re-match to this week's broccoli deal at $1.99/lb, a
  -- fall back to the bacon's $6.99 regular price, and a cleared price for the shampoo — rather
  -- than the seed asserting them by hand. Food Lion then subtotals $18.26 with one unpriced,
  -- Harris Teeter $7.00, CVS Pharmacy $10.78, and Anywhere $0.00 with three unpriced.
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
      'colgate optic white advanced charcoal purple sensitive total or hello adult toothpaste'
  order by d.external_id limit 1;
  insert into public.shopping_list_item (list_id, item_name, normalized_name, quantity, status,
    added_by, source, merchant_id, merchant_name, deal_external_id, sale_price, regular_price,
    deal_valid_to, price_unit, conditional_price, price, created_at)
  values (this_week, 'Colgate Optic White',
    'colgate optic white advanced charcoal purple sensitive total or hello adult toothpaste', 1,
    'needed', alex, 'from_deal', '2264', 'CVS Pharmacy', deal_ext, 4.79, 9.79,
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
  -- Recipes: 12 for Oak Street, 2 for Rivera Family.
  -- `normalized_name` is `@hearth/matching`'s `normalize()` run once offline and pasted here, the
  -- same way the deal and pantry rows above do it — there is no SQL implementation to call.
  -- Readiness, match overrides, and the meal plan are a later unit's seed rows: this unit's job is
  -- the recipe library alone, unscored (recipe_readiness is derived data the matching unit writes).
  --
  -- Ten of Oak Street's twelve keep a source_url and each ingredient's original raw_text, as if
  -- imported from a URL; Lentil Curry and Shrimp Pad Thai are the two manual entries (no
  -- source_url, no raw_text). Rivera Family's two recipes are manual too: "Recipe sources" only
  -- accounts for ten-plus-two, which is exactly Oak Street's count, so Rivera's are left as the
  -- simpler, unspecified case rather than inventing two more source pages for them.
  -- -------------------------------------------------------------------------------------------

  insert into public.recipe (household_id, title, source_url, instructions, servings, created_by,
    created_at)
  values (oak_street, 'Sheet Pan Chicken and Vegetables',
    'https://www.weeknightkitchen.test/recipes/sheet-pan-chicken-and-vegetables',
    'Preheat the oven to 425F. Toss the chicken and vegetables with olive oil, garlic, and '
    || 'paprika on a sheet pan. Roast 25 minutes, until the chicken is cooked through. Squeeze '
    || 'the lemon over everything before serving.', 4, alex, now() - interval '18 days')
  returning id into recipe_id;
  insert into public.recipe_ingredient (recipe_id, "position", raw_text, item_name,
    normalized_name, quantity, unit) values
    (recipe_id, 0, '2 lb boneless, skinless chicken breast', 'chicken breast', 'chicken breast',
      2, 'lb'),
    (recipe_id, 1, '1 lb broccoli florets', 'broccoli', 'broccoli', 1, 'lb'),
    (recipe_id, 2, '1 bell pepper, sliced', 'bell pepper', 'bell pepper', 1, null),
    (recipe_id, 3, '2 tbsp olive oil', 'olive oil', 'olive oil', 2, 'tbsp'),
    (recipe_id, 4, '3 cloves garlic, minced', 'garlic', 'garlic', 3, 'cloves'),
    (recipe_id, 5, '1 tsp smoked paprika', 'paprika', 'paprika', 1, 'tsp'),
    (recipe_id, 6, '1 lemon, quartered', 'lemon', 'lemon', 1, null);

  insert into public.recipe (household_id, title, source_url, instructions, servings, created_by,
    created_at)
  values (oak_street, 'Spaghetti with Meat Sauce',
    'https://www.weeknightkitchen.test/recipes/spaghetti-with-meat-sauce',
    'Brown the ground beef with the onion and garlic. Stir in the crushed tomatoes and tomato '
    || 'paste and simmer 20 minutes, seasoning with the oregano. Serve over cooked spaghetti '
    || 'with parmesan.', 6, alex, now() - interval '17 days')
  returning id into recipe_id;
  insert into public.recipe_ingredient (recipe_id, "position", raw_text, item_name,
    normalized_name, quantity, unit) values
    (recipe_id, 0, '1 lb spaghetti', 'pasta', 'pasta', 1, 'lb'),
    (recipe_id, 1, '1 lb ground beef', 'ground beef', 'ground beef', 1, 'lb'),
    (recipe_id, 2, '1 (28 oz) can crushed tomatoes', 'canned tomatoes', 'canned tomato', 28, 'oz'),
    (recipe_id, 3, '1 onion, diced', 'onion', 'onion', 1, null),
    (recipe_id, 4, '2 cloves garlic, minced', 'garlic', 'garlic', 2, 'cloves'),
    (recipe_id, 5, '2 tbsp tomato paste', 'tomato paste', 'tomato paste', 2, 'tbsp'),
    (recipe_id, 6, '1/2 cup grated parmesan', 'parmesan', 'parmesan', 0.5, 'cup'),
    (recipe_id, 7, '1 tsp dried oregano', 'dried oregano', 'dried oregano', 1, 'tsp');

  insert into public.recipe (household_id, title, source_url, instructions, servings, created_by,
    created_at)
  values (oak_street, 'Vegetable Fried Rice',
    'https://www.homegrown-table.test/vegetable-fried-rice',
    'Scramble the eggs and set aside. Stir-fry the carrots and peas in sesame oil, add the cold '
    || 'rice and soy sauce, then fold in the eggs and green onions with the garlic.', 4, sam,
    now() - interval '16 days')
  returning id into recipe_id;
  insert into public.recipe_ingredient (recipe_id, "position", raw_text, item_name,
    normalized_name, quantity, unit) values
    (recipe_id, 0, '3 cups cooked rice, cold', 'rice', 'rice', 3, 'cups'),
    (recipe_id, 1, '2 eggs, beaten', 'eggs', 'egg', 2, null),
    (recipe_id, 2, '1 cup frozen peas', 'frozen peas', 'pea', 1, 'cup'),
    (recipe_id, 3, '2 carrots, diced', 'carrots', 'carrot', 2, null),
    (recipe_id, 4, '3 tbsp soy sauce', 'soy sauce', 'soy sauce', 3, 'tbsp'),
    (recipe_id, 5, '2 green onions, sliced', 'green onions', 'green onion', 2, null),
    (recipe_id, 6, '1 tsp sesame oil', 'sesame oil', 'sesame oil', 1, 'tsp'),
    (recipe_id, 7, '2 cloves garlic, minced', 'garlic', 'garlic', 2, 'cloves');

  insert into public.recipe (household_id, title, source_url, instructions, servings, created_by,
    created_at)
  values (oak_street, 'Black Bean Tacos', 'https://www.homegrown-table.test/black-bean-tacos',
    'Warm the black beans with the cumin. Fill the tortillas with beans, cheese, avocado, and '
    || 'red onion, and serve with salsa and lime wedges.', 4, sam, now() - interval '15 days')
  returning id into recipe_id;
  insert into public.recipe_ingredient (recipe_id, "position", raw_text, item_name,
    normalized_name, quantity, unit) values
    (recipe_id, 0, '1 (15 oz) can black beans, drained', 'black beans', 'black bean', 1, 'can'),
    (recipe_id, 1, '8 flour tortillas', 'flour tortillas', 'flour tortilla', 8, null),
    (recipe_id, 2, '1 tsp cumin', 'cumin', 'cumin', 1, 'tsp'),
    (recipe_id, 3, '1 avocado, sliced', 'avocado', 'avocado', 1, null),
    (recipe_id, 4, '1 lime, cut into wedges', 'lime', 'lime', 1, null),
    (recipe_id, 5, '1/2 cup salsa', 'salsa', 'salsa', 0.5, 'cup'),
    (recipe_id, 6, '1 cup shredded cheese', 'cheese', 'cheese', 1, 'cup'),
    (recipe_id, 7, '1/4 cup diced red onion', 'red onion', 'red onion', 0.25, 'cup');

  insert into public.recipe (household_id, title, source_url, instructions, servings, created_by,
    created_at)
  values (oak_street, 'Chicken Noodle Soup',
    'https://www.comfortfoodclub.test/chicken-noodle-soup',
    'Simmer the chicken breast in the broth with the carrots, celery, onion, garlic, thyme, and '
    || 'bay leaves until cooked through. Shred the chicken, add the egg noodles, and simmer '
    || 'until tender.', 6, jordan, now() - interval '14 days')
  returning id into recipe_id;
  insert into public.recipe_ingredient (recipe_id, "position", raw_text, item_name,
    normalized_name, quantity, unit) values
    (recipe_id, 0, '1 lb chicken breast', 'chicken breast', 'chicken breast', 1, 'lb'),
    (recipe_id, 1, '8 oz egg noodles', 'egg noodles', 'egg noodle', 8, 'oz'),
    (recipe_id, 2, '3 carrots, sliced', 'carrots', 'carrot', 3, null),
    (recipe_id, 3, '3 stalks celery, sliced', 'celery', 'celery', 3, 'stalks'),
    (recipe_id, 4, '1 onion, diced', 'onion', 'onion', 1, null),
    (recipe_id, 5, '2 cloves garlic, minced', 'garlic', 'garlic', 2, 'cloves'),
    (recipe_id, 6, '8 cups chicken broth', 'chicken broth', 'chicken broth', 8, 'cups'),
    (recipe_id, 7, '1 tsp dried thyme', 'thyme', 'thyme', 1, 'tsp'),
    (recipe_id, 8, '2 bay leaves', 'bay leaves', 'bay leaf', 2, null);

  insert into public.recipe (household_id, title, source_url, instructions, servings, created_by,
    created_at)
  values (oak_street, 'Greek Salad', 'https://www.comfortfoodclub.test/greek-salad',
    'Toss the cucumber, tomatoes, and red onion with the olives and feta. Whisk the olive oil '
    || 'and red wine vinegar together and dress the salad just before serving.', 4, jordan,
    now() - interval '13 days')
  returning id into recipe_id;
  insert into public.recipe_ingredient (recipe_id, "position", raw_text, item_name,
    normalized_name, quantity, unit) values
    (recipe_id, 0, '1 cucumber, diced', 'cucumber', 'cucumber', 1, null),
    (recipe_id, 1, '3 roma tomatoes, diced', 'roma tomatoes', 'roma tomato', 3, null),
    (recipe_id, 2, '1/2 red onion, thinly sliced', 'red onion', 'red onion', 0.5, null),
    (recipe_id, 3, '1 cup crumbled feta cheese', 'feta cheese', 'feta cheese', 1, 'cup'),
    (recipe_id, 4, '1/2 cup kalamata olives', 'kalamata olives', 'kalamata olive', 0.5, 'cup'),
    (recipe_id, 5, '2 tbsp olive oil', 'olive oil', 'olive oil', 2, 'tbsp'),
    (recipe_id, 6, '1 tbsp red wine vinegar', 'red wine vinegar', 'red wine vinegar', 1, 'tbsp');

  insert into public.recipe (household_id, title, source_url, instructions, servings, created_by,
    created_at)
  values (oak_street, 'Baked Ziti', 'https://www.weeknightkitchen.test/recipes/baked-ziti',
    'Brown the ground beef with the garlic and stir in the crushed tomatoes. Toss with cooked '
    || 'ziti and the ricotta, top with mozzarella and parmesan, and bake until bubbling.', 6, alex,
    now() - interval '12 days')
  returning id into recipe_id;
  insert into public.recipe_ingredient (recipe_id, "position", raw_text, item_name,
    normalized_name, quantity, unit) values
    (recipe_id, 0, '1 lb ziti pasta', 'pasta', 'pasta', 1, 'lb'),
    (recipe_id, 1, '1 lb ground beef', 'ground beef', 'ground beef', 1, 'lb'),
    (recipe_id, 2, '1 (28 oz) can crushed tomatoes', 'canned tomatoes', 'canned tomato', 28, 'oz'),
    (recipe_id, 3, '2 cups shredded mozzarella', 'mozzarella', 'mozzarella', 2, 'cups'),
    (recipe_id, 4, '1 cup ricotta cheese', 'ricotta', 'ricotta', 1, 'cup'),
    (recipe_id, 5, '1/2 cup grated parmesan', 'parmesan', 'parmesan', 0.5, 'cup'),
    (recipe_id, 6, '2 cloves garlic, minced', 'garlic', 'garlic', 2, 'cloves');

  insert into public.recipe (household_id, title, source_url, instructions, servings, created_by,
    created_at)
  values (oak_street, 'Breakfast Burritos', 'https://www.homegrown-table.test/breakfast-burritos',
    'Scramble the eggs and roast the diced potatoes and bell pepper. Fill the tortillas with '
    || 'eggs, potatoes, pepper, and cheese, and serve with salsa.', 4, sam,
    now() - interval '11 days')
  returning id into recipe_id;
  insert into public.recipe_ingredient (recipe_id, "position", raw_text, item_name,
    normalized_name, quantity, unit) values
    (recipe_id, 0, '6 eggs, scrambled', 'eggs', 'egg', 6, null),
    (recipe_id, 1, '4 large flour tortillas', 'flour tortillas', 'flour tortilla', 4, null),
    (recipe_id, 2, '1 cup shredded cheese', 'cheese', 'cheese', 1, 'cup'),
    (recipe_id, 3, '2 potatoes, diced and roasted', 'potatoes', 'potato', 2, null),
    (recipe_id, 4, '1 bell pepper, diced', 'bell pepper', 'bell pepper', 1, null),
    (recipe_id, 5, '1/2 cup salsa', 'salsa', 'salsa', 0.5, 'cup');

  -- Manual entry: no source_url, no raw_text on any ingredient.
  insert into public.recipe (household_id, title, source_url, instructions, servings, created_by,
    created_at)
  values (oak_street, 'Lentil Curry', null,
    'Saute the onion, garlic, and ginger, stir in the curry powder and cumin, then add the '
    || 'lentils, tomatoes, and enough water to cover. Simmer until the lentils are tender and '
    || 'serve over basmati rice with cilantro.', 4, alex, now() - interval '10 days')
  returning id into recipe_id;
  insert into public.recipe_ingredient (recipe_id, "position", raw_text, item_name,
    normalized_name, quantity, unit) values
    (recipe_id, 0, null, 'lentils', 'lentil', 2, 'cups'),
    (recipe_id, 1, null, 'coconut milk', 'coconut milk', 1, 'can'),
    (recipe_id, 2, null, 'onion', 'onion', 1, null),
    (recipe_id, 3, null, 'garlic', 'garlic', 3, 'cloves'),
    (recipe_id, 4, null, 'ginger', 'ginger', 1, 'tbsp'),
    (recipe_id, 5, null, 'curry powder', 'curry powder', 2, 'tbsp'),
    (recipe_id, 6, null, 'cumin', 'cumin', 1, 'tsp'),
    (recipe_id, 7, null, 'canned tomatoes', 'canned tomato', 14.5, 'oz'),
    (recipe_id, 8, null, 'basmati rice', 'basmati rice', 2, 'cups'),
    (recipe_id, 9, null, 'cilantro', 'cilantro', 0.25, 'cup');

  insert into public.recipe (household_id, title, source_url, instructions, servings, created_by,
    created_at)
  values (oak_street, 'Grilled Cheese and Tomato Soup',
    'https://www.comfortfoodclub.test/grilled-cheese-and-tomato-soup',
    'Simmer the crushed tomatoes with the milk until warmed through. Butter the bread, fill with '
    || 'cheese, and grill until golden on both sides. Serve alongside the soup.', 4, jordan,
    now() - interval '9 days')
  returning id into recipe_id;
  insert into public.recipe_ingredient (recipe_id, "position", raw_text, item_name,
    normalized_name, quantity, unit) values
    (recipe_id, 0, '8 slices bread', 'bread', 'bread', 8, null),
    (recipe_id, 1, '2 tbsp butter, softened', 'butter', 'butter', 2, 'tbsp'),
    (recipe_id, 2, '8 slices cheese', 'cheese', 'cheese', 8, 'slices'),
    (recipe_id, 3, '1 (28 oz) can crushed tomatoes', 'canned tomatoes', 'canned tomato', 28, 'oz'),
    (recipe_id, 4, '1 cup milk', 'milk', 'milk', 1, 'cup');

  -- Manual entry: no source_url, no raw_text on any ingredient.
  insert into public.recipe (household_id, title, source_url, instructions, servings, created_by,
    created_at)
  values (oak_street, 'Shrimp Pad Thai', null,
    'Soak the rice noodles until pliable. Stir-fry the shrimp, then add the noodles with the '
    || 'tamarind paste and fish sauce. Toss in the bean sprouts and green onions and finish with '
    || 'peanuts and a squeeze of lime.', 4, alex, now() - interval '8 days')
  returning id into recipe_id;
  insert into public.recipe_ingredient (recipe_id, "position", raw_text, item_name,
    normalized_name, quantity, unit) values
    (recipe_id, 0, null, 'rice noodles', 'rice noodle', 8, 'oz'),
    (recipe_id, 1, null, 'shrimp', 'shrimp', 1, 'lb'),
    (recipe_id, 2, null, 'tamarind paste', 'tamarind paste', 2, 'tbsp'),
    (recipe_id, 3, null, 'fish sauce', 'fish sauce', 3, 'tbsp'),
    (recipe_id, 4, null, 'bean sprouts', 'bean sprout', 1, 'cup'),
    (recipe_id, 5, null, 'peanuts', 'peanut', 0.25, 'cup'),
    (recipe_id, 6, null, 'lime', 'lime', 1, null),
    (recipe_id, 7, null, 'green onions', 'green onion', 2, null);

  insert into public.recipe (household_id, title, source_url, instructions, servings, created_by,
    created_at)
  values (oak_street, 'Sunday Pot Roast', 'https://www.sundaysupperclub.test/pot-roast',
    'Sear the chuck roast, then dust with flour and add the broth, potatoes, carrots, onion, '
    || 'rosemary, and worcestershire sauce. Cover and cook low and slow until the roast falls '
    || 'apart.', 6, sam, now() - interval '7 days')
  returning id into recipe_id;
  insert into public.recipe_ingredient (recipe_id, "position", raw_text, item_name,
    normalized_name, quantity, unit) values
    (recipe_id, 0, '3 lb beef chuck roast', 'chuck roast', 'chuck roast', 3, 'lb'),
    (recipe_id, 1, '4 russet potatoes, quartered', 'russet potatoes', 'russet potato', 4, null),
    (recipe_id, 2, '4 carrots, cut into chunks', 'carrots', 'carrot', 4, null),
    (recipe_id, 3, '1 onion, quartered', 'onion', 'onion', 1, null),
    (recipe_id, 4, '2 cups beef broth', 'beef broth', 'beef broth', 2, 'cups'),
    (recipe_id, 5, '1 tsp dried rosemary', 'rosemary', 'rosemary', 1, 'tsp'),
    (recipe_id, 6, '1 tbsp worcestershire sauce', 'worcestershire sauce', 'worcestershire sauce',
      1, 'tbsp'),
    (recipe_id, 7, '2 tbsp flour', 'flour', 'flour', 2, 'tbsp');

  -- Rivera Family: manual entries, same as Oak Street's two (see the note above).
  insert into public.recipe (household_id, title, source_url, instructions, servings, created_by,
    created_at)
  values (rivera_family, 'Tuna Poke Bowl', null,
    'Cube the ahi tuna and toss with soy sauce and sesame seeds. Serve over sushi rice with '
    || 'avocado and cucumber.', 2, morgan, now() - interval '6 days')
  returning id into recipe_id;
  insert into public.recipe_ingredient (recipe_id, "position", raw_text, item_name,
    normalized_name, quantity, unit) values
    (recipe_id, 0, null, 'ahi tuna', 'ahi tuna', 0.75, 'lb'),
    (recipe_id, 1, null, 'sushi rice', 'sushi rice', 2, 'cups'),
    (recipe_id, 2, null, 'soy sauce', 'soy sauce', 2, 'tbsp'),
    (recipe_id, 3, null, 'avocado', 'avocado', 1, null),
    (recipe_id, 4, null, 'cucumber', 'cucumber', 0.5, null),
    (recipe_id, 5, null, 'sesame seeds', 'sesame seed', 1, 'tbsp');

  insert into public.recipe (household_id, title, source_url, instructions, servings, created_by,
    created_at)
  values (rivera_family, 'Miso Soup', null,
    'Whisk the miso paste into hot dashi, then add the tofu, wakame, and green onions and warm '
    || 'through without boiling.', 4, morgan, now() - interval '5 days')
  returning id into recipe_id;
  insert into public.recipe_ingredient (recipe_id, "position", raw_text, item_name,
    normalized_name, quantity, unit) values
    (recipe_id, 0, null, 'miso paste', 'miso paste', 3, 'tbsp'),
    (recipe_id, 1, null, 'tofu', 'tofu', 0.5, 'block'),
    (recipe_id, 2, null, 'green onions', 'green onion', 2, null),
    (recipe_id, 3, null, 'dashi', 'dashi', 4, 'cups'),
    (recipe_id, 4, null, 'wakame', 'wakame', 2, 'tbsp');

  -- -------------------------------------------------------------------------------------------
  -- Match override: Oak Street has a force-no-match override for ingredient 'cheese' against deal
  -- 'snack cheese', Harris Teeter's. It demonstrates the 'Corrected' label, and it changes no
  -- score above, because 'cheese' already matches Food Lion's 'chunk or cheese'.
  -- recipe_readiness itself is derived data: computed by
  -- seed-users.ts after this script applies, never hand-written here.
  -- -------------------------------------------------------------------------------------------

  insert into public.ingredient_match_override (household_id, ingredient_normalized_name,
    target_kind, target_normalized_name, decision, created_by, created_at)
  values (oak_street, 'cheese', 'deal', 'snack cheese', 'force_no_match', alex,
    now() - interval '1 day');

  -- -------------------------------------------------------------------------------------------
  -- Meal plan. The current week has seven entries, including two in
  -- Wednesday's dinner slot (Baked Ziti and Greek Salad) — so one entry per day across the other
  -- five days, and Saturday left without one. The previous week has five, one of which stands
  -- for a deleted recipe ("Mushroom Stroganoff", a null recipe_id and a title snapshot with
  -- nothing to join back to). The coming week is left empty on purpose, which is what makes
  -- Alex's `weekly_meal_nudge` for Oak Street eligible on Saturday.
  -- -------------------------------------------------------------------------------------------

  insert into public.meal_plan_entry (household_id, recipe_id, recipe_title, planned_date,
    meal_type, added_by, created_at)
  select oak_street, r.id, r.title, v.planned_date, v.meal_type::public.meal_type, v.added_by,
    now() - make_interval(days => local_today - v.planned_date)
  from (values
    (this_sunday + 0, 'Sunday Pot Roast', 'dinner', sam),
    (this_sunday + 1, 'Spaghetti with Meat Sauce', 'dinner', alex),
    (this_sunday + 2, 'Chicken Noodle Soup', 'dinner', jordan),
    (this_sunday + 3, 'Baked Ziti', 'dinner', alex),
    (this_sunday + 3, 'Greek Salad', 'dinner', jordan),
    (this_sunday + 4, 'Vegetable Fried Rice', 'dinner', sam),
    (this_sunday + 5, 'Black Bean Tacos', 'dinner', sam)
  ) as v(planned_date, title, meal_type, added_by)
  join public.recipe r on r.household_id = oak_street and r.title = v.title;

  insert into public.meal_plan_entry (household_id, recipe_id, recipe_title, planned_date,
    meal_type, added_by, created_at)
  select oak_street, r.id, r.title, v.planned_date, v.meal_type::public.meal_type, v.added_by,
    now() - interval '7 days' - make_interval(days => local_today - v.planned_date)
  from (values
    (this_sunday - 7 + 0, 'Sheet Pan Chicken and Vegetables', 'dinner', jordan),
    (this_sunday - 7 + 2, 'Lentil Curry', 'dinner', alex),
    (this_sunday - 7 + 3, 'Grilled Cheese and Tomato Soup', 'lunch', sam),
    (this_sunday - 7 + 5, 'Shrimp Pad Thai', 'dinner', jordan)
  ) as v(planned_date, title, meal_type, added_by)
  join public.recipe r on r.household_id = oak_street and r.title = v.title;

  -- The deleted-recipe fixture: an explicit null recipe_id, never a reference to a real recipe.
  insert into public.meal_plan_entry (household_id, recipe_id, recipe_title, planned_date,
    meal_type, added_by, created_at)
  values (oak_street, null, 'Mushroom Stroganoff', this_sunday - 7 + 4, 'dinner', sam,
    now() - interval '8 days');

  -- -------------------------------------------------------------------------------------------
  -- Bills and payment history: Phase 4. Nine bills: every occurrence from
  -- `anchor_date` up to, but not including, "C" (each bill's own current occurrence) has a paid
  -- or skipped log row; only Duke Energy's C is past due and unlogged, and only Old Phone Plan is
  -- archived. Dates are relative to the seed run via local_today (declared above), so this section
  -- reads the same whenever it is seeded.
  -- -------------------------------------------------------------------------------------------

  -- Rent: anchor_date is given directly — the 1st of the month 5 months ago (not derived from C;
  -- unlike the bills below, Rent's and Old Phone Plan's anchors are given in absolute terms).
  -- Six occurrences get paid (indices 0-5), which puts the unresolved seventh (index 6, six months
  -- after the anchor) on next month's 1st — matching C, "1st of next month", as a consistency
  -- check rather than a derivation. The anchor is always day 1, so no month-end clamping is ever
  -- needed for it.
  rent_anchor := (date_trunc('month', local_today) - interval '5 months')::date;
  rent_c := pg_temp.clamped_month_add(rent_anchor, 6);
  assert rent_c = (date_trunc('month', local_today) + interval '1 month')::date,
    'Rent’s current occurrence no longer lands on next month’s 1st';
  insert into public.bill (household_id, owner_user_id, name, amount, recurrence_unit, "interval",
    anchor_date, visibility, created_at)
  values (oak_street, alex, 'Rent', 1850.00, 'month', 1, rent_anchor, 'household',
    (rent_anchor - 7)::timestamp at time zone 'America/New_York')
  returning id into rent_id;
  -- Six paid occurrences from the anchor; C (index 6, next month) is left unlogged and not yet due.
  insert into public.bill_payment_log (bill_id, occurrence_date, paid_date, amount_paid,
    recorded_by)
  select rent_id, occ, occ, 1850.00, alex
  from (select pg_temp.clamped_month_add(rent_anchor, k) as occ from generate_series(0, 5) as k) s;

  -- Duke Energy: C is 5 days ago, left deliberately unlogged so it is the one overdue bill.
  duke_c := local_today - 5;
  duke_anchor := pg_temp.clamped_month_add(duke_c, -6);
  insert into public.bill (household_id, owner_user_id, name, amount, recurrence_unit, "interval",
    anchor_date, visibility, created_at)
  values (oak_street, sam, 'Duke Energy', 142.30, 'month', 1, duke_anchor, 'household',
    (duke_anchor - 3)::timestamp at time zone 'America/New_York')
  returning id into duke_id;
  -- Six paid occurrences; the third was recorded 4 days late, which exercises the anchored-
  -- recurrence rule (its occurrence_date stays the anchor day, and the next occurrence is still
  -- exactly one month later, never shifted by the late payment).
  insert into public.bill_payment_log (bill_id, occurrence_date, paid_date, amount_paid,
    recorded_by)
  select duke_id, occ, case when k = 2 then occ + 4 else occ end, 142.30, sam
  from (select k, pg_temp.clamped_month_add(duke_anchor, k) as occ from generate_series(0, 5) as k)
    s;

  -- Spectrum Internet: household, autopay, subscription. Three is_auto rows from the anchor; its
  -- created_at is the anchor date itself, so every auto-logged occurrence is on or after
  -- created_at, as the no-backfill rule requires. last_used_confirmed_at is set recently so this
  -- one does NOT trigger "Still using this?" — Sam's Adobe subscription below is the only
  -- fixture meant to.
  spectrum_c := local_today + 3;
  spectrum_anchor := pg_temp.clamped_month_add(spectrum_c, -3);
  insert into public.bill (household_id, owner_user_id, name, amount, recurrence_unit, "interval",
    anchor_date, visibility, autopay, is_subscription, last_used_confirmed_at, created_at)
  values (oak_street, alex, 'Spectrum Internet', 74.99, 'month', 1, spectrum_anchor, 'household',
    true, true, now() - interval '10 days',
    spectrum_anchor::timestamp at time zone 'America/New_York')
  returning id into spectrum_id;
  insert into public.bill_payment_log (bill_id, occurrence_date, paid_date, amount_paid, is_auto)
  select spectrum_id, occ, occ, 74.99, true
  from (select pg_temp.clamped_month_add(spectrum_anchor, k) as occ from generate_series(0, 2) as k)
    s;

  -- Water and Sewer: three past occurrences are paid, skipped, paid, for the skip display.
  water_c := local_today + 9;
  water_anchor := pg_temp.clamped_month_add(water_c, -3);
  insert into public.bill (household_id, owner_user_id, name, amount, recurrence_unit, "interval",
    anchor_date, visibility, created_at)
  values (oak_street, jordan, 'Water and Sewer', 58.40, 'month', 1, water_anchor, 'household',
    (water_anchor - 5)::timestamp at time zone 'America/New_York')
  returning id into water_id;
  insert into public.bill_payment_log (bill_id, occurrence_date, paid_date, amount_paid,
    is_skipped, recorded_by)
  values
    (water_id, pg_temp.clamped_month_add(water_anchor, 0), pg_temp.clamped_month_add(water_anchor,
      0), 58.40, false, jordan),
    (water_id, pg_temp.clamped_month_add(water_anchor, 1), null, null, true, jordan),
    (water_id, pg_temp.clamped_month_add(water_anchor, 2), pg_temp.clamped_month_add(water_anchor,
      2), 58.40, false, jordan);

  -- Renters Insurance: yearly, autopay, no history yet — its first occurrence is C itself.
  renters_anchor := local_today + 40;
  insert into public.bill (household_id, owner_user_id, name, amount, recurrence_unit, "interval",
    anchor_date, visibility, autopay, created_at)
  values (oak_street, alex, 'Renters Insurance', 186.00, 'year', 1, renters_anchor, 'household',
    true, now() - interval '10 days')
  returning id into renters_id;

  -- Personal subscriptions (Spotify, Adobe, Gym): visibility 'personal', household_id null, same
  -- three-is_auto-row shape as Spectrum. Spotify and Gym also get a recent
  -- last_used_confirmed_at, for the same reason as Spectrum above: only Adobe is the seed
  -- fixture for the usage-confirmation prompt.
  spotify_c := local_today + 12;
  spotify_anchor := pg_temp.clamped_month_add(spotify_c, -3);
  insert into public.bill (owner_user_id, name, amount, recurrence_unit, "interval", anchor_date,
    visibility, autopay, is_subscription, last_used_confirmed_at, created_at)
  values (alex, 'Spotify', 11.99, 'month', 1, spotify_anchor, 'personal', true, true,
    now() - interval '10 days', spotify_anchor::timestamp at time zone 'America/New_York')
  returning id into spotify_id;
  insert into public.bill_payment_log (bill_id, occurrence_date, paid_date, amount_paid, is_auto)
  select spotify_id, occ, occ, 11.99, true
  from (select pg_temp.clamped_month_add(spotify_anchor, k) as occ from generate_series(0, 2) as k)
    s;

  -- Sam's Adobe subscription: last_used_confirmed_at 70 days ago, past the 60-day threshold, so
  -- it is the seed fixture for the "Still using this?" prompt.
  adobe_c := local_today + 20;
  adobe_anchor := pg_temp.clamped_month_add(adobe_c, -3);
  insert into public.bill (owner_user_id, name, amount, recurrence_unit, "interval", anchor_date,
    visibility, autopay, is_subscription, last_used_confirmed_at, created_at)
  values (sam, 'Adobe Creative Cloud', 59.99, 'month', 1, adobe_anchor, 'personal', true, true,
    now() - interval '70 days', adobe_anchor::timestamp at time zone 'America/New_York')
  returning id into adobe_id;
  insert into public.bill_payment_log (bill_id, occurrence_date, paid_date, amount_paid, is_auto)
  select adobe_id, occ, occ, 59.99, true
  from (select pg_temp.clamped_month_add(adobe_anchor, k) as occ from generate_series(0, 2) as k)
    s;

  gym_c := local_today + 6;
  gym_anchor := pg_temp.clamped_month_add(gym_c, -3);
  insert into public.bill (owner_user_id, name, amount, recurrence_unit, "interval", anchor_date,
    visibility, autopay, is_subscription, last_used_confirmed_at, created_at)
  values (jordan, 'Gym Membership', 34.00, 'month', 1, gym_anchor, 'personal', true, true,
    now() - interval '10 days', gym_anchor::timestamp at time zone 'America/New_York')
  returning id into gym_id;
  insert into public.bill_payment_log (bill_id, occurrence_date, paid_date, amount_paid, is_auto)
  select gym_id, occ, occ, 34.00, true
  from (select pg_temp.clamped_month_add(gym_anchor, k) as occ from generate_series(0, 2) as k) s;

  -- Old Phone Plan: archived 30 days ago, with paid rows for its first seven occurrences — it
  -- must appear in no view and send no reminders.
  old_phone_anchor := (date_trunc('month', local_today) - interval '8 months')::date;
  insert into public.bill (household_id, owner_user_id, name, amount, recurrence_unit, "interval",
    anchor_date, visibility, created_at, archived_at)
  values (oak_street, sam, 'Old Phone Plan', 45.00, 'month', 1, old_phone_anchor, 'household',
    (old_phone_anchor - 7)::timestamp at time zone 'America/New_York',
    now() - interval '30 days')
  returning id into old_phone_id;
  insert into public.bill_payment_log (bill_id, occurrence_date, paid_date, amount_paid,
    recorded_by)
  select old_phone_id, occ, occ, 45.00, sam
  from (select pg_temp.clamped_month_add(old_phone_anchor, k) as occ
    from generate_series(0, 6) as k) s;

  -- -------------------------------------------------------------------------------------------
  -- Chores, completions (including Casey's), and errands: Phase 4. Occurrence dates are evaluated in America/New_York, Oak Street's timezone, so
  -- every occurrence_date below is computed from local_today, never from a plain interval off
  -- now() (the same reasoning the deal-validity dates above this give for local_today).
  -- -------------------------------------------------------------------------------------------

  -- Take out trash: weekly, anchored 56 days ago, rotation Alex -> Sam -> Jordan, offset 2.
  -- (2 + 8) mod 3 = 1 = Sam, so today's occurrence (k=8, uncompleted) is Sam's turn, due today.
  insert into public.chore (household_id, name, recurrence_unit, anchor_date, rotation_order,
    rotation_offset, created_by, created_at)
  values (oak_street, 'Take out trash', 'week', local_today - 56, array[alex, sam, jordan], 2,
    alex, now() - interval '57 days')
  returning id into trash_chore;

  -- Eight completions, one per past occurrence (k = 0..7); the k=3 completion was recorded three
  -- days after its occurrence_date, which the anchored-recurrence rule keeps from shifting the
  -- occurrence after it.
  insert into public.chore_completion (chore_id, occurrence_date, completed_by, completed_at)
  select trash_chore, local_today - 56 + 7 * k,
    (array[alex, sam, jordan])[((2 + k) % 3) + 1],
    now() - make_interval(days => (56 - 7 * k) - case when k = 3 then 3 else 0 end)
  from generate_series(0, 7) as k;

  -- Clean bathroom: weekly, anchored 5 days ago, same rotation, offset 1. One completion closes
  -- the only arrived occurrence; (1 + 1) mod 3 = 2 = Jordan, due in 2 days (the next occurrence).
  insert into public.chore (household_id, name, recurrence_unit, anchor_date, rotation_order,
    rotation_offset, created_by, created_at)
  values (oak_street, 'Clean bathroom', 'week', local_today - 5, array[alex, sam, jordan], 1,
    alex, now() - interval '6 days')
  returning id into bathroom_chore;

  insert into public.chore_completion (chore_id, occurrence_date, completed_by, completed_at)
  values (bathroom_chore, local_today - 5, sam, now() - interval '5 days');

  -- Vacuum common areas: weekly, anchored 38 days ago, unassigned. Only the first occurrence was
  -- ever completed, by Casey (now departed); the four missed occurrences since rolled forward
  -- without stacking, leaving the occurrence 3 days ago overdue.
  insert into public.chore (household_id, name, recurrence_unit, anchor_date, created_by,
    created_at)
  values (oak_street, 'Vacuum common areas', 'week', local_today - 38, alex,
    now() - interval '39 days')
  returning id into vacuum_chore;

  insert into public.chore_completion (chore_id, occurrence_date, completed_by, completed_at)
  values (vacuum_chore, local_today - 38, casey, now() - interval '38 days');

  -- Replace HVAC filter: monthly, anchored 11 days from now, assigned to Alex, never completed.
  insert into public.chore (household_id, name, recurrence_unit, anchor_date, assigned_to,
    created_by, created_at)
  values (oak_street, 'Replace HVAC filter', 'month', local_today + 11, alex, alex,
    now() - interval '3 days');

  -- Deep clean fridge: monthly, anchored 6 days from now, rotation Alex -> Sam, offset 0, never
  -- completed; (0 + 0) mod 2 = 0 = Alex.
  insert into public.chore (household_id, name, recurrence_unit, anchor_date, rotation_order,
    rotation_offset, created_by, created_at)
  values (oak_street, 'Deep clean fridge', 'month', local_today + 6, array[alex, sam], 0, alex,
    now() - interval '2 days');

  -- Water plants: every 3 days, anchored on its creation date 8 days ago, unassigned. Three
  -- completions (8, 5, and 2 days ago) close every occurrence up to today; the next is tomorrow.
  insert into public.chore (household_id, name, recurrence_unit, "interval", anchor_date,
    created_by, created_at)
  values (oak_street, 'Water plants', 'day', 3, local_today - 8, alex, now() - interval '8 days')
  returning id into water_chore;

  insert into public.chore_completion (chore_id, occurrence_date, completed_by, completed_at)
  values
    (water_chore, local_today - 8, alex, now() - interval '8 days'),
    (water_chore, local_today - 5, alex, now() - interval '5 days'),
    (water_chore, local_today - 2, alex, now() - interval '2 days');

  -- Errands: a mix of open (dated, overdue, undated, unassigned) and done, including one done by
  -- someone other than its assignee.
  insert into public.errand (household_id, name, due_date, status, added_by, assigned_to,
    completed_at, completed_by, created_at)
  values
    (oak_street, 'Return Amazon package', local_today + 2, 'open', alex, alex, null, null,
      now() - interval '1 day'),
    (oak_street, 'Pick up dry cleaning', local_today - 2, 'open', jordan, null, null, null,
      now() - interval '5 days'),
    (oak_street, 'Renew car registration', local_today + 21, 'open', sam, sam, null, null,
      now() - interval '3 days'),
    (oak_street, 'Buy birthday card', null, 'open', jordan, null, null, null,
      now() - interval '2 days'),
    (oak_street, 'Mail rent check', local_today - 3, 'done', alex, alex,
      now() - interval '4 days', alex, now() - interval '10 days'),
    (oak_street, 'Replace porch light bulb', null, 'done', jordan, jordan,
      now() - interval '6 days', sam, now() - interval '14 days');

  -- -------------------------------------------------------------------------------------------
  -- App errors, for System health. The fingerprint is the SHA-256 of
  -- source, error name, and route or job, newline-separated.
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
