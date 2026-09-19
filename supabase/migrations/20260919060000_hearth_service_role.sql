-- hearth_service is the login role the Node service connects as (Technical Architecture, "The
-- RLS rule"). It is a member of anon, authenticated, and service_role so it can `set role` into
-- each, and has no other privileges. NOINHERIT keeps it that way: until a transaction switches
-- role it holds none of those roles' rights, so a query that forgets to switch fails instead of
-- running with them.
--
-- Created NOLOGIN, with no password: LOGIN and the password come from .env through
-- docker/db/hearth-service-login.sql. Idempotent, so a fresh database or a restore target can be
-- given the role by running this file again; memberships already held are not granted twice.
do $$
declare
  target text;
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'hearth_service') then
    create role hearth_service nologin noinherit;
  end if;

  foreach target in array array['anon', 'authenticated', 'service_role'] loop
    if not pg_catalog.pg_has_role('hearth_service', target, 'member') then
      execute pg_catalog.format('grant %I to hearth_service', target);
    end if;
  end loop;
end
$$;
