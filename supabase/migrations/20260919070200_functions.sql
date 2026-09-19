-- Membership lifecycle, activity, error-recording, and health functions (Technical Architecture,
-- "Membership lifecycle functions", "Error recording", "Health checks").
--
-- Each is security definer with an empty search_path and fully qualified names, and checks its
-- caller with auth.uid() before doing anything. The service calls them inside withUserDb, so
-- auth.uid() is the requesting user. Errors carry a SQLSTATE the service maps to a response:
--
--   42501  the caller fails the function's check (not signed in, not a member, not the admin)
--   P0002  the named member is not in the household
--   22023  an argument is invalid (name, postal code, timezone, a reassignment)
--   HR001  the invite has expired or was revoked
--   HR002  no invite matches the link or code
--   HR003  a departure left something unassigned
--   HR004  the typed household name does not match (deleting the household)

-- ---------------------------------------------------------------------------------------------
-- Internal helpers (no grants: only the functions below call them)
-- ---------------------------------------------------------------------------------------------

create function public.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  return caller;
end;
$$;

-- Removes a member from a rotation order and rebases rotation_offset so the turn stays with the
-- same person (Requirements, "Rotation"). With cur the index whose turn it was and i the removed
-- index: cur' = cur - 1 if i < cur, cur if i > cur, cur mod (n - 1) if i = cur (the next member
-- takes the turn); the new offset is (cur' - completion_count) mod (n - 1). An order that loses
-- its last member becomes null. Returns the new order, offset, and who holds the turn after.
create function public.rebase_rotation(
  rotation_order uuid[],
  rotation_offset integer,
  completion_count integer,
  removed uuid,
  out new_order uuid[],
  out new_offset integer,
  out turn_holder uuid
)
language plpgsql
immutable
set search_path = ''
as $$
declare
  n integer;
  i integer;
  cur integer;
  next_cur integer;
begin
  new_order := rotation_order;
  new_offset := rotation_offset;

  -- A member listed twice is removed each time, rebasing after each removal.
  loop
    i := pg_catalog.array_position(new_order, removed);
    exit when i is null;
    i := i - 1;
    n := pg_catalog.cardinality(new_order);

    if n = 1 then
      new_order := null;
      new_offset := 0;
      exit;
    end if;

    cur := (new_offset + completion_count) % n;
    next_cur := case
      when i < cur then cur - 1
      when i > cur then cur
      else cur % (n - 1)
    end;
    new_order := new_order[1:i] || new_order[i + 2:n];
    new_offset := (((next_cur - completion_count) % (n - 1)) + (n - 1)) % (n - 1);
  end loop;

  if new_order is null then
    turn_holder := null;
  else
    turn_holder := new_order[
      ((new_offset + completion_count) % pg_catalog.cardinality(new_order)) + 1
    ];
  end if;
end;
$$;

-- Invite codes are Crockford Base32. Decoding is forgiving the way Crockford specifies: case,
-- spaces, and hyphens are ignored, I and L read as 1, O as 0. U is not in the alphabet. Returns
-- null when the input cannot be a code.
create function public.normalize_invite_code(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when normalized ~ '^[0-9A-HJKMNP-TV-Z]{8}$' then normalized end
  from (
    select pg_catalog.translate(
      pg_catalog.upper(pg_catalog.regexp_replace(coalesce(input, ''), '[[:space:]-]', '', 'g')),
      'ILO',
      '110'
    ) as normalized
  ) s;
$$;

-- SHA-256 as lowercase hex: how invite tokens and codes are stored.
create function public.sha256_hex(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(extensions.digest(input, 'sha256'), 'hex');
$$;

-- ---------------------------------------------------------------------------------------------
-- create_household
-- ---------------------------------------------------------------------------------------------

create function public.create_household(name text, postal_code text, timezone text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := public.require_user();
  new_id uuid;
begin
  if name is null or pg_catalog.btrim(name) = '' then
    raise exception 'household name is required' using errcode = '22023';
  end if;
  if postal_code is null or postal_code !~ '^[0-9]{5}$' then
    raise exception 'postal code must be five digits' using errcode = '22023';
  end if;
  if timezone is null
    or not exists (select 1 from pg_catalog.pg_timezone_names tz where tz.name = timezone)
  then
    raise exception 'unknown timezone' using errcode = '22023';
  end if;

  insert into public.household (name, postal_code, timezone, created_by)
  values (pg_catalog.btrim(name), postal_code, timezone, caller)
  returning id into new_id;

  insert into public.household_member (household_id, user_id, role)
  values (new_id, caller, 'admin');

  update public.profile set active_household_id = new_id where id = caller;

  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- household_members: co-members' names. profile is own-row only, so this is the one way to see
-- another member's name, and it returns nothing beyond id, name, role, and join date.
-- ---------------------------------------------------------------------------------------------

create function public.household_members(hid uuid)
returns table (user_id uuid, display_name text, role public.household_role, joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_user();
  if not public.is_household_member(hid) then
    raise exception 'not a member of this household' using errcode = '42501';
  end if;

  return query
    select m.user_id, p.display_name, m.role, m.joined_at
    from public.household_member m
    join public.profile p on p.id = m.user_id
    where m.household_id = hid
    order by m.joined_at, m.user_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- mark_household_active: last_active_at, at most once per UTC day. Any member's request counts,
-- but only the admin may update the household row directly, so this is a function.
-- ---------------------------------------------------------------------------------------------

create function public.mark_household_active(hid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_user();
  if not public.is_household_member(hid) then
    raise exception 'not a member of this household' using errcode = '42501';
  end if;

  update public.household
  set last_active_at = now()
  where id = hid
    and last_active_at < pg_catalog.date_trunc('day', now(), 'UTC');
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- departure_preview
-- ---------------------------------------------------------------------------------------------

create function public.departure_preview(hid uuid, departing_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := public.require_user();
  household_name text;
  remaining integer;
  is_last boolean;
  result jsonb;
begin
  if not (
    (caller = departing_user_id and public.is_household_member(hid))
    or public.is_household_admin(hid)
  ) then
    raise exception 'only the member or the admin can preview a departure'
      using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.household_member
    where household_id = hid and user_id = departing_user_id
  ) then
    raise exception 'not a member of this household' using errcode = 'P0002';
  end if;

  select h.name into household_name from public.household h where h.id = hid;
  select count(*) into remaining
  from public.household_member
  where household_id = hid and user_id <> departing_user_id;
  is_last := remaining = 0;

  result := pg_catalog.jsonb_build_object(
    'household_id', hid,
    'household_name', household_name,
    'user_id', departing_user_id,
    'is_last_member', is_last,
    -- What deleting the household would lose, for the typed-name confirmation.
    'deletion_counts', pg_catalog.jsonb_build_object(
      'lists', (select count(*) from public.shopping_list where household_id = hid),
      'pantry_items', (select count(*) from public.pantry_item where household_id = hid),
      'recipes', (select count(*) from public.recipe where household_id = hid),
      'meal_plan_entries', (select count(*) from public.meal_plan_entry where household_id = hid),
      'chores', (select count(*) from public.chore where household_id = hid),
      'errands', (select count(*) from public.errand where household_id = hid),
      'bills', (select count(*) from public.bill where household_id = hid)
    )
  );

  -- The last member has nobody to reassign to; the household is deleted instead.
  if is_last then
    return result || pg_catalog.jsonb_build_object(
      'lists', '[]'::jsonb, 'chores', '[]'::jsonb, 'errands', '[]'::jsonb,
      'bills', '[]'::jsonb, 'rotations', '[]'::jsonb
    );
  end if;

  return result || pg_catalog.jsonb_build_object(
    'lists', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('id', l.id, 'name', l.name) order by l.created_at, l.id
      )
      from public.shopping_list l
      where l.household_id = hid and l.created_by = departing_user_id
    ), '[]'::jsonb),
    'chores', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('id', c.id, 'name', c.name) order by c.created_at, c.id
      )
      from public.chore c
      where c.household_id = hid and c.assigned_to = departing_user_id
    ), '[]'::jsonb),
    'errands', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('id', e.id, 'name', e.name) order by e.created_at, e.id
      )
      from public.errand e
      where e.household_id = hid and e.assigned_to = departing_user_id and e.status = 'open'
    ), '[]'::jsonb),
    'bills', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('id', b.id, 'name', b.name) order by b.created_at, b.id
      )
      from public.bill b
      where b.household_id = hid
        and b.owner_user_id = departing_user_id
        and b.archived_at is null
    ), '[]'::jsonb),
    'rotations', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'chore_id', c.id,
          'chore_name', c.name,
          'next_turn_user_id', r.turn_holder
        ) order by c.created_at, c.id
      )
      from public.chore c
      cross join lateral public.rebase_rotation(
        c.rotation_order,
        c.rotation_offset,
        (select count(*)::integer from public.chore_completion cc where cc.chore_id = c.id),
        departing_user_id
      ) r
      where c.household_id = hid and departing_user_id = any (c.rotation_order)
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- depart_household: leave (caller is the member) or remove (caller is the admin)
-- ---------------------------------------------------------------------------------------------

-- `reassignments` is a JSON object mapping the id of each owned list, chore, errand, and bill
-- (the ones departure_preview returns) to a remaining member's id. It is ignored when the
-- departing member is the last one.
create function public.depart_household(
  hid uuid,
  departing_user_id uuid,
  reassignments jsonb,
  confirm_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := public.require_user();
  departing_role public.household_role;
  household_name text;
  owned uuid[];
  item_key text;
  item_value jsonb;
  missing integer;
  promoted uuid;
  rotating record;
  rebased record;
  next_active uuid;
  deleted boolean := false;
begin
  if not (
    (caller = departing_user_id and public.is_household_member(hid))
    or public.is_household_admin(hid)
  ) then
    raise exception 'only the member or the admin can complete a departure'
      using errcode = '42501';
  end if;

  -- Serializes departures from one household, so two can never both think the other remains.
  select h.name into household_name from public.household h where h.id = hid for update;

  select m.role into departing_role
  from public.household_member m
  where m.household_id = hid and m.user_id = departing_user_id;
  if departing_role is null then
    raise exception 'not a member of this household' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.household_member
    where household_id = hid and user_id <> departing_user_id
  ) then
    -- The last member: the household and all its data go, after the typed-name confirmation.
    -- Personal bills have no household and are untouched.
    if confirm_name is distinct from household_name then
      raise exception 'the household name does not match' using errcode = 'HR004';
    end if;
    delete from public.household where id = hid;
    deleted := true;
  else
    reassignments := coalesce(reassignments, '{}'::jsonb);
    if pg_catalog.jsonb_typeof(reassignments) <> 'object' then
      raise exception 'reassignments must be an object' using errcode = '22023';
    end if;

    owned := array(
      select l.id from public.shopping_list l
      where l.household_id = hid and l.created_by = departing_user_id
      union all
      select c.id from public.chore c
      where c.household_id = hid and c.assigned_to = departing_user_id
      union all
      select e.id from public.errand e
      where e.household_id = hid and e.assigned_to = departing_user_id and e.status = 'open'
      union all
      select b.id from public.bill b
      where b.household_id = hid
        and b.owner_user_id = departing_user_id
        and b.archived_at is null
    );

    for item_key, item_value in select key, value from pg_catalog.jsonb_each(reassignments) loop
      if item_key !~ '^[0-9a-fA-F-]{36}$' or not (item_key::uuid = any (owned)) then
        raise exception 'reassignment names something the member does not own: %', item_key
          using errcode = '22023';
      end if;
      if pg_catalog.jsonb_typeof(item_value) <> 'string'
        or (item_value #>> '{}') !~ '^[0-9a-fA-F-]{36}$'
        or (item_value #>> '{}')::uuid = departing_user_id
        or not exists (
          select 1 from public.household_member m
          where m.household_id = hid and m.user_id = (item_value #>> '{}')::uuid
        )
      then
        raise exception 'reassignment for % is not a remaining member', item_key
          using errcode = '22023';
      end if;
    end loop;

    select count(*) into missing
    from pg_catalog.unnest(owned) o(id)
    where not (reassignments ? o.id::text);
    if missing > 0 then
      raise exception '% owned item(s) are not reassigned', missing using errcode = 'HR003';
    end if;

    update public.shopping_list l
    set created_by = (reassignments ->> l.id::text)::uuid
    where l.household_id = hid and l.created_by = departing_user_id;

    update public.chore c
    set assigned_to = (reassignments ->> c.id::text)::uuid
    where c.household_id = hid and c.assigned_to = departing_user_id;

    update public.errand e
    set assigned_to = (reassignments ->> e.id::text)::uuid
    where e.household_id = hid and e.assigned_to = departing_user_id and e.status = 'open';

    update public.bill b
    set owner_user_id = (reassignments ->> b.id::text)::uuid
    where b.household_id = hid
      and b.owner_user_id = departing_user_id
      and b.archived_at is null;

    for rotating in
      select c.id, c.rotation_order, c.rotation_offset,
        (select count(*)::integer from public.chore_completion cc where cc.chore_id = c.id)
          as completion_count
      from public.chore c
      where c.household_id = hid and departing_user_id = any (c.rotation_order)
      for update of c
    loop
      select * into rebased
      from public.rebase_rotation(
        rotating.rotation_order,
        rotating.rotation_offset,
        rotating.completion_count,
        departing_user_id
      );
      update public.chore
      set rotation_order = rebased.new_order, rotation_offset = rebased.new_offset
      where id = rotating.id;
    end loop;

    delete from public.household_member
    where household_id = hid and user_id = departing_user_id;

    -- The admin may leave without transferring: the longest-tenured remaining member takes over.
    if departing_role = 'admin' then
      select m.user_id into promoted
      from public.household_member m
      where m.household_id = hid
      order by m.joined_at, m.user_id
      limit 1;
      update public.household_member
      set role = 'admin'
      where household_id = hid and user_id = promoted;
    end if;

    -- Anything still queued for the departed member about this household would reach them
    -- after they lost access.
    delete from public.notification n
    where n.user_id = departing_user_id
      and n.sent_at is null
      and n.payload ->> 'householdId' = hid::text;
  end if;

  -- The departed user's active household moves to their longest-held remaining membership, or
  -- null, if it was the one they left (a deleted household has already nulled it).
  select m.household_id into next_active
  from public.household_member m
  where m.user_id = departing_user_id
  order by m.joined_at, m.household_id
  limit 1;

  update public.profile
  set active_household_id = next_active
  where id = departing_user_id
    and (active_household_id is null or active_household_id = hid);

  return pg_catalog.jsonb_build_object(
    'household_deleted', deleted,
    'promoted_user_id', promoted
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- transfer_admin
-- ---------------------------------------------------------------------------------------------

create function public.transfer_admin(hid uuid, new_admin_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := public.require_user();
begin
  if not public.is_household_admin(hid) then
    raise exception 'only the admin can transfer the admin role' using errcode = '42501';
  end if;
  if new_admin_id is null or new_admin_id = caller then
    raise exception 'the new admin must be another member' using errcode = '22023';
  end if;

  perform 1 from public.household h where h.id = hid for update;
  if not exists (
    select 1 from public.household_member
    where household_id = hid and user_id = new_admin_id
  ) then
    raise exception 'not a member of this household' using errcode = 'P0002';
  end if;

  -- Demote first: at most one admin row may exist at any moment.
  update public.household_member set role = 'member'
  where household_id = hid and user_id = caller;
  update public.household_member set role = 'admin'
  where household_id = hid and user_id = new_admin_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- redeem_invite: by link token or typed code
-- ---------------------------------------------------------------------------------------------

create function public.redeem_invite(token_or_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := public.require_user();
  input text := pg_catalog.btrim(coalesce(token_or_code, ''));
  code text := public.normalize_invite_code(token_or_code);
  invite record;
begin
  if input = '' then
    raise exception 'no invite matches' using errcode = 'HR002';
  end if;

  select i.household_id, i.expires_at, i.revoked_at into invite
  from public.household_invite i
  where i.token_hash = public.sha256_hex(input)
    or (code is not null and i.code_hash = public.sha256_hex(code))
  limit 1;

  if not found then
    raise exception 'no invite matches' using errcode = 'HR002';
  end if;
  if invite.revoked_at is not null or invite.expires_at <= now() then
    raise exception 'the invite has expired' using errcode = 'HR001';
  end if;

  insert into public.household_member (household_id, user_id, role)
  values (invite.household_id, caller, 'member')
  on conflict (household_id, user_id) do nothing;

  update public.profile set active_household_id = invite.household_id where id = caller;

  return invite.household_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- record_app_error: the only way into app_error, callable as anon
-- ---------------------------------------------------------------------------------------------

create function public.record_app_error(fingerprint text, message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_error as e (fingerprint, message)
  values (fingerprint, pg_catalog.left(coalesce(message, ''), 500))
  on conflict on constraint app_error_pkey do update
    set count = e.count + 1, last_seen = now();
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- system_health: aggregates only, for GET /api/health/deep (the service checks the owner)
-- ---------------------------------------------------------------------------------------------

create function public.system_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'newest_deal_fetched_at', (select max(d.fetched_at) from public.deal d),
    'newest_notification_sent_at', (select max(n.sent_at) from public.notification n),
    'recent_errors', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(top) order by top.count desc, top.last_seen desc)
      from (
        select e.fingerprint, e.message, e.count, e.first_seen, e.last_seen
        from public.app_error e
        where e.last_seen > now() - interval '24 hours'
        order by e.count desc, e.last_seen desc
        limit 10
      ) top
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------

revoke all on function
  public.require_user(),
  public.rebase_rotation(uuid[], integer, integer, uuid),
  public.normalize_invite_code(text),
  public.sha256_hex(text),
  public.create_household(text, text, text),
  public.household_members(uuid),
  public.mark_household_active(uuid),
  public.departure_preview(uuid, uuid),
  public.depart_household(uuid, uuid, jsonb, text),
  public.transfer_admin(uuid, uuid),
  public.redeem_invite(text),
  public.record_app_error(text, text),
  public.system_health()
from public, anon, authenticated;

grant execute on function
  public.create_household(text, text, text),
  public.household_members(uuid),
  public.mark_household_active(uuid),
  public.departure_preview(uuid, uuid),
  public.depart_household(uuid, uuid, jsonb, text),
  public.transfer_admin(uuid, uuid),
  public.redeem_invite(text)
to authenticated, service_role;

-- Recent error messages may name users and households from anywhere on the server, so no
-- signed-in user may read them. The service switches to service_role for this one call, after
-- it has checked that the caller is the server owner.
grant execute on function public.system_health() to service_role;

grant execute on function public.record_app_error(text, text)
to anon, authenticated, service_role;
