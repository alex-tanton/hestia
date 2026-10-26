#!/bin/sh
# The CSP's connect-src names the origin's host for WebSockets; derive it from HESTIA_ORIGIN
# so .env holds the origin exactly once.
set -eu

case "${HESTIA_ORIGIN:-}" in
  https://*) ;;
  *)
    echo "HESTIA_ORIGIN must be https://<machine>.<tailnet>.ts.net (got '${HESTIA_ORIGIN:-}')" >&2
    exit 1
    ;;
esac
host="${HESTIA_ORIGIN#https://}"
HESTIA_HOST="${host%/}"
export HESTIA_HOST

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
