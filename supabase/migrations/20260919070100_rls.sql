-- Row-level security and grants for every table (Technical Architecture, "RLS policy pattern").
-- Every table has RLS enabled. A table with no policy denies everything; app_error is the only
-- such table, reachable solely through record_app_error.
--
-- Grants are explicit: `authenticated` gets only the privileges its policies need, `anon` gets
-- none (its one function grant is in the next migration), and service_role keeps full access
-- for jobs, migrations, and the owner CLI.

-- ---------------------------------------------------------------------------------------------
-- Default privileges
-- ---------------------------------------------------------------------------------------------

-- Supabase grants everything in public to anon and authenticated by default, and Postgres grants
-- EXECUTE on new functions to PUBLIC. Turn both off for objects later migrations create, so a
-- new table or function is unreachable until a migration grants it deliberately.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges revoke execute on functions from public;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Helpers. security definer so a policy can consult household_member without recursing through
-- household_member's own policy; each reads only the caller's own membership.
-- ---------------------------------------------------------------------------------------------

create function public.is_household_member(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.household_member
    where household_id = hid and user_id = auth.uid()
  );
$$;

create function public.is_household_admin(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.household_member
    where household_id = hid and user_id = auth.uid() and role = 'admin'
  );
$$;

-- Deals are shared per postal code, not per household: any member of a household at that
-- postal code may read and refresh them.
create function public.is_member_postal_code(pc text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_member m
    join public.household h on h.id = m.household_id
    where m.user_id = auth.uid() and h.postal_code = pc
  );
$$;

-- A household bill is its household's; a personal bill is its owner's alone.
create function public.can_access_bill(bid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.bill b
    where b.id = bid
      and (
        (b.household_id is not null and public.is_household_member(b.household_id))
        or (b.household_id is null and b.owner_user_id = auth.uid())
      )
  );
$$;

-- The only outbox rows a request writes on someone else's behalf are list_activity and
-- chore_rotation. Both the caller and the recipient must belong to the household that owns the
-- target list or chore, so a co-member in one household cannot touch the recipient's rows
-- about another.
create function public.can_write_member_notification(
  ntype public.notification_type,
  target uuid,
  recipient uuid
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from (
      select l.household_id from public.shopping_list l
      where ntype = 'list_activity' and l.id = target
      union all
      select c.household_id from public.chore c
      where ntype = 'chore_rotation' and c.id = target
    ) owner
    where public.is_household_member(owner.household_id)
      and exists (
        select 1 from public.household_member m
        where m.household_id = owner.household_id and m.user_id = recipient
      )
  );
$$;

grant execute on function
  public.is_household_member(uuid),
  public.is_household_admin(uuid),
  public.is_member_postal_code(text),
  public.can_access_bill(uuid),
  public.can_write_member_notification(public.notification_type, uuid, uuid)
to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------------------------

alter table public.profile enable row level security;
alter table public.household enable row level security;
alter table public.household_member enable row level security;
alter table public.household_invite enable row level security;
alter table public.deal enable row level security;
alter table public.deal_query_cache enable row level security;
alter table public.postal_code_refresh enable row level security;
alter table public.household_favorite_store enable row level security;
alter table public.shopping_list enable row level security;
alter table public.shopping_list_item enable row level security;
alter table public.pantry_item enable row level security;
alter table public.recipe enable row level security;
alter table public.recipe_ingredient enable row level security;
alter table public.recipe_readiness enable row level security;
alter table public.ingredient_match_override enable row level security;
alter table public.meal_plan_entry enable row level security;
alter table public.bill enable row level security;
alter table public.bill_payment_log enable row level security;
alter table public.chore enable row level security;
alter table public.chore_completion enable row level security;
alter table public.errand enable row level security;
alter table public.notification_preference enable row level security;
alter table public.push_subscription enable row level security;
alter table public.notification enable row level security;
alter table public.app_error enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Household-scoped tables: membership in household_id
-- ---------------------------------------------------------------------------------------------

do $$
declare
  scoped text;
begin
  foreach scoped in array array[
    'household_favorite_store',
    'shopping_list',
    'pantry_item',
    'recipe',
    'recipe_readiness',
    'ingredient_match_override',
    'meal_plan_entry',
    'chore',
    'errand'
  ] loop
    execute pg_catalog.format(
      'create policy household_read on public.%I
         for select using (public.is_household_member(household_id))',
      scoped
    );
    execute pg_catalog.format(
      'create policy household_write on public.%I
         for all using (public.is_household_member(household_id))
         with check (public.is_household_member(household_id))',
      scoped
    );
    execute pg_catalog.format(
      'grant select, insert, update, delete on public.%I to authenticated',
      scoped
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Child tables: membership through the parent's household
-- ---------------------------------------------------------------------------------------------

create policy household_read on public.shopping_list_item
  for select using (
    exists (
      select 1 from public.shopping_list l
      where l.id = list_id and public.is_household_member(l.household_id)
    )
  );
create policy household_write on public.shopping_list_item
  for all using (
    exists (
      select 1 from public.shopping_list l
      where l.id = list_id and public.is_household_member(l.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.shopping_list l
      where l.id = list_id and public.is_household_member(l.household_id)
    )
  );

create policy household_read on public.recipe_ingredient
  for select using (
    exists (
      select 1 from public.recipe r
      where r.id = recipe_id and public.is_household_member(r.household_id)
    )
  );
create policy household_write on public.recipe_ingredient
  for all using (
    exists (
      select 1 from public.recipe r
      where r.id = recipe_id and public.is_household_member(r.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.recipe r
      where r.id = recipe_id and public.is_household_member(r.household_id)
    )
  );

create policy household_read on public.chore_completion
  for select using (
    exists (
      select 1 from public.chore c
      where c.id = chore_id and public.is_household_member(c.household_id)
    )
  );
create policy household_write on public.chore_completion
  for all using (
    exists (
      select 1 from public.chore c
      where c.id = chore_id and public.is_household_member(c.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.chore c
      where c.id = chore_id and public.is_household_member(c.household_id)
    )
  );

-- A payment log row follows its bill's policy, household or personal.
create policy bill_read on public.bill_payment_log
  for select using (public.can_access_bill(bill_id));
create policy bill_write on public.bill_payment_log
  for all using (public.can_access_bill(bill_id))
  with check (public.can_access_bill(bill_id));

grant select, insert, update, delete on
  public.shopping_list_item,
  public.recipe_ingredient,
  public.chore_completion,
  public.bill_payment_log
to authenticated;

-- ---------------------------------------------------------------------------------------------
-- bill: household bills by membership, personal bills by owner only
-- ---------------------------------------------------------------------------------------------

create policy household_read on public.bill
  for select using (
    visibility = 'household' and public.is_household_member(household_id)
  );
create policy household_write on public.bill
  for all using (
    visibility = 'household' and public.is_household_member(household_id)
  )
  with check (
    visibility = 'household' and public.is_household_member(household_id)
  );

create policy personal_read on public.bill
  for select using (visibility = 'personal' and owner_user_id = (select auth.uid()));
create policy personal_write on public.bill
  for all using (visibility = 'personal' and owner_user_id = (select auth.uid()))
  with check (visibility = 'personal' and owner_user_id = (select auth.uid()));

grant select, insert, update, delete on public.bill to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Own rows only: profile, notification_preference, push_subscription
-- ---------------------------------------------------------------------------------------------

-- The profile row is created by the auth.users trigger and never deleted by a user. The active
-- household can only be one the caller belongs to; email follows auth.users.
create policy own_read on public.profile
  for select using (id = (select auth.uid()));
create policy own_update on public.profile
  for update using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (active_household_id is null or public.is_household_member(active_household_id))
  );

grant select on public.profile to authenticated;
grant update (
  display_name,
  timezone,
  active_household_id,
  quiet_hours_start,
  quiet_hours_end,
  household_bill_reminders
) on public.profile to authenticated;

create policy own_rows on public.notification_preference
  for all using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (household_id is null or public.is_household_member(household_id))
  );

create policy own_rows on public.push_subscription
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on
  public.notification_preference,
  public.push_subscription
to authenticated;

-- ---------------------------------------------------------------------------------------------
-- notification: own rows readable; unsent list_activity and chore_rotation rows writable by a
-- co-member of the target's household. Everything else is written by jobs as service_role.
-- ---------------------------------------------------------------------------------------------

create policy own_read on public.notification
  for select using (user_id = (select auth.uid()));

-- The batching upsert (Requirements, "Rules") and the undo of a completion read the row they
-- change, so the writable rows are also readable.
create policy member_event_read on public.notification
  for select using (
    sent_at is null and public.can_write_member_notification(type, target_id, user_id)
  );
create policy member_event_insert on public.notification
  for insert with check (
    sent_at is null and public.can_write_member_notification(type, target_id, user_id)
  );
create policy member_event_update on public.notification
  for update using (
    sent_at is null and public.can_write_member_notification(type, target_id, user_id)
  )
  with check (
    sent_at is null and public.can_write_member_notification(type, target_id, user_id)
  );
-- Undoing a completion deletes its unsent chore_rotation row in the same request.
create policy member_event_delete on public.notification
  for delete using (
    sent_at is null and public.can_write_member_notification(type, target_id, user_id)
  );

grant select, insert, update, delete on public.notification to authenticated;

-- ---------------------------------------------------------------------------------------------
-- household and household_member: read by membership. Rows are created, deleted, and have
-- their roles changed only by the membership functions. The admin edits the household's name,
-- postal code, and timezone directly.
-- ---------------------------------------------------------------------------------------------

create policy member_read on public.household
  for select using (public.is_household_member(id));
create policy admin_update on public.household
  for update using (public.is_household_admin(id))
  with check (public.is_household_admin(id));

grant select on public.household to authenticated;
grant update (name, postal_code, timezone) on public.household to authenticated;

create policy member_read on public.household_member
  for select using (public.is_household_member(household_id));

grant select on public.household_member to authenticated;

-- ---------------------------------------------------------------------------------------------
-- household_invite: the household's admin only. Revoking is the one update, and it is final.
-- ---------------------------------------------------------------------------------------------

create policy admin_read on public.household_invite
  for select using (public.is_household_admin(household_id));
create policy admin_insert on public.household_invite
  for insert with check (
    public.is_household_admin(household_id) and created_by = (select auth.uid())
  );
create policy admin_revoke on public.household_invite
  for update using (public.is_household_admin(household_id) and revoked_at is null)
  with check (public.is_household_admin(household_id) and revoked_at is not null);

-- The admin supplies only the household and the two hashes. created_at, expires_at, created_by,
-- and revoked_at take their defaults: a caller-chosen created_at would satisfy the seven-day
-- check while minting an invite that lives for years.
grant select on public.household_invite to authenticated;
grant insert (household_id, token_hash, code_hash) on public.household_invite to authenticated;
grant update (revoked_at) on public.household_invite to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Deals: by postal code of a household the caller belongs to. Pruning is a job.
-- ---------------------------------------------------------------------------------------------

do $$
declare
  shared_by_postal_code text;
begin
  foreach shared_by_postal_code in array array['deal', 'deal_query_cache', 'postal_code_refresh']
  loop
    execute pg_catalog.format(
      'create policy postal_code_read on public.%I
         for select using (public.is_member_postal_code(postal_code))',
      shared_by_postal_code
    );
    execute pg_catalog.format(
      'create policy postal_code_insert on public.%I
         for insert with check (public.is_member_postal_code(postal_code))',
      shared_by_postal_code
    );
    execute pg_catalog.format(
      'create policy postal_code_update on public.%I
         for update using (public.is_member_postal_code(postal_code))
         with check (public.is_member_postal_code(postal_code))',
      shared_by_postal_code
    );
    execute pg_catalog.format(
      'grant select, insert, update on public.%I to authenticated',
      shared_by_postal_code
    );
  end loop;
end
$$;

-- app_error: RLS on, no policy, no grant. Written only through record_app_error.
