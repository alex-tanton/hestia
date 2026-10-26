---
phase: 09-domain-network-migration-cloudflare-tunnel-ingress
plan: 02
subsystem: infra
tags: [deploy, docker-compose, caddy, cloudflared, harness-tests, ci]

requires:
  - phase: 09-domain-network-migration-cloudflare-tunnel-ingress
    provides: 09-01 removed the published host port and the network gateway, added the cloudflared service and the Caddy trust list variable
provides:
  - deploy.sh prepares the whole project before its subset start, so the one-time hestia network recreate completes
  - deploy.sh health gate and rollback run wget inside the caddy container, with no host port or host HTTP client
  - cloudflared in the fail-early supporting-services start
  - CI pre-pull never pulls cloudflare/ images
  - Caddy entrypoint refuses an empty or missing HESTIA_TRUSTED_PROXIES and names https://hestia.aberrance.app
  - scripts/caddy-entrypoint.test.mjs in test:harness
affects: [09-03, 09-04, 09-05]

plan_head_before: d15a78d4fa32761c050a8d0307b0723678a41813
plan_head_after: 52e64c30751afd65af808c7a2c493f03a05e7897

actuals:
  tokens: 4900
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Whole-project `up --no-start --no-recreate --no-build` before a subset `up`, so Compose can recreate a changed network with every container off it"
    - "Health probes run inside the container (`compose exec -T caddy wget`) when no service publishes a host port"
    - "Harness test of a container entrypoint: the real script under sh against a stub binary first on PATH"

key-files:
  created:
    - scripts/caddy-entrypoint.test.mjs
  modified:
    - scripts/deploy.sh
    - scripts/deploy.test.mjs
    - scripts/ci-prepull-images.sh
    - scripts/ci-prepull-images.test.mjs
    - docker/caddy-entrypoint.sh
    - package.json

key-decisions:
  - "Prepare step carries HESTIA_TAG=$new_tag because a first deploy has no :current images to create containers from"
  - "A bad or revoked tunnel token fails the deploy in the fail-early start with 'nothing restarted' (planner decision 2); the first deploy after a network change is the one case where containers are already stopped"
  - "The host HTTP client stub stays linked in deploy.test.mjs only to prove it is never called"

patterns-established:
  - "Commit scope for Compose, deploy and entrypoint work is docker (commitlint scope list is closed; subject limit 71 characters)"

requirements-completed: [NET-01, NET-02, NET-03, NET-04]

coverage:
  - id: D1
    description: "deploy.sh prepares the whole project (with the new image tag) after the build and before the supporting-services start, so the network recreate completes; a disposable stack proves the transition and that the subset-only path fails"
    requirement: NET-01
    verification:
      - kind: unit
        ref: "scripts/deploy.test.mjs#prepares every container and the network before the supporting services start"
        status: pass
      - kind: integration
        ref: "Task 1 verify: disposable eight-service Compose stack, subnet+gateway to subnet-only, deploy.sh's three calls, eight running, config hash changed, control fails with 'active endpoints'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Health gate and rollback check /api/health inside the caddy container; no host port or host HTTP client"
    requirement: NET-01
    verification:
      - kind: unit
        ref: "scripts/deploy.test.mjs#checks /api/health inside the caddy container, never through a host port"
        status: pass
    human_judgment: false
  - id: D3
    description: "cloudflared starts with the supporting services, before backup, migration and restart; CI pre-pull skips cloudflare/"
    requirement: NET-02
    verification:
      - kind: unit
        ref: "scripts/deploy.test.mjs#starts cloudflared with the supporting services before anything is restarted"
        status: pass
      - kind: unit
        ref: "scripts/ci-prepull-images.test.mjs#never pulls the tunnel connector, which E2E never starts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Caddy entrypoint exits 1 before Caddy starts on an empty or missing trust list or a non-https origin, naming the variable and the new origin"
    requirement: NET-03
    verification:
      - kind: unit
        ref: "scripts/caddy-entrypoint.test.mjs#refuses an empty or missing trust list, before Caddy starts"
        status: pass
      - kind: unit
        ref: "scripts/caddy-entrypoint.test.mjs#refuses an origin that is not https, before Caddy starts"
        status: pass
      - kind: integration
        ref: "Task 2 verify: real caddy:2.11.7-alpine busybox sh refuses HESTIA_TRUSTED_PROXIES= with exit 1 and an empty stdout"
        status: pass
    human_judgment: false
  - id: D5
    description: "With HESTIA_ORIGIN=https://hestia.aberrance.app the entrypoint derives HESTIA_HOST and the loaded Caddyfile yields the production CSP WebSocket host"
    requirement: NET-04
    verification:
      - kind: unit
        ref: "scripts/caddy-entrypoint.test.mjs#derives HESTIA_HOST from the origin and runs Caddy with the baked-in Caddyfile"
        status: pass
      - kind: integration
        ref: "Task 2 verify: caddy adapt in caddy:2.11.7-alpine through the real entrypoint matched connect-src 'self' wss://hestia.aberrance.app;"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-10-26
status: complete
---

# Phase 09 Plan 02: Deploy and Entrypoint for Tunnel Ingress Summary

**deploy.sh now prepares the whole Compose project before its subset start so the first deploy's network recreate completes, gates health from inside the caddy container with no host port, and starts cloudflared with the supporting services; Caddy's entrypoint refuses an empty trust list and names the real origin.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-26T17:56:08Z
- **Completed:** 2026-10-26T18:01Z
- **Tasks:** 2
- **Files modified:** 7 (1 new)

## Accomplishments

- `scripts/deploy.sh`: `HESTIA_TAG="$new_tag" compose up --no-start --no-recreate --no-build` runs after the build and before the supporting-services start, with a why-comment (network recreate, the `has active endpoints` failure of a subset-only `up`, first deploy has no `:current` images). The host health URL and every host HTTP client call are gone; `healthy_within` loops on `compose exec -T caddy wget -q -T 5 -O /dev/null http://127.0.0.1:8080/api/health` (same 60 s deadline and 2 s pause, used by the rollback too). `cloudflared` joins `db auth realtime kong backup` in the fail-early `up --detach --wait --no-recreate --no-build`. Header step summary rewritten.
- `scripts/ci-prepull-images.sh`: `^cloudflare/` added to the exclusion, header comment updated.
- `docker/caddy-entrypoint.sh`: the https error now reads `HESTIA_ORIGIN must be an https origin such as https://hestia.aberrance.app (got '<value>')`; a new guard exits 1 when `HESTIA_TRUSTED_PROXIES` is unset or empty, with a why-comment. `set -eu`, the `HESTIA_HOST` derivation and the final `exec caddy run ...` line are unchanged.
- Tests: three new `deploy.test.mjs` cases (stub now logs a `TAG` line per call), one `ci-prepull-images.test.mjs` case, and the new `scripts/caddy-entrypoint.test.mjs` (four cases), listed in `test:harness` directly after `scripts/deploy.test.mjs` (now fourteen files).

## Task Commits

1. **Task 1 (tracer): prepare, in-container health gate, tunnel start, pre-pull** - `98f357d` `fix(docker): prepare the stack first, check health in caddy, start tunnel`
2. **Task 2: entrypoint trust-list guard and harness test** - `52e64c3` `fix(docker): refuse an empty trust list, name the hestia.aberrance.app origin`

(The plan's Task 1 subject `fix(deploy): ...` was rejected by commitlint for the same reason as in 09-01: scope `deploy` is not in the closed list and the header exceeded the limits. Scope `docker` and a 71-character subject were used.)

## Messages 09-04 quotes

- Prepare step failure: `could not prepare the containers and the hestia network`
- Supporting-services failure: `the Supabase services, the backup or the tunnel are not healthy; nothing restarted`
- Entrypoint, empty trust list: `HESTIA_TRUSTED_PROXIES must be set to the Compose subnet, the only addresses allowed to name the client`
- Entrypoint, non-https origin: `HESTIA_ORIGIN must be an https origin such as https://hestia.aberrance.app (got '<value>')`

## Verification Evidence

- **Harness totals:** Task 1 files `node --test scripts/deploy.test.mjs scripts/ci-prepull-images.test.mjs`: 20 tests, 20 pass (16 existing, including all password cases unchanged, plus 4 new). Task 2: `scripts/caddy-entrypoint.test.mjs` 4/4; `pnpm test:harness` 420 tests, 420 pass, 0 fail. RED was confirmed before each GREEN (4 failing, then 2 failing). ESLint (`--max-warnings=0`) and Prettier clean on the touched tests and `package.json`; the commit hooks ran lint-staged and the workspace typechecks.
- **Network probe (Task 1 verify, Compose project `hestia-netprobe-<pid>`):** an eight-service stack named like deploy.sh's services on `caddy:2.11.7-alpine` came up on a subnet-plus-gateway network. The whole-project prepare printed `Network hestia-netprobe-22566_hestia Removing / Removed / Creating / Created`. The subset start and the `--no-deps hestia-service caddy` start then left all eight services running, the network's `com.docker.compose.config-hash` label changed, and the network held eight containers. The control (subset-only `up` back on the old file) failed with `error while removing network: network ... has active endpoints (name:"...-hestia-service-1" ... name:"...-caddy-1" ...)`, so the probe does cross a network change. `docker ps -a` and `docker network ls` show no `hestia-netprobe-*` afterwards.
- **Real-image probe, CSP (Task 2 verify):** the committed Caddyfile and the new entrypoint mounted into `caddy:2.11.7-alpine`, with a shim turning `run` into `caddy adapt`, printed JSON containing `connect-src 'self' wss://hestia.aberrance.app;`, `"client_ip_headers":["CF-Connecting-IP"]` and `"ranges":["172.16.238.0/24"]`.
- **Real-image probe, empty list:** with `HESTIA_TRUSTED_PROXIES=` the busybox `sh` run exited 1, stdout empty, stderr `HESTIA_TRUSTED_PROXIES must be set to the Compose subnet, the only addresses allowed to name the client`.
- **Tracer gate:** the Task 1 verify was run on the committed tree before expansion (`Tracer verified end-to-end - expanding`).
- Acceptance: `deploy.sh` has no host HTTP client word (`grep -w curl` finds nothing), no `tailscale|tailnet|ts.net|<machine>` in the entrypoint, `test:harness` lists `scripts/caddy-entrypoint.test.mjs` immediately after `scripts/deploy.test.mjs`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 commit subject adapted to commitlint**
- **Found during:** Task 1 commit
- **Issue:** `fix(deploy): prepare the whole stack first, check health inside the caddy container and start the tunnel before restarting` failed commitlint (scope `deploy` not allowed, header over 100 characters, subject over 71). Hooks are not bypassed.
- **Fix:** Committed as `fix(docker): prepare the stack first, check health in caddy, start tunnel`.
- **Commit:** 98f357d

**2. [Rule 3 - Blocking] Prettier reformatted `deploy.test.mjs` after the first verify run**
- **Found during:** Task 1 verify
- **Issue:** the hand-written new describe block failed `prettier --check`.
- **Fix:** ran `prettier --write`; the verify then passed in full.
- **Commit:** 98f357d

**Total deviations:** 2 auto-fixed (both Rule 3). **Impact:** none on repository behavior; only the Task 1 commit subject differs from the plan text.

## Issues Encountered

None. The sandbox's Docker daemon and the cached `caddy:2.11.7-alpine` image were enough for both probes; no CA workaround or image pulls were needed.

## Known Stubs

None.

## Threat Flags

None. The plan's threat register (T-09-08 to T-09-12, T-09-26) covers the changed surface.

## Next Phase Readiness

- 09-03 (test fixtures on the new origin) is unblocked.
- 09-04's runbook should state: the first deploy after the network change logs `Network hestia Removing/Removed/Creating/Created` in the prepare step and briefly stops the whole stack; the recovery for a half-done recreate is `hestia-compose down` (volumes kept) and a re-run; and a missing or revoked `CLOUDFLARE_TUNNEL_TOKEN` fails the deploy in the fail-early start (on the very first deploy after a network change `hestia-service` and `caddy` are already stopped at that point).

## Self-Check: PASSED

- Files exist: `scripts/caddy-entrypoint.test.mjs`, `scripts/deploy.sh`, `scripts/deploy.test.mjs`, `scripts/ci-prepull-images.sh`, `scripts/ci-prepull-images.test.mjs`, `docker/caddy-entrypoint.sh`.
- Commits `98f357d` and `52e64c3` are ancestors of HEAD; `git rev-list --count d15a78d..HEAD` before this SUMMARY commit: 2.
