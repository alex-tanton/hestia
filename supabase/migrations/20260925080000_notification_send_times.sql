-- Send-time helpers for the notification outbox (Technical Architecture, "Scheduled jobs ›
-- Dispatch"): `send_after` is set when a row is written, and a time that falls inside the
-- recipient's quiet hours moves to the end of that window rather than being dropped.
--
-- Both resolve against a named timezone, which the Requirements document requires for every date
-- the user owns (Handoff non-negotiable 8): personal send times follow `profile.timezone`, never
-- the server's. They live in SQL because Postgres already has correct, DST-aware local-time
-- arithmetic, and every writer of an outbox row needs the same answer.
--
-- `stable` rather than `immutable`: `at time zone` depends on the timezone database.

create function public.next_local_time(after timestamptz, tz text, at_local time)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when (pg_catalog.date_trunc('day', after at time zone tz) + at_local) at time zone tz > after
      then (pg_catalog.date_trunc('day', after at time zone tz) + at_local) at time zone tz
    else (pg_catalog.date_trunc('day', after at time zone tz) + interval '1 day' + at_local)
         at time zone tz
  end;
$$;

comment on function public.next_local_time(timestamptz, text, time) is
  'The first instant strictly after `after` at which the local clock in `tz` reads `at_local`.';

create function public.after_quiet_hours(
  send_at timestamptz,
  tz text,
  quiet_start time,
  quiet_end time
)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  -- Quiet hours are either both set or both null. A window that crosses midnight is the union of
  -- two ranges, which is why the two comparisons differ by direction rather than by clamping.
  select case
    when quiet_start is null or quiet_end is null or quiet_start = quiet_end then send_at
    when (
      quiet_start < quiet_end
        and (send_at at time zone tz)::time >= quiet_start
        and (send_at at time zone tz)::time < quiet_end
    ) or (
      quiet_start > quiet_end
        and (
          (send_at at time zone tz)::time >= quiet_start
            or (send_at at time zone tz)::time < quiet_end
        )
    )
      -- The end of the window, which is the first moment delivery is allowed again. Stepping back
      -- a microsecond keeps a `send_at` that already equals the window's end where it is.
      then public.next_local_time(send_at - interval '1 microsecond', tz, quiet_end)
    else send_at
  end;
$$;

comment on function public.after_quiet_hours(timestamptz, text, time, time) is
  'Moves a send time inside the recipient''s quiet hours to the end of that window.';

revoke all on function
  public.next_local_time(timestamptz, text, time),
  public.after_quiet_hours(timestamptz, text, time, time)
from public, anon, authenticated;

-- Outbox rows for scheduled types are written by jobs, as service_role; the request-written types
-- (`list_activity`, `chore_rotation`) are written by the caller, so `authenticated` needs them too.
grant execute on function
  public.next_local_time(timestamptz, text, time),
  public.after_quiet_hours(timestamptz, text, time, time)
to authenticated, service_role;
