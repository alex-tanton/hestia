-- GoTrue connects as supabase_auth_admin. The other roles Supabase's self-hosting stack gives
-- passwords to (authenticator, pgbouncer, storage, functions) serve services Hearth does not
-- run, so they keep no password and cannot log in.
\set pgpass `echo "$POSTGRES_PASSWORD"`

alter user supabase_auth_admin with password :'pgpass';
