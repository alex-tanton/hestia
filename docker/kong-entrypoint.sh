#!/bin/sh
# Substitutes the API keys into Kong's declarative config, then starts Kong. Only the two key
# variables are replaced, so nothing else in kong.yml can be changed by the environment.
set -eu

: "${SUPABASE_ANON_KEY:?}"
: "${SUPABASE_SERVICE_KEY:?}"

sed \
  -e "s|\$SUPABASE_ANON_KEY|${SUPABASE_ANON_KEY}|g" \
  -e "s|\$SUPABASE_SERVICE_KEY|${SUPABASE_SERVICE_KEY}|g" \
  /home/kong/temp.yml > "$KONG_DECLARATIVE_CONFIG"

exec /entrypoint.sh kong docker-start
