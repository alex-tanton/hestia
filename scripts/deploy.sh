#!/usr/bin/env bash
# Deploys the checked-out commit to this box.
# Run by .github/workflows/deploy.yml on the self-hosted runner, or by hand from a checkout:
#
#   scripts/deploy.sh
#
#   HEARTH_ENV_FILE     the host's .env (default /srv/hearth/.env, outside any checkout)
#   HEARTH_DEPLOY_SHA   the commit being deployed (default: git HEAD)
#
# Steps: build both images tagged with the commit SHA; back up the database; apply pending
# migrations; restart hearth-service and caddy on the new images; require GET /api/health
# through Caddy within 60 seconds, else roll both back to the images that were running.
# A failed build, backup, or migration aborts before anything is restarted. Safe to re-run.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${HEARTH_ENV_FILE:-/srv/hearth/.env}"
sha="${HEARTH_DEPLOY_SHA:-$(git -C "$repo_root" rev-parse HEAD)}"
new_tag="${sha:0:12}"
health_url="http://127.0.0.1:8080/api/health"
health_timeout_seconds=60
images=(hearth-service hearth-caddy)
# Old SHA-tagged images kept per image, for manual rollback beyond the automatic one.
keep_tags=5

log() { printf '%s deploy: %s\n' "$(date -u +%FT%TZ)" "$*"; }
fail() {
  log "FAILED: $*"
  exit 1
}
compose() {
  docker compose --env-file "$env_file" -f "$repo_root/docker/docker-compose.yml" "$@"
}
env_value() { sed -n "s/^$1=//p" "$env_file" | tail -n 1; }
image_id() { docker image inspect --format '{{.Id}}' "$1" 2>/dev/null || true; }
revision_of() {
  docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
    "$1" 2>/dev/null || true
}

healthy_within() {
  local deadline=$((SECONDS + $1))
  while ((SECONDS < deadline)); do
    if curl --silent --fail --max-time 5 --output /dev/null "$health_url"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# Points :current at the given images and recreates the two containers on them.
switch_to() {
  docker tag "$1" hearth-service:current
  docker tag "$2" hearth-caddy:current
  compose up --detach --no-deps --no-build hearth-service caddy
}

[[ -r "$env_file" ]] || fail "cannot read $env_file (set HEARTH_ENV_FILE)"
command -v supabase >/dev/null || fail "the Supabase CLI is not installed"
cd "$repo_root"

log "deploying $new_tag"

# 1. Record what is running now; it is the rollback target.
prev_service="$(image_id hearth-service:current)"
prev_caddy="$(image_id hearth-caddy:current)"
if [[ -n "$prev_service" && -n "$prev_caddy" ]]; then
  log "previous: hearth-service $(revision_of hearth-service:current)," \
    "hearth-caddy $(revision_of hearth-caddy:current)"
else
  log "previous: none (first deploy; there is nothing to roll back to)"
fi

# 2. Build. Nothing is restarted yet, so a failed build changes nothing.
log "building hearth-service:$new_tag and hearth-caddy:$new_tag"
HEARTH_TAG="$new_tag" compose build hearth-service caddy || fail "build failed; nothing restarted"

# The Supabase services and backup must be running for the backup and migrations. Only
# missing containers are started: a deploy never recreates the database.
compose up --detach --wait --no-recreate --no-build db auth realtime kong backup ||
  fail "the Supabase services are not healthy; nothing restarted"

# 3. Backup, immediately before migrations.
log "backing up the database"
compose exec -T backup /backup.sh || fail "backup failed; nothing migrated or restarted"

# 4. Migrations, with the Supabase CLI against the Compose database. The database publishes no
# port, so the CLI connects to the container's address on the Compose network. The password goes
# in PGPASSWORD for this one command, never in the URL, because a command line shows in the
# process list.
db_container="$(compose ps --quiet db)"
db_ip="$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
  "$db_container")"
[[ -n "$db_ip" ]] || fail "cannot find the db container's address; nothing restarted"
log "applying pending migrations"
PGPASSWORD="$(env_value POSTGRES_PASSWORD)" supabase migration up --workdir "$repo_root" \
  --db-url "postgresql://postgres@${db_ip}:5432/postgres?sslmode=disable" ||
  fail "migration failed; nothing restarted (the backup above is the restore point)"

# hearth_service's LOGIN and password come from .env, not a migration; re-applying them is
# idempotent and picks up a rotated password.
compose exec -T db psql --username supabase_admin --dbname postgres --quiet \
  --set ON_ERROR_STOP=1 --file - <docker/db/hearth-service-login.sql ||
  fail "setting the hearth_service login failed; nothing restarted"

# 5. Restart on the new images, gated on health.
log "restarting hearth-service and caddy on $new_tag"
switch_to "hearth-service:$new_tag" "hearth-caddy:$new_tag"
if healthy_within "$health_timeout_seconds"; then
  log "healthy; deployed $new_tag"
else
  log "GET /api/health did not succeed within ${health_timeout_seconds}s"
  compose logs --tail 30 hearth-service caddy || true
  if [[ -z "$prev_service" || -z "$prev_caddy" ]]; then
    fail "$new_tag is unhealthy and there is no previous image to roll back to"
  fi
  log "rolling back to the previous images"
  switch_to "$prev_service" "$prev_caddy"
  if healthy_within "$health_timeout_seconds"; then
    fail "$new_tag was unhealthy; rolled back, and the previous images are healthy"
  fi
  fail "$new_tag was unhealthy; rolled back, but the previous images are not healthy either"
fi

# 6. Keep the newest few SHA tags; an image a container still uses is never removed.
for image in "${images[@]}"; do
  docker image ls "$image" --format '{{.Tag}}' |
    { grep -Ev "^(current|$new_tag|<none>)$" || true; } |
    tail -n +"$((keep_tags + 1))" |
    while read -r tag; do docker image rm "$image:$tag" >/dev/null 2>&1 || true; done
done
