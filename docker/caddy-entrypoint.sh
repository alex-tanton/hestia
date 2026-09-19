#!/bin/sh
# The CSP's connect-src names the origin's host for WebSockets; derive it from HEARTH_ORIGIN
# so .env holds the origin exactly once.
set -eu

case "${HEARTH_ORIGIN:-}" in
  https://*) ;;
  *)
    echo "HEARTH_ORIGIN must be https://<machine>.<tailnet>.ts.net (got '${HEARTH_ORIGIN:-}')" >&2
    exit 1
    ;;
esac
host="${HEARTH_ORIGIN#https://}"
HEARTH_HOST="${host%/}"
export HEARTH_HOST

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
