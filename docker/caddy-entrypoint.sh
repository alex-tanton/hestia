#!/bin/sh
# The CSP's connect-src names the origin's host for WebSockets; derive it from HESTIA_ORIGIN
# so .env holds the origin exactly once. Also refuses to start without a trust list for the
# client-address header (HESTIA_TRUSTED_PROXIES).
set -eu

case "${HESTIA_ORIGIN:-}" in
  https://*) ;;
  *)
    echo "HESTIA_ORIGIN must be an https origin such as https://hestia.aberrance.app (got '${HESTIA_ORIGIN:-}')" >&2
    exit 1
    ;;
esac

# Caddy accepts an empty trust list without error and then never reads CF-Connecting-IP, so every
# visitor would share cloudflared's address and one household could trip the per-IP limit for all.
if [ -z "${HESTIA_TRUSTED_PROXIES:-}" ]; then
  echo "HESTIA_TRUSTED_PROXIES must be set to the Compose subnet, the only addresses allowed to name the client" >&2
  exit 1
fi

host="${HESTIA_ORIGIN#https://}"
HESTIA_HOST="${host%/}"
export HESTIA_HOST

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
