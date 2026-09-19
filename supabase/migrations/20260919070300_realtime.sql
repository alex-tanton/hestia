-- The tables the PWA subscribes to (Technical Architecture, "Migrations"). Realtime applies the
-- same RLS policies to these streams, as the subscribing user.
--
-- The Supabase Postgres image creates the supabase_realtime publication at initialization, both
-- under `supabase start` and in the Compose `db` service; it is created here only if missing.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;

alter publication supabase_realtime add table
  public.shopping_list,
  public.shopping_list_item,
  public.chore_completion,
  public.errand;
