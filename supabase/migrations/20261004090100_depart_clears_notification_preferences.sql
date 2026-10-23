-- A departure clears the member's notification preferences for the household they leave
-- (Requirements, "Notifications" › "Rules" › "Departure"). Only weekly_meal_nudge is household-scoped,
-- so this removes that row and no per-user setting. The function is replaced whole, with the one
-- added statement, so the rest of its behaviour is unchanged.

create or replace function public.depart_household(
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

  -- Only weekly_meal_nudge is household-scoped; clearing every row the member holds for this
  -- household means no opt-in outlives their access to it, whichever branch below runs.
  delete from public.notification_preference
  where user_id = departing_user_id and household_id = hid;

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
-- canary: never merged
