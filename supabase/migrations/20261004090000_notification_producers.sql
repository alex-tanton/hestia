-- Rules the notification producers share (Technical Architecture, "Scheduled jobs" › "Dispatch").
--
--   notification_wanted: whether a recipient receives a type, with the defaults applied when no
--     preference row exists. The scheduled enqueue and the request path both ask it, so the
--     default lives in one place.
--   member_quiet_send_at: the quiet-hours shift for a row a request writes (list activity, chore
--     rotation). The request runs as the caller, and RLS keeps a member from reading another
--     member's profile, so this definer reads the recipient's window and returns only the shifted
--     instant.
--   notification_still_holds: the condition a row was written for, checked again at send time.
--
-- The two that a member's request reaches guard on auth.uid(): a caller may only ask about a
-- co-member. The service role has no JWT, so auth.uid() is null there and the guard passes.

create function public.notification_wanted(
  recipient uuid,
  ntype public.notification_type,
  hid uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
      auth.uid() is null
      or exists (
        select 1
        from public.household_member a
        join public.household_member b on b.household_id = a.household_id
        where a.user_id = auth.uid() and b.user_id = recipient
      )
    )
    and coalesce(
      (
        select np.enabled
        from public.notification_preference np
        where np.user_id = recipient
          and np.notification_type = ntype
          and np.household_id is not distinct from hid
      ),
      case ntype
        when 'bill_due' then true
        when 'chore_due' then true
        when 'chore_rotation' then true
        when 'list_activity' then true
        else false
      end
    )
$$;

create function public.member_quiet_send_at(recipient uuid, send_at timestamptz)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select public.after_quiet_hours(send_at, p.timezone, p.quiet_hours_start, p.quiet_hours_end)
  from public.profile p
  where p.id = recipient
    and (
      auth.uid() is null
      or exists (
        select 1
        from public.household_member a
        join public.household_member b on b.household_id = a.household_id
        where a.user_id = auth.uid() and b.user_id = recipient
      )
    )
$$;

create function public.notification_still_holds(n public.notification)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case n.type
    when 'bill_due' then exists (
      select 1
      from public.bill b
      where b.id = n.target_id
        and b.archived_at is null
        and not exists (
          select 1
          from public.bill_payment_log l
          where l.bill_id = b.id
            and l.occurrence_date = split_part(n.occurrence_key, '/', 1)::date
        )
    )
    -- chore_due covers both chores and errands; an errand's target is never a chore id.
    when 'chore_due' then
      case
        when exists (select 1 from public.errand e where e.id = n.target_id)
          then exists (select 1 from public.errand e where e.id = n.target_id and e.status = 'open')
        else exists (select 1 from public.chore c where c.id = n.target_id)
          and not exists (
            select 1
            from public.chore_completion cc
            where cc.chore_id = n.target_id
              and cc.occurrence_date = n.occurrence_key::date
          )
      end
    when 'meal_reminder' then exists (
      select 1
      from public.meal_plan_entry e
      where e.household_id = n.target_id
        and e.planned_date = n.occurrence_key::date
    )
    -- The nudge's key is the Sunday that starts the week it is about.
    when 'weekly_meal_nudge' then exists (
      select 1
      from public.household_member m
      where m.household_id = n.target_id and m.user_id = n.user_id
    )
      and not exists (
        select 1
        from public.meal_plan_entry e
        where e.household_id = n.target_id
          and e.planned_date between n.occurrence_key::date and n.occurrence_key::date + 6
      )
    else true
  end
$$;

revoke all on function
  public.notification_wanted(uuid, public.notification_type, uuid),
  public.member_quiet_send_at(uuid, timestamptz),
  public.notification_still_holds(public.notification)
from public, anon, authenticated;

grant execute on function
  public.notification_wanted(uuid, public.notification_type, uuid),
  public.member_quiet_send_at(uuid, timestamptz)
to authenticated, service_role;

-- Re-checked at send time by the dispatch job only, so the request path never needs it.
grant execute on function public.notification_still_holds(public.notification) to service_role;
