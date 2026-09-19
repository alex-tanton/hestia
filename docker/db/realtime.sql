-- Realtime keeps its tenant and migration metadata in _realtime.
\set pguser `echo "$POSTGRES_USER"`

create schema if not exists _realtime;
alter schema _realtime owner to :pguser;
