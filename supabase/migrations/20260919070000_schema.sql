-- The complete Hearth schema (Requirements, "Data model"). Every pillar's tables exist from Phase 1
-- so later phases never alter foundational tables (Implementation Handoff, "Build phases").
-- Row-level security, grants, and the membership functions are in the migrations that follow.
--
-- Conventions: uuid primary keys; money is numeric(10,2); dates without a time are `date`,
-- everything else `timestamptz`. Enumerated fields are Postgres enums. Flipp's identifiers
-- (item, flyer, merchant) are opaque text, as the DealSource contract types them.

-- ---------------------------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------------------------

create type public.household_role as enum ('admin', 'member');
create type public.price_unit as enum ('each', 'lb', 'oz');
create type public.conditional_reason as enum ('coupon', 'loyalty_card');
create type public.list_item_status as enum ('needed', 'in_cart', 'bought');
create type public.list_item_source as enum ('manual', 'from_deal', 'from_recipe');
create type public.match_target_kind as enum ('deal', 'pantry');
create type public.match_decision as enum ('force_match', 'force_no_match');
create type public.meal_type as enum ('breakfast', 'lunch', 'dinner');
create type public.recurrence_unit as enum ('day', 'week', 'month', 'year');
create type public.bill_visibility as enum ('household', 'personal');
create type public.errand_status as enum ('open', 'done');
create type public.notification_type as enum (
  'bill_due',
  'chore_due',
  'chore_rotation',
  'list_activity',
  'meal_reminder',
  'weekly_meal_nudge',
  'flyer_refresh'
);

-- ---------------------------------------------------------------------------------------------
-- Users and households
-- ---------------------------------------------------------------------------------------------

-- A profile outlives every membership: historical rows (completions, payments, "added by")
-- reference it, so a departed member still resolves to an id that renders as "Former member".
create table public.profile (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  timezone text not null default 'UTC',
  active_household_id uuid,
  quiet_hours_start time,
  quiet_hours_end time,
  household_bill_reminders boolean not null default false,
  created_at timestamptz not null default now(),
  -- A quiet-hours window needs both ends.
  constraint profile_quiet_hours_pair
    check ((quiet_hours_start is null) = (quiet_hours_end is null))
);

create table public.household (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  timezone text not null,
  last_active_at timestamptz not null default now(),
  created_by uuid not null references public.profile (id),
  created_at timestamptz not null default now()
);

alter table public.profile
  add constraint profile_active_household_id_fkey
  foreign key (active_household_id) references public.household (id) on delete set null;

-- Every household and personal date is evaluated in one of these timezones, so a name Postgres
-- cannot resolve would make date evaluation, and every job that does it, fail.
create function public.require_known_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'unknown timezone' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger household_known_timezone
  before insert or update of timezone on public.household
  for each row execute function public.require_known_timezone();
create trigger profile_known_timezone
  before insert or update of timezone on public.profile
  for each row execute function public.require_known_timezone();

create table public.household_member (
  household_id uuid not null references public.household (id) on delete cascade,
  user_id uuid not null references public.profile (id) on delete cascade,
  role public.household_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_member_user_id_idx on public.household_member (user_id);
create index household_member_household_id_idx on public.household_member (household_id);
-- Exactly one admin per household: the functions keep at least one, this keeps at most one.
create unique index household_member_one_admin_idx
  on public.household_member (household_id) where role = 'admin';

-- Only hashes are stored (SHA-256, lowercase hex). The link token and the code are shown once.
create table public.household_invite (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null default auth.uid() references public.profile (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '168 hours',
  revoked_at timestamptz,
  -- Invites live exactly 7 days (Requirements, "Invites"); an admin cannot mint a longer one.
  -- Hours, not days: day arithmetic on timestamptz depends on the session timezone.
  constraint household_invite_seven_days check (expires_at = created_at + interval '168 hours')
);

create index household_invite_household_id_idx on public.household_invite (household_id);

-- ---------------------------------------------------------------------------------------------
-- Deals
-- ---------------------------------------------------------------------------------------------

create table public.deal (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  merchant_id text not null,
  merchant_name text not null,
  name text not null,
  normalized_name text not null,
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  price_unit public.price_unit not null,
  original_price numeric(10, 2) check (original_price >= 0),
  discount_percent integer check (discount_percent between 0 and 100),
  display_price text not null,
  conditional_price boolean not null default false,
  conditional_reason public.conditional_reason,
  category text,
  image_url text,
  source_url text,
  flyer_id text not null,
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  valid_from date not null,
  valid_to date not null,
  fetched_at timestamptz not null default now(),
  unique (postal_code, external_id),
  constraint deal_conditional_reason_iff_conditional
    check (conditional_price = (conditional_reason is not null))
);

create index deal_postal_code_valid_to_idx on public.deal (postal_code, valid_to);
create index deal_postal_code_merchant_name_idx
  on public.deal (postal_code, merchant_id, normalized_name);

create table public.deal_query_cache (
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  normalized_query text not null,
  deal_ids uuid[] not null default '{}',
  cached_at timestamptz not null default now(),
  primary key (postal_code, normalized_query)
);

create table public.postal_code_refresh (
  postal_code text primary key check (postal_code ~ '^[0-9]{5}$'),
  last_refreshed_at timestamptz,
  last_on_demand_at timestamptz
);

create table public.household_favorite_store (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  merchant_id text not null,
  merchant_name text not null,
  unique (household_id, merchant_id)
);

-- ---------------------------------------------------------------------------------------------
-- Shopping and pantry
-- ---------------------------------------------------------------------------------------------

create table public.shopping_list (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  archived_at timestamptz,
  created_by uuid not null default auth.uid() references public.profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shopping_list_household_id_idx on public.shopping_list (household_id);

-- The id is generated by the client, so a replayed offline add is a duplicate-key no-op.
create table public.shopping_list_item (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_list (id) on delete cascade,
  item_name text not null check (btrim(item_name) <> ''),
  normalized_name text not null,
  quantity numeric check (quantity > 0),
  quantity_note text,
  status public.list_item_status not null default 'needed',
  added_by uuid not null default auth.uid() references public.profile (id),
  source public.list_item_source not null default 'manual',
  merchant_id text,
  merchant_name text,
  deal_external_id text,
  sale_price numeric(10, 2) check (sale_price >= 0),
  regular_price numeric(10, 2) check (regular_price >= 0),
  deal_valid_to date,
  price_unit public.price_unit not null default 'each',
  conditional_price boolean not null default false,
  price numeric(10, 2) check (price >= 0),
  original_sale_price numeric(10, 2) check (original_sale_price >= 0),
  repriced_at timestamptz,
  contributing_recipe_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index shopping_list_item_list_id_idx on public.shopping_list_item (list_id);

create table public.pantry_item (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  item_name text not null check (btrim(item_name) <> ''),
  normalized_name text not null,
  quantity_note text,
  last_updated timestamptz not null default now(),
  -- One row per ingredient: "Add bought items to pantry" merges instead of duplicating.
  unique (household_id, normalized_name)
);

-- `shopping_list.updated_at` is the list's last activity: any change to the list or to one of
-- its items bumps it (Requirements, "Shopping and pantry").
create function public.touch_shopping_list()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger shopping_list_touch
  before update on public.shopping_list
  for each row execute function public.touch_shopping_list();

create function public.touch_shopping_list_from_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.shopping_list set updated_at = now() where id = old.list_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.list_id <> old.list_id) then
    update public.shopping_list set updated_at = now() where id = new.list_id;
  end if;
  return null;
end;
$$;

create trigger shopping_list_item_touch_list
  after insert or update or delete on public.shopping_list_item
  for each row execute function public.touch_shopping_list_from_item();

-- ---------------------------------------------------------------------------------------------
-- Meal planning
-- ---------------------------------------------------------------------------------------------

create table public.recipe (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  source_url text,
  instructions text,
  servings integer check (servings > 0),
  created_by uuid not null default auth.uid() references public.profile (id),
  created_at timestamptz not null default now(),
  -- Target of the composite keys below, which keep derived and snapshot rows in the recipe's
  -- own household.
  unique (id, household_id)
);

create index recipe_household_id_idx on public.recipe (household_id);

create table public.recipe_ingredient (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipe (id) on delete cascade,
  "position" integer not null check ("position" >= 0),
  raw_text text,
  item_name text not null,
  normalized_name text not null,
  quantity numeric check (quantity > 0),
  unit text
);

create index recipe_ingredient_recipe_id_idx on public.recipe_ingredient (recipe_id, "position");

create table public.recipe_readiness (
  recipe_id uuid primary key,
  household_id uuid not null references public.household (id) on delete cascade,
  on_sale_count integer not null check (on_sale_count >= 0),
  in_pantry_count integer not null check (in_pantry_count >= 0),
  to_buy_count integer not null check (to_buy_count >= 0),
  readiness_percent integer not null check (readiness_percent between 0 and 100),
  breakdown jsonb not null default '{}',
  computed_at timestamptz not null default now(),
  foreign key (recipe_id, household_id)
    references public.recipe (id, household_id) on delete cascade
);

create index recipe_readiness_household_id_idx on public.recipe_readiness (household_id);

create table public.ingredient_match_override (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  ingredient_normalized_name text not null,
  target_kind public.match_target_kind not null,
  target_normalized_name text not null,
  decision public.match_decision not null,
  created_by uuid not null default auth.uid() references public.profile (id),
  created_at timestamptz not null default now(),
  unique (household_id, ingredient_normalized_name, target_kind, target_normalized_name)
);

create table public.meal_plan_entry (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  recipe_id uuid,
  recipe_title text not null,
  planned_date date not null,
  meal_type public.meal_type not null,
  added_by uuid not null default auth.uid() references public.profile (id),
  created_at timestamptz not null default now(),
  -- Deleting the recipe keeps the entry and its title snapshot (Requirements, "Meal plan
  -- history and deleted recipes"); only recipe_id is cleared.
  foreign key (recipe_id, household_id)
    references public.recipe (id, household_id) on delete set null (recipe_id)
);

create index meal_plan_entry_household_date_idx
  on public.meal_plan_entry (household_id, planned_date);
create index meal_plan_entry_recipe_id_idx on public.meal_plan_entry (recipe_id);

-- ---------------------------------------------------------------------------------------------
-- Bills
-- ---------------------------------------------------------------------------------------------

create table public.bill (
  id uuid primary key default gen_random_uuid(),
  -- Only household bills cascade with their household; personal bills have no household.
  household_id uuid references public.household (id) on delete cascade,
  owner_user_id uuid not null references public.profile (id),
  name text not null check (btrim(name) <> ''),
  amount numeric(10, 2) not null check (amount >= 0),
  category text,
  recurrence_unit public.recurrence_unit,
  "interval" integer not null default 1 check ("interval" > 0),
  anchor_date date not null,
  reminder_days_before integer not null default 3 check (reminder_days_before >= 0),
  autopay boolean not null default false,
  visibility public.bill_visibility not null,
  is_subscription boolean not null default false,
  last_used_confirmed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  -- This constraint is what keeps personal bills out of every household's data.
  constraint bill_personal_iff_no_household
    check ((visibility = 'personal') = (household_id is null))
);

-- Only a bill's owner may switch its visibility, and a household bill never moves to another
-- household. RLS alone cannot stop a co-member from taking a household bill (and its payment
-- history) as their own personal bill: the old row passes the household policy and the new one
-- passes the personal policy once owner_user_id is set to the caller.
create function public.keep_bill_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.visibility is distinct from old.visibility
    or new.household_id is distinct from old.household_id
  then
    if old.household_id is not null and new.household_id is not null then
      raise exception 'a household bill cannot move to another household'
        using errcode = '42501';
    end if;
    if old.owner_user_id is distinct from auth.uid()
      or new.owner_user_id is distinct from old.owner_user_id
    then
      raise exception 'only the bill''s owner can change its visibility' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger bill_keep_scope
  before update on public.bill
  for each row execute function public.keep_bill_scope();

create index bill_household_id_idx on public.bill (household_id);
create index bill_owner_user_id_idx on public.bill (owner_user_id);

create table public.bill_payment_log (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bill (id) on delete cascade,
  occurrence_date date not null,
  paid_date date,
  amount_paid numeric(10, 2) check (amount_paid >= 0),
  is_auto boolean not null default false,
  is_skipped boolean not null default false,
  -- Null for automatic payments. A departed member's id stays (Requirements, "Membership
  -- lifecycle").
  recorded_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  -- The unique key is also the (bill_id, occurrence_date) index Technical Architecture lists.
  unique (bill_id, occurrence_date),
  constraint bill_payment_log_paid_xor_skipped check (
    (not is_skipped and paid_date is not null and amount_paid is not null)
    or (is_skipped and paid_date is null and amount_paid is null)
  )
);

-- ---------------------------------------------------------------------------------------------
-- Chores and errands
-- ---------------------------------------------------------------------------------------------

create table public.chore (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  recurrence_unit public.recurrence_unit not null,
  "interval" integer not null default 1 check ("interval" > 0),
  anchor_date date not null,
  rotation_order uuid[] check (cardinality(rotation_order) > 0),
  rotation_offset integer not null default 0 check (rotation_offset >= 0),
  assigned_to uuid references public.profile (id),
  created_by uuid not null default auth.uid() references public.profile (id),
  created_at timestamptz not null default now(),
  constraint chore_rotation_or_assignee check (rotation_order is null or assigned_to is null)
);

create index chore_household_id_idx on public.chore (household_id);

-- The id is generated by the client so a replayed offline completion is a no-op.
create table public.chore_completion (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references public.chore (id) on delete cascade,
  occurrence_date date not null,
  completed_by uuid not null default auth.uid() references public.profile (id),
  completed_at timestamptz not null default now(),
  unique (chore_id, occurrence_date)
);

create table public.errand (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  due_date date,
  status public.errand_status not null default 'open',
  added_by uuid not null default auth.uid() references public.profile (id),
  assigned_to uuid references public.profile (id),
  completed_at timestamptz,
  completed_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  -- PATCH sets status absolutely: done stamps both completion fields, open clears them.
  constraint errand_completion_matches_status check (
    (status = 'open' and completed_at is null and completed_by is null)
    or (status = 'done' and completed_at is not null and completed_by is not null)
  )
);

create index errand_household_id_idx on public.errand (household_id);

-- Whoever a chore, errand, or household bill is given to must be a member of its household when
-- it is given: chore_due and bill_due go to that person with the household's data in the payload,
-- so an outsider named here would receive it. An unchanged assignment is not rechecked, so
-- history (a done errand, an archived bill) keeps a departed member's id.
create function public.require_member_assignees()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  given uuid[] := '{}';
  -- A row that is new, or moves household, has every assignment checked afresh.
  fresh boolean := tg_op = 'INSERT' or new.household_id is distinct from old.household_id;
begin
  -- A caller outside the household is refused by RLS. Answering first would tell them whether
  -- the user they named belongs to it.
  if new.household_id is null
    or (auth.uid() is not null and not exists (
      select 1 from public.household_member m
      where m.household_id = new.household_id and m.user_id = auth.uid()
    ))
  then
    return new;
  end if;

  if tg_table_name = 'chore' then
    if fresh or new.assigned_to is distinct from old.assigned_to then
      given := given || new.assigned_to;
    end if;
    if fresh or new.rotation_order is distinct from old.rotation_order then
      given := given || coalesce(new.rotation_order, '{}');
    end if;
  elsif tg_table_name = 'errand' then
    if fresh or new.assigned_to is distinct from old.assigned_to then
      given := given || new.assigned_to;
    end if;
  elsif tg_table_name = 'bill' then
    if new.household_id is not null
      and (fresh or new.owner_user_id is distinct from old.owner_user_id)
    then
      given := given || new.owner_user_id;
    end if;
  end if;

  if exists (
    select 1 from pg_catalog.unnest(given) g(user_id)
    where g.user_id is not null
      and not exists (
        select 1 from public.household_member m
        where m.household_id = new.household_id and m.user_id = g.user_id
      )
  ) then
    raise exception 'only a member of the household can be assigned' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger chore_member_assignees
  before insert or update on public.chore
  for each row execute function public.require_member_assignees();
create trigger errand_member_assignees
  before insert or update on public.errand
  for each row execute function public.require_member_assignees();
create trigger bill_member_owner
  before insert or update on public.bill
  for each row execute function public.require_member_assignees();

-- ---------------------------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------------------------

create table public.notification_preference (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profile (id) on delete cascade,
  notification_type public.notification_type not null,
  household_id uuid references public.household (id) on delete cascade,
  enabled boolean not null,
  unique nulls not distinct (user_id, notification_type, household_id),
  -- Only weekly_meal_nudge is opted into per household.
  constraint notification_preference_household_scope
    check ((notification_type = 'weekly_meal_nudge') = (household_id is not null))
);

create index notification_preference_household_id_idx
  on public.notification_preference (household_id);

create table public.push_subscription (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profile (id) on delete cascade,
  endpoint text not null,
  keys jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- The single outbox. Its unique key is what makes a notification impossible to send twice.
create table public.notification (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profile (id) on delete cascade,
  type public.notification_type not null,
  target_id uuid not null,
  occurrence_key text not null,
  payload jsonb not null,
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, type, target_id, occurrence_key)
);

create index notification_due_idx on public.notification (send_after) where sent_at is null;

-- ---------------------------------------------------------------------------------------------
-- Operations
-- ---------------------------------------------------------------------------------------------

-- The fingerprint is a SHA-256 (lowercase hex), so nothing but the scrubbed message is free text.
create table public.app_error (
  fingerprint text primary key check (fingerprint ~ '^[0-9a-f]{64}$'),
  message text not null check (char_length(message) <= 500),
  count integer not null default 1 check (count > 0),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- profile follows auth.users
-- ---------------------------------------------------------------------------------------------

-- Signup passes display_name and the browser's timezone as user_metadata (Technical
-- Architecture, "Auth configuration"). The timezone falls back to UTC until the PWA's first
-- open patches it; a blank display name falls back to the email's local part.
create function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_timezone text := new.raw_user_meta_data ->> 'timezone';
  requested_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  if requested_timezone is null
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = requested_timezone)
  then
    requested_timezone := 'UTC';
  end if;

  if requested_name = '' then
    requested_name := pg_catalog.split_part(coalesce(new.email, ''), '@', 1);
  end if;

  insert into public.profile (id, email, display_name, timezone)
  values (new.id, coalesce(new.email, ''), requested_name, requested_timezone);
  return new;
end;
$$;

create function public.handle_auth_user_email_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profile set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_created();

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_auth_user_email_changed();
