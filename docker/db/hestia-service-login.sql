-- Gives hestia_service LOGIN and its password from HESTIA_SERVICE_DB_PASSWORD in the db
-- container's environment (from .env), so the password never enters a migration. Idempotent:
-- it runs when the database is initialized and again on every deploy, after migrations, which
-- also applies a rotated password.
\set pw `echo "$HESTIA_SERVICE_DB_PASSWORD"`

alter role hestia_service with login password :'pw';
