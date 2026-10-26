#!/usr/bin/env bash
# Pre-pulls the images the E2E stack needs, for CI's `test-e2e` job. Anonymous pulls from
# public.ecr.aws are rate limited per IP and GitHub-hosted runners share IPs, so `docker compose up`
# could fail with toomanyrequests before any test ran. Pulling the images first, with backoff, lets
# Compose find them in the local cache.
#
# Run from the repository root. The image list is read from docker/docker-compose.yml and
# docker/*.Dockerfile (the BuildKit `# syntax=` frontend included, because BuildKit pulls it during
# `--build`), so a Dependabot bump needs no edit here. Images already present are skipped, and the
# hestia-built images, the backup image, the tunnel connector (cloudflare/, which E2E never
# starts) and build-stage names are never pulled.
#
# The three Supabase images (public.ecr.aws/supabase/{name}:{tag}) are also published on
# ghcr.io/supabase by the same publisher with the same manifest digests (checked 2026-10-20). They
# are pulled from there first and tagged with their public.ecr.aws names, so Compose and production
# keep those names and Compose finds the images locally. public.ecr.aws stays the fallback.
#
# Each image gets up to six attempts. After a failed attempt the script waits 30, 60, 90, 120 and
# 150 seconds in turn; CI_PREPULL_DELAY_SCALE multiplies those delays (the tests set it to 0). Every
# attempt tries ghcr.io first and then public.ecr.aws, for the images that have a mirror.
set -euo pipefail

scale="${CI_PREPULL_DELAY_SCALE:-1}"
if [[ ! "$scale" =~ ^[0-9]+$ ]]; then
  echo "::error::CI_PREPULL_DELAY_SCALE must be a whole number of seconds per step"
  exit 1
fi

if [[ ! -f docker/docker-compose.yml ]]; then
  echo "::error::docker/docker-compose.yml not found; run this script from the repository root"
  exit 1
fi

list=$(
  {
    sed -nE 's/^[[:space:]]*image:[[:space:]]*//p' docker/docker-compose.yml |
      { grep -vE '^hestia-|^prodrigestivill/|^cloudflare/' || true; }
    sed -nE 's/^FROM[[:space:]]+(--[^[:space:]]+[[:space:]]+)*([^[:space:]]+).*/\2/p' docker/*.Dockerfile |
      { grep -E '[:/]' || true; }
    grep -h '^# syntax=' docker/*.Dockerfile | sed 's/^# syntax=//' || true
  } | sort -u
)

images=()
if [[ -n "$list" ]]; then
  mapfile -t lines <<<"$list"
  for line in "${lines[@]}"; do
    if [[ -n "$line" ]]; then
      images+=("$line")
    fi
  done
fi

echo "Pre-pulling images:"
printf '%s\n' "${images[@]}"

# The names come from files in the repository and are only ever passed to docker as quoted
# arguments. A name that is not a plain image reference is refused before anything is pulled.
reference='^[a-z0-9]+([._/-][a-z0-9]+)*(:[A-Za-z0-9_][A-Za-z0-9_.-]{0,127})?(@sha256:[a-f0-9]{64})?$'
for image in "${images[@]}"; do
  if [[ ! "$image" =~ $reference ]]; then
    echo "::error::Refusing to pull '$image': not a plain image reference"
    exit 1
  fi
done

# The ghcr.io mirror of a public.ecr.aws/supabase/{name}:{tag} image, or nothing when the image has
# none. Nested paths and digest references are left alone.
mirror_of() {
  case "$1" in
    public.ecr.aws/supabase/*/* | *@*) ;;
    public.ecr.aws/supabase/*:*) echo "ghcr.io/supabase/${1#public.ecr.aws/supabase/}" ;;
  esac
}

for image in "${images[@]}"; do
  if docker image inspect "$image" >/dev/null 2>&1; then
    echo "$image is already present"
    continue
  fi
  mirror=$(mirror_of "$image")
  for attempt in 1 2 3 4 5 6; do
    if [[ -n "$mirror" ]]; then
      if docker pull "$mirror" && docker tag "$mirror" "$image"; then
        echo "Pulled $mirror and tagged it $image"
        continue 2
      fi
      echo "Pull of $mirror failed; trying $image"
    fi
    if docker pull "$image"; then
      continue 2
    fi
    if [[ "$attempt" -eq 6 ]]; then
      echo "::error::Could not pull $image after $attempt attempts"
      exit 1
    fi
    delay=$((attempt * 30 * scale))
    echo "Pull of $image failed (attempt $attempt of 6); retrying in ${delay}s"
    sleep "$delay"
  done
done
